// football-data.org v4 API client.
//
// - Authenticates with the `X-Auth-Token` header from process.env.FOOTBALL_DATA_API_KEY.
// - Serializes all requests through a single queue and enforces a minimum spacing
//   so we stay under the free-tier limit of 10 requests/minute.
// - Retries on HTTP 429 (Too Many Requests) with exponential backoff, honoring the
//   server's `Retry-After` header when present.
//
// No secret is hard-coded here — the key must be supplied via the environment.

import type { FdMatchesResponse, FdStandingsResponse } from './types.ts'

const BASE_URL = 'https://api.football-data.org/v4'
const COMPETITION = 'WC'
const SEASON = '2026'

/** Free tier: ≤10 req/min. Keep a safety margin with a 7s minimum gap (~8.5/min). */
const MIN_INTERVAL_MS = 7_000
/** Max attempts on a 429 before giving up. */
const MAX_RETRIES = 5
/** Base backoff used when no Retry-After header is supplied. */
const BASE_BACKOFF_MS = 10_000

export interface FootballDataClientOptions {
  apiKey?: string
  /** Injectable for tests; defaults to global fetch. */
  fetchImpl?: typeof fetch
  /** Injectable delay (ms) — overridable in tests to avoid real waits. */
  sleep?: (ms: number) => Promise<void>
  minIntervalMs?: number
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms))

export class FootballDataClient {
  private readonly apiKey: string
  private readonly fetchImpl: typeof fetch
  private readonly sleep: (ms: number) => Promise<void>
  private readonly minIntervalMs: number
  /** Tail of the serialized request chain — ensures one request at a time. */
  private chain: Promise<unknown> = Promise.resolve()
  private lastRequestAt = 0

  constructor(opts: FootballDataClientOptions = {}) {
    const apiKey = opts.apiKey ?? process.env.FOOTBALL_DATA_API_KEY
    if (!apiKey) {
      throw new Error(
        'FOOTBALL_DATA_API_KEY is not set. Supply it via the environment (GitHub Secret / .env).',
      )
    }
    this.apiKey = apiKey
    this.fetchImpl = opts.fetchImpl ?? fetch
    this.sleep = opts.sleep ?? defaultSleep
    this.minIntervalMs = opts.minIntervalMs ?? MIN_INTERVAL_MS
  }

  /** GET WC matches for the configured season. */
  async getMatches(): Promise<FdMatchesResponse> {
    return this.request<FdMatchesResponse>(`/competitions/${COMPETITION}/matches?season=${SEASON}`)
  }

  /**
   * GET only the FINISHED WC matches for the season.
   *
   * The free tier can publish a freshly-finished match's full-time score on this
   * status-filtered endpoint BEFORE that score propagates to the unfiltered
   * `getMatches()` list (observed 2026-06-11: the main list showed FINISHED with a
   * `null` score while this query already returned the real scoreline). The caller
   * overlays these authoritative scores so grading isn't delayed a polling cycle.
   */
  async getFinishedMatches(): Promise<FdMatchesResponse> {
    return this.request<FdMatchesResponse>(
      `/competitions/${COMPETITION}/matches?season=${SEASON}&status=FINISHED`,
    )
  }

  /** GET WC standings for the configured season. */
  async getStandings(): Promise<FdStandingsResponse> {
    return this.request<FdStandingsResponse>(
      `/competitions/${COMPETITION}/standings?season=${SEASON}`,
    )
  }

  /** Serialize the request onto the chain so only one is in flight at a time. */
  private request<T>(path: string): Promise<T> {
    const run = this.chain.then(() => this.execute<T>(path))
    // Keep the chain alive even if a request rejects.
    this.chain = run.catch(() => undefined)
    return run
  }

  private async execute<T>(path: string): Promise<T> {
    await this.throttle()
    const url = `${BASE_URL}${path}`

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const res = await this.fetchImpl(url, {
        headers: { 'X-Auth-Token': this.apiKey },
      })
      this.lastRequestAt = Date.now()

      if (res.status === 429) {
        if (attempt === MAX_RETRIES) {
          throw new Error(`football-data 429 after ${MAX_RETRIES} retries: ${path}`)
        }
        const retryAfter = res.headers.get('Retry-After')
        const waitMs = retryAfter ? Number(retryAfter) * 1000 : BASE_BACKOFF_MS * 2 ** attempt
        await this.sleep(waitMs)
        await this.throttle()
        continue
      }

      if (!res.ok) {
        const body = await res.text().catch(() => '')
        throw new Error(`football-data ${res.status} for ${path}: ${body.slice(0, 200)}`)
      }

      return (await res.json()) as T
    }

    // Unreachable — the loop either returns or throws.
    throw new Error(`football-data request failed: ${path}`)
  }

  /** Enforce the minimum spacing between requests. */
  private async throttle(): Promise<void> {
    const elapsed = Date.now() - this.lastRequestAt
    if (this.lastRequestAt !== 0 && elapsed < this.minIntervalMs) {
      await this.sleep(this.minIntervalMs - elapsed)
    }
  }
}

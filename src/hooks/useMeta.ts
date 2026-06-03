/**
 * useMeta — live tournament metadata (`config/meta`) from Firestore.
 *
 * Used by the Fixtures page for the "updated N min ago" freshness indicator,
 * sourced from `MetaConfig.lastIngestAt` (the canonical field in
 * `src/shared/types.ts`; the spec's prose calls it `lastIngestRun`).
 *
 * The listener is cleaned up on unmount.
 */
import { useEffect, useState } from 'react'
import { onSnapshot } from 'firebase/firestore'
import { metaConfigDoc } from '../firebase/db'
import type { MetaConfig } from '../shared/types'

export interface UseMetaResult {
  /** `config/meta`, or null when the doc is absent (pre-seeding). */
  meta: MetaConfig | null
  loading: boolean
  error: Error | null
}

export function useMeta(): UseMetaResult {
  const [meta, setMeta] = useState<MetaConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const unsubscribe = onSnapshot(
      metaConfigDoc(),
      (snap) => {
        setMeta(snap.exists() ? snap.data() : null)
        setError(null)
        setLoading(false)
      },
      (err) => {
        setError(err)
        setLoading(false)
      },
    )
    return unsubscribe
  }, [])

  return { meta, loading, error }
}

export default useMeta

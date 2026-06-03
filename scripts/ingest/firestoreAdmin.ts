// firebase-admin initialization for the ingestion job.
//
// Credentials are loaded, in priority order, from:
//   1. process.env.FIREBASE_SERVICE_ACCOUNT — the full service-account JSON as a
//      string (this is what the GitHub Actions secret provides).
//   2. process.env.GOOGLE_APPLICATION_CREDENTIALS — a path to a JSON key file.
//   3. A local, gitignored ./serviceAccount.json next to this script (dev only).
//
// NO secret is ever hard-coded here. `dotenv` loads a local, gitignored `.env`
// (with FOOTBALL_DATA_API_KEY / FIREBASE_PROJECT_ID / a key path) for local runs.
//
// See ./README.md for exactly how to supply these for local + CI runs.

import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { config as loadDotenv } from 'dotenv'
import admin from 'firebase-admin'
import type { Firestore } from 'firebase-admin/firestore'

loadDotenv()

const __dirname = dirname(fileURLToPath(import.meta.url))

interface ServiceAccountJson {
  project_id?: string
  client_email?: string
  private_key?: string
}

/** Resolve the service-account credential from env/secret/local file. */
function resolveCredential(): {
  credential: admin.credential.Credential
  projectId: string | undefined
} {
  const inline = process.env.FIREBASE_SERVICE_ACCOUNT
  if (inline && inline.trim().length > 0) {
    const parsed = JSON.parse(inline) as ServiceAccountJson
    return {
      credential: admin.credential.cert(parsed as admin.ServiceAccount),
      projectId: parsed.project_id,
    }
  }

  const keyPath =
    process.env.GOOGLE_APPLICATION_CREDENTIALS ?? resolve(__dirname, 'serviceAccount.json')

  if (existsSync(keyPath)) {
    const parsed = JSON.parse(readFileSync(keyPath, 'utf8')) as ServiceAccountJson
    return {
      credential: admin.credential.cert(parsed as admin.ServiceAccount),
      projectId: parsed.project_id,
    }
  }

  throw new Error(
    'No Firebase credentials found. Set FIREBASE_SERVICE_ACCOUNT (JSON string), ' +
      'GOOGLE_APPLICATION_CREDENTIALS (path), or place a gitignored serviceAccount.json ' +
      'in scripts/ingest/. See scripts/ingest/README.md.',
  )
}

let cachedDb: Firestore | undefined

/** Lazily initialize firebase-admin once and return the Firestore instance. */
export function getDb(): Firestore {
  if (cachedDb) return cachedDb

  if (admin.apps.length === 0) {
    const { credential, projectId } = resolveCredential()
    admin.initializeApp({
      credential,
      projectId: process.env.FIREBASE_PROJECT_ID ?? projectId,
    })
  }

  cachedDb = admin.firestore()
  return cachedDb
}

/** Re-export the admin namespace for callers needing Timestamp / FieldValue. */
export { admin }

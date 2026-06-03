/**
 * Short, unguessable invite-code generator (ticket 012).
 *
 * Produces a Crockford-base32-ish token using the platform CSPRNG. The code backs a
 * nicer invite link; approval is still required, so it is convenience, not a secret gate.
 */
const ALPHABET = 'ABCDEFGHJKMNPQRSTVWXYZ23456789'

export function generateInviteCode(length = 8): string {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  let out = ''
  for (let i = 0; i < length; i += 1) {
    out += ALPHABET[bytes[i] % ALPHABET.length]
  }
  return out
}

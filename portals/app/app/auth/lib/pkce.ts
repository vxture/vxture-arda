/**
 * PKCE (S256) plus state/nonce helpers. The verifier and nonce live only in the
 * server-side authreq record (Redis); the browser never sees them. The standard
 * requires code_challenge_method=S256 and rejects plain.
 */
import { createHash, randomBytes } from "node:crypto";

function base64url(buf: Buffer): string {
  return buf.toString("base64url");
}

/** A high-entropy opaque token (state, nonce, or RP session id). */
export function randomToken(bytes = 32): string {
  return base64url(randomBytes(bytes));
}

/** PKCE code_verifier: 43-128 chars of unreserved characters (base64url is). */
export function createCodeVerifier(): string {
  return base64url(randomBytes(32));
}

/** code_challenge = BASE64URL(SHA256(code_verifier)). */
export function challengeFromVerifier(verifier: string): string {
  return base64url(createHash("sha256").update(verifier).digest());
}

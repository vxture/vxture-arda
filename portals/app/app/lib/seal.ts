/**
 * App-layer symmetric encryption for sensitive persisted values (data-130 §2.1).
 *
 * The ONLY consumer today is DataSource.connectionConfig: credentials are
 * sealed before persistence so the DB never sees plaintext. The ciphertext
 * and its metadata serialize into the existing Json column - no side columns
 * for iv/keyId (data-130 §1).
 *
 * Key: DATA_ENCRYPTION_KEY env (base64, 32 bytes -> AES-256-GCM). Runtime
 * secret per data-130 §3.4 - never committed; generate with
 * `openssl rand -base64 32`. A missing/malformed key throws loudly: storing
 * plaintext as a fallback is never acceptable.
 */

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export interface SealedSecret {
  v: 1;
  alg: "aes-256-gcm";
  iv: string; // base64
  tag: string; // base64
  ct: string; // base64
}

function key(): Buffer {
  const raw = process.env.DATA_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error("DATA_ENCRYPTION_KEY is not set; refusing to store credentials in plaintext");
  }
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== 32) {
    throw new Error("DATA_ENCRYPTION_KEY must be 32 bytes base64 (openssl rand -base64 32)");
  }
  return buf;
}

export function seal(value: unknown): SealedSecret {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const plaintext = Buffer.from(JSON.stringify(value), "utf8");
  const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return {
    v: 1,
    alg: "aes-256-gcm",
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    ct: ct.toString("base64"),
  };
}

export function unseal<T = unknown>(sealed: SealedSecret): T {
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(sealed.iv, "base64"));
  decipher.setAuthTag(Buffer.from(sealed.tag, "base64"));
  const pt = Buffer.concat([decipher.update(Buffer.from(sealed.ct, "base64")), decipher.final()]);
  return JSON.parse(pt.toString("utf8")) as T;
}

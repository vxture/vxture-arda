/**
 * Server-side OIDC RP session store backed by Redis. Four key families:
 *   authreq:<state>  short-lived login->callback handshake (verifier, nonce).
 *   rpsess:<rpsid>   verified IDENTITY CLAIMS only.
 *   rptok:<rpsid>    OIDC token bundle (this server only; never leaves it).
 *   sid:<sid>        SET of rpsid for back-channel logout (one central session
 *                    can map to several RP sessions).
 * The browser only ever holds an opaque cookie pointing at <rpsid>.
 */
import Redis from "ioredis";
import { randomToken } from "./pkce";
import { setTimeout as delay } from "node:timers/promises";
import type { OidcConfig } from "./config";
import type { ArdaClaim } from "../../entitlement/types";
import { eventChannel, sessionTarget } from "../../events/bus";

export interface AuthRequest {
  codeVerifier: string;
  nonce: string;
  returnTo: string;
}

/** Identity subset stored per RP session. Sourced from the verified
 * access_token. Human identifiers: display_name (name), username
 * (preferred_username), email, phone, avatar_url (picture). email/phone are
 * present only when the account has them and the email/phone scopes were
 * granted; avatar_url is empty until the platform emits the picture claim, and
 * the UI falls back to initials. Tenant context uses org/workspace/roles (the
 * live claim names). */
export interface IdentityClaims {
  /** Server status schedule only; never a renewable RP session lifetime. */
  central_next_check_at?: number;
  sub: string;
  sid: string;
  display_name: string;
  username: string;
  avatar_url: string;
  email: string;
  email_verified: boolean;
  phone: string;
  phone_verified: boolean;
  account_status: string;
  active_org: string;
  active_org_type: string;
  active_org_name: string;
  active_workspace: string;
  active_workspace_name: string;
  roles: string[];
  user_type: string;
  exp: number;
  /** Populated when the access token carries the "arda" scope claim.
   *  Null for local dev without a real IdP or when the claim is absent. */
  arda_claim: ArdaClaim | null;
}

export interface TokenBundle {
  access_token: string;
  refresh_token: string;
  access_exp: number;
  id_claims: Record<string, unknown>;
}

let client: Redis | null = null;

export async function closeSessionStore(): Promise<void> {
  const current = client; client = null;
  if (current) await current.quit();
}

function redis(cfg: OidcConfig): Redis {
  if (!client) {
    client = new Redis(cfg.redisUrl, { maxRetriesPerRequest: 2, lazyConnect: false });
  }
  return client;
}

const authReqKey = (state: string) => `authreq:${state}`;
const sessKey = (rpsid: string) => `rpsess:${rpsid}`;
const tokKey = (rpsid: string) => `rptok:${rpsid}`;
const sidKey = (sid: string) => `sid:${sid}`;

/** Serialize central checks and rotating single-use refresh tokens across replicas. */
export async function withSessionLock<T>(cfg: OidcConfig, rpsid: string, work: () => Promise<T>): Promise<T> {
  const key = `rplock:${rpsid}`;
  const owner = randomToken();
  // Concurrent session/entitlement requests must wait for the same rotation,
  // then re-read its result inside work(), never reuse a single-use refresh.
  const deadline = Date.now() + 12_000;
  while (!(await redis(cfg).set(key, owner, "PX", 60_000, "NX"))) {
    if (Date.now() >= deadline) throw new Error("session_resolution_busy");
    await delay(50);
  }
  try { return await work(); }
  finally {
    await redis(cfg).eval("if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end", 1, key, owner);
  }
}

const AUTHREQ_TTL = 600;

export async function putAuthRequest(cfg: OidcConfig, state: string, req: AuthRequest): Promise<void> {
  await redis(cfg).set(authReqKey(state), JSON.stringify(req), "EX", AUTHREQ_TTL);
}

/** Atomically fetch and delete the authreq (single-use, prevents replay). */
export async function takeAuthRequest(cfg: OidcConfig, state: string): Promise<AuthRequest | null> {
  const raw = await redis(cfg).getdel(authReqKey(state));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthRequest;
  } catch {
    return null;
  }
}

/** Create an RP session and index it under its central sid. Returns the rpsid. */
export async function createSession(
  cfg: OidcConfig,
  identity: IdentityClaims,
  tokens: TokenBundle,
): Promise<string> {
  const rpsid = randomToken();
  const ttl = cfg.sessionTtlSeconds;
  await redis(cfg)
    .multi()
    .set(sessKey(rpsid), JSON.stringify(identity), "EX", ttl)
    .set(tokKey(rpsid), JSON.stringify(tokens), "EX", ttl)
    .sadd(sidKey(identity.sid), rpsid)
    .expire(sidKey(identity.sid), ttl)
    .exec();
  return rpsid;
}

export async function getIdentity(cfg: OidcConfig, rpsid: string): Promise<IdentityClaims | null> {
  const raw = await redis(cfg).get(sessKey(rpsid));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as IdentityClaims;
  } catch {
    return null;
  }
}

export async function getTokens(cfg: OidcConfig, rpsid: string): Promise<TokenBundle | null> {
  const raw = await redis(cfg).get(tokKey(rpsid));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as TokenBundle;
  } catch {
    return null;
  }
}

/** Replace the token bundle after a refresh, preserving the session TTL. */
export async function putTokens(cfg: OidcConfig, rpsid: string, tokens: TokenBundle): Promise<void> {
  const saved = await redis(cfg).set(tokKey(rpsid), JSON.stringify(tokens), "KEEPTTL", "XX");
  if (!saved) throw new Error("session_ended_during_update");
}

/** Commit a refresh together and never resurrect a concurrently logged-out session. */
export async function putRotatedSession(cfg: OidcConfig, rpsid: string,
  identity: IdentityClaims, tokens: TokenBundle): Promise<void> {
  const saved = await redis(cfg).eval(
    "if redis.call('exists', KEYS[1]) == 0 or redis.call('exists', KEYS[2]) == 0 then return 0 end "
    + "redis.call('set', KEYS[1], ARGV[1], 'KEEPTTL', 'XX'); "
    + "redis.call('set', KEYS[2], ARGV[2], 'KEEPTTL', 'XX'); "
    + "redis.call('publish',ARGV[3],ARGV[4]); return 1",
    2, sessKey(rpsid), tokKey(rpsid), JSON.stringify(identity), JSON.stringify(tokens),
    eventChannel(cfg.clientId), JSON.stringify({ target: sessionTarget(rpsid), kind: "refresh" }));
  if (saved !== 1) throw new Error("session_ended_during_update");
}

/** Replace the stored identity claims after a refresh, preserving the session
 * TTL. The sid (back-channel logout index) must be unchanged by the caller. */
export async function putIdentity(cfg: OidcConfig, rpsid: string, identity: IdentityClaims): Promise<void> {
  const saved = await redis(cfg).set(sessKey(rpsid), JSON.stringify(identity), "KEEPTTL", "XX");
  if (!saved) throw new Error("session_ended_during_update");
}

/** Destroy a single RP session and drop it from its sid index. */
export async function destroySession(cfg: OidcConfig, rpsid: string): Promise<void> {
  await redis(cfg).eval(
    "local raw=redis.call('get',KEYS[1]); "
    + "if raw then local ok,s=pcall(cjson.decode,raw); "
    + "if ok and s.sid then redis.call('srem','sid:'..s.sid,ARGV[1]) end end; "
    + "redis.call('del',KEYS[1],KEYS[2]); redis.call('publish',ARGV[2],ARGV[3]); return 1",
    2, sessKey(rpsid), tokKey(rpsid), rpsid, eventChannel(cfg.clientId),
    JSON.stringify({ target: sessionTarget(rpsid), kind: "revoked" }));
}

/** Destroy every RP session for a central sid (back-channel logout). */
export async function destroyBySid(cfg: OidcConfig, sid: string): Promise<number> {
  return Number(await redis(cfg).eval(
    "local ids=redis.call('smembers',KEYS[1]); for _,id in ipairs(ids) do "
    + "redis.call('del','rpsess:'..id,'rptok:'..id); "
    + "redis.call('publish',ARGV[1],cjson.encode({target='session:'..id,kind='revoked'})); end; "
    + "redis.call('del',KEYS[1]); return #ids",
    1, sidKey(sid), eventChannel(cfg.clientId)));
}

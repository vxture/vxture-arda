import type { ProductAccess, ProductRole, ProductPermission } from "./policy";
import { PRODUCT_ROLES, PERMISSIONS, permits } from "./policy";
import { prisma } from "../lib/db";
import { tryPublishWorkspaceRevision } from "../events/outbox";

export interface RoleSql {
  $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
  $executeRawUnsafe(query: string, ...values: unknown[]): Promise<number>;
}
export interface RoleDatabase extends RoleSql {
  $transaction<T>(work: (tx: RoleSql) => Promise<T>): Promise<T>;
}
export interface MemberIdentity { workspaceId: string; sub: string; roles: readonly string[] }
const SUBJECT = /^usr_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function validate(identity: MemberIdentity) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identity.workspaceId) || !SUBJECT.test(identity.sub)) throw new Error("role_identity_invalid");
}
async function lock(tx: RoleSql, ws: string) {
  await tx.$queryRawUnsafe("SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended($1,0))", `arda:roles:${ws}`);
}
async function read(tx: RoleSql, identity: MemberIdentity): Promise<ProductAccess> {
  const rows = await tx.$queryRawUnsafe<{ role_code: string; perm_code: string | null }[]>(`
    SELECT r.role_code,p.perm_code FROM local_authz.member m
    JOIN local_authz.member_role mr ON mr.member_id=m.id
    JOIN local_authz.role r ON r.id=mr.role_id
    LEFT JOIN local_authz.role_permission rp ON rp.role_id=r.id
    LEFT JOIN local_authz.permission p ON p.id=rp.permission_id
    WHERE m.workspace_id=$1::uuid AND m.sub=$2 AND m.status='active'
      AND (r.role_code<>'owner' OR EXISTS(SELECT 1 FROM local_authz.owner_anchor o
        WHERE o.workspace_id=m.workspace_id AND o.member_id=m.id))`, identity.workspaceId, identity.sub);
  const roles = [...new Set(rows.map(r => r.role_code).filter((r): r is ProductRole => PRODUCT_ROLES.includes(r as ProductRole)))];
  const permissions = [...new Set(rows.filter(r => roles.includes(r.role_code as ProductRole))
    .map(r => r.perm_code).filter((p): p is ProductPermission => PERMISSIONS.includes(p as ProductPermission)))];
  return { roles, permissions };
}
async function audit(tx: RoleSql, ws: string, actor: string, target: string, action: string,
  before: readonly string[], after: readonly string[]) {
  await tx.$executeRawUnsafe(`INSERT INTO local_authz.role_audit
    (workspace_id,actor_sub,target_sub,action,roles_before,roles_after)
    VALUES ($1::uuid,$2,$3,$4,$5::jsonb,$6::jsonb)`, ws, actor, target, action, JSON.stringify(before), JSON.stringify(after));
}
async function assign(tx: RoleSql, member: string, roles: readonly ProductRole[]) {
  await tx.$executeRawUnsafe("DELETE FROM local_authz.member_role WHERE member_id=$1::uuid", member);
  for (const role of roles) {
    const n = await tx.$executeRawUnsafe(`INSERT INTO local_authz.member_role(member_id,role_id)
      SELECT $1::uuid,id FROM local_authz.role WHERE role_code=$2 ON CONFLICT DO NOTHING`, member, role);
    if (n !== 1) throw new Error("role_catalog_missing");
  }
}
/** Caller MUST first verify current platform assignment and coverage. Existing
 * members (including deliberately roleless/inactive members) are never defaulted. */
export async function resolveProductAccess(identity: MemberIdentity, db?: RoleDatabase): Promise<ProductAccess> {
  validate(identity);
  const database = db ?? await databaseClient();
  const existing = await database.$queryRawUnsafe<{id:string}[]>("SELECT id FROM local_authz.member WHERE workspace_id=$1::uuid AND sub=$2",identity.workspaceId,identity.sub);
  if(existing.length) return read(database,identity);
  return database.$transaction(async tx => {
    await lock(tx, identity.workspaceId);
    const created = await tx.$queryRawUnsafe<{id: string}[]>(`INSERT INTO local_authz.member(workspace_id,sub)
      VALUES($1::uuid,$2) ON CONFLICT(workspace_id,sub) DO NOTHING RETURNING id`, identity.workspaceId, identity.sub);
    if (created.length) {
      let role: ProductRole = "readonly";
      // A single audited bootstrap creates the product owner. This does not
      // permanently make platform governance claims a product-role bypass.
      if (identity.roles.some(r => r.trim().toLowerCase() === "workspace:owner")) {
        const claimed = await tx.$queryRawUnsafe<{member_id:string}[]>(`INSERT INTO local_authz.owner_anchor(workspace_id,member_id)
          VALUES($1::uuid,$2::uuid) ON CONFLICT(workspace_id) DO NOTHING RETURNING member_id`, identity.workspaceId, created[0].id);
        if (claimed.length) role = "owner";
      }
      await assign(tx, created[0].id, [role]);
      await audit(tx, identity.workspaceId, identity.sub, identity.sub, "member.initialize", [], [role]);
    }
    return read(tx, identity);
  });
}
/** Explicit member role edits; no seat creation. Recheck target eligibility
 * inside the serialized transaction to reject removed roster targets. */
export async function changeMemberRoles(identity: MemberIdentity, target: string, roles: ProductRole[],
  eligible: () => Promise<boolean>, db?: RoleDatabase): Promise<void> {
  validate(identity);
  validate({ ...identity, sub: target });
  if (new Set(roles).size !== roles.length || roles.some(r => !PRODUCT_ROLES.includes(r) || r === "owner")) throw new Error("role_change_invalid");
  const database = db ?? await databaseClient();
  await database.$transaction(async tx => {
    await lock(tx, identity.workspaceId);
    const actor = await read(tx, identity);
    if (!permits(actor, "members.manage")) throw new Error("role_forbidden");
    const old = await read(tx, { ...identity, sub: target });
    if (old.roles.includes("owner")) throw new Error("owner_transfer_required");
    if (!actor.roles.includes("owner") && (old.roles.includes("administrator") || roles.includes("administrator"))) throw new Error("role_forbidden");
    if (!await eligible()) throw new Error("target_not_authorized");
    const rows = await tx.$queryRawUnsafe<{id:string;status:string}[]>(`INSERT INTO local_authz.member(workspace_id,sub)
      VALUES($1::uuid,$2) ON CONFLICT(workspace_id,sub) DO UPDATE SET updated_at=local_authz.member.updated_at
      RETURNING id,status`, identity.workspaceId,target);
    if (rows[0].status !== "active") throw new Error("member_inactive");
    await assign(tx,rows[0].id,roles);
    await audit(tx,identity.workspaceId,identity.sub,target,"member.roles",old.roles,roles);
    await invalidate(tx,identity.workspaceId);
  });
  if (!db) await publish(identity.workspaceId);
}
export async function transferOwnership(identity: MemberIdentity, target: string,
  eligible: () => Promise<boolean>, db?: RoleDatabase): Promise<void> {
  validate(identity);
  validate({ ...identity, sub: target });
  if (target === identity.sub) throw new Error("owner_transfer_invalid");
  const database = db ?? await databaseClient();
  await database.$transaction(async tx => {
    await lock(tx,identity.workspaceId);
    const actor = await read(tx,identity);
    if (!actor.roles.includes("owner") || !permits(actor,"ownership.transfer")) throw new Error("role_forbidden");
    if (!await eligible()) throw new Error("target_not_authorized");
    const members = await tx.$queryRawUnsafe<{id:string;sub:string;status:string}[]>(
      "SELECT id,sub,status FROM local_authz.member WHERE workspace_id=$1::uuid AND sub IN ($2,$3)",identity.workspaceId,identity.sub,target);
    const from = members.find(m=>m.sub===identity.sub), to = members.find(m=>m.sub===target);
    if (!from || !to || to.status!=="active") throw new Error("target_member_required");
    const before = await read(tx,{...identity,sub:target});
    await tx.$executeRawUnsafe("DELETE FROM local_authz.owner_anchor WHERE workspace_id=$1::uuid",identity.workspaceId);
    await tx.$executeRawUnsafe("INSERT INTO local_authz.owner_anchor(workspace_id,member_id) VALUES($1::uuid,$2::uuid)",identity.workspaceId,to.id);
    await assign(tx,from.id,["administrator"]); await assign(tx,to.id,["owner"]);
    await audit(tx,identity.workspaceId,identity.sub,identity.sub,"ownership.release",actor.roles,["administrator"]);
    await audit(tx,identity.workspaceId,identity.sub,target,"ownership.accept",before.roles,["owner"]);
    await invalidate(tx,identity.workspaceId);
  });
  if (!db) await publish(identity.workspaceId);
}
export async function listLocalRoles(ws: string): Promise<{sub:string;status:string;roles:string[]}[]> {
  return (await databaseClient()).$queryRawUnsafe(`SELECT m.sub,m.status,
    coalesce(array_agg(r.role_code) FILTER(WHERE r.role_code IS NOT NULL),'{}') AS roles
    FROM local_authz.member m LEFT JOIN local_authz.member_role mr ON mr.member_id=m.id
    LEFT JOIN local_authz.role r ON r.id=mr.role_id WHERE m.workspace_id=$1::uuid
    GROUP BY m.id ORDER BY m.sub`, ws);
}
async function databaseClient(): Promise<RoleDatabase> { return prisma as unknown as RoleDatabase; }
async function publish(ws:string) { await tryPublishWorkspaceRevision(ws); }
async function invalidate(tx:RoleSql,ws:string) {
  await tx.$executeRawUnsafe(`INSERT INTO vx_provision.access_revision("workspaceId",generation,"publishedGeneration","updatedAt")
    VALUES($1,1,0,now()) ON CONFLICT("workspaceId") DO UPDATE SET generation=access_revision.generation+1,"updatedAt"=now()`,ws);
}

export async function readProductAccess(identity: MemberIdentity): Promise<ProductAccess> {
  validate(identity); return read(await databaseClient(),identity);
}

/** Explicit recovery for an unowned product workspace. Trusted platform owner
 * may adopt their own active membership once; never overwrites an owner. */
export async function bootstrapOwnership(identity:MemberIdentity,eligible:()=>Promise<boolean>,db?:RoleDatabase) {
 validate(identity);
 if(!identity.roles.includes("workspace:owner")) throw new Error("role_forbidden");
 const database=db??await databaseClient();
 await database.$transaction(async tx=>{
  await lock(tx,identity.workspaceId);
  if(!await eligible()) throw new Error("target_not_authorized");
  const before=await read(tx,identity);
  const members=await tx.$queryRawUnsafe<{id:string;status:string}[]>(`INSERT INTO local_authz.member(workspace_id,sub)
   VALUES($1::uuid,$2) ON CONFLICT(workspace_id,sub) DO UPDATE SET updated_at=local_authz.member.updated_at RETURNING id,status`,identity.workspaceId,identity.sub);
  if(members[0].status!=="active") throw new Error("member_inactive");
  const claimed=await tx.$queryRawUnsafe<{member_id:string}[]>(`INSERT INTO local_authz.owner_anchor(workspace_id,member_id)
   VALUES($1::uuid,$2::uuid) ON CONFLICT(workspace_id) DO NOTHING RETURNING member_id`,identity.workspaceId,members[0].id);
  if(!claimed.length) throw new Error("owner_already_initialized");
  await assign(tx,members[0].id,["owner"]);
  await audit(tx,identity.workspaceId,identity.sub,identity.sub,"ownership.bootstrap",before.roles,["owner"]);
  await invalidate(tx,identity.workspaceId);
 });
 if(!db) await publish(identity.workspaceId);
}

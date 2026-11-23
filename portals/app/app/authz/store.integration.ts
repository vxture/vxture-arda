import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { bootstrapOwnership, resolveProductAccess, changeMemberRoles, transferOwnership, type RoleDatabase } from "./store";
import { permits } from "./policy";

/** Exercises the actual transactions against isolated PostgreSQL, never seats. */
export async function verifyRoleTransactions(db: RoleDatabase) {
 const workspaceId=randomUUID();
 const identity=(roles:string[]=[])=>({workspaceId,sub:`usr_${randomUUID()}`,roles});
 const owner=identity(["workspace:owner"]), reader=identity(), admin=identity();
 const yes=async()=>true;
 const parallel=await Promise.all(Array.from({length:8},()=>resolveProductAccess(reader,db)));
 for(const access of parallel) {
  assert.deepEqual(access.roles,["readonly"]);
  assert.equal(permits(access,"data.read"),true);
  for(const permission of ["data.write","data.export","ai.use","service.publish","members.manage"] as const)
   assert.equal(permits(access,permission),false);
 }
 assert.deepEqual((await resolveProductAccess(owner,db)).roles,["owner"]);
 assert.deepEqual((await resolveProductAccess(admin,db)).roles,["readonly"]);
 await assert.rejects(changeMemberRoles(reader,admin.sub,["member"],yes,db),/role_forbidden/);
 await changeMemberRoles(owner,admin.sub,["administrator"],yes,db);
 await assert.rejects(changeMemberRoles(admin,admin.sub,["member"],yes,db),/role_forbidden/);
 await assert.rejects(changeMemberRoles(admin,reader.sub,["administrator"],yes,db),/role_forbidden/);
 await assert.rejects(changeMemberRoles(owner,owner.sub,[],yes,db),/owner_transfer_required/);
 await assert.rejects(changeMemberRoles(owner,reader.sub,["owner"],yes,db),/role_change_invalid/);
 await assert.rejects(changeMemberRoles(owner,reader.sub,["member"],async()=>false,db),/target_not_authorized/);
 assert.deepEqual((await resolveProductAccess(reader,db)).roles,["readonly"]);
 await changeMemberRoles(owner,reader.sub,[],yes,db);
 assert.deepEqual((await resolveProductAccess({...reader,roles:["workspace:owner"]},db)).roles,[]);
 const audits=await db.$queryRawUnsafe<{n:bigint}[]>("SELECT count(*) AS n FROM local_authz.role_audit WHERE workspace_id=$1::uuid AND target_sub=$2 AND action='member.initialize'",workspaceId,reader.sub);
 assert.equal(Number(audits[0].n),1,"concurrent initialization audits once");
 await transferOwnership(owner,admin.sub,yes,db);
 assert.deepEqual((await resolveProductAccess(owner,db)).roles,["administrator"]);
 assert.deepEqual((await resolveProductAccess(admin,db)).roles,["owner"]);
 await assert.rejects(transferOwnership(owner,reader.sub,yes,db),/role_forbidden/);
 const anchors=await db.$queryRawUnsafe<{n:bigint}[]>("SELECT count(*) AS n FROM local_authz.owner_anchor WHERE workspace_id=$1::uuid",workspaceId);
 assert.equal(Number(anchors[0].n),1);
 const other={...owner,workspaceId:randomUUID(),roles:[]};
 assert.deepEqual((await resolveProductAccess(other,db)).roles,["readonly"]);
 await assert.rejects(changeMemberRoles(other,reader.sub,["member"],yes,db),/role_forbidden/);
 const inactive=identity(); await resolveProductAccess(inactive,db);
 await db.$executeRawUnsafe("UPDATE local_authz.member SET status='inactive' WHERE workspace_id=$1::uuid AND sub=$2",workspaceId,inactive.sub);
 assert.deepEqual((await resolveProductAccess(inactive,db)).roles,[]);
 await assert.rejects(changeMemberRoles(admin,inactive.sub,["member"],yes,db),/member_inactive/);
 const recovery={...identity(["workspace:owner"]),workspaceId:randomUUID()};
 await db.$executeRawUnsafe("INSERT INTO local_authz.member(workspace_id,sub) VALUES($1::uuid,$2)",recovery.workspaceId,recovery.sub);
 assert.deepEqual((await resolveProductAccess(recovery,db)).roles,[]);
 await assert.rejects(bootstrapOwnership({...recovery,roles:[]},yes,db),/role_forbidden/);
 await bootstrapOwnership(recovery,yes,db);
 assert.deepEqual((await resolveProductAccess(recovery,db)).roles,["owner"]);
 await assert.rejects(bootstrapOwnership(recovery,yes,db),/owner_already_initialized/);
 const revision=await db.$queryRawUnsafe<{generation:bigint}[]>('SELECT generation FROM vx_provision.access_revision WHERE "workspaceId"=$1',workspaceId);
 assert.equal(Number(revision[0].generation),3,"only committed edits and transfer advance outbox");
}

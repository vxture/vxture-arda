import {test} from "node:test";
import assert from "node:assert/strict";
import {delegatedAccess} from "./obo";
import type {ProductAccess} from "./policy";
const context={workspaceId:"w",orgId:"o",subject:"u",subjectToken:"test-only"};
const readonly:ProductAccess={roles:["readonly"],permissions:["product.enter","data.read"]};
test("delegated calls honor live revocation and never initialize default roles",async()=>{
 let assigned=true,reads=0;
 const deps={assigned:async()=>assigned,read:async()=>{reads++;return readonly;}};
 assert.equal(await delegatedAccess(context,"data.read",deps),readonly);
 assert.equal(await delegatedAccess(context,"data.write",deps),null);
 assigned=false;
 assert.equal(await delegatedAccess(context,"data.read",deps),null);
 assert.equal(reads,2);
 await assert.rejects(delegatedAccess(context,"data.read",{...deps,assigned:async()=>{throw new Error("offline");}}),/offline/);
 assert.equal(await delegatedAccess(context,"data.read",{...deps,assigned:async()=>true,read:async()=>({roles:[],permissions:[]})}),null);
});

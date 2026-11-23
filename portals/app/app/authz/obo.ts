import { authorizedRoster } from "../platform/roster";
import { readProductAccess } from "./store";
import { permits, type ProductPermission } from "./policy";
import type { PlatformContext } from "../platform/ticket";
/** Received OBO tickets use workspace_id, not RP active_workspace. They cannot
 * be re-exchanged as RP user tokens. A product-owned workspace service ticket
 * reads the current eligible roster; the subject comes only from verified OBO. */
export async function assignedDelegatedSubject(context:PlatformContext,rosterReader:typeof authorizedRoster=authorizedRoster):Promise<boolean> {
 if(!context.subject) return false;
 const roster=await rosterReader({orgId:context.orgId,workspaceId:context.workspaceId});
 return roster.items.some(member=>member.subject===context.subject);
}
export async function delegatedAccess(context:PlatformContext,permission:ProductPermission,deps={assigned:assignedDelegatedSubject,read:readProductAccess}) {
 if(!context.subject || !context.subjectToken) return null;
 if(!await deps.assigned(context)) return null;
 const access=await deps.read({workspaceId:context.workspaceId,sub:context.subject,roles:[]});
 return permits(access,"product.enter")&&permits(access,permission)?access:null;
}

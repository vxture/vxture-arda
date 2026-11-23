import { productAssigned } from "../platform/access";
import { readProductAccess } from "./store";
import { permits, type ProductPermission } from "./policy";
import type { PlatformContext } from "../platform/ticket";
export async function delegatedAccess(context:PlatformContext,permission:ProductPermission,deps={assigned:productAssigned,read:readProductAccess}) {
 if(!context.subject || !context.subjectToken) return null;
 if(!await deps.assigned(context)) return null;
 const access=await deps.read({workspaceId:context.workspaceId,sub:context.subject,roles:[]});
 return permits(access,"product.enter")&&permits(access,permission)?access:null;
}

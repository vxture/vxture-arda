import { getPermissionSession } from "../../../auth/lib/session";
import { MemberRoles } from "../../../authz/member-roles";
export default async function AdminPlatformPage() {
 if(!await getPermissionSession("members.manage")) return null;
 return <MemberRoles/>;
}

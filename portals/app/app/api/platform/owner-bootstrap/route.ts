import {NextResponse} from "next/server";
import {getOidcConfig} from "../../../auth/lib/config";
import {bootstrapOwnership} from "../../../authz/store";
import {getSession,getPlatformUserContext} from "../../../auth/lib/session";
import {admitProductUser} from "../../../platform/admission";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store"};
export async function POST(req:Request){
 if(req.headers.get("origin")!==getOidcConfig()?.appOrigin || req.headers.get("sec-fetch-site")==="cross-site") return NextResponse.json({error:"origin_invalid"},{status:403,headers});
 if(!req.headers.get("content-type")?.startsWith("application/json")) return NextResponse.json({error:"json_required"},{status:415,headers});
 try{
  const text=await req.text();
  if(text.length>128||JSON.parse(text)?.confirm!=="initialize_product_owner") return NextResponse.json({error:"confirmation_required"},{status:400,headers});
  const session=await getSession();
  if(!session)return NextResponse.json({error:"unauthenticated"},{status:401,headers});
  const context=await getPlatformUserContext(session);
  const identity={workspaceId:session.workspaceId,sub:session.sub,roles:session.roles};
  await bootstrapOwnership(identity,()=>admitProductUser(context));
  return NextResponse.json({ok:true},{headers});
 }catch(error){
  const code=error instanceof Error?error.message:"unavailable";
  const denied=["role_forbidden","target_not_authorized","member_inactive","owner_already_initialized"].includes(code);
  return NextResponse.json({error:denied?code:"bootstrap_unavailable"},{status:denied?403:503,headers});
 }
}

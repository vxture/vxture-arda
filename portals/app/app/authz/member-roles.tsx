"use client";
import { useEffect, useState } from "react";
import { Button, DataTable, NativeSelect, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, type DataTableColumn } from "@vxture/design-system";
interface Member { subject:string; display_name:string|null; productRoles:string[]; initialized:boolean; status:string }
interface Roster { items:Member[]; actorRoles:string[] }
const labels:Record<string,string>={"owner": "\u4ea7\u54c1\u6240\u6709\u8005", "administrator": "\u7ba1\u7406\u5458", "member": "\u6210\u5458", "readonly": "\u53ea\u8bfb", "guest": "\u8bbf\u5ba2", "none": "\u65e0\u89d2\u8272", "title": "\u4ea7\u54c1\u6210\u5458\u4e0e\u89d2\u8272", "hint": "\u4ec5\u663e\u793a\u5e73\u53f0\u5df2\u6388\u6743\u4f7f\u7528\u4ea7\u54c1\u7684\u6210\u5458\u3002\u4ea7\u54c1\u89d2\u8272\u4e0d\u4f1a\u589e\u52a0\u5e2d\u4f4d\u6216\u6062\u590d\u5df2\u64a4\u9500\u7684\u5e73\u53f0\u6388\u6743\u3002", "unavailable": "\u65e0\u6cd5\u8bfb\u53d6\u6388\u6743\u6210\u5458\uff0c\u8bf7\u786e\u8ba4\u7ba1\u7406\u6743\u9650\u540e\u91cd\u8bd5\u3002", "failed": "\u4fee\u6539\u672a\u5b8c\u6210\uff0c\u8bf7\u5237\u65b0\u5e76\u786e\u8ba4\u6210\u5458\u6388\u6743\u53ca\u5f53\u524d\u7ba1\u7406\u6743\u9650\u3002", "current": "\u5f53\u524d\u89d2\u8272", "first": "\u9996\u6b21\u8fdb\u5165\u65f6\u5206\u914d\u53ea\u8bfb", "change": "\u4fee\u6539\u89d2\u8272", "choose": "\u9009\u62e9\u89d2\u8272", "ownership": "\u6240\u6709\u6743", "transfer": "\u8f6c\u79fb\u6240\u6709\u6743", "transferHint": "\u6240\u6709\u6743\u5c06\u8f6c\u79fb\u7ed9\u6b64\u6210\u5458\uff0c\u4f60\u5c06\u6210\u4e3a\u7ba1\u7406\u5458\u3002\u6b64\u64cd\u4f5c\u4f1a\u8bb0\u5f55\u5ba1\u8ba1\u3002", "changeHint": "\u786e\u8ba4\u66f4\u65b0\u6b64\u6210\u5458\u7684\u4ea7\u54c1\u6743\u9650\u3002\u8bbe\u4e3a\u65e0\u89d2\u8272\u540e\uff0c\u8be5\u6210\u5458\u5c06\u65e0\u6cd5\u8fdb\u5165\u4ea7\u54c1\u3002", "refresh": "\u5237\u65b0\u6210\u5458", "loading": "\u6b63\u5728\u8bfb\u53d6\u6210\u5458", "cancel": "\u53d6\u6d88", "confirm": "\u786e\u8ba4"};
export function MemberRoles() {
 const [roster,setRoster]=useState<Roster|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState(false);
 const [pending,setPending]=useState<{member:Member;role:string;transfer:boolean}|null>(null);
 async function load() {
  const response=await fetch("/api/platform/members",{cache:"no-store"});
  if(!response.ok) throw new Error(labels.unavailable);
  setRoster(await response.json());
 }
 useEffect(()=>{void load().catch(()=>setError(labels.unavailable));},[]);
 async function save() {
  if(!pending)return;
  setBusy(true);setError("");
  try {
   const response=await fetch("/api/platform/member-roles",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:pending.transfer?"transfer":"roles",subject:pending.member.subject,roles:pending.role?[pending.role]:[]})});
   if(!response.ok) throw new Error(labels.failed);
   setPending(null); await load();
  }catch {setError(labels.failed);} finally {setBusy(false);}
 }
 const isOwner=roster?.actorRoles.includes("owner")??false;
 const columns:DataTableColumn<Member>[]=[
  {id:"name",header:labels.member,cell:member=><span>{member.display_name??member.subject}</span>},
  {id:"roles",header:labels.current,cell:member=><span>{member.initialized?member.productRoles.map(role=>labels[role]??role).join(", ")||labels.none:labels.first}</span>},
  {id:"edit",header:labels.change,cell:member=>{
   const locked=member.productRoles.includes("owner")||member.status==="inactive"||(!isOwner&&member.productRoles.includes("administrator"));
   return <NativeSelect aria-label={labels.change} disabled={busy||locked} value="" onChange={event=>{if(event.target.value)setPending({member,role:event.target.value==="none"?"":event.target.value,transfer:false});}}>
    <option value="">{labels.choose}</option>
    {(["readonly","guest","member",...(isOwner?["administrator"]:[]),"none"]).map(role=><option key={role} value={role}>{labels[role]}</option>)}
   </NativeSelect>;
  }},
  {id:"owner",header:labels.ownership,cell:member=>isOwner&&member.initialized&&member.status!=="inactive"&&!member.productRoles.includes("owner")?<Button disabled={busy} onClick={()=>setPending({member,role:"owner",transfer:true})}>{labels.transfer}</Button>:null},
 ];
 return <section className="space-y-4">
  <h1>{labels.title}</h1><p>{labels.hint}</p>
  {error&&<p role="alert">{error}</p>}
  <Button disabled={busy} onClick={()=>{setError("");void load().catch(()=>setError(labels.unavailable));}}>{labels.refresh}</Button>
  {roster?<DataTable columns={columns} rows={roster.items} rowKey={member=>member.subject}/>:<p>{labels.loading}</p>}
  <Dialog open={Boolean(pending)} onOpenChange={open=>{if(!open&&!busy)setPending(null);}}>
   <DialogContent><DialogHeader><DialogTitle>{pending?.transfer?labels.transfer:labels.change}</DialogTitle>
    <DialogDescription>{pending?.transfer?labels.transferHint:labels.changeHint}</DialogDescription></DialogHeader>
    <p>{pending?.member.display_name??pending?.member.subject} - {labels[pending?.role||"none"]}</p>
    <DialogFooter><Button disabled={busy} onClick={()=>setPending(null)}>{labels.cancel}</Button><Button disabled={busy} onClick={()=>void save()}>{labels.confirm}</Button></DialogFooter>
   </DialogContent>
  </Dialog>
 </section>;
}

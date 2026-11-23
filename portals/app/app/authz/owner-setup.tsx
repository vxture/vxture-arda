"use client";
import {useState} from "react";
import {Button,Checkbox,Label} from "@vxture/design-system";
export function OwnerSetup(){
 const [confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
 async function initialize(){setBusy(true);try{
  const response=await fetch("/api/platform/owner-bootstrap",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({confirm:"initialize_product_owner"})});
  setMessage(response.ok?"Owner initialized. Return to the product.":"Cannot initialize: check current workspace ownership, product authorization and existing product owner.");
 }catch{setMessage("Authority unavailable. Retry after restoring the connection.");}finally{setBusy(false);}}
 return <section className="space-y-4"><h1>Initialize product owner</h1><p>Only the currently authorized platform workspace owner may initialize an unowned product workspace. This explicit action grants your product owner role and records an audit. It cannot replace an existing product owner.</p><Label><Checkbox checked={confirmed} onCheckedChange={value=>setConfirmed(value===true)}/>I confirm initializing myself as product owner for the current workspace.</Label><Button disabled={!confirmed||busy} onClick={()=>void initialize()}>Initialize owner</Button><p role="status">{message}</p><a href="/">Return to product</a></section>;
}

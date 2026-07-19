import { redirect } from "next/navigation";

// Sharing approvals are single-homed in the admin approval center (biz-107
// decision 2); the security domain's entry deep-links there.
export default function SecApprovalsPage() {
  redirect("/approvals");
}

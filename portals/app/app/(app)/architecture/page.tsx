import { redirect } from "next/navigation";

// The domain root now redirects to the first menu item of the L2 skeleton
// (arda-biz-106); the launcher itself jumps straight to the home item.
export default function ArchitecturePage() {
  redirect("/architecture/business");
}

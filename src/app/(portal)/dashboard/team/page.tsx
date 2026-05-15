import { redirect } from "next/navigation";

export default function TeamPage() {
  redirect("/app/settings?tab=team");
}

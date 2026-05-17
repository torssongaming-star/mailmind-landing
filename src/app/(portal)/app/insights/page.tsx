import { redirect } from "next/navigation";

export default function InsightsRoot() {
  redirect("/app/insights/stats");
}

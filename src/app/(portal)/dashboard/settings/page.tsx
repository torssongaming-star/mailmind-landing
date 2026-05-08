import { redirect } from "next/navigation";

export default function SettingsPage() {
  // Deprecated: redirected to the new consolidated account settings
  redirect("/app/settings/account");
}

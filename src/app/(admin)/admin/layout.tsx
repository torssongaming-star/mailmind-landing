import { requireMailmindAdmin } from "@/lib/admin/auth";
import { AdminShell } from "@/components/admin/AdminShell";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Guard: Redirect non-admins
  await requireMailmindAdmin();

  return <AdminShell>{children}</AdminShell>;
}

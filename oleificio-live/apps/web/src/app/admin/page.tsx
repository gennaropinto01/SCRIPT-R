import { redirect } from "next/navigation";
import { getPrincipal } from "@/lib/auth";
import AdminDashboard from "@/components/AdminDashboard";

export default async function AdminPage() {
  const p = await getPrincipal();
  if (!p) redirect("/login");
  if (p.subjectType !== "USER" || p.role !== "MILL_ADMIN") redirect("/");
  return <AdminDashboard />;
}

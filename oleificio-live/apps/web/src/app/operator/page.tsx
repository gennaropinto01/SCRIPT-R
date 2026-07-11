import { redirect } from "next/navigation";
import { getPrincipal } from "@/lib/auth";
import { prisma } from "@/lib/db";
import OperatorDashboard from "@/components/OperatorDashboard";

export default async function OperatorPage() {
  const p = await getPrincipal();
  if (!p) redirect("/login");
  if (p.subjectType !== "USER" || !["OPERATOR", "MILL_ADMIN"].includes(p.role)) redirect("/");
  const customers = p.tenantId
    ? await prisma.customer.findMany({ where: { tenantId: p.tenantId }, select: { id: true, fullName: true }, orderBy: { fullName: "asc" } })
    : [];
  return <OperatorDashboard role={p.role} customers={customers} />;
}

import { redirect } from "next/navigation";
import { getPrincipal } from "@/lib/auth";
import { prisma } from "@/lib/db";
import CustomerDashboard from "@/components/CustomerDashboard";

export default async function PortalePage() {
  const p = await getPrincipal();
  if (!p) redirect("/login");
  if (p.subjectType !== "CUSTOMER") redirect("/");
  const customer = await prisma.customer.findUnique({ where: { id: p.subjectId } });
  const tenant = p.tenantId ? await prisma.tenant.findUnique({ where: { id: p.tenantId } }) : null;
  if (!customer) redirect("/login");
  return <CustomerDashboard customerName={customer.fullName} millName={tenant?.logoText ?? "Oleificio"} />;
}

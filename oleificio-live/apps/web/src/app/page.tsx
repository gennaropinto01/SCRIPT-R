import { redirect } from "next/navigation";
import { getPrincipal } from "@/lib/auth";

export default async function Home() {
  const p = await getPrincipal();
  if (!p) redirect("/login");
  if (p.subjectType === "CUSTOMER") redirect("/portale");
  if (p.role === "SUPER_ADMIN") redirect("/superadmin");
  if (p.role === "MILL_ADMIN") redirect("/admin");
  redirect("/operator");
}

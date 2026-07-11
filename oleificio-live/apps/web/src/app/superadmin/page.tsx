import { redirect } from "next/navigation";
import { getPrincipal } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { LogoutButton } from "@/components/ui";

export default async function SuperAdminPage() {
  const p = await getPrincipal();
  if (!p) redirect("/login");
  if (p.subjectType !== "USER" || p.role !== "SUPER_ADMIN") redirect("/");

  const tenants = await prisma.tenant.findMany({ include: { _count: { select: { lots: true, customers: true, users: true } } } });

  return (
    <main className="min-h-screen max-w-4xl mx-auto p-6 space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Super Admin · Oleifici</h1>
        <LogoutButton />
      </header>
      <section className="grid sm:grid-cols-2 gap-4">
        {tenants.map((t) => (
          <div key={t.id} className="card">
            <div className="flex items-center justify-between">
              <p className="font-semibold">{t.name}</p>
              <span className={`badge ${t.isSuspended ? "bg-red-100 text-red-700" : "bg-olive-100 text-olive-700"}`}>{t.isSuspended ? "sospeso" : "attivo"}</span>
            </div>
            <p className="text-sm text-steel-500 mt-2">{t._count.lots} lotti · {t._count.customers} clienti · {t._count.users} utenti</p>
          </div>
        ))}
      </section>
      <p className="text-sm text-steel-500">La gestione completa (creazione oleifici, sospensione, audit globale, statistiche) è esposta come API ed estendibile in questa vista.</p>
    </main>
  );
}

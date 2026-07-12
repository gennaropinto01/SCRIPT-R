"use client";
import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useState } from "react";
import { EtaBadge, ProgressBar, Timeline, apiGet, LogoutButton } from "./ui";

const PlantView = dynamic(() => import("./PlantView"), { ssr: false, loading: () => <div className="h-full w-full rounded-2xl bg-steel-700 animate-pulse" /> });

interface LotSummary { id: string; trackingCode: string; statusLabel: string; weightKg: number; variety?: string | null; progress: number; }
interface LotDetail {
  id: string; trackingCode: string; statusLabel: string; status: string; weightKg: number; variety?: string | null; organic: boolean; progress: number;
  currentStage: { code: string; name: string; description?: string | null; animationKey?: string | null } | null;
  eta: { lowAt?: string | null; highAt?: string | null; confidence: string; updatedAt?: string | null };
  result: { oilLiters?: number | null; yieldPercentage?: number | null; completedAt?: string | null; estimatedOilLiters?: number | null };
  timeline: Array<{ stageCode: string; name: string; status: string; numberOfBatches?: number | null; estimatedStartAt?: string | null; estimatedEndAt?: string | null }>;
}
interface Notif { id: string; title: string; body: string; createdAt: string; readAt: string | null; }

export default function CustomerDashboard({ customerName, millName }: { customerName: string; millName: string }) {
  const [selected, setSelected] = useState<string | null>(null);
  const lotsQ = useQuery({ queryKey: ["lots"], queryFn: () => apiGet<{ data: LotSummary[] }>("/api/customer/lots") });
  const lots = lotsQ.data?.data ?? [];
  const activeId = selected ?? lots[0]?.id ?? null;
  const detailQ = useQuery({ queryKey: ["lot", activeId], queryFn: () => apiGet<LotDetail>(`/api/customer/lots/${activeId}`), enabled: !!activeId });
  const notifQ = useQuery({ queryKey: ["notif"], queryFn: () => apiGet<{ data: Notif[] }>("/api/customer/notifications") });
  const lot = detailQ.data;

  return (
    <main className="min-h-screen max-w-5xl mx-auto p-4 sm:p-6 space-y-4">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-xl bg-olive-600 grid place-items-center text-white">🫒</div>
          <div>
            <p className="font-bold leading-tight">{millName}</p>
            <p className="text-sm text-steel-500">Ciao, {customerName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <NotifBell notifs={notifQ.data?.data ?? []} />
          <LogoutButton />
        </div>
      </header>

      {lots.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {lots.map((l) => (
            <button key={l.id} onClick={() => setSelected(l.id)} className={`badge whitespace-nowrap px-3 py-1.5 ${activeId === l.id ? "bg-olive-600 text-white" : "bg-white text-steel-700 border border-steel-300"}`}>
              {l.trackingCode}
            </button>
          ))}
        </div>
      )}

      {lotsQ.isLoading && <div className="card">Caricamento…</div>}
      {!lotsQ.isLoading && lots.length === 0 && <div className="card">Non hai ancora conferimenti registrati.</div>}

      {lot && (
        <>
          <section className="card">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="label">Lotto</p>
                <p className="text-2xl font-bold">{lot.trackingCode}</p>
                <p className="text-sm text-steel-500">{lot.weightKg} kg · {lot.variety ?? "—"} {lot.organic && "· biologico"}</p>
              </div>
              <span className="badge bg-steel-100 text-steel-700 self-center">{lot.statusLabel}</span>
            </div>
            {lot.currentStage && (
              <p className="mt-3 text-steel-600 dark:text-steel-200">
                Il tuo lotto è nella fase di <b>{lot.currentStage.name.toLowerCase()}</b>.
              </p>
            )}
            <div className="mt-4"><ProgressBar value={lot.progress} /></div>
            <div className="mt-4"><EtaBadge lowAt={lot.eta.lowAt} highAt={lot.eta.highAt} confidence={lot.eta.confidence} updatedAt={lot.eta.updatedAt} /></div>
          </section>

          <section className="card p-0 overflow-hidden">
            <PlantView
              stageCode={lot.currentStage?.code ?? null}
              progress={lot.progress}
              status={lot.status}
              activeStartAt={lot.timeline.find((p) => p.status === "RUNNING")?.estimatedStartAt ?? null}
              activeEndAt={lot.timeline.find((p) => p.status === "RUNNING")?.estimatedEndAt ?? null}
            />
          </section>

          <section className="card">
            <p className="label mb-2">Cosa sta succedendo</p>
            <p className="text-steel-600 dark:text-steel-200 min-h-[3rem]">
              {lot.currentStage?.description ?? (lot.status === "COMPLETED" ? "La lavorazione è completata: consulta il riepilogo qui sotto." : "Il lotto è in coda di lavorazione.")}
            </p>
            <hr className="my-4 border-steel-200/60" />
            <p className="label mb-2">Timeline</p>
            <Timeline phases={lot.timeline} />
          </section>

          {(lot.status === "COMPLETED" || lot.result.oilLiters) && (
            <section className="card">
              <p className="label mb-2">Riepilogo finale</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Stat label="Olive conferite" value={`${lot.weightKg} kg`} />
                <Stat label="Olio ottenuto" value={lot.result.oilLiters ? `${lot.result.oilLiters} L` : `~${lot.result.estimatedOilLiters ?? "—"} L (stima)`} />
                <Stat label="Resa" value={lot.result.yieldPercentage ? `${lot.result.yieldPercentage}%` : "—"} />
                <Stat label="Completato" value={lot.result.completedAt ? new Date(lot.result.completedAt).toLocaleDateString("it-IT") : "—"} />
              </div>
            </section>
          )}
        </>
      )}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="label">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}

function NotifBell({ notifs }: { notifs: Notif[] }) {
  const [open, setOpen] = useState(false);
  const unread = notifs.filter((n) => !n.readAt).length;
  return (
    <div className="relative">
      <button className="btn-ghost text-sm relative" onClick={() => setOpen((o) => !o)} aria-label={`Notifiche, ${unread} non lette`}>
        🔔 {unread > 0 && <span className="absolute -top-1 -right-1 badge bg-red-600 text-white px-1.5">{unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-auto card z-10">
          <p className="label mb-2">Notifiche</p>
          {notifs.length === 0 && <p className="text-sm text-steel-500">Nessuna notifica.</p>}
          <ul className="space-y-2">
            {notifs.map((n) => (
              <li key={n.id} className="text-sm border-b border-steel-200/50 pb-2">
                <p className="font-medium">{n.title}</p>
                <p className="text-steel-500">{n.body}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

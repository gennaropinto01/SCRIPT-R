"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { apiGet, apiPatch, LogoutButton } from "./ui";

interface Machine { id: string; code: string; name: string; type: string; status: string; nominalCapacityKgPerHour: number | null; batchCapacityKg: number | null; parallelBatchCount: number; efficiencyFactor: number; }
interface QueueLot { id: string; trackingCode: string; customerName: string; priority: string; queuePosition: number; progress: number; status: string; etaConfidence: string; estimatedCompletionAt: string | null; }
interface Audit { id: string; eventType: string; actorType: string; timestamp: string; newState: string | null; }

const MACHINE_STATUS_CLASS: Record<string, string> = { ACTIVE: "bg-olive-600 text-white", IDLE: "bg-steel-300 text-steel-900", MAINTENANCE: "bg-steel-500 text-white", ERROR: "bg-red-600 text-white", PAUSED: "bg-amber-400 text-steel-900" };

export default function AdminDashboard() {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const machinesQ = useQuery({ queryKey: ["machines"], queryFn: () => apiGet<{ data: Machine[] }>("/api/admin/machines") });
  const queueQ = useQuery({ queryKey: ["queue"], queryFn: () => apiGet<{ data: QueueLot[] }>("/api/admin/queue") });
  const auditQ = useQuery({ queryKey: ["audit"], queryFn: () => apiGet<{ data: Audit[] }>("/api/admin/audit") });

  async function toggleMachine(m: Machine) {
    setError(null);
    const next = m.status === "MAINTENANCE" || m.status === "ERROR" ? "IDLE" : "MAINTENANCE";
    try { await apiPatch(`/api/admin/machines/${m.id}/status`, { status: next, reason: "Modifica manuale admin" }); await qc.invalidateQueries(); }
    catch (e) { setError(e instanceof Error ? e.message : "Errore"); }
  }

  return (
    <main className="min-h-screen max-w-6xl mx-auto p-4 sm:p-6 space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Pannello amministratore</h1>
          <p className="text-sm text-steel-500">Impianto, coda e audit</p>
        </div>
        <div className="flex gap-2"><a href="/operator" className="btn-ghost text-sm">Postazione operatore</a><LogoutButton /></div>
      </header>

      {error && <div className="card border-red-300 text-red-700" role="alert">{error}</div>}

      <section className="card">
        <div className="flex items-center justify-between mb-3">
          <p className="label">Macchine e capacità</p>
          <p className="text-xs text-amber-700 bg-amber-100 rounded-lg px-2 py-1">Valori DEMO: sostituire con quelli reali del frantoio</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {machinesQ.data?.data.map((m) => (
            <div key={m.id} className="rounded-xl border border-steel-200/60 p-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold">{m.name}</span>
                <span className={`badge ${MACHINE_STATUS_CLASS[m.status] ?? "bg-steel-300"}`}>{m.status}</span>
              </div>
              <p className="text-sm text-steel-500 mt-1">
                {m.batchCapacityKg ? `Batch ${m.batchCapacityKg} kg × ${m.parallelBatchCount}` : `${m.nominalCapacityKgPerHour ?? "—"} kg/h`} · η {m.efficiencyFactor}
              </p>
              <button className="btn-ghost text-sm mt-2 w-full" onClick={() => toggleMachine(m)}>
                {m.status === "MAINTENANCE" || m.status === "ERROR" ? "Rimetti in servizio" : "Metti in fermo"}
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="grid lg:grid-cols-2 gap-4">
        <div className="card">
          <p className="label mb-2">Coda di produzione</p>
          <ol className="space-y-2">
            {queueQ.data?.data.map((l) => (
              <li key={l.id} className="flex items-center justify-between text-sm border-b border-steel-200/50 pb-2">
                <span>#{l.queuePosition} <b>{l.trackingCode}</b> · {l.customerName}</span>
                <span className="text-steel-500">{l.priority} · {l.progress}%</span>
              </li>
            ))}
            {(queueQ.data?.data.length ?? 0) === 0 && <li className="text-sm text-steel-500">Coda vuota.</li>}
          </ol>
        </div>
        <div className="card">
          <p className="label mb-2">Audit log (append-only)</p>
          <ul className="space-y-1 max-h-80 overflow-auto">
            {auditQ.data?.data.map((a) => (
              <li key={a.id} className="text-xs flex justify-between border-b border-steel-200/40 py-1">
                <span className="font-mono">{a.eventType}</span>
                <span className="text-steel-500">{a.actorType} · {new Date(a.timestamp).toLocaleTimeString("it-IT")}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}

"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { apiGet, apiPost, LogoutButton } from "./ui";

interface Phase { id: string; stageCode: string; status: string; orderIndex: number; version: number }
interface Lot {
  id: string; trackingCode: string; customerName: string; statusLabel: string; status: string; priority: string;
  weightKg: number; progress: number; currentStageCode?: string | null; queuePosition: number; etaConfidence: string;
  estimatedCompletionAt?: string | null; phases: Phase[];
}

const PRIORITY_CLASS: Record<string, string> = { URGENT: "bg-red-600 text-white", HIGH: "bg-amber-500 text-white", NORMAL: "bg-steel-300 text-steel-900" };

export default function OperatorDashboard({ role, customers }: { role: string; customers: { id: string; fullName: string }[] }) {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const boardQ = useQuery({ queryKey: ["board"], queryFn: () => apiGet<{ data: Lot[] }>("/api/operator/board") });
  const lots = boardQ.data?.data ?? [];
  const demoLotId = useRef<string | null>(null);
  const [demoSpeed, setDemoSpeed] = useState(0);
  const demoTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  async function act(fn: () => Promise<unknown>) {
    setError(null);
    try { await fn(); await qc.invalidateQueries(); } catch (e) { setError(e instanceof Error ? e.message : "Errore"); }
  }

  function currentPhase(lot: Lot): Phase | undefined {
    return lot.phases.find((p) => p.status === "RUNNING") ?? lot.phases.find((p) => p.status === "READY") ?? lot.phases.find((p) => p.status === "PAUSED");
  }

  // Demo loop
  function setSpeed(mult: number) {
    setDemoSpeed(mult);
    if (demoTimer.current) clearInterval(demoTimer.current);
    if (mult <= 0) return;
    demoTimer.current = setInterval(async () => {
      if (!demoLotId.current) return;
      await act(() => apiPost("/api/demo/control", { action: "step", lotId: demoLotId.current }));
    }, 4000 / mult);
  }
  async function startDemo() {
    await act(async () => {
      const r = await apiPost<{ lotId: string }>("/api/demo/control", { action: "start" });
      demoLotId.current = r.lotId;
    });
  }

  return (
    <main className="min-h-screen max-w-6xl mx-auto p-4 sm:p-6 space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Postazione operatore</h1>
          <p className="text-sm text-steel-500">Coda di produzione · {lots.length} lotti attivi</p>
        </div>
        <LogoutButton />
      </header>

      {error && <div className="card border-red-300 text-red-700" role="alert">{error}</div>}

      <div className="grid lg:grid-cols-3 gap-4">
        <section className="lg:col-span-2 space-y-3">
          {boardQ.isLoading && <div className="card">Caricamento…</div>}
          {lots.map((lot) => {
            const cp = currentPhase(lot);
            return (
              <div key={lot.id} className="card">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="badge bg-steel-100 text-steel-700">#{lot.queuePosition}</span>
                    <span className="font-bold">{lot.trackingCode}</span>
                    <span className={`badge ${PRIORITY_CLASS[lot.priority] ?? PRIORITY_CLASS.NORMAL}`}>{lot.priority}</span>
                  </div>
                  <span className="text-sm text-steel-500">{lot.customerName} · {lot.weightKg} kg</span>
                </div>
                <div className="mt-2 flex items-center gap-3">
                  <div className="flex-1 h-2 rounded-full bg-steel-300/50 overflow-hidden">
                    <div className="h-full bg-olive-500" style={{ width: `${lot.progress}%` }} />
                  </div>
                  <span className="text-sm font-medium w-28 text-right">{lot.currentStageCode ?? lot.statusLabel} · {lot.progress}%</span>
                </div>
                {cp && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {cp.status === "READY" && <button className="btn-primary text-sm" onClick={() => act(() => apiPost(`/api/operator/lots/${lot.id}/phases/${cp.id}/start`, { expectedVersion: cp.version }))}>▶ Avvia {cp.stageCode}</button>}
                    {cp.status === "RUNNING" && <>
                      <button className="btn-ghost text-sm" onClick={() => act(() => apiPost(`/api/operator/lots/${lot.id}/phases/${cp.id}/pause`, { expectedVersion: cp.version }))}>⏸ Pausa</button>
                      <button className="btn-primary text-sm" onClick={() => act(() => apiPost(`/api/operator/lots/${lot.id}/phases/${cp.id}/complete`, { expectedVersion: cp.version }))}>✓ Completa {cp.stageCode}</button>
                    </>}
                    {cp.status === "PAUSED" && <button className="btn-primary text-sm" onClick={() => act(() => apiPost(`/api/operator/lots/${lot.id}/phases/${cp.id}/resume`, { expectedVersion: cp.version }))}>▶ Riprendi</button>}
                    {lot.status === "COMPLETED" && <OilForm lotId={lot.id} onDone={() => qc.invalidateQueries()} act={act} />}
                  </div>
                )}
              </div>
            );
          })}
        </section>

        <aside className="space-y-4">
          <NewDelivery customers={customers} act={act} />
          <div className="card">
            <p className="label mb-2">Modalità demo</p>
            <p className="text-sm text-steel-500 mb-3">Simula una lavorazione accelerata: crea un lotto e avanzalo tra le fasi.</p>
            <div className="flex flex-wrap gap-2">
              <button className="btn-primary text-sm" onClick={startDemo}>Nuovo lotto demo</button>
              <button className="btn-ghost text-sm" onClick={() => demoLotId.current && act(() => apiPost("/api/demo/control", { action: "step", lotId: demoLotId.current }))}>Avanza fase</button>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <span className="label">Velocità</span>
              {[0, 1, 5, 20].map((s) => (
                <button key={s} className={`badge px-2.5 py-1 ${demoSpeed === s ? "bg-olive-600 text-white" : "bg-steel-100 text-steel-700"}`} onClick={() => setSpeed(s)}>{s === 0 ? "⏸" : `${s}x`}</button>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button className="btn-ghost text-sm" onClick={() => act(() => apiPost("/api/demo/control", { action: "stop_machine", machine: "MAL-1" }))}>Simula fermo gramola</button>
              <button className="btn-ghost text-sm" onClick={() => act(() => apiPost("/api/demo/control", { action: "restore_machine", machine: "MAL-1" }))}>Ripristina</button>
            </div>
          </div>
          {role === "MILL_ADMIN" && <a href="/admin" className="btn-ghost w-full">Vai al pannello admin →</a>}
        </aside>
      </div>
    </main>
  );
}

function NewDelivery({ customers, act }: { customers: { id: string; fullName: string }[]; act: (fn: () => Promise<unknown>) => Promise<void> }) {
  const [customerId, setCustomerId] = useState(customers[0]?.id ?? "");
  const [weight, setWeight] = useState("500");
  return (
    <form className="card space-y-2" onSubmit={(e) => { e.preventDefault(); act(() => apiPost("/api/operator/deliveries", { customerId, weightKg: Number(weight) })); }}>
      <p className="label">Registra conferimento</p>
      <select className="w-full rounded-xl border border-steel-300 bg-transparent px-3 py-2" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
        {customers.map((c) => <option key={c.id} value={c.id}>{c.fullName}</option>)}
      </select>
      <input type="number" min="1" step="1" className="w-full rounded-xl border border-steel-300 bg-transparent px-3 py-2" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="Peso kg" aria-label="Peso in kg" />
      <button className="btn-primary w-full text-sm">Crea lotto</button>
    </form>
  );
}

function OilForm({ lotId, onDone, act }: { lotId: string; onDone: () => void; act: (fn: () => Promise<unknown>) => Promise<void> }) {
  const [liters, setLiters] = useState("");
  return (
    <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); act(async () => { await apiPost(`/api/operator/lots/${lotId}/oil`, { liters: Number(liters) }); onDone(); }); }}>
      <input type="number" min="0" step="0.1" className="w-24 rounded-xl border border-steel-300 bg-transparent px-2 py-1 text-sm" value={liters} onChange={(e) => setLiters(e.target.value)} placeholder="Litri olio" aria-label="Litri di olio" />
      <button className="btn-primary text-sm">Salva resa</button>
    </form>
  );
}

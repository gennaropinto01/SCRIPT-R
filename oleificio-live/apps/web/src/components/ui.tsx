"use client";

const CONF_LABEL: Record<string, string> = { HIGH: "alta", MEDIUM: "media", LOW: "bassa" };
const CONF_CLASS: Record<string, string> = {
  HIGH: "bg-olive-100 text-olive-700", MEDIUM: "bg-amber-100 text-amber-800", LOW: "bg-red-100 text-red-700",
};

function fmtTime(d?: string | Date | null): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
}

export function EtaBadge({ lowAt, highAt, confidence, updatedAt }: { lowAt?: string | null; highAt?: string | null; confidence: string; updatedAt?: string | null }) {
  return (
    <div className="space-y-1">
      <div className="text-lg font-semibold">
        {lowAt && highAt ? <>Completamento previsto tra le {fmtTime(lowAt)} e le {fmtTime(highAt)}</> : "Stima non ancora disponibile"}
      </div>
      <div className="flex items-center gap-2 text-sm text-steel-500">
        <span className={`badge ${CONF_CLASS[confidence] ?? CONF_CLASS.MEDIUM}`}>Affidabilità: {CONF_LABEL[confidence] ?? "media"}</span>
        {updatedAt && <span>Aggiornata alle {fmtTime(updatedAt)}</span>}
      </div>
    </div>
  );
}

export function ProgressBar({ value }: { value: number }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="label">Avanzamento stimato</span>
        <span className="font-semibold">{Math.round(value)}%</span>
      </div>
      <div className="h-3 rounded-full bg-steel-300/50 overflow-hidden" role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full bg-olive-500 transition-all" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
      </div>
    </div>
  );
}

const PHASE_STATE_CLASS: Record<string, string> = {
  COMPLETED: "bg-olive-500 text-white", RUNNING: "bg-amber-400 text-steel-900", READY: "bg-steel-300 text-steel-900",
  PENDING: "bg-steel-100 text-steel-500", PAUSED: "bg-amber-200 text-steel-900", SKIPPED: "bg-steel-100 text-steel-400 line-through", FAILED: "bg-red-500 text-white",
};
const PHASE_STATE_LABEL: Record<string, string> = {
  COMPLETED: "completata", RUNNING: "in corso", READY: "in attesa", PENDING: "in attesa", PAUSED: "in pausa", SKIPPED: "saltata", FAILED: "errore",
};

export function Timeline({ phases }: { phases: Array<{ stageCode: string; name: string; status: string; numberOfBatches?: number | null }> }) {
  return (
    <ol className="space-y-2">
      {phases.map((p) => (
        <li key={p.stageCode} className="flex items-center gap-3">
          <span className={`badge ${PHASE_STATE_CLASS[p.status] ?? PHASE_STATE_CLASS.PENDING}`}>{PHASE_STATE_LABEL[p.status] ?? p.status}</span>
          <span className="font-medium">{p.name}</span>
          {p.numberOfBatches && p.numberOfBatches > 1 && <span className="text-xs text-steel-500">({p.numberOfBatches} batch)</span>}
        </li>
      ))}
    </ol>
  );
}

export async function apiGet<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error?.message ?? "Errore");
  return res.json();
}
export async function apiPost<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body ?? {}) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error?.message ?? "Errore");
  return res.json();
}
export async function apiPatch<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body ?? {}) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error?.message ?? "Errore");
  return res.json();
}

export function LogoutButton() {
  return (
    <button className="btn-ghost text-sm" onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); window.location.href = "/login"; }}>
      Esci
    </button>
  );
}

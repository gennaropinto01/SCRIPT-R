"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? "Errore di accesso");
      router.push(data.redirect ?? "/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen grid place-items-center p-6 bg-gradient-to-br from-olive-100 to-steel-100 dark:from-steel-900 dark:to-steel-700">
      <div className="card w-full max-w-md">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-xl bg-olive-600 grid place-items-center text-white text-xl">🫒</div>
          <div>
            <h1 className="text-xl font-bold">Oleificio Live</h1>
            <p className="text-sm text-steel-500">Segui la lavorazione delle tue olive</p>
          </div>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label" htmlFor="id">Username o email</label>
            <input id="id" className="mt-1 w-full rounded-xl border border-steel-300 bg-transparent px-3 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-olive-500" value={identifier} onChange={(e) => setIdentifier(e.target.value)} autoComplete="username" required />
          </div>
          <div>
            <label className="label" htmlFor="pw">Password</label>
            <input id="pw" type="password" className="mt-1 w-full rounded-xl border border-steel-300 bg-transparent px-3 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-olive-500" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
          </div>
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          <button className="btn-primary w-full" disabled={loading}>{loading ? "Accesso…" : "Accedi"}</button>
        </form>
        <details className="mt-6 text-sm text-steel-500">
          <summary className="cursor-pointer">Credenziali demo</summary>
          <ul className="mt-2 space-y-1">
            <li><b>Cliente:</b> gverdi / cliente123</li>
            <li><b>Operatore:</b> op1@sanmartino.local / op123</li>
            <li><b>Admin:</b> admin@sanmartino.local / admin123</li>
          </ul>
        </details>
      </div>
    </main>
  );
}

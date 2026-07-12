"use client";
import { useEffect, useRef, useState } from "react";
import { PLANT_SVG, PLANT_CSS } from "./plantSvg";

// Maps the app's processing stages onto the 7 visual nodes of the plant schematic.
const STAGE_TO_VISUAL: Record<string, number> = {
  ACCEPTANCE: 0, DEFOLIATION: 1, WASHING: 1, CRUSHING: 2, MALAXING: 3,
  DECANTER: 4, SEPARATION: 5, FILTRATION: 6, STORAGE: 6,
};
const NOMI = [
  "Accettazione e pesatura", "Defogliazione e lavaggio", "Frangitura",
  "Gramolazione", "Estrazione (decanter)", "Separazione finale", "Olio pronto",
];
const COMUNI = ["m0", "nas", "m1", "m2"];
const ELEM = ["gram", "pompa", "dec", "sep", "olio"];
const ORDINE: Record<string, number> = { m0: 0, nas: 1, m1: 1, m2: 2, gram: 3, pompa: 4, dec: 4, sep: 5, olio: 6 };

function gruppiFase(i: number, line: "A" | "B"): string[] {
  return [["m0"], ["m1", "nas"], ["m2"], ["gram" + line], ["pompa" + line, "dec" + line], ["sep" + line], ["olio" + line]][i] ?? [];
}

interface Props {
  stageCode: string | null;
  progress: number;      // 0..100 overall
  status: string;        // lot status
  activeStartAt?: string | null;
  activeEndAt?: string | null;
}

export default function PlantView({ stageCode, progress, status, activeStartAt, activeEndAt }: Props) {
  const [line, setLine] = useState<"A" | "B">("A");
  const ref = useRef<HTMLDivElement>(null);
  const geo = useRef<{ SC: number[]; SA: number[]; SB: number[]; LC: number; LA: number; LB: number } | null>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const $ = (id: string) => root.querySelector<SVGElement>("#" + CSS.escape(id));
    const tC = $("tuboC") as unknown as SVGPathElement | null;
    const tA = $("tuboA") as unknown as SVGPathElement | null;
    const tB = $("tuboB") as unknown as SVGPathElement | null;
    if (!tC || !tA || !tB) return;

    // Compute pipe stop fractions once (positions of each visual node on the pipe).
    if (!geo.current) {
      const LC = tC.getTotalLength(), LA = tA.getTotalLength(), LB = tB.getTotalLength();
      const soste = (path: SVGPathElement, L: number, punti: [number, number][]) => {
        const N = 800, fr: number[] = []; let prev = 0;
        for (const [sx, sy] of punti) {
          let best = prev, bd = 1e9;
          for (let k = Math.round(prev * N); k <= N; k++) {
            const p = path.getPointAtLength((L * k) / N);
            const d = (p.x - sx) ** 2 + (p.y - sy) ** 2;
            if (d < bd) { bd = d; best = k / N; }
          }
          prev = best; fr.push(best * 100);
        }
        return fr;
      };
      const SC = soste(tC, LC, [[105, 85], [340, 70], [440, 62]]); SC[0] = 0; SC.push(100);
      const SA = soste(tA, LA, [[604, 88], [817, 55], [926, 128]]); SA.push(100);
      const SB = soste(tB, LB, [[604, 253], [817, 220], [926, 293]]); SB.push(100);
      geo.current = { SC, SA, SB, LC, LA, LB };
    }
    const { SC, SA, SB, LC, LA, LB } = geo.current;

    const finito = ["COMPLETED", "READY_FOR_PICKUP", "DELIVERED"].includes(status);
    const activeIndex = finito ? 7 : (stageCode ? STAGE_TO_VISUAL[stageCode] ?? 0 : 0);

    // Within-phase fraction from the active phase's real estimated window (fallback to overall progress).
    let inFase = 0.4;
    if (finito) inFase = 1;
    else if (activeStartAt && activeEndAt) {
      const s = new Date(activeStartAt).getTime(), e = new Date(activeEndAt).getTime(), now = Date.now();
      if (e > s) inFase = Math.min(1, Math.max(0, (now - s) / (e - s)));
    } else {
      inFase = Math.min(1, Math.max(0, (progress % (100 / 7)) / (100 / 7)));
    }
    const s = { i: activeIndex, inFase };

    const setOff = (id: string, v: number) => { const el = $(id); if (el) el.setAttribute("stroke-dashoffset", String(v)); };
    const muovi = (id: string, path: SVGPathElement, L: number, pct: number) => {
      const el = $(id); if (!el) return;
      const p = path.getPointAtLength((L * pct) / 100);
      el.setAttribute("cx", String(p.x)); el.setAttribute("cy", String(p.y));
    };

    // Pre-line pipe (conferimento → frangitura, nodes 0..2)
    let pC: number;
    if (finito || s.i > 2) pC = 100;
    else pC = SC[s.i]! + (SC[s.i + 1]! - SC[s.i]!) * s.inFase;
    setOff("oroC", 100 - pC);

    // Line pipe (nodes 3..6)
    const S = line === "A" ? SA : SB;
    const tubo = line === "A" ? tA : tB;
    const Lr = line === "A" ? LA : LB;
    let pR = 0;
    if (finito) pR = 100;
    else if (s.i >= 3) { const k = s.i - 3; pR = S[k]! + (S[k + 1]! - S[k]!) * s.inFase; }
    setOff("oroA", line === "A" ? 100 - pR : 100);
    setOff("oroB", line === "B" ? 100 - pR : 100);

    // Flowing dot (olives on the belt, then oil on the line)
    const olivaC = $("olivaC"), dotR = $("oliva" + line), dotAltro = $("oliva" + (line === "A" ? "B" : "A"));
    if (olivaC) (olivaC as unknown as HTMLElement).style.display = !finito && s.i <= 2 ? "" : "none";
    if (dotAltro) (dotAltro as unknown as HTMLElement).style.display = "none";
    if (dotR) (dotR as unknown as HTMLElement).style.display = !finito && s.i >= 3 ? "" : "none";
    if (!finito && s.i <= 2) muovi("olivaC", tC, LC, pC);
    if (!finito && s.i >= 3) muovi("oliva" + line, tubo, Lr, pR);

    // Highlight active machine, dim the rest, mark completed ones.
    const attivi = finito ? ["olio" + line] : gruppiFase(s.i, line);
    COMUNI.forEach((id) => {
      const g = $(id); if (!g) return;
      const o = ORDINE[id]!; const attiva = attivi.includes(id);
      g.classList.toggle("attiva", attiva);
      g.classList.toggle("fatta", !attiva && (finito || o < s.i));
    });
    for (const l of ["A", "B"] as const) {
      for (const e of ELEM) {
        const id = e + l, g = $(id); if (!g) continue;
        if (l !== line) { g.classList.remove("attiva", "fatta"); continue; }
        const o = ORDINE[e]!; const attiva = attivi.includes(id);
        g.classList.toggle("attiva", attiva);
        g.classList.toggle("fatta", !attiva && (finito ? e !== "olio" : o < s.i));
      }
    }
  }, [stageCode, progress, status, line, activeStartAt, activeEndAt]);

  const finito = ["COMPLETED", "READY_FOR_PICKUP", "DELIVERED"].includes(status);
  const vi = finito ? 6 : stageCode ? STAGE_TO_VISUAL[stageCode] ?? 0 : 0;

  return (
    <div className="plant-scope h-full flex flex-col">
      <style dangerouslySetInnerHTML={{ __html: PLANT_CSS }} />
      <div className="line-sel">
        <span>Impianto</span>
        <button className={line === "A" ? "attivo" : ""} onClick={() => setLine("A")} aria-pressed={line === "A"}>Linea 1</button>
        <button className={line === "B" ? "attivo" : ""} onClick={() => setLine("B")} aria-pressed={line === "B"}>Linea 2</button>
      </div>
      <div className="impianto-scroll flex-1" ref={ref} dangerouslySetInnerHTML={{ __html: PLANT_SVG }} />
      <div className="fase-banner">
        <div className="fase-titolo">{finito ? "Olio pronto" : NOMI[vi]}</div>
        <p>Vista dell'impianto · Linea {line === "A" ? "1" : "2"} — la macchina evidenziata è quella che sta lavorando il tuo lotto.</p>
      </div>
    </div>
  );
}

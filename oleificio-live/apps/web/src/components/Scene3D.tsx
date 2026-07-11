"use client";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Environment } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState } from "react";
import type * as THREE from "three";

// State → colour mapping for the active machine.
const STATE_COLOR: Record<string, string> = {
  IDLE: "#a9b6c1", WAITING: "#c3cd7f", ACTIVE: "#65701f", PAUSED: "#d59a2e", ERROR: "#c0392b", COMPLETED: "#4e561a", MAINTENANCE: "#5f7385",
};

function hasWebGL(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const c = document.createElement("canvas");
    return !!(window.WebGLRenderingContext && (c.getContext("webgl") || c.getContext("experimental-webgl")));
  } catch {
    return false;
  }
}

// A simple procedural "machine": a base, a rotating working part whose speed
// tracks progress, and olives/paste moving along a belt. Low-poly, no external GLB.
function Machine({ animationKey, progress, active, color }: { animationKey: string; progress: number; active: boolean; color: string }) {
  const rotor = useRef<THREE.Mesh>(null);
  const flow = useRef<THREE.Group>(null);
  const reduced = useMemo(
    () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  useFrame((_, delta) => {
    if (reduced || !active) return;
    if (rotor.current) rotor.current.rotation.y += delta * (1 + progress * 4);
    if (flow.current) {
      flow.current.children.forEach((c, i) => {
        c.position.x = ((c.position.x + delta * 1.5 + 3) % 6) - 3;
        c.visible = i / flow.current!.children.length <= progress + 0.15;
      });
    }
  });

  const isRound = ["crushing", "malaxing", "decanter", "separation"].includes(animationKey);

  return (
    <group>
      {/* base */}
      <mesh position={[0, -0.6, 0]} receiveShadow>
        <boxGeometry args={[4.2, 0.3, 2]} />
        <meshStandardMaterial color="#374654" />
      </mesh>
      {/* body */}
      <mesh position={[0, 0, 0]} castShadow>
        {isRound ? <cylinderGeometry args={[0.9, 0.9, 1.4, 24]} /> : <boxGeometry args={[1.8, 1.4, 1.2]} />}
        <meshStandardMaterial color={color} metalness={0.4} roughness={0.4} />
      </mesh>
      {/* rotating working part */}
      <mesh ref={rotor} position={[0, 0.1, 0]}>
        <torusGeometry args={[0.55, 0.12, 12, 24]} />
        <meshStandardMaterial color="#e6eaee" metalness={0.6} roughness={0.3} />
      </mesh>
      {/* flow of olives/paste along a belt */}
      <group ref={flow} position={[0, -0.35, 0]}>
        {Array.from({ length: 10 }).map((_, i) => (
          <mesh key={i} position={[-3 + i * 0.6, 0, 0.9]}>
            <sphereGeometry args={[0.12, 10, 10]} />
            <meshStandardMaterial color={animationKey === "malaxing" || animationKey === "decanter" ? "#7f6b2e" : "#4e561a"} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

export function Fallback2D({ label, progress, state }: { label: string; progress: number; state: string }) {
  return (
    <div className="grid place-items-center h-full w-full rounded-2xl bg-steel-700 text-steel-100 p-6" role="img" aria-label={`Fase ${label}, stato ${state}, avanzamento ${Math.round(progress * 100)}%`}>
      <div className="text-center">
        <div className="text-5xl mb-3">⚙️</div>
        <p className="font-semibold">{label}</p>
        <div className="mt-3 h-2 w-48 rounded-full bg-steel-500 overflow-hidden">
          <div className="h-full bg-olive-500" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
        <p className="mt-2 text-sm opacity-80">{Math.round(progress * 100)}% · {state}</p>
      </div>
    </div>
  );
}

export default function Scene3D({ animationKey, label, progress, state }: { animationKey: string; label: string; progress: number; state: string }) {
  const [webgl, setWebgl] = useState<boolean | null>(null);
  useEffect(() => setWebgl(hasWebGL()), []);
  const color = STATE_COLOR[state] ?? STATE_COLOR.ACTIVE!;
  const active = state === "ACTIVE" || state === "RUNNING" || state === "IN_PROGRESS";

  if (webgl === null) return <div className="h-full w-full rounded-2xl bg-steel-700 animate-pulse" aria-hidden />;
  if (!webgl) return <Fallback2D label={label} progress={progress} state={state} />;

  return (
    <div className="h-full w-full rounded-2xl overflow-hidden bg-gradient-to-b from-steel-700 to-steel-900">
      {/* Text alternative for screen readers */}
      <span className="sr-only">Vista 3D della fase {label}. Stato {state}. Avanzamento {Math.round(progress * 100)} percento.</span>
      <Canvas shadows camera={{ position: [4, 3, 5], fov: 45 }} dpr={[1, 1.5]}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 6, 4]} intensity={1} castShadow />
        <Machine animationKey={animationKey} progress={progress} active={active} color={color} />
        <Environment preset="warehouse" />
        <OrbitControls enablePan={false} minDistance={4} maxDistance={9} enableDamping />
      </Canvas>
    </div>
  );
}

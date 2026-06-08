"use client";
import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

/* ───────────────────────────── Tunables ─────────────────────────────
   All visual knobs live here (per spec) so the morph is easy to retune and,
   later, to lift the per-particle lerp into a GLSL ShaderMaterial. */
const COUNT = 2600;
const PARTICLE_SIZE = 0.05;
const PARTICLE_COLOR = "#3A3D44"; // graphite "pencil" on cream paper
const STAGGER = 0.35; // per-particle arrival spread (0..1 of progress)
const BACKGROUND = "#FAF8F3"; // paper/cream

// Network (shape B) layout
const LAYER_X = [-3.2, -1.1, 1.1, 3.2];
const LAYER_NODES = [5, 8, 8, 4];

const smoothstep = (x) => x * x * (3 - 2 * x);
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const rand = (a, b) => a + Math.random() * (b - a);

/** Precompute the two target shapes + per-particle delay as flat arrays. */
function buildShapes() {
  const a = new Float32Array(COUNT * 3); // book
  const b = new Float32Array(COUNT * 3); // network
  const delay = new Float32Array(COUNT);

  // Build the network's node positions once.
  const nodes = []; // [{x,y}]
  const nodesByLayer = LAYER_X.map(() => []);
  LAYER_X.forEach((x, li) => {
    const n = LAYER_NODES[li];
    for (let i = 0; i < n; i++) {
      const y = n === 1 ? 0 : ((i / (n - 1)) * 2 - 1) * 2.0; // spread on Y in [-2,2]
      const node = { x, y };
      nodes.push(node);
      nodesByLayer[li].push(node);
    }
  });
  // Adjacent-layer edges (for stringing particles along connections).
  const edges = [];
  for (let li = 0; li < LAYER_X.length - 1; li++) {
    for (const p of nodesByLayer[li]) {
      for (const q of nodesByLayer[li + 1]) edges.push([p, q]);
    }
  }

  for (let i = 0; i < COUNT; i++) {
    const o = i * 3;

    // ── Shape A: open book ──
    const side = i % 2 === 0 ? -1 : 1; // alternate left/right page
    const u = Math.random(); // spine(0) → outer edge(1)
    const v = Math.random() * 2 - 1; // top(-1) → bottom(1)
    a[o] = side * u * 3.2;
    a[o + 1] = v * 2.2;
    a[o + 2] = -Math.sin((u * Math.PI) / 2) * 1.4 - u * u * 0.3; // lift + page curl

    // ── Shape B: neural network ──
    if (Math.random() < 0.55) {
      // jitter around a random node
      const node = nodes[(Math.random() * nodes.length) | 0];
      b[o] = node.x + rand(-0.45, 0.45);
      b[o + 1] = node.y + rand(-0.45, 0.45);
      b[o + 2] = rand(-0.45, 0.45);
    } else {
      // string along a random edge
      const [p, q] = edges[(Math.random() * edges.length) | 0];
      const t = Math.random();
      b[o] = p.x + (q.x - p.x) * t + rand(-0.06, 0.06);
      b[o + 1] = p.y + (q.y - p.y) * t + rand(-0.06, 0.06);
      b[o + 2] = rand(-0.2, 0.2);
    }

    delay[i] = Math.random() * STAGGER;
  }

  return { a, b, delay };
}

/** Soft round sprite so particles read like pencil dots, not hard squares. */
function makeDotTexture() {
  if (typeof document === "undefined") return null;
  const s = 64;
  const c = document.createElement("canvas");
  c.width = c.height = s;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.45, "rgba(255,255,255,0.9)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

function Particles({ progress }) {
  const pointsRef = useRef(null);
  const easedRef = useRef(0);
  const { a, b, delay } = useMemo(() => buildShapes(), []);
  const dot = useMemo(() => makeDotTexture(), []);

  // Live positions start on the book (shape A).
  const positions = useMemo(() => Float32Array.from(a), [a]);

  useFrame((state) => {
    const target = progress.current;
    // Low-pass smoothing so a flick of the wheel glides rather than jerks.
    easedRef.current += (target - easedRef.current) * 0.08;
    const eased = easedRef.current;

    const geo = pointsRef.current?.geometry;
    if (!geo) return;
    const arr = geo.attributes.position.array;
    const denom = 1 - STAGGER;

    for (let i = 0; i < COUNT; i++) {
      const o = i * 3;
      // Staggered, eased per-particle interpolation factor.
      const local = clamp01((eased - delay[i]) / denom);
      const t = smoothstep(local);
      arr[o] = a[o] + (b[o] - a[o]) * t;
      arr[o + 1] = a[o + 1] + (b[o + 1] - a[o + 1]) * t;
      arr[o + 2] = a[o + 2] + (b[o + 2] - a[o + 2]) * t;
    }
    geo.attributes.position.needsUpdate = true;

    // Gentle continuous breathing rotation so it feels alive when scroll is still.
    const el = state.clock.elapsedTime;
    pointsRef.current.rotation.y = Math.sin(el * 0.25) * 0.22;
    pointsRef.current.rotation.x = Math.sin(el * 0.18) * 0.05;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        {/* Live position (mutated each frame) */}
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        {/* A/B/delay kept as attributes so a vertex shader could read them later */}
        <bufferAttribute attach="attributes-aPosition" args={[a, 3]} />
        <bufferAttribute attach="attributes-bPosition" args={[b, 3]} />
        <bufferAttribute attach="attributes-aDelay" args={[delay, 1]} />
      </bufferGeometry>
      <pointsMaterial
        size={PARTICLE_SIZE}
        color={PARTICLE_COLOR}
        map={dot ?? undefined}
        alphaTest={0.02}
        transparent
        opacity={0.92}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

/**
 * Scroll-driven book→network particle morph.
 * `sectionRef` is the tall (300vh) scroll section; progress is read from its
 * rect each frame and stored in a ref (NEVER state) so scrolling triggers no
 * React re-render.
 */
export default function BookBrainMorph({ sectionRef }) {
  const progress = useRef(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const el = sectionRef?.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const span = rect.height - window.innerHeight;
      progress.current = span > 0 ? clamp01(-rect.top / span) : 0;
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [sectionRef]);

  return (
    <Canvas
      camera={{ position: [0, 0, 9], fov: 50 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: false }}
      style={{ position: "absolute", inset: 0 }}
      onCreated={({ gl }) => gl.setClearColor(BACKGROUND, 1)}
    >
      <Particles progress={progress} />
    </Canvas>
  );
}

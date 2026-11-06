'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

const DURATION = 2.2;
const COLORS = ['#2ec4b6', '#ffc857', '#e4572e', '#b8a9ff'];

/** Deterministic pseudo-random in [0,1) so the burst is pure and replays identically. */
const rand = (i: number, salt: number) => {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

/** Coin mask pops up, spins and lifts away; confetti bursts. Renders only while playing. */
export default function MaskPop3DScene() {
  const [done, setDone] = useState(false);
  return (
    <Canvas
      frameloop={done ? 'never' : 'always'}
      dpr={[1, 1.75]}
      camera={{ position: [0, 0, 5], fov: 40 }}
      gl={{ alpha: true, antialias: true }}
      aria-hidden
    >
      <ambientLight intensity={0.6} />
      <directionalLight position={[2, 3, 4]} intensity={2.2} color="#fff1cc" />
      <Mask onDone={() => setDone(true)} />
      <Confetti />
    </Canvas>
  );
}

function Mask({ onDone }: { onDone: () => void }) {
  const g = useRef<THREE.Group>(null);
  const t0 = useRef<number | null>(null);
  const finished = useRef(false);
  useFrame((state) => {
    if (!g.current) return;
    t0.current ??= state.clock.elapsedTime;
    const t = Math.min(1, (state.clock.elapsedTime - t0.current) / DURATION);
    const pop = 1 - Math.pow(1 - Math.min(1, t * 2.5), 3);
    g.current.position.y = -1.6 + pop * 1.6 + Math.max(0, t - 0.55) * 1.2;
    g.current.scale.setScalar(0.3 + pop * 0.7);
    g.current.rotation.y = t * Math.PI * 4;
    g.current.rotation.z = Math.max(0, t - 0.55) * -0.9;
    if (t >= 1 && !finished.current) {
      finished.current = true;
      onDone();
    }
  });
  return (
    <group ref={g}>
      <mesh rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[1, 1, 0.16, 48]} />
        <meshStandardMaterial color="#e8b84a" metalness={0.85} roughness={0.25} />
      </mesh>
      {[-0.38, 0.38].map((x) => (
        <mesh key={x} position={[x, 0.18, 0.09]} scale={[1.2, 0.7, 0.3]}>
          <sphereGeometry args={[0.2, 16, 16]} />
          <meshBasicMaterial color="#1b1410" />
        </mesh>
      ))}
      <mesh position={[0, -0.35, 0.09]} rotation-z={Math.PI}>
        <torusGeometry args={[0.4, 0.05, 8, 24, Math.PI]} />
        <meshBasicMaterial color="#1b1410" />
      </mesh>
    </group>
  );
}

function Confetti() {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const parts = useMemo(
    () =>
      Array.from({ length: 70 }, (_, i) => ({
        v: new THREE.Vector3((rand(i, 1) - 0.5) * 6, 2 + rand(i, 2) * 4, (rand(i, 3) - 0.5) * 2),
        r: rand(i, 4) * Math.PI,
        color: new THREE.Color(COLORS[i % COLORS.length]),
      })),
    [],
  );
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const start = useRef<number | null>(null);
  useFrame((state) => {
    const m = mesh.current;
    if (!m) return;
    start.current ??= state.clock.elapsedTime;
    const t = state.clock.elapsedTime - start.current;
    parts.forEach((p, i) => {
      dummy.position.set(p.v.x * t, p.v.y * t - 4.9 * t * t, p.v.z * t);
      dummy.rotation.set(p.r + t * 6, p.r * 2 + t * 4, 0);
      dummy.scale.setScalar(t < 0.15 ? 0 : 1);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
      m.setColorAt(i, p.color);
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  });
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, parts.length]}>
      <planeGeometry args={[0.12, 0.07]} />
      <meshBasicMaterial side={THREE.DoubleSide} />
    </instancedMesh>
  );
}

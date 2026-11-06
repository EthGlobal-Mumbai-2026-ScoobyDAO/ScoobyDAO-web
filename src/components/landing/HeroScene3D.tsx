'use client';

import { useAnimations, useGLTF } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Suspense, useEffect, useRef } from 'react';
import * as THREE from 'three';

// Landing hero 3D Sniff (THEME.md §3). Loaded only on capable devices, on pointer intent.
// Renders on demand: a driver requests frames only while the hero is on screen.

export const SNIFF_MODEL_URL = '/models/sniff.glb';

type Pointer = { current: { x: number; y: number } };

/**
 * Transparent canvas that renders only Sniff, sized to his spot in the 2D scene. The night
 * scene, parallax and flashlight stay in the DOM layers around it.
 */
export default function HeroScene3D({
  host,
  hasModel,
  onReady,
}: {
  host: HTMLElement;
  hasModel: boolean;
  onReady: () => void;
}) {
  const pointer = useRef({ x: 0.4, y: -0.1 });

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const r = host.getBoundingClientRect();
      pointer.current = {
        x: ((e.clientX - r.left) / r.width) * 2 - 1,
        y: -(((e.clientY - r.top) / r.height) * 2 - 1),
      };
    };
    host.addEventListener('pointermove', onMove);
    return () => host.removeEventListener('pointermove', onMove);
  }, [host]);

  return (
    <Canvas
      frameloop="demand"
      dpr={[1, 1.75]}
      camera={{ position: [0, 1.1, 7.2], fov: 30 }}
      gl={{ alpha: true, antialias: true, powerPreference: 'low-power' }}
      onCreated={({ camera, gl }) => {
        camera.lookAt(0, 1.05, 0);
        gl.setClearColor(0x000000, 0);
        requestAnimationFrame(onReady);
      }}
      aria-hidden
    >
      <ambientLight intensity={0.55} color="#9aa6d8" />
      <directionalLight position={[-3, 4, 2]} intensity={0.6} color="#b8a9ff" />
      <pointLight position={[1.5, 2, 3.5]} intensity={8} distance={9} color="#ffd9a0" />
      <Driver host={host} />
      <Suspense fallback={null}>
        {hasModel ? <SniffModel pointer={pointer} /> : <PlaceholderSniff pointer={pointer} />}
      </Suspense>
    </Canvas>
  );
}

/** Requests ~30fps while the hero is visible and the tab is shown; nothing otherwise. */
function Driver({ host }: { host: HTMLElement }) {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    let visible = true;
    let raf = 0;
    let last = 0;
    const loop = (t: number) => {
      raf = 0;
      if (!visible || document.hidden) return;
      if (t - last > 33) {
        last = t;
        invalidate();
      }
      raf = requestAnimationFrame(loop);
    };
    const start = () => {
      if (!raf) raf = requestAnimationFrame(loop);
    };
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible) start();
    });
    io.observe(host);
    const onVis = () => !document.hidden && start();
    document.addEventListener('visibilitychange', onVis);
    start();
    return () => {
      io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [host, invalidate]);
  return null;
}

/** Real model: plays idle by default (clips: idle, sniff, alert, triumph). */
function SniffModel({ pointer }: { pointer: Pointer }) {
  const { scene, animations } = useGLTF(SNIFF_MODEL_URL);
  const { actions, names } = useAnimations(animations, scene);
  const group = useRef<THREE.Group>(null);
  useEffect(() => {
    const clip = actions.idle ?? (names[0] ? actions[names[0]] : undefined);
    clip?.reset().fadeIn(0.3).play();
    return () => void clip?.fadeOut(0.3);
  }, [actions, names]);
  useFrame(() => {
    if (group.current)
      group.current.rotation.y = THREE.MathUtils.lerp(
        group.current.rotation.y,
        pointer.current.x * 0.5,
        0.08,
      );
  });
  return (
    <group ref={group} position={[0, 0, 0]}>
      <primitive object={scene} />
    </group>
  );
}

/** Stylised stand-in until sniff.glb exists: low-poly hound head, ears, teal coat and hat. */
function PlaceholderSniff({ pointer }: { pointer: Pointer }) {
  const head = useRef<THREE.Group>(null);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (!head.current) return;
    head.current.rotation.y = THREE.MathUtils.lerp(
      head.current.rotation.y,
      pointer.current.x * 0.6,
      0.08,
    );
    head.current.rotation.x = THREE.MathUtils.lerp(
      head.current.rotation.x,
      -pointer.current.y * 0.25,
      0.08,
    );
    head.current.position.y = 1.55 + Math.sin(t * 1.6) * 0.03;
  });
  const fur = '#d9a066';
  const ear = '#8a5a2b';
  return (
    <group position={[0, 0, 0]} rotation-y={-0.2}>
      {/* coat */}
      <mesh position={[0, 0.6, 0]}>
        <coneGeometry args={[0.75, 1.3, 8]} />
        <meshStandardMaterial color="#2ec4b6" roughness={0.7} flatShading />
      </mesh>
      <group ref={head} position={[0, 1.55, 0]}>
        <mesh>
          <icosahedronGeometry args={[0.5, 1]} />
          <meshStandardMaterial color={fur} flatShading />
        </mesh>
        <mesh position={[0, -0.12, 0.42]} scale={[1, 0.8, 1.1]}>
          <icosahedronGeometry args={[0.26, 1]} />
          <meshStandardMaterial color="#f3e2c4" flatShading />
        </mesh>
        <mesh position={[0, -0.04, 0.66]}>
          <sphereGeometry args={[0.08, 12, 12]} />
          <meshStandardMaterial color="#1b1410" roughness={0.3} />
        </mesh>
        {[-1, 1].map((s) => (
          <group key={s}>
            <mesh position={[s * 0.46, -0.25, 0]} rotation-z={s * 0.25}>
              <capsuleGeometry args={[0.13, 0.55, 4, 8]} />
              <meshStandardMaterial color={ear} flatShading />
            </mesh>
            <mesh position={[s * 0.17, 0.1, 0.43]}>
              <sphereGeometry args={[0.06, 10, 10]} />
              <meshStandardMaterial color="#1b1410" />
            </mesh>
          </group>
        ))}
        {/* hat */}
        <mesh position={[0, 0.42, -0.02]}>
          <cylinderGeometry args={[0.62, 0.62, 0.05, 16]} />
          <meshStandardMaterial color="#1f8f85" />
        </mesh>
        <mesh position={[0, 0.58, -0.02]}>
          <cylinderGeometry args={[0.33, 0.38, 0.3, 16]} />
          <meshStandardMaterial color="#2ec4b6" />
        </mesh>
      </group>
    </group>
  );
}

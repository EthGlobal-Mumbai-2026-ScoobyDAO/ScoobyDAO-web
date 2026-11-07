'use client';

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { lazy, Suspense, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

// Landing hero 3D Sniff (THEME.md §3). Loaded only on capable devices, on pointer intent.
// Renders on demand: a driver requests frames only while the hero is on screen.

export type Pointer = { current: { x: number; y: number } };

// The glTF loader (drei useGLTF/useAnimations + three-stdlib) is its own chunk, fetched only
// when public/models/manifest.json says sniff.glb exists.
const SniffModel = lazy(() => import('./SniffModel'));

export interface HeroScene3DProps {
  host: HTMLElement;
  hasModel: boolean;
  onReady: () => void;
  onFail: () => void;
}

/**
 * Transparent canvas that renders only Sniff, sized to his spot in the 2D scene. The night
 * scene, parallax and flashlight stay in the DOM layers around it.
 */
export default function HeroScene3D({ host, hasModel, onReady, onFail }: HeroScene3DProps) {
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
      dpr={[1, 1.5]}
      camera={{ position: [0, 1.1, 7.2], fov: 30 }}
      gl={{ alpha: true, antialias: true, powerPreference: 'low-power' }}
      onCreated={({ camera, gl }) => {
        camera.lookAt(0, 1.05, 0);
        gl.setClearColor(0x000000, 0);
        // Reveal once the first frame (and shader compile) has happened.
        requestAnimationFrame(() => requestAnimationFrame(onReady));
      }}
      onError={onFail}
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

const FUR = '#d9a066';
const EAR = '#8a5a2b';
const COAT = '#2ec4b6';
const COAT_DEEP = '#17706a';
const BRASS = '#c99a32';

// Trench coat silhouette, revolved: flared hem → belted waist → shoulders → neck.
const COAT_PROFILE = [
  [0.001, 0],
  [0.8, 0],
  [0.74, 0.22],
  [0.6, 0.62],
  [0.54, 0.86],
  [0.56, 1.06],
  [0.5, 1.16],
  [0.3, 1.24],
  [0.001, 1.26],
].map(([x, y]) => new THREE.Vector2(x, y));

/**
 * Stylised stand-in until sniff.glb exists: a stocky basset in a teal trench coat (flared hem,
 * shoulders, popped collar, lapels, belt and buckle, sleeves), long ears, hat and a brass magnifier.
 * The head follows the pointer; the body breathes slightly.
 */
function PlaceholderSniff({ pointer }: { pointer: Pointer }) {
  const head = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const coatGeo = useMemo(() => new THREE.LatheGeometry(COAT_PROFILE, 12), []);
  useEffect(() => () => coatGeo.dispose(), [coatGeo]);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (head.current) {
      head.current.rotation.y = THREE.MathUtils.lerp(head.current.rotation.y, pointer.current.x * 0.6, 0.08);
      head.current.rotation.x = THREE.MathUtils.lerp(head.current.rotation.x, -pointer.current.y * 0.25, 0.08);
      head.current.position.y = 1.62 + Math.sin(t * 1.6) * 0.025;
    }
    if (body.current) body.current.scale.y = 1 + Math.sin(t * 1.6) * 0.008;
  });
  const coat = <meshStandardMaterial color={COAT} roughness={0.75} flatShading />;
  const deep = <meshStandardMaterial color={COAT_DEEP} roughness={0.8} flatShading />;
  const fur = <meshStandardMaterial color={FUR} roughness={0.85} flatShading />;
  const brass = <meshStandardMaterial color={BRASS} metalness={0.6} roughness={0.35} />;
  return (
    <group rotation-y={-0.25}>
      <group ref={body}>
        {/* feet under the hem */}
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.3, 0.06, 0.52]} scale={[1, 0.55, 1.4]}>
            <sphereGeometry args={[0.17, 10, 8]} />
            {fur}
          </mesh>
        ))}
        {/* coat */}
        <mesh geometry={coatGeo} scale={[1, 1, 0.82]}>
          {coat}
        </mesh>
        {/* front opening */}
        <mesh position={[0, 0.5, 0.56]} rotation-x={-0.18}>
          <boxGeometry args={[0.025, 0.95, 0.02]} />
          {deep}
        </mesh>
        {/* belt + buckle */}
        <mesh position={[0, 0.72, 0]} rotation-x={Math.PI / 2} scale={[1, 0.82, 1]}>
          <torusGeometry args={[0.565, 0.05, 6, 24]} />
          {deep}
        </mesh>
        <mesh position={[0, 0.72, 0.48]}>
          <boxGeometry args={[0.16, 0.12, 0.04]} />
          {brass}
        </mesh>
        {/* buttons */}
        {[0.95, 0.42].flatMap((y) =>
          [-1, 1].map((s) => (
            <mesh key={`${y}${s}`} position={[s * 0.12, y, y > 0.6 ? 0.45 : 0.53]}>
              <sphereGeometry args={[0.035, 8, 6]} />
              {brass}
            </mesh>
          )),
        )}
        {/* shoulders */}
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.44, 1.1, 0]} scale={[1, 0.75, 0.9]}>
            <sphereGeometry args={[0.22, 10, 8]} />
            {coat}
          </mesh>
        ))}
        {/* popped collar and lapels */}
        <mesh position={[0, 1.27, -0.02]}>
          <cylinderGeometry args={[0.36, 0.28, 0.24, 12, 1, true]} />
          <meshStandardMaterial color={COAT_DEEP} roughness={0.8} flatShading side={THREE.DoubleSide} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.15, 1.04, 0.4]} rotation={[-0.35, 0, s * 0.45]}>
            <boxGeometry args={[0.13, 0.38, 0.03]} />
            {deep}
          </mesh>
        ))}
        {/* left sleeve hanging, paw */}
        <group position={[-0.52, 1.08, 0.02]} rotation-z={-0.18}>
          <mesh position={[0, -0.36, 0]}>
            <capsuleGeometry args={[0.12, 0.55, 4, 8]} />
            {coat}
          </mesh>
          <mesh position={[0, -0.72, 0.02]}>
            <sphereGeometry args={[0.12, 10, 8]} />
            {fur}
          </mesh>
        </group>
        {/* right sleeve raised forward with the magnifier */}
        <group position={[0.52, 1.08, 0.02]} rotation={[-0.9, 0, 0.35]}>
          <mesh position={[0, -0.33, 0]}>
            <capsuleGeometry args={[0.12, 0.5, 4, 8]} />
            {coat}
          </mesh>
          <mesh position={[0, -0.66, 0]}>
            <sphereGeometry args={[0.12, 10, 8]} />
            {fur}
          </mesh>
          <group position={[0, -0.66, 0]} rotation-x={0.9}>
            <mesh position={[0.06, 0.18, 0.06]}>
              <cylinderGeometry args={[0.03, 0.035, 0.32, 8]} />
              {brass}
            </mesh>
            <group position={[0.1, 0.48, 0.1]} rotation-y={-0.4}>
              <mesh>
                <torusGeometry args={[0.17, 0.035, 8, 20]} />
                {brass}
              </mesh>
              <mesh>
                <circleGeometry args={[0.16, 20]} />
                <meshStandardMaterial color="#dff6f3" transparent opacity={0.35} side={THREE.DoubleSide} />
              </mesh>
            </group>
          </group>
        </group>
      </group>
      <group ref={head} position={[0, 1.62, 0.04]}>
        <mesh>
          <icosahedronGeometry args={[0.48, 1]} />
          {fur}
        </mesh>
        {/* cream muzzle and jowls */}
        <mesh position={[0, -0.14, 0.38]} scale={[1.05, 0.85, 1.1]}>
          <icosahedronGeometry args={[0.26, 1]} />
          <meshStandardMaterial color="#f3e2c4" flatShading />
        </mesh>
        <mesh position={[0, -0.05, 0.64]}>
          <sphereGeometry args={[0.085, 12, 12]} />
          <meshStandardMaterial color="#1b1410" roughness={0.3} />
        </mesh>
        {[-1, 1].map((s) => (
          <group key={s}>
            {/* long basset ears, reaching past the chin */}
            <mesh position={[s * 0.45, -0.38, -0.02]} rotation-z={s * 0.16} scale={[1, 1, 0.55]}>
              <capsuleGeometry args={[0.16, 0.72, 4, 8]} />
              <meshStandardMaterial color={EAR} flatShading />
            </mesh>
            <mesh position={[s * 0.17, 0.08, 0.41]}>
              <sphereGeometry args={[0.06, 10, 10]} />
              <meshStandardMaterial color="#1b1410" />
            </mesh>
            {/* droopy lids */}
            <mesh position={[s * 0.17, 0.13, 0.4]} scale={[1.25, 0.5, 0.8]}>
              <sphereGeometry args={[0.07, 10, 8]} />
              {fur}
            </mesh>
          </group>
        ))}
        {/* hat */}
        <mesh position={[0, 0.4, -0.02]}>
          <cylinderGeometry args={[0.62, 0.62, 0.05, 16]} />
          <meshStandardMaterial color="#1f8f85" />
        </mesh>
        <mesh position={[0, 0.56, -0.02]}>
          <cylinderGeometry args={[0.33, 0.38, 0.3, 16]} />
          <meshStandardMaterial color={COAT} />
        </mesh>
        <mesh position={[0, 0.45, -0.02]}>
          <cylinderGeometry args={[0.385, 0.385, 0.07, 16]} />
          {deep}
        </mesh>
      </group>
    </group>
  );
}

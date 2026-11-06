'use client';

import { useAnimations, useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { Pointer } from './HeroScene3D';

export const SNIFF_MODEL_URL = '/models/sniff.glb';

/** Real model: plays idle by default (clips: idle, sniff, alert, triumph). */
export default function SniffModel({ pointer }: { pointer: Pointer }) {
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

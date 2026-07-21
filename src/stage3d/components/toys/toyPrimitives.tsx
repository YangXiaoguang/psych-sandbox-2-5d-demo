export type Vec3 = [number, number, number];

export type MaterialPreset =
  | "softPlastic"
  | "claySkin"
  | "paintedWood"
  | "warmCeramic"
  | "toyMetal"
  | "glassWater"
  | "sandMatte";

export const TOY_DARK = "#1b2828";
export const TOY_BLUSH = "#ef9d86";

const MATERIAL_PRESETS: Record<
  MaterialPreset,
  { clearcoat: number; clearcoatRoughness: number; color: string; metalness: number; roughness: number }
> = {
  softPlastic: { clearcoat: 0.42, clearcoatRoughness: 0.5, color: "#7fcfbe", metalness: 0.02, roughness: 0.44 },
  claySkin: { clearcoat: 0.18, clearcoatRoughness: 0.68, color: "#efb77e", metalness: 0, roughness: 0.56 },
  paintedWood: { clearcoat: 0.2, clearcoatRoughness: 0.66, color: "#c58a4f", metalness: 0.01, roughness: 0.72 },
  warmCeramic: { clearcoat: 0.36, clearcoatRoughness: 0.5, color: "#f2dec0", metalness: 0.01, roughness: 0.5 },
  toyMetal: { clearcoat: 0.32, clearcoatRoughness: 0.42, color: "#a9b9bd", metalness: 0.12, roughness: 0.38 },
  glassWater: { clearcoat: 0.62, clearcoatRoughness: 0.24, color: "#77d7e8", metalness: 0.02, roughness: 0.2 },
  sandMatte: { clearcoat: 0.06, clearcoatRoughness: 0.82, color: "#ead2a2", metalness: 0, roughness: 0.92 },
};

export function ToyMaterial({
  color,
  emissive,
  emissiveIntensity = 0,
  opacity = 1,
  preset,
}: {
  color?: string;
  emissive?: string;
  emissiveIntensity?: number;
  opacity?: number;
  preset: MaterialPreset;
}): JSX.Element {
  const base = MATERIAL_PRESETS[preset];

  return (
    <meshPhysicalMaterial
      color={color ?? base.color}
      clearcoat={base.clearcoat}
      clearcoatRoughness={base.clearcoatRoughness}
      emissive={emissive ?? "#000000"}
      emissiveIntensity={emissiveIntensity}
      metalness={base.metalness}
      opacity={opacity}
      roughness={base.roughness}
      transparent={opacity < 1}
    />
  );
}

export function EyePair({
  left = -0.075,
  right = 0.075,
  y,
  z,
  size = 0.028,
}: {
  left?: number;
  right?: number;
  y: number;
  z: number;
  size?: number;
}): JSX.Element {
  return (
    <>
      {[left, right].map((x) => (
        <group key={x}>
          <mesh position={[x, y, z]} castShadow>
            <sphereGeometry args={[size, 18, 12]} />
            <ToyMaterial preset="softPlastic" color={TOY_DARK} />
          </mesh>
          <mesh position={[x + size * 0.28, y + size * 0.34, z - size * 0.72]} renderOrder={4}>
            <sphereGeometry args={[size * 0.32, 10, 8]} />
            <meshBasicMaterial color="#f8ffff" transparent opacity={0.9} depthWrite={false} />
          </mesh>
        </group>
      ))}
    </>
  );
}

export function Smile({
  position,
  rotation = [Math.PI / 2, 0, 0] as Vec3,
  scale = [1, 1, 1] as Vec3,
}: {
  position: Vec3;
  rotation?: Vec3;
  scale?: Vec3;
}): JSX.Element {
  return (
    <mesh position={position} rotation={rotation} scale={scale} castShadow>
      <torusGeometry args={[0.095, 0.011, 8, 28, Math.PI]} />
      <ToyMaterial preset="softPlastic" color={TOY_DARK} />
    </mesh>
  );
}

export function Cheeks({ y, z, width = 0.165 }: { y: number; z: number; width?: number }): JSX.Element {
  return (
    <>
      {[-width, width].map((x) => (
        <mesh key={x} position={[x, y, z]} scale={[1.32, 0.78, 0.24]} castShadow>
          <sphereGeometry args={[0.033, 16, 10]} />
          <ToyMaterial preset="claySkin" color={TOY_BLUSH} opacity={0.72} />
        </mesh>
      ))}
    </>
  );
}

export function ToyHighlight({
  color = "#fff6d8",
  opacity = 0.32,
  position,
  rotation = [0, 0, 0] as Vec3,
  scale = [1, 1, 1] as Vec3,
}: {
  color?: string;
  opacity?: number;
  position: Vec3;
  rotation?: Vec3;
  scale?: Vec3;
}): JSX.Element {
  return (
    <mesh position={position} rotation={rotation} scale={scale} renderOrder={5}>
      <sphereGeometry args={[0.08, 18, 10]} />
      <meshBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} />
    </mesh>
  );
}

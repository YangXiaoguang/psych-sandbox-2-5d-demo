import { RoundedBoxMesh } from "../RoundedBoxMesh";

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

export function ToyStud({
  color = "#fff2d2",
  opacity = 1,
  position,
  preset = "warmCeramic",
  size = 0.018,
}: {
  color?: string;
  opacity?: number;
  position: Vec3;
  preset?: MaterialPreset;
  size?: number;
}): JSX.Element {
  return (
    <mesh position={position} castShadow>
      <sphereGeometry args={[size, 12, 8]} />
      <ToyMaterial preset={preset} color={color} opacity={opacity} />
    </mesh>
  );
}

export function ToyStripe({
  color = "#fff1c8",
  length = 0.18,
  opacity = 1,
  position,
  radius = 0.008,
  rotation = [0, 0, Math.PI / 2] as Vec3,
  preset = "warmCeramic",
}: {
  color?: string;
  length?: number;
  opacity?: number;
  position: Vec3;
  radius?: number;
  rotation?: Vec3;
  preset?: MaterialPreset;
}): JSX.Element {
  return (
    <mesh position={position} rotation={rotation} castShadow>
      <capsuleGeometry args={[radius, length, 4, 8]} />
      <ToyMaterial preset={preset} color={color} opacity={opacity} />
    </mesh>
  );
}

export function ToyBeadRow({
  color = "#fff2d2",
  count = 5,
  end,
  opacity = 1,
  preset = "warmCeramic",
  size = 0.014,
  start,
}: {
  color?: string;
  count?: number;
  end: Vec3;
  opacity?: number;
  preset?: MaterialPreset;
  size?: number;
  start: Vec3;
}): JSX.Element {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => {
        const progress = count === 1 ? 0 : index / (count - 1);
        const position: Vec3 = [
          start[0] + (end[0] - start[0]) * progress,
          start[1] + (end[1] - start[1]) * progress,
          start[2] + (end[2] - start[2]) * progress,
        ];
        return <ToyStud key={`${position.join("-")}-${index}`} position={position} color={color} opacity={opacity} preset={preset} size={size} />;
      })}
    </>
  );
}

export function ToyBow({
  color = "#e85643",
  knotColor = "#ffd46f",
  opacity = 1,
  position,
  rotation = [0, 0, 0] as Vec3,
  scale = [1, 1, 1] as Vec3,
}: {
  color?: string;
  knotColor?: string;
  opacity?: number;
  position: Vec3;
  rotation?: Vec3;
  scale?: Vec3;
}): JSX.Element {
  return (
    <group position={position} rotation={rotation} scale={scale}>
      {[-0.055, 0.055].map((x) => (
        <mesh key={`bow-loop-${x}`} position={[x, 0, -0.006]} scale={[1.3, 0.72, 0.35]} castShadow>
          <sphereGeometry args={[0.058, 16, 10]} />
          <ToyMaterial preset="softPlastic" color={color} opacity={opacity} />
        </mesh>
      ))}
      <mesh position={[0, 0, -0.02]} scale={[0.9, 0.8, 0.55]} castShadow>
        <sphereGeometry args={[0.034, 14, 10]} />
        <ToyMaterial preset="softPlastic" color={knotColor} opacity={opacity} />
      </mesh>
      {[-0.035, 0.035].map((x) => (
        <mesh key={`bow-tail-${x}`} position={[x, -0.055, -0.004]} rotation={[0, 0, x > 0 ? -0.38 : 0.38]} castShadow>
          <coneGeometry args={[0.026, 0.09, 3]} />
          <ToyMaterial preset="softPlastic" color={color} opacity={opacity} />
        </mesh>
      ))}
      <ToyHighlight position={[-0.04, 0.026, -0.052]} scale={[0.42, 0.2, 0.12]} opacity={0.24} color="#fff4ce" />
    </group>
  );
}

export function ToyInsetPlate({
  color = "#fff1d1",
  opacity = 1,
  position,
  radius = 0.018,
  rotation = [0, 0, 0] as Vec3,
  size,
}: {
  color?: string;
  opacity?: number;
  position: Vec3;
  radius?: number;
  rotation?: Vec3;
  size: Vec3;
}): JSX.Element {
  return (
    <RoundedBoxMesh size={size} radius={radius} smoothness={4} position={position} rotation={rotation} castShadow>
      <ToyMaterial preset="warmCeramic" color={color} opacity={opacity} />
    </RoundedBoxMesh>
  );
}

export function ToyWoodGrain({
  color = "#8b5c38",
  count = 3,
  length = 0.18,
  opacity = 0.58,
  origin,
  spread = 0.09,
}: {
  color?: string;
  count?: number;
  length?: number;
  opacity?: number;
  origin: Vec3;
  spread?: number;
}): JSX.Element {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => {
        const offset = count === 1 ? 0 : (index / (count - 1) - 0.5) * spread;
        return (
          <ToyStripe
            key={`grain-${origin.join("-")}-${index}`}
            position={[origin[0] + offset, origin[1] + index * 0.006, origin[2]]}
            rotation={[0, 0, Math.PI / 2 + (index - 1) * 0.08]}
            length={length * (1 - index * 0.08)}
            radius={0.0038}
            preset="paintedWood"
            color={color}
            opacity={opacity}
          />
        );
      })}
    </>
  );
}

export function ToyStitchRow({
  color = "#fff5d6",
  count = 5,
  end,
  opacity = 0.76,
  size = 0.007,
  start,
}: {
  color?: string;
  count?: number;
  end: Vec3;
  opacity?: number;
  size?: number;
  start: Vec3;
}): JSX.Element {
  return <ToyBeadRow start={start} end={end} count={count} color={color} preset="warmCeramic" size={size} opacity={opacity} />;
}

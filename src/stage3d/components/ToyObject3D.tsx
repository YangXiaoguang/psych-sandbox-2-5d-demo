import type { ThreeEvent } from "@react-three/fiber";
import { useMemo } from "react";
import * as THREE from "three";
import type { ToyModelRecipe } from "../../types";
import { RoundedBoxMesh } from "./RoundedBoxMesh";

type Vec3 = [number, number, number];
type MaterialPreset = "softPlastic" | "claySkin" | "paintedWood" | "warmCeramic" | "toyMetal" | "glassWater" | "sandMatte";

interface ToyObject3DProps {
  dragging?: boolean;
  modelRecipe: ToyModelRecipe;
  onPointerDown?: (event: ThreeEvent<PointerEvent>) => void;
  position: Vec3;
  rotation?: Vec3;
  scale?: number;
  selected?: boolean;
}

const MATERIAL_PRESETS: Record<MaterialPreset, { clearcoat: number; clearcoatRoughness: number; color: string; metalness: number; roughness: number }> = {
  softPlastic: { clearcoat: 0.42, clearcoatRoughness: 0.5, color: "#7fcfbe", metalness: 0.02, roughness: 0.44 },
  claySkin: { clearcoat: 0.18, clearcoatRoughness: 0.68, color: "#efb77e", metalness: 0, roughness: 0.56 },
  paintedWood: { clearcoat: 0.2, clearcoatRoughness: 0.66, color: "#c58a4f", metalness: 0.01, roughness: 0.72 },
  warmCeramic: { clearcoat: 0.36, clearcoatRoughness: 0.5, color: "#f2dec0", metalness: 0.01, roughness: 0.5 },
  toyMetal: { clearcoat: 0.32, clearcoatRoughness: 0.42, color: "#a9b9bd", metalness: 0.12, roughness: 0.38 },
  glassWater: { clearcoat: 0.62, clearcoatRoughness: 0.24, color: "#77d7e8", metalness: 0.02, roughness: 0.2 },
  sandMatte: { clearcoat: 0.06, clearcoatRoughness: 0.82, color: "#ead2a2", metalness: 0, roughness: 0.92 },
};

const TOY_DARK = "#1b2828";
const TOY_BLUSH = "#ef9d86";

function ToyMaterial({
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

function EyePair({
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

function Smile({
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

function Cheeks({ y, z, width = 0.165 }: { y: number; z: number; width?: number }): JSX.Element {
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

function ToyHighlight({
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

export function ToyObject3D({
  dragging = false,
  modelRecipe,
  onPointerDown,
  position,
  rotation = [0, 0, 0],
  scale = 1,
  selected = false,
}: ToyObject3DProps): JSX.Element {
  return (
    <group
      position={position}
      rotation={rotation}
      scale={scale}
      onPointerDown={onPointerDown}
      onPointerOver={() => {
        document.body.style.cursor = dragging ? "grabbing" : "grab";
      }}
      onPointerOut={() => {
        document.body.style.cursor = "";
      }}
    >
      <SelectionHalo active={selected} dragging={dragging} />
      <ToyDropShadow opacity={selected ? 0.34 : 0.24} radius={getShadowRadius(modelRecipe.kind)} />
      {renderToyModel(modelRecipe)}
    </group>
  );
}

function renderToyModel(recipe: ToyModelRecipe): JSX.Element {
  switch (recipe.kind) {
    case "person":
      return <PersonToy cloth={recipe.cloth} skin={recipe.skin} bodyScale={recipe.bodyScale} elder={recipe.elder} />;
    case "dog":
      return <DogToy />;
    case "bird":
      return <BirdToy />;
    case "fish":
      return <FishToy />;
    case "lion":
      return <LionToy />;
    case "house":
      return <HouseToy />;
    case "bridge":
      return <BridgeToy />;
    case "fence":
      return <FenceToy />;
    case "tower":
      return <TowerToy />;
    case "tree":
      return <TreeToy />;
    case "water":
      return <WaterToy />;
    case "rock":
      return <RockToy />;
    case "sun":
      return <SunToy />;
    case "monster":
      return <MonsterToy />;
    case "robot":
      return <RobotToy />;
    case "skull":
      return <SkullToy />;
    case "light":
      return <LightToy />;
    case "fallback":
    default:
      return <FallbackToy />;
  }
}

function SelectionHalo({ active, dragging }: { active: boolean; dragging: boolean }): JSX.Element | null {
  if (!active) {
    return null;
  }

  return (
    <mesh position={[0, -0.16, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={10}>
      <ringGeometry args={[0.54, 0.62, 56]} />
      <meshBasicMaterial color={dragging ? "#f7d46b" : "#63d7cb"} transparent opacity={0.92} depthWrite={false} />
    </mesh>
  );
}

function ToyDropShadow({ opacity, radius }: { opacity: number; radius: number }): JSX.Element {
  const shadowTexture = useMemo(() => createSoftShadowTexture(), []);

  return (
    <mesh position={[0, -0.181, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow renderOrder={1}>
      <circleGeometry args={[radius, 48]} />
      <meshBasicMaterial map={shadowTexture} color="#1e160c" transparent opacity={opacity} depthWrite={false} />
    </mesh>
  );
}

function createSoftShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  if (context) {
    const gradient = context.createRadialGradient(128, 128, 8, 128, 128, 126);
    gradient.addColorStop(0, "rgba(255,255,255,0.98)");
    gradient.addColorStop(0.42, "rgba(255,255,255,0.58)");
    gradient.addColorStop(0.72, "rgba(255,255,255,0.18)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function HouseToy(): JSX.Element {
  return (
    <group>
      <RoundedBoxMesh size={[1.0, 0.08, 0.9]} radius={0.08} smoothness={6} position={[0, 0.03, 0.02]} castShadow receiveShadow>
        <ToyMaterial preset="sandMatte" color="#dcc092" />
      </RoundedBoxMesh>
      <RoundedBoxMesh size={[0.92, 0.68, 0.78]} radius={0.095} smoothness={8} position={[0, 0.28, 0]} castShadow receiveShadow>
        <ToyMaterial preset="warmCeramic" color="#f4dab2" />
      </RoundedBoxMesh>
      <mesh position={[0, 0.77, 0]} rotation={[0, Math.PI / 4, 0]} castShadow receiveShadow>
        <coneGeometry args={[0.76, 0.48, 4]} />
        <ToyMaterial preset="softPlastic" color="#de6845" />
      </mesh>
      <RoundedBoxMesh size={[1.04, 0.055, 0.11]} radius={0.026} smoothness={4} position={[0, 0.64, -0.42]} castShadow receiveShadow>
        <ToyMaterial preset="softPlastic" color="#f08a56" />
      </RoundedBoxMesh>
      <RoundedBoxMesh size={[0.11, 0.055, 0.82]} radius={0.026} smoothness={4} position={[-0.43, 0.64, 0]} castShadow receiveShadow>
        <ToyMaterial preset="softPlastic" color="#b94f39" />
      </RoundedBoxMesh>
      {[-0.26, 0, 0.26].map((x) => (
        <RoundedBoxMesh key={x} size={[0.045, 0.38, 0.055]} radius={0.016} smoothness={3} position={[x, 0.84, -0.18]} rotation={[0.08, 0, 0]} castShadow>
          <ToyMaterial preset="paintedWood" color="#f0a24d" />
        </RoundedBoxMesh>
      ))}
      <ToyHighlight position={[-0.18, 0.94, -0.18]} scale={[1.8, 0.34, 0.62]} opacity={0.2} />
      <mesh position={[0.28, 0.96, 0.18]} castShadow receiveShadow>
        <cylinderGeometry args={[0.055, 0.07, 0.22, 12]} />
        <ToyMaterial preset="paintedWood" color="#9a6742" />
      </mesh>
      <RoundedBoxMesh size={[0.16, 0.05, 0.16]} radius={0.024} smoothness={4} position={[0.28, 1.1, 0.18]} castShadow>
        <ToyMaterial preset="paintedWood" color="#7e5236" />
      </RoundedBoxMesh>
      <RoundedBoxMesh size={[0.22, 0.34, 0.035]} radius={0.025} smoothness={4} position={[0, 0.13, -0.405]} castShadow>
        <ToyMaterial preset="paintedWood" color="#8b542f" />
      </RoundedBoxMesh>
      <mesh position={[0.06, 0.13, -0.428]} castShadow>
        <sphereGeometry args={[0.018, 12, 8]} />
        <ToyMaterial preset="toyMetal" color="#f0c167" />
      </mesh>
      <RoundedBoxMesh size={[0.32, 0.055, 0.16]} radius={0.03} smoothness={4} position={[0, -0.01, -0.49]} castShadow receiveShadow>
        <ToyMaterial preset="sandMatte" color="#c6ae83" />
      </RoundedBoxMesh>
      {[-0.12, 0.03, 0.18].map((x, index) => (
        <RoundedBoxMesh
          key={x}
          size={[0.16, 0.028, 0.11]}
          radius={0.028}
          smoothness={4}
          position={[x, -0.045, -0.68 - index * 0.1]}
          rotation={[0, 0.15 - index * 0.08, 0]}
          castShadow
          receiveShadow
        >
          <ToyMaterial preset="sandMatte" color={index % 2 === 0 ? "#d9c294" : "#bfa77e"} />
        </RoundedBoxMesh>
      ))}
      <RoundedBoxMesh size={[0.18, 0.16, 0.035]} radius={0.02} smoothness={4} position={[-0.25, 0.3, -0.407]} castShadow>
        <ToyMaterial preset="glassWater" color="#9fdbe8" opacity={0.86} />
      </RoundedBoxMesh>
      <RoundedBoxMesh size={[0.18, 0.16, 0.035]} radius={0.02} smoothness={4} position={[0.25, 0.3, -0.407]} castShadow>
        <ToyMaterial preset="glassWater" color="#9fdbe8" opacity={0.86} />
      </RoundedBoxMesh>
      {[-0.25, 0.25].map((x) => (
        <group key={x}>
          <RoundedBoxMesh size={[0.205, 0.027, 0.02]} radius={0.01} smoothness={2} position={[x, 0.3, -0.431]} castShadow>
            <ToyMaterial preset="paintedWood" color="#f7ead6" />
          </RoundedBoxMesh>
          <RoundedBoxMesh size={[0.022, 0.18, 0.02]} radius={0.008} smoothness={2} position={[x, 0.3, -0.434]} castShadow>
            <ToyMaterial preset="paintedWood" color="#f7ead6" />
          </RoundedBoxMesh>
        </group>
      ))}
      {[-0.36, 0.36].map((x) => (
        <mesh key={x} position={[x, 0.14, -0.43]} scale={[1.1, 0.62, 0.5]} castShadow receiveShadow>
          <sphereGeometry args={[0.09, 16, 10]} />
          <ToyMaterial preset="softPlastic" color="#74bf76" />
        </mesh>
      ))}
      {[-0.39, 0.33, 0.42].map((x, index) => (
        <mesh key={x} position={[x, 0.2 + index * 0.015, -0.51]} castShadow>
          <sphereGeometry args={[0.023, 10, 8]} />
          <ToyMaterial preset="softPlastic" color={index === 1 ? "#ffd35d" : "#f07d73"} />
        </mesh>
      ))}
    </group>
  );
}

function PersonToy({
  bodyScale,
  cloth,
  elder,
  skin,
}: {
  bodyScale: number;
  cloth: string;
  elder?: boolean;
  skin: string;
}): JSX.Element {
  const isChild = bodyScale < 0.94;
  const isAdult = !elder && !isChild;

  return (
    <group scale={[bodyScale, bodyScale, bodyScale]}>
      <RoundedBoxMesh size={[0.38, 0.58, 0.28]} radius={0.14} smoothness={8} position={[0, 0.24, 0]} castShadow receiveShadow>
        <ToyMaterial preset="softPlastic" color={cloth} />
      </RoundedBoxMesh>
      <RoundedBoxMesh size={[0.16, 0.32, 0.025]} radius={0.025} smoothness={3} position={[0, 0.28, -0.155]} castShadow>
        <ToyMaterial preset="softPlastic" color={isAdult ? "#f7ead8" : "#fff4df"} opacity={0.92} />
      </RoundedBoxMesh>
      {isAdult ? (
        <mesh position={[0, 0.31, -0.175]} rotation={[0, 0, Math.PI / 4]} castShadow>
          <coneGeometry args={[0.055, 0.18, 4]} />
          <ToyMaterial preset="softPlastic" color="#5b3226" />
        </mesh>
      ) : null}
      {[-0.06, 0.06].map((x) => (
        <mesh key={x} position={[x, 0.18, -0.166]} castShadow>
          <sphereGeometry args={[0.018, 10, 8]} />
          <ToyMaterial preset="warmCeramic" color="#fff5de" />
        </mesh>
      ))}
      <RoundedBoxMesh size={[0.34, 0.12, 0.18]} radius={0.04} smoothness={4} position={[0, 0.51, -0.105]} castShadow>
        <ToyMaterial preset="warmCeramic" color="#fff4df" />
      </RoundedBoxMesh>
      <mesh position={[0, 0.72, 0]} castShadow receiveShadow>
        <sphereGeometry args={[0.24, 32, 24]} />
        <ToyMaterial preset="claySkin" color={skin} />
      </mesh>
      <ToyHighlight position={[-0.075, 0.79, -0.17]} scale={[0.85, 0.48, 0.28]} opacity={0.2} />
      <EyePair y={0.755} z={-0.207} size={0.027} />
      {isAdult ? (
        <>
          {[-0.075, 0.075].map((x) => (
            <mesh key={x} position={[x, 0.755, -0.22]} castShadow>
              <torusGeometry args={[0.05, 0.006, 6, 18]} />
              <ToyMaterial preset="toyMetal" color="#4c4035" />
            </mesh>
          ))}
          <RoundedBoxMesh size={[0.05, 0.008, 0.012]} radius={0.003} smoothness={2} position={[0, 0.755, -0.222]} castShadow>
            <ToyMaterial preset="toyMetal" color="#4c4035" />
          </RoundedBoxMesh>
        </>
      ) : null}
      <Cheeks y={0.705} z={-0.214} width={0.125} />
      <mesh position={[0, 0.71, -0.228]} scale={[0.75, 0.4, 0.35]} castShadow>
        <sphereGeometry args={[0.026, 14, 10]} />
        <ToyMaterial preset="claySkin" color="#e6a673" />
      </mesh>
      <Smile position={[0, 0.66, -0.225]} scale={[0.62, 0.42, 0.62]} />
      <mesh position={[0, 0.86, 0.03]} castShadow>
        <sphereGeometry args={[0.245, 32, 12, 0, Math.PI * 2, 0, Math.PI * 0.48]} />
        <ToyMaterial preset="softPlastic" color={elder ? "#f2ede0" : "#49301f"} />
      </mesh>
      {!elder ? (
        <>
          <mesh position={[0, 0.8, -0.17]} rotation={[0.6, 0, 0]} castShadow>
            <torusGeometry args={[0.135, 0.016, 8, 22, Math.PI]} />
            <ToyMaterial preset="softPlastic" color="#3a2419" />
          </mesh>
          {isChild ? (
            <mesh position={[-0.12, 0.86, -0.06]} rotation={[0.2, 0, 0.45]} castShadow>
              <capsuleGeometry args={[0.027, 0.18, 5, 10]} />
              <ToyMaterial preset="softPlastic" color="#51331f" />
            </mesh>
          ) : null}
        </>
      ) : (
        <>
          {[-0.1, 0.1].map((x) => (
            <mesh key={x} position={[x, 0.79, -0.19]} rotation={[0.5, 0, x > 0 ? -0.1 : 0.1]} castShadow>
              <capsuleGeometry args={[0.012, 0.14, 4, 8]} />
              <ToyMaterial preset="softPlastic" color="#d9d1c5" />
            </mesh>
          ))}
        </>
      )}
      <mesh position={[-0.2, 0.23, -0.02]} rotation={[0.15, 0, 0.28]} castShadow receiveShadow>
        <capsuleGeometry args={[0.065, 0.36, 6, 16]} />
        <ToyMaterial preset="claySkin" color={skin} />
      </mesh>
      <mesh position={[0.2, 0.23, -0.02]} rotation={[0.1, 0, -0.28]} castShadow receiveShadow>
        <capsuleGeometry args={[0.065, 0.36, 6, 16]} />
        <ToyMaterial preset="claySkin" color={skin} />
      </mesh>
      {[-0.11, 0.11].map((x) => (
        <mesh key={x} position={[x, -0.04, -0.02]} rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
          <capsuleGeometry args={[0.048, 0.18, 5, 10]} />
          <ToyMaterial preset="softPlastic" color="#5f3c26" />
        </mesh>
      ))}
      {[-0.11, 0.11].map((x) => (
        <RoundedBoxMesh key={x} size={[0.14, 0.045, 0.16]} radius={0.028} smoothness={4} position={[x, -0.09, -0.09]} castShadow receiveShadow>
          <ToyMaterial preset="softPlastic" color={elder ? "#6e6258" : "#4f3423"} />
        </RoundedBoxMesh>
      ))}
      {elder ? (
        <group position={[0.28, 0.14, -0.08]} rotation={[0.08, 0, -0.12]}>
          <mesh castShadow receiveShadow>
            <cylinderGeometry args={[0.018, 0.018, 0.62, 10]} />
            <ToyMaterial preset="paintedWood" color="#8a5f3b" />
          </mesh>
          <mesh position={[0, -0.32, 0]} castShadow>
            <sphereGeometry args={[0.035, 12, 8]} />
            <ToyMaterial preset="paintedWood" color="#8a5f3b" />
          </mesh>
        </group>
      ) : null}
    </group>
  );
}

function DogToy(): JSX.Element {
  return (
    <group>
      <mesh position={[0, 0.25, 0]} rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
        <capsuleGeometry args={[0.18, 0.56, 7, 18]} />
        <ToyMaterial preset="softPlastic" color="#d99a50" />
      </mesh>
      <mesh position={[-0.08, 0.33, -0.15]} rotation={[0.15, -0.1, 0.2]} scale={[1.25, 0.7, 0.28]} castShadow>
        <sphereGeometry args={[0.095, 16, 10]} />
        <ToyMaterial preset="warmCeramic" color="#f6d6a0" />
      </mesh>
      <mesh position={[0.43, 0.34, -0.02]} castShadow receiveShadow>
        <sphereGeometry args={[0.2, 28, 20]} />
        <ToyMaterial preset="softPlastic" color="#e7b26a" />
      </mesh>
      <ToyHighlight position={[0.36, 0.43, -0.12]} scale={[0.9, 0.44, 0.3]} opacity={0.18} />
      <mesh position={[0.58, 0.31, -0.075]} scale={[1.2, 0.72, 0.86]} castShadow receiveShadow>
        <sphereGeometry args={[0.09, 18, 12]} />
        <ToyMaterial preset="warmCeramic" color="#f5cf98" />
      </mesh>
      <mesh position={[0.52, 0.37, -0.18]} castShadow>
        <sphereGeometry args={[0.035, 14, 10]} />
        <ToyMaterial preset="softPlastic" color={TOY_DARK} />
      </mesh>
      <mesh position={[0.66, 0.31, -0.165]} castShadow>
        <sphereGeometry args={[0.026, 12, 8]} />
        <ToyMaterial preset="softPlastic" color="#2c2520" />
      </mesh>
      <Cheeks y={0.29} z={-0.175} width={0.085} />
      {[0.32, 0.5].map((x, index) => (
        <mesh key={x} position={[x, 0.48, index === 0 ? 0.08 : -0.02]} rotation={[0.32, 0, index === 0 ? -0.45 : 0.45]} castShadow>
          <capsuleGeometry args={[0.055, 0.22, 5, 12]} />
          <ToyMaterial preset="softPlastic" color="#8d5a35" />
        </mesh>
      ))}
      <mesh position={[0.18, 0.5, 0.02]} rotation={[0.15, 0, -0.25]} castShadow>
        <capsuleGeometry args={[0.045, 0.28, 5, 12]} />
        <ToyMaterial preset="softPlastic" color="#8d5a35" />
      </mesh>
      {[-0.22, 0.18, -0.06, 0.34].map((x, index) => (
        <mesh key={x} position={[x, 0.02, -0.1]} castShadow>
          <capsuleGeometry args={[0.04, 0.24, 5, 10]} />
          <ToyMaterial preset="paintedWood" color={index % 2 === 0 ? "#8d5a35" : "#a56c42"} />
        </mesh>
      ))}
      <mesh position={[-0.42, 0.44, 0]} rotation={[0, 0, 0.78]} castShadow>
        <capsuleGeometry args={[0.035, 0.32, 5, 10]} />
        <ToyMaterial preset="softPlastic" color="#8d5a35" />
      </mesh>
      <mesh position={[0.08, 0.42, -0.145]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <torusGeometry args={[0.18, 0.018, 8, 28]} />
        <ToyMaterial preset="softPlastic" color="#4ea7c8" />
      </mesh>
      <mesh position={[0.14, 0.22, -0.3]} castShadow>
        <sphereGeometry args={[0.035, 12, 8]} />
        <ToyMaterial preset="softPlastic" color="#f4cf65" />
      </mesh>
      {[-0.22, 0.18, -0.06, 0.34].map((x) => (
        <mesh key={`paw-${x}`} position={[x, -0.09, -0.18]} scale={[1.25, 0.55, 0.75]} castShadow receiveShadow>
          <sphereGeometry args={[0.052, 12, 8]} />
          <ToyMaterial preset="warmCeramic" color="#f2c487" />
        </mesh>
      ))}
    </group>
  );
}

function BirdToy(): JSX.Element {
  return (
    <group>
      <mesh position={[0, 0.28, 0]} castShadow receiveShadow>
        <sphereGeometry args={[0.27, 32, 22]} />
        <ToyMaterial preset="softPlastic" color="#78c7e7" />
      </mesh>
      <mesh position={[0.02, 0.18, -0.22]} scale={[1.15, 0.72, 0.24]} castShadow>
        <sphereGeometry args={[0.13, 18, 12]} />
        <ToyMaterial preset="warmCeramic" color="#dff8ef" opacity={0.86} />
      </mesh>
      <mesh position={[0.03, 0.5, -0.03]} castShadow receiveShadow>
        <sphereGeometry args={[0.18, 24, 18]} />
        <ToyMaterial preset="softPlastic" color="#8fd4ef" />
      </mesh>
      <ToyHighlight position={[-0.08, 0.58, -0.13]} scale={[0.72, 0.44, 0.24]} opacity={0.22} />
      <mesh position={[0.03, 0.5, -0.2]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <coneGeometry args={[0.06, 0.17, 18]} />
        <ToyMaterial preset="softPlastic" color="#f2b544" />
      </mesh>
      <EyePair left={-0.045} right={0.105} y={0.55} z={-0.18} size={0.022} />
      <mesh position={[-0.22, 0.25, 0.02]} rotation={[0.2, 0, 0.75]} castShadow>
        <capsuleGeometry args={[0.055, 0.34, 5, 14]} />
        <ToyMaterial preset="softPlastic" color="#3fa3c4" />
      </mesh>
      <mesh position={[0.22, 0.25, 0.02]} rotation={[0.2, 0, -0.75]} castShadow>
        <capsuleGeometry args={[0.055, 0.34, 5, 14]} />
        <ToyMaterial preset="softPlastic" color="#3fa3c4" />
      </mesh>
      {[-0.26, 0.26].map((x) => (
        <group key={x} position={[x, 0.26, -0.08]} rotation={[0.15, 0, x > 0 ? -0.68 : 0.68]}>
          {[0, 0.055, 0.11].map((offset) => (
            <mesh key={offset} position={[0, -offset, 0]} castShadow>
              <capsuleGeometry args={[0.015, 0.18, 4, 8]} />
              <ToyMaterial preset="glassWater" color="#b3edf3" opacity={0.8} />
            </mesh>
          ))}
        </group>
      ))}
      {[-0.08, 0.08].map((x) => (
        <mesh key={x} position={[x, 0.05, -0.04]} rotation={[0.18, 0, 0]} castShadow>
          <capsuleGeometry args={[0.012, 0.2, 4, 8]} />
          <ToyMaterial preset="paintedWood" color="#b66d42" />
        </mesh>
      ))}
      {[-0.1, 0.1].map((x) => (
        <mesh key={`toe-${x}`} position={[x, -0.055, -0.14]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <capsuleGeometry args={[0.011, 0.1, 4, 8]} />
          <ToyMaterial preset="paintedWood" color="#d08343" />
        </mesh>
      ))}
      <mesh position={[-0.02, 0.2, 0.25]} rotation={[-0.1, 0, Math.PI / 2]} castShadow>
        <coneGeometry args={[0.16, 0.28, 3]} />
        <ToyMaterial preset="softPlastic" color="#4aaed1" />
      </mesh>
    </group>
  );
}

function FishToy(): JSX.Element {
  return (
    <group rotation={[0, -0.45, 0]}>
      <mesh position={[0, 0.26, 0]} scale={[1.38, 0.78, 0.7]} castShadow receiveShadow>
        <sphereGeometry args={[0.28, 32, 20]} />
        <ToyMaterial preset="glassWater" color="#75d6df" />
      </mesh>
      <ToyHighlight position={[0.1, 0.39, -0.2]} scale={[1.55, 0.42, 0.28]} opacity={0.28} color="#efffff" />
      <mesh position={[-0.48, 0.26, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <coneGeometry args={[0.2, 0.34, 3]} />
        <ToyMaterial preset="glassWater" color="#55bcc9" />
      </mesh>
      <mesh position={[-0.53, 0.26, 0]} rotation={[0, 0, Math.PI / 2]} scale={[1.16, 1.16, 1]} castShadow>
        <torusGeometry args={[0.12, 0.011, 8, 3]} />
        <ToyMaterial preset="glassWater" color="#d4fbff" opacity={0.62} />
      </mesh>
      <mesh position={[0.2, 0.38, -0.2]} castShadow>
        <sphereGeometry args={[0.026, 14, 10]} />
        <ToyMaterial preset="softPlastic" color="#203233" />
      </mesh>
      <mesh position={[0.21, 0.392, -0.222]} renderOrder={4}>
        <sphereGeometry args={[0.008, 8, 6]} />
        <meshBasicMaterial color="#faffff" transparent opacity={0.9} depthWrite={false} />
      </mesh>
      <mesh position={[0.33, 0.23, -0.19]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <torusGeometry args={[0.042, 0.006, 6, 18, Math.PI]} />
        <ToyMaterial preset="glassWater" color="#398e9d" />
      </mesh>
      {[0.02, 0.16, 0.3].map((x) => (
        <mesh key={x} position={[x, 0.3, -0.18]} rotation={[0.1, 0, 0.35]} scale={[0.34, 0.78, 0.12]} castShadow>
          <sphereGeometry args={[0.085, 16, 10]} />
          <ToyMaterial preset="glassWater" color="#a7edf0" opacity={0.8} />
        </mesh>
      ))}
      <mesh position={[0.03, 0.5, 0.02]} rotation={[0, 0, 0.2]} castShadow>
        <coneGeometry args={[0.11, 0.24, 3]} />
        <ToyMaterial preset="glassWater" color="#5ccbd6" />
      </mesh>
      <mesh position={[0.08, 0.12, 0.02]} rotation={[Math.PI, 0, -0.18]} castShadow>
        <coneGeometry args={[0.1, 0.2, 3]} />
        <ToyMaterial preset="glassWater" color="#5ccbd6" />
      </mesh>
    </group>
  );
}

function LionToy(): JSX.Element {
  return (
    <group>
      <mesh position={[0, 0.25, 0]} rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
        <capsuleGeometry args={[0.2, 0.58, 7, 18]} />
        <ToyMaterial preset="softPlastic" color="#d99a45" />
      </mesh>
      <mesh position={[0.02, 0.19, -0.17]} scale={[1.3, 0.58, 0.25]} castShadow>
        <sphereGeometry args={[0.14, 18, 12]} />
        <ToyMaterial preset="warmCeramic" color="#f2bf68" opacity={0.9} />
      </mesh>
      <mesh position={[0.43, 0.37, 0]} castShadow receiveShadow>
        <sphereGeometry args={[0.27, 28, 20]} />
        <ToyMaterial preset="paintedWood" color="#aa6637" />
      </mesh>
      <mesh position={[0.49, 0.39, -0.08]} castShadow receiveShadow>
        <sphereGeometry args={[0.18, 24, 16]} />
        <ToyMaterial preset="softPlastic" color="#e8b45b" />
      </mesh>
      <ToyHighlight position={[0.36, 0.48, -0.13]} scale={[0.86, 0.42, 0.28]} opacity={0.17} />
      {Array.from({ length: 9 }).map((_, index) => {
        const angle = (index / 9) * Math.PI * 2;
        return (
          <mesh key={angle} position={[0.43 + Math.cos(angle) * 0.22, 0.38 + Math.sin(angle) * 0.05, Math.sin(angle) * 0.16]} scale={[0.55, 0.55, 0.55]} castShadow>
            <sphereGeometry args={[0.08, 14, 10]} />
            <ToyMaterial preset="paintedWood" color="#9a5a31" />
          </mesh>
        );
      })}
      <EyePair left={0.44} right={0.56} y={0.44} z={-0.225} size={0.022} />
      <mesh position={[0.54, 0.41, -0.245]} castShadow>
        <sphereGeometry args={[0.026, 14, 10]} />
        <ToyMaterial preset="softPlastic" color="#2d241d" />
      </mesh>
      <mesh position={[0.64, 0.34, -0.18]} castShadow>
        <sphereGeometry args={[0.03, 12, 8]} />
        <ToyMaterial preset="softPlastic" color="#33231a" />
      </mesh>
      {[-0.04, 0.04].map((offset) => (
        <mesh key={offset} position={[0.6 + offset, 0.315, -0.22]} rotation={[Math.PI / 2, 0, offset > 0 ? -0.2 : 0.2]} castShadow>
          <torusGeometry args={[0.055, 0.006, 6, 14, Math.PI]} />
          <ToyMaterial preset="paintedWood" color="#6b3d25" />
        </mesh>
      ))}
      <mesh position={[-0.44, 0.43, 0]} rotation={[0, 0, 0.72]} castShadow>
        <capsuleGeometry args={[0.035, 0.34, 5, 10]} />
        <ToyMaterial preset="paintedWood" color="#9d5a2c" />
      </mesh>
      <mesh position={[-0.55, 0.54, 0.02]} castShadow>
        <sphereGeometry args={[0.065, 14, 10]} />
        <ToyMaterial preset="paintedWood" color="#7b4428" />
      </mesh>
      {[-0.22, 0.16, 0.34].map((x) => (
        <mesh key={x} position={[x, 0.02, -0.1]} castShadow>
          <capsuleGeometry args={[0.045, 0.23, 5, 10]} />
          <ToyMaterial preset="paintedWood" color="#9d5a2c" />
        </mesh>
      ))}
      {[-0.22, 0.16, 0.34].map((x) => (
        <mesh key={`lion-paw-${x}`} position={[x, -0.085, -0.17]} scale={[1.2, 0.5, 0.72]} castShadow receiveShadow>
          <sphereGeometry args={[0.052, 12, 8]} />
          <ToyMaterial preset="softPlastic" color="#eeb464" />
        </mesh>
      ))}
    </group>
  );
}

function BridgeToy(): JSX.Element {
  return (
    <group>
      <RoundedBoxMesh size={[1.25, 0.14, 0.36]} radius={0.05} smoothness={5} position={[0, 0.18, 0]} castShadow receiveShadow>
        <ToyMaterial preset="paintedWood" color="#bc8550" />
      </RoundedBoxMesh>
      {[-0.42, -0.14, 0.14, 0.42].map((x) => (
        <RoundedBoxMesh key={x} size={[0.08, 0.06, 0.42]} radius={0.02} smoothness={4} position={[x, 0.28, 0]} castShadow receiveShadow>
          <ToyMaterial preset="paintedWood" color="#edc17e" />
        </RoundedBoxMesh>
      ))}
      {[-0.56, -0.28, 0, 0.28, 0.56].map((x, index) => (
        <RoundedBoxMesh key={`plank-${x}`} size={[0.06, 0.032, 0.32]} radius={0.012} smoothness={3} position={[x, 0.285, -0.025]} castShadow>
          <ToyMaterial preset="paintedWood" color={index % 2 === 0 ? "#d5a164" : "#c58b52"} />
        </RoundedBoxMesh>
      ))}
      {[-0.4, 0, 0.4].map((x) => (
        <RoundedBoxMesh key={x} size={[0.08, 0.26, 0.46]} radius={0.025} smoothness={4} position={[x, 0.31, 0]} castShadow>
          <ToyMaterial preset="paintedWood" color="#e1b276" />
        </RoundedBoxMesh>
      ))}
      {[-0.24, 0.24].map((z) => (
        <RoundedBoxMesh key={z} size={[1.34, 0.06, 0.06]} radius={0.02} smoothness={4} position={[0, 0.42, z]} castShadow>
          <ToyMaterial preset="paintedWood" color="#8a5d36" />
        </RoundedBoxMesh>
      ))}
      {[-0.24, 0.24].map((z) => (
        <RoundedBoxMesh key={`rope-${z}`} size={[1.18, 0.025, 0.03]} radius={0.012} smoothness={3} position={[0, 0.52, z]} castShadow>
          <ToyMaterial preset="paintedWood" color="#f0d49a" />
        </RoundedBoxMesh>
      ))}
      {[-0.42, 0.42].map((x) => (
        <RoundedBoxMesh key={`brace-${x}`} size={[0.06, 0.38, 0.04]} radius={0.015} smoothness={3} position={[x, 0.31, -0.235]} rotation={[0, 0, x > 0 ? 0.34 : -0.34]} castShadow>
          <ToyMaterial preset="paintedWood" color="#9c663e" />
        </RoundedBoxMesh>
      ))}
      {[-0.58, 0.58].map((x) => (
        <mesh key={x} position={[x, 0.11, 0.25]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <torusGeometry args={[0.08, 0.014, 8, 18]} />
          <ToyMaterial preset="toyMetal" color="#876c54" />
        </mesh>
      ))}
      {[-0.55, 0.55].map((x) => (
        <mesh key={`bridge-stone-${x}`} position={[x, 0.04, -0.26]} scale={[1.3, 0.55, 0.8]} castShadow receiveShadow>
          <sphereGeometry args={[0.09, 14, 8]} />
          <ToyMaterial preset="sandMatte" color="#958775" />
        </mesh>
      ))}
    </group>
  );
}

function FenceToy(): JSX.Element {
  return (
    <group>
      {[-0.48, -0.16, 0.16, 0.48].map((x) => (
        <RoundedBoxMesh key={x} size={[0.08, 0.46, 0.08]} radius={0.025} smoothness={4} position={[x, 0.23, 0]} castShadow receiveShadow>
          <ToyMaterial preset="paintedWood" color="#d9b477" />
        </RoundedBoxMesh>
      ))}
      {[-0.48, -0.16, 0.16, 0.48].map((x, index) => (
        <RoundedBoxMesh key={`grain-${x}`} size={[0.018, 0.29, 0.012]} radius={0.006} smoothness={2} position={[x + (index % 2 === 0 ? -0.018 : 0.018), 0.23, -0.047]} castShadow>
          <ToyMaterial preset="paintedWood" color="#a87348" />
        </RoundedBoxMesh>
      ))}
      {[-0.48, -0.16, 0.16, 0.48].map((x) => (
        <mesh key={x} position={[x, 0.49, 0]} rotation={[0, 0, Math.PI / 4]} castShadow>
          <coneGeometry args={[0.07, 0.12, 4]} />
          <ToyMaterial preset="paintedWood" color="#f0d09b" />
        </mesh>
      ))}
      {[0.14, 0.32].map((y) => (
        <RoundedBoxMesh key={y} size={[1.08, 0.07, 0.08]} radius={0.02} smoothness={4} position={[0, y, -0.02]} castShadow>
          <ToyMaterial preset="paintedWood" color="#bb8150" />
        </RoundedBoxMesh>
      ))}
      <RoundedBoxMesh size={[0.96, 0.045, 0.06]} radius={0.015} smoothness={4} position={[0, 0.235, -0.055]} rotation={[0, 0, 0.18]} castShadow>
        <ToyMaterial preset="paintedWood" color="#a96e42" />
      </RoundedBoxMesh>
      {[-0.31, 0.31].map((x) => (
        <mesh key={`tie-${x}`} position={[x, 0.32, -0.09]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <torusGeometry args={[0.042, 0.007, 6, 16]} />
          <ToyMaterial preset="paintedWood" color="#f4dca8" />
        </mesh>
      ))}
      {[-0.5, 0.5].map((x) => (
        <mesh key={`grass-${x}`} position={[x, 0.03, -0.13]} rotation={[0.08, 0, x > 0 ? -0.35 : 0.35]} castShadow>
          <capsuleGeometry args={[0.014, 0.2, 4, 8]} />
          <ToyMaterial preset="softPlastic" color="#78b96d" />
        </mesh>
      ))}
    </group>
  );
}

function TowerToy(): JSX.Element {
  return (
    <group>
      <mesh position={[0, 0.42, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.27, 0.34, 0.84, 24]} />
        <ToyMaterial preset="warmCeramic" color="#d7c6ad" />
      </mesh>
      {[0.22, 0.42, 0.62].map((y, row) =>
        [-0.18, 0, 0.18].map((x, column) => (
          <RoundedBoxMesh
            key={`${y}-${x}`}
            size={[0.12, 0.055, 0.025]}
            radius={0.01}
            smoothness={2}
            position={[x + (row % 2 === 0 ? 0.04 : -0.02), y, -0.31]}
            castShadow
          >
            <ToyMaterial preset="warmCeramic" color={(row + column) % 2 === 0 ? "#eee0c8" : "#c7b397"} />
          </RoundedBoxMesh>
        )),
      )}
      <mesh position={[0, 1.02, 0]} castShadow receiveShadow>
        <coneGeometry args={[0.42, 0.48, 24]} />
        <ToyMaterial preset="softPlastic" color="#c55e46" />
      </mesh>
      <ToyHighlight position={[-0.09, 1.13, -0.2]} scale={[1.4, 0.36, 0.3]} opacity={0.18} />
      <RoundedBoxMesh size={[0.15, 0.24, 0.035]} radius={0.02} smoothness={4} position={[0, 0.34, -0.345]} castShadow>
        <ToyMaterial preset="glassWater" color="#6ba9bd" opacity={0.88} />
      </RoundedBoxMesh>
      <RoundedBoxMesh size={[0.2, 0.035, 0.025]} radius={0.008} smoothness={2} position={[0, 0.47, -0.367]} castShadow>
        <ToyMaterial preset="paintedWood" color="#f4ead4" />
      </RoundedBoxMesh>
      <RoundedBoxMesh size={[0.028, 0.25, 0.025]} radius={0.008} smoothness={2} position={[0, 0.34, -0.37]} castShadow>
        <ToyMaterial preset="paintedWood" color="#f4ead4" />
      </RoundedBoxMesh>
      {[-0.2, 0.2].map((x) => (
        <RoundedBoxMesh key={x} size={[0.08, 0.08, 0.08]} radius={0.018} smoothness={4} position={[x, 0.86, -0.12]} castShadow>
          <ToyMaterial preset="warmCeramic" color="#f0dfc2" />
        </RoundedBoxMesh>
      ))}
      {[-0.29, 0.29].map((x) => (
        <mesh key={`tower-rock-${x}`} position={[x, 0.03, -0.1]} scale={[1.2, 0.52, 0.9]} castShadow receiveShadow>
          <sphereGeometry args={[0.08, 12, 8]} />
          <ToyMaterial preset="sandMatte" color="#a9a091" />
        </mesh>
      ))}
      <mesh position={[0, 1.3, 0]} rotation={[0, 0, -0.55]} castShadow>
        <coneGeometry args={[0.035, 0.25, 3]} />
        <ToyMaterial preset="softPlastic" color="#f1b343" />
      </mesh>
    </group>
  );
}

function TreeToy(): JSX.Element {
  return (
    <group>
      <mesh position={[0, 0.2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.13, 0.18, 0.64, 18]} />
        <ToyMaterial preset="paintedWood" color="#a66b3d" />
      </mesh>
      {[0.18, 0.31].map((y) => (
        <mesh key={y} position={[0, y, -0.132]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <torusGeometry args={[0.105, 0.006, 6, 20, Math.PI]} />
          <ToyMaterial preset="paintedWood" color="#84512e" />
        </mesh>
      ))}
      <mesh position={[0, 0.04, 0]} scale={[1.35, 0.28, 1.08]} castShadow receiveShadow>
        <sphereGeometry args={[0.18, 18, 10]} />
        <ToyMaterial preset="sandMatte" color="#af8054" />
      </mesh>
      {[-0.18, 0, 0.18].map((x, index) => (
        <mesh key={x} position={[x, 0.045, -0.18]} rotation={[0, 0, Math.PI / 2 + (index - 1) * 0.22]} castShadow>
          <capsuleGeometry args={[0.018, 0.22, 4, 8]} />
          <ToyMaterial preset="paintedWood" color="#8f5b35" />
        </mesh>
      ))}
      <mesh position={[-0.12, 0.72, 0.05]} castShadow receiveShadow>
        <sphereGeometry args={[0.34, 32, 22]} />
        <ToyMaterial preset="softPlastic" color="#73c985" />
      </mesh>
      <mesh position={[0.2, 0.65, -0.03]} castShadow receiveShadow>
        <sphereGeometry args={[0.3, 32, 22]} />
        <ToyMaterial preset="softPlastic" color="#61b979" />
      </mesh>
      <mesh position={[0.02, 0.92, -0.02]} castShadow receiveShadow>
        <sphereGeometry args={[0.33, 32, 22]} />
        <ToyMaterial preset="softPlastic" color="#8edc8b" />
      </mesh>
      <ToyHighlight position={[-0.1, 1.03, -0.18]} scale={[1.45, 0.56, 0.34]} opacity={0.18} />
      <ToyHighlight position={[-0.26, 0.78, -0.14]} scale={[0.9, 0.4, 0.25]} opacity={0.16} />
      {([
        [-0.3, 0.78, -0.18],
        [0.1, 1.02, -0.2],
        [0.31, 0.7, -0.12],
      ] as Vec3[]).map(([x, y, z]) => (
        <mesh key={`${x}-${y}`} position={[x, y, z]} castShadow>
          <sphereGeometry args={[0.045, 12, 8]} />
          <ToyMaterial preset="softPlastic" color="#e7774f" />
        </mesh>
      ))}
    </group>
  );
}

function WaterToy(): JSX.Element {
  return (
    <group>
      <mesh position={[0, 0.02, 0]} scale={[1.35, 0.24, 0.82]} receiveShadow>
        <sphereGeometry args={[0.42, 48, 18]} />
        <ToyMaterial preset="glassWater" color="#74d4e8" opacity={0.86} />
      </mesh>
      <ToyHighlight position={[-0.18, 0.15, -0.16]} scale={[2.2, 0.34, 0.42]} opacity={0.26} color="#f4ffff" />
      {[0.34, 0.58, 0.78].map((radius) => (
        <mesh key={radius} position={[0.02, 0.105 + radius * 0.005, 0.02]} rotation={[-Math.PI / 2, 0, 0]} scale={[1.45, 0.82, 1]} receiveShadow>
          <ringGeometry args={[radius, radius + 0.012, 72]} />
          <ToyMaterial preset="glassWater" color="#e5fbff" opacity={0.46} />
        </mesh>
      ))}
      {[0.18, 0.48, 0.66].map((radius, index) => (
        <mesh
          key={`inner-${radius}`}
          position={[-0.1 + index * 0.1, 0.13 + index * 0.006, -0.08 + index * 0.04]}
          rotation={[-Math.PI / 2, 0, 0.08 * index]}
          scale={[1.25, 0.5, 1]}
          receiveShadow
        >
          <ringGeometry args={[radius, radius + 0.01, 64]} />
          <ToyMaterial preset="glassWater" color="#ffffff" opacity={0.28} />
        </mesh>
      ))}
      {[-0.62, -0.45, 0.5, 0.68].map((x, index) => (
        <mesh key={x} position={[x, 0.08, 0.24]} castShadow receiveShadow>
          <sphereGeometry args={[index % 2 === 0 ? 0.11 : 0.13, 18, 12]} />
          <ToyMaterial preset="sandMatte" color={index % 2 === 0 ? "#988a74" : "#8b7d6a"} />
        </mesh>
      ))}
      {[-0.58, 0.54].map((x) => (
        <ToyHighlight key={`stone-light-${x}`} position={[x, 0.17, 0.16]} scale={[0.58, 0.2, 0.28]} opacity={0.13} color="#fff2d0" />
      ))}
      {[-0.42, 0.58].map((x) => (
        <group key={x} position={[x, 0.12, -0.2]} rotation={[0, 0, x > 0 ? -0.18 : 0.14]}>
          {[0, 0.07, -0.07].map((offset) => (
            <mesh key={offset} position={[offset, 0.14, 0]} rotation={[0.12, 0, offset * 2]} castShadow>
              <capsuleGeometry args={[0.018, 0.28, 4, 8]} />
              <ToyMaterial preset="softPlastic" color="#5fab6f" />
            </mesh>
          ))}
          <mesh position={[0.12, 0.09, -0.02]} rotation={[0.2, 0, -0.45]} castShadow>
            <capsuleGeometry args={[0.016, 0.22, 4, 8]} />
            <ToyMaterial preset="softPlastic" color="#8bd47c" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function RockToy(): JSX.Element {
  return (
    <group>
      <mesh position={[-0.16, 0.19, 0.02]} scale={[1.2, 0.82, 1]} castShadow receiveShadow>
        <sphereGeometry args={[0.24, 24, 16]} />
        <ToyMaterial preset="sandMatte" color="#9a978d" />
      </mesh>
      <ToyHighlight position={[-0.24, 0.28, -0.12]} scale={[0.9, 0.24, 0.28]} opacity={0.16} color="#f2e8cf" />
      <mesh position={[0.16, 0.16, -0.04]} scale={[1, 0.68, 0.92]} castShadow receiveShadow>
        <sphereGeometry args={[0.22, 24, 16]} />
        <ToyMaterial preset="sandMatte" color="#b4afa1" />
      </mesh>
      <ToyHighlight position={[0.13, 0.22, -0.16]} scale={[0.7, 0.2, 0.24]} opacity={0.15} color="#fff1d5" />
      <mesh position={[0.04, 0.28, -0.1]} scale={[0.72, 0.36, 0.32]} castShadow>
        <sphereGeometry args={[0.18, 18, 12]} />
        <ToyMaterial preset="sandMatte" color="#d2c9b7" />
      </mesh>
      {[-0.22, -0.02, 0.2].map((x, index) => (
        <mesh key={x} position={[x, 0.21 + index * 0.025, -0.23]} rotation={[Math.PI / 2, 0, 0.12 * index]} castShadow>
          <torusGeometry args={[0.09, 0.006, 6, 20, Math.PI]} />
          <ToyMaterial preset="sandMatte" color={index === 1 ? "#7d786e" : "#888277"} />
        </mesh>
      ))}
    </group>
  );
}

function SunToy(): JSX.Element {
  return (
    <group>
      <mesh position={[0, 0.48, 0]} castShadow receiveShadow>
        <sphereGeometry args={[0.28, 32, 22]} />
        <ToyMaterial preset="softPlastic" color="#ffd65a" emissive="#d9911d" emissiveIntensity={0.18} />
      </mesh>
      <ToyHighlight position={[-0.09, 0.58, -0.2]} scale={[1.1, 0.46, 0.28]} opacity={0.28} color="#fff8bc" />
      <EyePair left={-0.08} right={0.08} y={0.53} z={-0.25} size={0.024} />
      <Cheeks y={0.47} z={-0.26} width={0.13} />
      <Smile position={[0, 0.45, -0.268]} scale={[0.6, 0.38, 0.6]} />
      {Array.from({ length: 8 }).map((_, index) => {
        const angle = (index / 8) * Math.PI * 2;
        return (
          <mesh
            key={angle}
            position={[Math.cos(angle) * 0.38, 0.48 + Math.sin(angle) * 0.16, 0]}
            rotation={[0, 0, -angle]}
            scale={index % 2 === 0 ? [1.05, 1.05, 1.05] : [0.78, 0.78, 0.78]}
            castShadow
          >
            <coneGeometry args={[0.055, 0.18, 12]} />
            <ToyMaterial preset="softPlastic" color="#ffbe43" />
          </mesh>
        );
      })}
      <mesh position={[0, 0.17, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.04, 0.05, 0.36, 12]} />
        <ToyMaterial preset="paintedWood" color="#8e6335" />
      </mesh>
      <mesh position={[0, -0.02, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.18, 0.22, 0.08, 20]} />
        <ToyMaterial preset="paintedWood" color="#ba8150" />
      </mesh>
      <mesh position={[0, -0.055, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <ringGeometry args={[0.18, 0.28, 36]} />
        <ToyMaterial preset="sandMatte" color="#d8bd7f" opacity={0.72} />
      </mesh>
    </group>
  );
}

function MonsterToy(): JSX.Element {
  return (
    <group>
      <RoundedBoxMesh size={[0.58, 0.62, 0.48]} radius={0.22} smoothness={9} position={[0, 0.32, 0]} castShadow receiveShadow>
        <ToyMaterial preset="softPlastic" color="#8067d8" />
      </RoundedBoxMesh>
      <ToyHighlight position={[-0.14, 0.52, -0.19]} scale={[1.1, 0.48, 0.3]} opacity={0.18} color="#ddd4ff" />
      <mesh position={[0, 0.22, -0.245]} scale={[1.25, 0.85, 0.28]} castShadow>
        <sphereGeometry args={[0.11, 16, 10]} />
        <ToyMaterial preset="softPlastic" color="#9a84e7" opacity={0.92} />
      </mesh>
      {[-0.17, 0.17].map((x) => (
        <mesh key={x} position={[x, 0.72, 0]} rotation={[0, 0, x > 0 ? -0.36 : 0.36]} castShadow>
          <coneGeometry args={[0.08, 0.24, 18]} />
          <ToyMaterial preset="softPlastic" color="#f4d875" />
        </mesh>
      ))}
      {[-0.1, 0.1].map((x) => (
        <mesh key={x} position={[x, 0.42, -0.25]} castShadow>
          <sphereGeometry args={[0.045, 16, 12]} />
          <ToyMaterial preset="softPlastic" color="#192222" />
        </mesh>
      ))}
      <Cheeks y={0.34} z={-0.255} width={0.16} />
      <Smile position={[0, 0.27, -0.265]} scale={[0.78, 0.5, 0.78]} />
      {[-0.04, 0.04].map((x) => (
        <mesh key={`tooth-${x}`} position={[x, 0.245, -0.285]} rotation={[Math.PI, 0, 0]} castShadow>
          <coneGeometry args={[0.018, 0.055, 8]} />
          <ToyMaterial preset="warmCeramic" color="#fff4da" />
        </mesh>
      ))}
      {[-0.24, 0.22].map((x, index) => (
        <mesh key={`spot-${x}`} position={[x, 0.46 - index * 0.12, -0.248]} scale={[1.1, 0.75, 0.24]} castShadow>
          <sphereGeometry args={[0.04, 12, 8]} />
          <ToyMaterial preset="softPlastic" color={index === 0 ? "#6d59c7" : "#b09dff"} opacity={0.72} />
        </mesh>
      ))}
      {[-0.31, 0.31].map((x) => (
        <mesh key={x} position={[x, 0.28, -0.02]} rotation={[0.08, 0, x > 0 ? -0.52 : 0.52]} castShadow receiveShadow>
          <capsuleGeometry args={[0.055, 0.26, 5, 12]} />
          <ToyMaterial preset="softPlastic" color="#6c58c6" />
        </mesh>
      ))}
      {[-0.14, 0.14].map((x) => (
        <mesh key={x} position={[x, -0.02, -0.02]} castShadow receiveShadow>
          <sphereGeometry args={[0.06, 14, 10]} />
          <ToyMaterial preset="softPlastic" color="#f0a06c" />
        </mesh>
      ))}
      {[-0.14, 0.14].map((x) => (
        <mesh key={`claw-${x}`} position={[x, -0.08, -0.12]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <coneGeometry args={[0.02, 0.07, 8]} />
          <ToyMaterial preset="warmCeramic" color="#fff1c9" />
        </mesh>
      ))}
    </group>
  );
}

function RobotToy(): JSX.Element {
  return (
    <group>
      <RoundedBoxMesh size={[0.42, 0.48, 0.32]} radius={0.09} smoothness={6} position={[0, 0.2, 0]} castShadow receiveShadow>
        <ToyMaterial preset="toyMetal" color="#aebec3" />
      </RoundedBoxMesh>
      <ToyHighlight position={[-0.11, 0.34, -0.13]} scale={[0.9, 0.42, 0.26]} opacity={0.16} />
      <RoundedBoxMesh size={[0.46, 0.34, 0.36]} radius={0.1} smoothness={6} position={[0, 0.62, 0]} castShadow receiveShadow>
        <ToyMaterial preset="toyMetal" color="#d4e0de" />
      </RoundedBoxMesh>
      <RoundedBoxMesh size={[0.2, 0.045, 0.05]} radius={0.018} smoothness={4} position={[0, 0.77, -0.19]} castShadow>
        <ToyMaterial preset="toyMetal" color="#92a5aa" />
      </RoundedBoxMesh>
      <RoundedBoxMesh size={[0.26, 0.16, 0.03]} radius={0.025} smoothness={4} position={[0, 0.2, -0.172]} castShadow>
        <ToyMaterial preset="glassWater" color="#67b8cc" opacity={0.88} />
      </RoundedBoxMesh>
      <RoundedBoxMesh size={[0.18, 0.1, 0.018]} radius={0.018} smoothness={3} position={[-0.015, 0.205, -0.194]} castShadow>
        <ToyMaterial preset="glassWater" color="#15333b" emissive="#55d7d0" emissiveIntensity={0.18} opacity={0.88} />
      </RoundedBoxMesh>
      <mesh position={[0.06, 0.205, -0.194]} castShadow>
        <sphereGeometry args={[0.014, 10, 8]} />
        <ToyMaterial preset="softPlastic" color="#e9f8e8" emissive="#9decc4" emissiveIntensity={0.08} />
      </mesh>
      {[-0.07, 0, 0.07].map((x, index) => (
        <mesh key={x} position={[x, 0.05, -0.175]} castShadow>
          <sphereGeometry args={[0.018, 10, 8]} />
          <ToyMaterial preset="softPlastic" color={index === 1 ? "#f0d767" : "#ee8e85"} emissive={index === 1 ? "#d5b641" : "#d75b54"} emissiveIntensity={0.08} />
        </mesh>
      ))}
      {[-0.11, 0.11].map((x) => (
        <mesh key={x} position={[x, 0.66, -0.2]} castShadow>
          <sphereGeometry args={[0.035, 14, 10]} />
          <ToyMaterial preset="glassWater" color="#2d5562" />
        </mesh>
      ))}
      <Smile position={[0, 0.59, -0.205]} scale={[0.52, 0.32, 0.52]} />
      {[-0.31, 0.31].map((x) => (
        <mesh key={x} position={[x, 0.26, 0]} rotation={[0, 0, x > 0 ? -0.18 : 0.18]} castShadow receiveShadow>
          <capsuleGeometry args={[0.045, 0.28, 5, 12]} />
          <ToyMaterial preset="toyMetal" color="#94a8ae" />
        </mesh>
      ))}
      {[-0.28, 0.28].map((x) => (
        <mesh key={`ear-${x}`} position={[x, 0.63, -0.01]} rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
          <cylinderGeometry args={[0.055, 0.055, 0.07, 16]} />
          <ToyMaterial preset="toyMetal" color="#8fa4aa" />
        </mesh>
      ))}
      {[-0.12, 0.12].map((x) => (
        <RoundedBoxMesh key={x} size={[0.08, 0.11, 0.12]} radius={0.025} smoothness={4} position={[x, -0.035, 0]} castShadow receiveShadow>
          <ToyMaterial preset="toyMetal" color="#83969c" />
        </RoundedBoxMesh>
      ))}
      {[
        [-0.17, 0.35, -0.17],
        [0.17, 0.35, -0.17],
        [-0.17, 0.08, -0.17],
        [0.17, 0.08, -0.17],
      ].map(([x, y, z]) => (
        <mesh key={`${x}-${y}`} position={[x, y, z]} castShadow>
          <sphereGeometry args={[0.018, 10, 8]} />
          <ToyMaterial preset="toyMetal" color="#758b91" />
        </mesh>
      ))}
      <mesh position={[0, 0.88, 0]} castShadow>
        <cylinderGeometry args={[0.018, 0.018, 0.24, 10]} />
        <ToyMaterial preset="toyMetal" color="#8a969b" />
      </mesh>
      <mesh position={[0, 1.02, 0]} castShadow>
        <sphereGeometry args={[0.04, 14, 10]} />
        <ToyMaterial preset="softPlastic" color="#ee8e85" emissive="#e76459" emissiveIntensity={0.12} />
      </mesh>
    </group>
  );
}

function SkullToy(): JSX.Element {
  return (
    <group>
      <mesh position={[0, 0.42, 0]} scale={[1, 1.04, 0.88]} castShadow receiveShadow>
        <sphereGeometry args={[0.28, 32, 20]} />
        <ToyMaterial preset="warmCeramic" color="#ece3cc" />
      </mesh>
      <ToyHighlight position={[-0.08, 0.52, -0.2]} scale={[0.86, 0.34, 0.24]} opacity={0.16} color="#fff8de" />
      <RoundedBoxMesh size={[0.3, 0.18, 0.2]} radius={0.06} smoothness={5} position={[0, 0.18, -0.02]} castShadow receiveShadow>
        <ToyMaterial preset="warmCeramic" color="#d7ccb4" />
      </RoundedBoxMesh>
      {[-0.09, 0.09].map((x) => (
        <mesh key={x} position={[x, 0.45, -0.23]} castShadow>
          <sphereGeometry args={[0.06, 16, 12]} />
          <ToyMaterial preset="softPlastic" color="#25231f" />
        </mesh>
      ))}
      <mesh position={[0, 0.34, -0.24]} scale={[0.72, 0.5, 0.38]} castShadow>
        <sphereGeometry args={[0.042, 12, 8]} />
        <ToyMaterial preset="softPlastic" color="#6f6350" />
      </mesh>
      <mesh position={[0.08, 0.56, -0.225]} rotation={[0, 0, -0.55]} castShadow>
        <capsuleGeometry args={[0.006, 0.16, 4, 8]} />
        <ToyMaterial preset="sandMatte" color="#b9ad98" />
      </mesh>
      <mesh position={[0.15, 0.5, -0.225]} rotation={[0, 0, 0.85]} castShadow>
        <capsuleGeometry args={[0.005, 0.08, 4, 8]} />
        <ToyMaterial preset="sandMatte" color="#b9ad98" />
      </mesh>
      {[-0.16, 0.16].map((x) => (
        <mesh key={`cheek-bone-${x}`} position={[x, 0.31, -0.23]} scale={[1.15, 0.45, 0.28]} castShadow>
          <sphereGeometry args={[0.05, 12, 8]} />
          <ToyMaterial preset="warmCeramic" color="#d8ceb8" />
        </mesh>
      ))}
      {[-0.09, 0, 0.09].map((x) => (
        <RoundedBoxMesh key={x} size={[0.035, 0.085, 0.025]} radius={0.008} smoothness={2} position={[x, 0.16, -0.13]} castShadow>
          <ToyMaterial preset="warmCeramic" color="#f7eed9" />
        </RoundedBoxMesh>
      ))}
      <mesh position={[0, -0.03, -0.02]} scale={[1.5, 0.4, 1]} castShadow receiveShadow>
        <sphereGeometry args={[0.11, 14, 8]} />
        <ToyMaterial preset="sandMatte" color="#b5a586" />
      </mesh>
    </group>
  );
}

function LightToy(): JSX.Element {
  return (
    <group>
      <pointLight position={[0, 0.82, 0]} intensity={0.34} color="#ffd889" distance={2.2} />
      <mesh position={[0, 0.24, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.06, 0.1, 0.48, 18]} />
        <ToyMaterial preset="paintedWood" color="#7f6648" />
      </mesh>
      <mesh position={[0, 0.02, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.22, 0.26, 0.08, 24]} />
        <ToyMaterial preset="paintedWood" color="#a57a4d" />
      </mesh>
      <mesh position={[0, 0.58, 0]} castShadow receiveShadow>
        <sphereGeometry args={[0.22, 32, 18]} />
        <ToyMaterial preset="warmCeramic" color="#ffe19b" emissive="#f5b64f" emissiveIntensity={0.35} />
      </mesh>
      <mesh position={[0, 0.58, 0]} renderOrder={3}>
        <sphereGeometry args={[0.32, 32, 18]} />
        <meshBasicMaterial color="#fff0a8" transparent opacity={0.16} depthWrite={false} />
      </mesh>
      <ToyHighlight position={[-0.07, 0.67, -0.18]} scale={[0.8, 0.38, 0.26]} opacity={0.28} color="#fff8d0" />
      <mesh position={[0, 0.58, 0]} rotation={[-Math.PI / 2, 0, 0]} castShadow>
        <torusGeometry args={[0.25, 0.016, 10, 32]} />
        <ToyMaterial preset="toyMetal" color="#d7b165" />
      </mesh>
      {Array.from({ length: 5 }).map((_, index) => {
        const angle = (index / 5) * Math.PI * 2;
        return (
          <mesh key={angle} position={[Math.cos(angle) * 0.36, 0.58, Math.sin(angle) * 0.36]} rotation={[0, 0, angle]} castShadow>
            <sphereGeometry args={[0.025, 10, 8]} />
            <ToyMaterial preset="warmCeramic" color="#ffe7b2" emissive="#eebf62" emissiveIntensity={0.18} />
          </mesh>
        );
      })}
      {Array.from({ length: 4 }).map((_, index) => {
        const angle = index * (Math.PI / 2) + Math.PI / 4;
        return (
          <mesh key={`ray-${angle}`} position={[Math.cos(angle) * 0.48, 0.58, Math.sin(angle) * 0.48]} rotation={[0, 0, -angle]} renderOrder={2}>
            <sphereGeometry args={[0.034, 10, 8]} />
            <meshBasicMaterial color="#fff2a8" transparent opacity={0.32} depthWrite={false} />
          </mesh>
        );
      })}
      <RoundedBoxMesh size={[0.3, 0.035, 0.05]} radius={0.012} smoothness={3} position={[0, 0.08, -0.15]} castShadow>
        <ToyMaterial preset="toyMetal" color="#d0aa68" />
      </RoundedBoxMesh>
    </group>
  );
}

function FallbackToy(): JSX.Element {
  return (
    <group>
      <RoundedBoxMesh size={[0.52, 0.52, 0.52]} radius={0.16} smoothness={8} position={[0, 0.26, 0]} castShadow receiveShadow>
        <ToyMaterial preset="softPlastic" color="#b9e2d6" />
      </RoundedBoxMesh>
      <ToyHighlight position={[-0.08, 0.42, -0.2]} scale={[0.78, 0.34, 0.22]} opacity={0.2} />
      <EyePair left={-0.08} right={0.08} y={0.32} z={-0.265} size={0.022} />
      <Smile position={[0, 0.24, -0.272]} scale={[0.52, 0.32, 0.52]} />
    </group>
  );
}

function getShadowRadius(kind: ToyModelRecipe["kind"]): number {
  if (kind === "bridge" || kind === "fence" || kind === "water") {
    return 0.74;
  }
  if (kind === "tree" || kind === "house" || kind === "tower") {
    return 0.62;
  }
  return 0.46;
}

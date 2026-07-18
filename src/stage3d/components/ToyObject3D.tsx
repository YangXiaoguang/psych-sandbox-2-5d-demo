import type { ThreeEvent } from "@react-three/fiber";
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

const MATERIAL_PRESETS: Record<MaterialPreset, { color: string; metalness: number; roughness: number }> = {
  softPlastic: { color: "#7fcfbe", metalness: 0.02, roughness: 0.46 },
  claySkin: { color: "#efb77e", metalness: 0, roughness: 0.55 },
  paintedWood: { color: "#c58a4f", metalness: 0.01, roughness: 0.72 },
  warmCeramic: { color: "#f2dec0", metalness: 0.01, roughness: 0.5 },
  toyMetal: { color: "#a9b9bd", metalness: 0.12, roughness: 0.38 },
  glassWater: { color: "#77d7e8", metalness: 0.02, roughness: 0.2 },
  sandMatte: { color: "#ead2a2", metalness: 0, roughness: 0.92 },
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
    <meshStandardMaterial
      color={color ?? base.color}
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
        <mesh key={x} position={[x, y, z]} castShadow>
          <sphereGeometry args={[size, 18, 12]} />
          <ToyMaterial preset="softPlastic" color={TOY_DARK} />
        </mesh>
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
  return (
    <mesh position={[0, -0.18, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <circleGeometry args={[radius, 48]} />
      <meshBasicMaterial color="#1e160c" transparent opacity={opacity} depthWrite={false} />
    </mesh>
  );
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
      {[-0.26, 0, 0.26].map((x) => (
        <RoundedBoxMesh key={x} size={[0.045, 0.38, 0.055]} radius={0.016} smoothness={3} position={[x, 0.84, -0.18]} rotation={[0.08, 0, 0]} castShadow>
          <ToyMaterial preset="paintedWood" color="#f0a24d" />
        </RoundedBoxMesh>
      ))}
      <mesh position={[0.28, 0.96, 0.18]} castShadow receiveShadow>
        <cylinderGeometry args={[0.055, 0.07, 0.22, 12]} />
        <ToyMaterial preset="paintedWood" color="#9a6742" />
      </mesh>
      <RoundedBoxMesh size={[0.22, 0.34, 0.035]} radius={0.025} smoothness={4} position={[0, 0.13, -0.405]} castShadow>
        <ToyMaterial preset="paintedWood" color="#8b542f" />
      </RoundedBoxMesh>
      <mesh position={[0.06, 0.13, -0.428]} castShadow>
        <sphereGeometry args={[0.018, 12, 8]} />
        <ToyMaterial preset="toyMetal" color="#f0c167" />
      </mesh>
      <RoundedBoxMesh size={[0.18, 0.16, 0.035]} radius={0.02} smoothness={4} position={[-0.25, 0.3, -0.407]} castShadow>
        <ToyMaterial preset="glassWater" color="#9fdbe8" opacity={0.86} />
      </RoundedBoxMesh>
      <RoundedBoxMesh size={[0.18, 0.16, 0.035]} radius={0.02} smoothness={4} position={[0.25, 0.3, -0.407]} castShadow>
        <ToyMaterial preset="glassWater" color="#9fdbe8" opacity={0.86} />
      </RoundedBoxMesh>
      {[-0.36, 0.36].map((x) => (
        <mesh key={x} position={[x, 0.14, -0.43]} scale={[1.1, 0.62, 0.5]} castShadow receiveShadow>
          <sphereGeometry args={[0.09, 16, 10]} />
          <ToyMaterial preset="softPlastic" color="#74bf76" />
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
  return (
    <group scale={[bodyScale, bodyScale, bodyScale]}>
      <RoundedBoxMesh size={[0.38, 0.58, 0.28]} radius={0.14} smoothness={8} position={[0, 0.24, 0]} castShadow receiveShadow>
        <ToyMaterial preset="softPlastic" color={cloth} />
      </RoundedBoxMesh>
      <RoundedBoxMesh size={[0.34, 0.12, 0.18]} radius={0.04} smoothness={4} position={[0, 0.51, -0.105]} castShadow>
        <ToyMaterial preset="warmCeramic" color="#fff4df" />
      </RoundedBoxMesh>
      <mesh position={[0, 0.72, 0]} castShadow receiveShadow>
        <sphereGeometry args={[0.24, 32, 24]} />
        <ToyMaterial preset="claySkin" color={skin} />
      </mesh>
      <EyePair y={0.755} z={-0.207} size={0.027} />
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
        <mesh position={[0, 0.8, -0.17]} rotation={[0.6, 0, 0]} castShadow>
          <torusGeometry args={[0.135, 0.016, 8, 22, Math.PI]} />
          <ToyMaterial preset="softPlastic" color="#3a2419" />
        </mesh>
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
      <mesh position={[0.43, 0.34, -0.02]} castShadow receiveShadow>
        <sphereGeometry args={[0.2, 28, 20]} />
        <ToyMaterial preset="softPlastic" color="#e7b26a" />
      </mesh>
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
      <mesh position={[0.03, 0.5, -0.03]} castShadow receiveShadow>
        <sphereGeometry args={[0.18, 24, 18]} />
        <ToyMaterial preset="softPlastic" color="#8fd4ef" />
      </mesh>
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
      {[-0.08, 0.08].map((x) => (
        <mesh key={x} position={[x, 0.05, -0.04]} rotation={[0.18, 0, 0]} castShadow>
          <capsuleGeometry args={[0.012, 0.2, 4, 8]} />
          <ToyMaterial preset="paintedWood" color="#b66d42" />
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
      <mesh position={[-0.48, 0.26, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <coneGeometry args={[0.2, 0.34, 3]} />
        <ToyMaterial preset="glassWater" color="#55bcc9" />
      </mesh>
      <mesh position={[0.2, 0.38, -0.2]} castShadow>
        <sphereGeometry args={[0.026, 14, 10]} />
        <ToyMaterial preset="softPlastic" color="#203233" />
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
      <mesh position={[0.43, 0.37, 0]} castShadow receiveShadow>
        <sphereGeometry args={[0.27, 28, 20]} />
        <ToyMaterial preset="paintedWood" color="#aa6637" />
      </mesh>
      <mesh position={[0.49, 0.39, -0.08]} castShadow receiveShadow>
        <sphereGeometry args={[0.18, 24, 16]} />
        <ToyMaterial preset="softPlastic" color="#e8b45b" />
      </mesh>
      {Array.from({ length: 9 }).map((_, index) => {
        const angle = (index / 9) * Math.PI * 2;
        return (
          <mesh key={angle} position={[0.43 + Math.cos(angle) * 0.22, 0.38 + Math.sin(angle) * 0.05, Math.sin(angle) * 0.16]} scale={[0.55, 0.55, 0.55]} castShadow>
            <sphereGeometry args={[0.08, 14, 10]} />
            <ToyMaterial preset="paintedWood" color="#9a5a31" />
          </mesh>
        );
      })}
      <mesh position={[0.54, 0.41, -0.245]} castShadow>
        <sphereGeometry args={[0.025, 14, 10]} />
        <ToyMaterial preset="softPlastic" color={TOY_DARK} />
      </mesh>
      <mesh position={[0.64, 0.34, -0.18]} castShadow>
        <sphereGeometry args={[0.03, 12, 8]} />
        <ToyMaterial preset="softPlastic" color="#33231a" />
      </mesh>
      <mesh position={[-0.44, 0.43, 0]} rotation={[0, 0, 0.72]} castShadow>
        <capsuleGeometry args={[0.035, 0.34, 5, 10]} />
        <ToyMaterial preset="paintedWood" color="#9d5a2c" />
      </mesh>
      {[-0.22, 0.16, 0.34].map((x) => (
        <mesh key={x} position={[x, 0.02, -0.1]} castShadow>
          <capsuleGeometry args={[0.045, 0.23, 5, 10]} />
          <ToyMaterial preset="paintedWood" color="#9d5a2c" />
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
      {[-0.58, 0.58].map((x) => (
        <mesh key={x} position={[x, 0.11, 0.25]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <torusGeometry args={[0.08, 0.014, 8, 18]} />
          <ToyMaterial preset="toyMetal" color="#876c54" />
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
      <mesh position={[0, 1.02, 0]} castShadow receiveShadow>
        <coneGeometry args={[0.42, 0.48, 24]} />
        <ToyMaterial preset="softPlastic" color="#c55e46" />
      </mesh>
      <RoundedBoxMesh size={[0.15, 0.24, 0.035]} radius={0.02} smoothness={4} position={[0, 0.34, -0.345]} castShadow>
        <ToyMaterial preset="glassWater" color="#6ba9bd" opacity={0.88} />
      </RoundedBoxMesh>
      {[-0.2, 0.2].map((x) => (
        <RoundedBoxMesh key={x} size={[0.08, 0.08, 0.08]} radius={0.018} smoothness={4} position={[x, 0.86, -0.12]} castShadow>
          <ToyMaterial preset="warmCeramic" color="#f0dfc2" />
        </RoundedBoxMesh>
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
      <mesh position={[0, 0.04, 0]} scale={[1.35, 0.28, 1.08]} castShadow receiveShadow>
        <sphereGeometry args={[0.18, 18, 10]} />
        <ToyMaterial preset="sandMatte" color="#af8054" />
      </mesh>
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
      {[0.34, 0.58, 0.78].map((radius) => (
        <mesh key={radius} position={[0.02, 0.105 + radius * 0.005, 0.02]} rotation={[-Math.PI / 2, 0, 0]} scale={[1.45, 0.82, 1]} receiveShadow>
          <ringGeometry args={[radius, radius + 0.012, 72]} />
          <ToyMaterial preset="glassWater" color="#e5fbff" opacity={0.46} />
        </mesh>
      ))}
      {[-0.62, -0.45, 0.5, 0.68].map((x, index) => (
        <mesh key={x} position={[x, 0.08, 0.24]} castShadow receiveShadow>
          <sphereGeometry args={[index % 2 === 0 ? 0.11 : 0.13, 18, 12]} />
          <ToyMaterial preset="sandMatte" color={index % 2 === 0 ? "#988a74" : "#8b7d6a"} />
        </mesh>
      ))}
      {[-0.42, 0.58].map((x) => (
        <group key={x} position={[x, 0.12, -0.2]} rotation={[0, 0, x > 0 ? -0.18 : 0.14]}>
          {[0, 0.07, -0.07].map((offset) => (
            <mesh key={offset} position={[offset, 0.14, 0]} rotation={[0.12, 0, offset * 2]} castShadow>
              <capsuleGeometry args={[0.018, 0.28, 4, 8]} />
              <ToyMaterial preset="softPlastic" color="#5fab6f" />
            </mesh>
          ))}
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
      <mesh position={[0.16, 0.16, -0.04]} scale={[1, 0.68, 0.92]} castShadow receiveShadow>
        <sphereGeometry args={[0.22, 24, 16]} />
        <ToyMaterial preset="sandMatte" color="#b4afa1" />
      </mesh>
      <mesh position={[0.04, 0.28, -0.1]} scale={[0.72, 0.36, 0.32]} castShadow>
        <sphereGeometry args={[0.18, 18, 12]} />
        <ToyMaterial preset="sandMatte" color="#d2c9b7" />
      </mesh>
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
      <EyePair left={-0.08} right={0.08} y={0.53} z={-0.25} size={0.024} />
      <Smile position={[0, 0.45, -0.268]} scale={[0.6, 0.38, 0.6]} />
      {Array.from({ length: 8 }).map((_, index) => {
        const angle = (index / 8) * Math.PI * 2;
        return (
          <mesh
            key={angle}
            position={[Math.cos(angle) * 0.38, 0.48 + Math.sin(angle) * 0.16, 0]}
            rotation={[0, 0, -angle]}
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
    </group>
  );
}

function MonsterToy(): JSX.Element {
  return (
    <group>
      <RoundedBoxMesh size={[0.58, 0.62, 0.48]} radius={0.22} smoothness={9} position={[0, 0.32, 0]} castShadow receiveShadow>
        <ToyMaterial preset="softPlastic" color="#8067d8" />
      </RoundedBoxMesh>
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
    </group>
  );
}

function RobotToy(): JSX.Element {
  return (
    <group>
      <RoundedBoxMesh size={[0.42, 0.48, 0.32]} radius={0.09} smoothness={6} position={[0, 0.2, 0]} castShadow receiveShadow>
        <ToyMaterial preset="toyMetal" color="#aebec3" />
      </RoundedBoxMesh>
      <RoundedBoxMesh size={[0.46, 0.34, 0.36]} radius={0.1} smoothness={6} position={[0, 0.62, 0]} castShadow receiveShadow>
        <ToyMaterial preset="toyMetal" color="#d4e0de" />
      </RoundedBoxMesh>
      <RoundedBoxMesh size={[0.26, 0.16, 0.03]} radius={0.025} smoothness={4} position={[0, 0.2, -0.172]} castShadow>
        <ToyMaterial preset="glassWater" color="#67b8cc" opacity={0.88} />
      </RoundedBoxMesh>
      <mesh position={[0.06, 0.205, -0.194]} castShadow>
        <sphereGeometry args={[0.014, 10, 8]} />
        <ToyMaterial preset="softPlastic" color="#e9f8e8" emissive="#9decc4" emissiveIntensity={0.08} />
      </mesh>
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
      {[-0.12, 0.12].map((x) => (
        <RoundedBoxMesh key={x} size={[0.08, 0.11, 0.12]} radius={0.025} smoothness={4} position={[x, -0.035, 0]} castShadow receiveShadow>
          <ToyMaterial preset="toyMetal" color="#83969c" />
        </RoundedBoxMesh>
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
      {[-0.09, 0, 0.09].map((x) => (
        <RoundedBoxMesh key={x} size={[0.035, 0.085, 0.025]} radius={0.008} smoothness={2} position={[x, 0.16, -0.13]} castShadow>
          <ToyMaterial preset="warmCeramic" color="#f7eed9" />
        </RoundedBoxMesh>
      ))}
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
    </group>
  );
}

function FallbackToy(): JSX.Element {
  return (
    <RoundedBoxMesh size={[0.52, 0.52, 0.52]} radius={0.16} smoothness={8} position={[0, 0.26, 0]} castShadow receiveShadow>
      <ToyMaterial preset="softPlastic" color="#b9e2d6" />
    </RoundedBoxMesh>
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

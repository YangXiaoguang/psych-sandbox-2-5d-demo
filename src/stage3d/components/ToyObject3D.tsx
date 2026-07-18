import type { ThreeEvent } from "@react-three/fiber";
import type { ToyModelRecipe } from "../../types";
import { RoundedBoxMesh } from "./RoundedBoxMesh";

type Vec3 = [number, number, number];

interface ToyObject3DProps {
  dragging?: boolean;
  modelRecipe: ToyModelRecipe;
  onPointerDown?: (event: ThreeEvent<PointerEvent>) => void;
  position: Vec3;
  rotation?: Vec3;
  scale?: number;
  selected?: boolean;
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
      <RoundedBoxMesh size={[0.92, 0.68, 0.78]} radius={0.08} smoothness={7} position={[0, 0.26, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#f3d9ad" roughness={0.72} />
      </RoundedBoxMesh>
      <mesh position={[0, 0.77, 0]} rotation={[0, Math.PI / 4, 0]} castShadow receiveShadow>
        <coneGeometry args={[0.76, 0.48, 4]} />
        <meshStandardMaterial color="#dd6644" roughness={0.58} />
      </mesh>
      <RoundedBoxMesh size={[0.22, 0.34, 0.035]} radius={0.025} smoothness={4} position={[0, 0.13, -0.405]} castShadow>
        <meshStandardMaterial color="#8b542f" roughness={0.74} />
      </RoundedBoxMesh>
      <RoundedBoxMesh size={[0.18, 0.16, 0.035]} radius={0.02} smoothness={4} position={[-0.25, 0.3, -0.407]} castShadow>
        <meshStandardMaterial color="#8ed1e4" roughness={0.42} />
      </RoundedBoxMesh>
      <RoundedBoxMesh size={[0.18, 0.16, 0.035]} radius={0.02} smoothness={4} position={[0.25, 0.3, -0.407]} castShadow>
        <meshStandardMaterial color="#8ed1e4" roughness={0.42} />
      </RoundedBoxMesh>
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
        <meshStandardMaterial color={cloth} roughness={0.56} />
      </RoundedBoxMesh>
      <mesh position={[0, 0.72, 0]} castShadow receiveShadow>
        <sphereGeometry args={[0.24, 32, 24]} />
        <meshStandardMaterial color={skin} roughness={0.5} />
      </mesh>
      <mesh position={[-0.075, 0.75, -0.205]} castShadow>
        <sphereGeometry args={[0.025, 16, 12]} />
        <meshStandardMaterial color="#1d2b2c" roughness={0.35} />
      </mesh>
      <mesh position={[0.075, 0.75, -0.205]} castShadow>
        <sphereGeometry args={[0.025, 16, 12]} />
        <meshStandardMaterial color="#1d2b2c" roughness={0.35} />
      </mesh>
      <mesh position={[0, 0.86, 0.03]} castShadow>
        <sphereGeometry args={[0.245, 32, 12, 0, Math.PI * 2, 0, Math.PI * 0.48]} />
        <meshStandardMaterial color={elder ? "#f2ede0" : "#49301f"} roughness={0.64} />
      </mesh>
      <mesh position={[-0.2, 0.23, -0.02]} rotation={[0.15, 0, 0.28]} castShadow receiveShadow>
        <capsuleGeometry args={[0.065, 0.36, 6, 16]} />
        <meshStandardMaterial color={skin} roughness={0.58} />
      </mesh>
      <mesh position={[0.2, 0.23, -0.02]} rotation={[0.1, 0, -0.28]} castShadow receiveShadow>
        <capsuleGeometry args={[0.065, 0.36, 6, 16]} />
        <meshStandardMaterial color={skin} roughness={0.58} />
      </mesh>
    </group>
  );
}

function DogToy(): JSX.Element {
  return (
    <group>
      <mesh position={[0, 0.25, 0]} rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
        <capsuleGeometry args={[0.18, 0.56, 7, 18]} />
        <meshStandardMaterial color="#d99a50" roughness={0.64} />
      </mesh>
      <mesh position={[0.43, 0.34, -0.02]} castShadow receiveShadow>
        <sphereGeometry args={[0.2, 28, 20]} />
        <meshStandardMaterial color="#e7b26a" roughness={0.6} />
      </mesh>
      <mesh position={[0.52, 0.37, -0.18]} castShadow>
        <sphereGeometry args={[0.035, 14, 10]} />
        <meshStandardMaterial color="#1e2523" roughness={0.4} />
      </mesh>
      <mesh position={[0.18, 0.5, 0.02]} rotation={[0.15, 0, -0.25]} castShadow>
        <capsuleGeometry args={[0.045, 0.28, 5, 12]} />
        <meshStandardMaterial color="#8d5a35" roughness={0.72} />
      </mesh>
      {[-0.22, 0.18].map((x) => (
        <mesh key={x} position={[x, 0.02, -0.1]} castShadow>
          <capsuleGeometry args={[0.04, 0.24, 5, 10]} />
          <meshStandardMaterial color="#8d5a35" roughness={0.72} />
        </mesh>
      ))}
      <mesh position={[-0.42, 0.44, 0]} rotation={[0, 0, 0.78]} castShadow>
        <capsuleGeometry args={[0.035, 0.32, 5, 10]} />
        <meshStandardMaterial color="#8d5a35" roughness={0.72} />
      </mesh>
    </group>
  );
}

function BirdToy(): JSX.Element {
  return (
    <group>
      <mesh position={[0, 0.28, 0]} castShadow receiveShadow>
        <sphereGeometry args={[0.27, 32, 22]} />
        <meshStandardMaterial color="#78c7e7" roughness={0.58} />
      </mesh>
      <mesh position={[0.03, 0.5, -0.03]} castShadow receiveShadow>
        <sphereGeometry args={[0.18, 24, 18]} />
        <meshStandardMaterial color="#8fd4ef" roughness={0.56} />
      </mesh>
      <mesh position={[0.03, 0.5, -0.2]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <coneGeometry args={[0.06, 0.17, 18]} />
        <meshStandardMaterial color="#f2b544" roughness={0.48} />
      </mesh>
      <mesh position={[-0.22, 0.25, 0.02]} rotation={[0.2, 0, 0.75]} castShadow>
        <capsuleGeometry args={[0.055, 0.34, 5, 14]} />
        <meshStandardMaterial color="#3fa3c4" roughness={0.62} />
      </mesh>
      <mesh position={[0.22, 0.25, 0.02]} rotation={[0.2, 0, -0.75]} castShadow>
        <capsuleGeometry args={[0.055, 0.34, 5, 14]} />
        <meshStandardMaterial color="#3fa3c4" roughness={0.62} />
      </mesh>
    </group>
  );
}

function FishToy(): JSX.Element {
  return (
    <group rotation={[0, -0.45, 0]}>
      <mesh position={[0, 0.26, 0]} scale={[1.38, 0.78, 0.7]} castShadow receiveShadow>
        <sphereGeometry args={[0.28, 32, 20]} />
        <meshStandardMaterial color="#75d6df" roughness={0.44} />
      </mesh>
      <mesh position={[-0.48, 0.26, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <coneGeometry args={[0.2, 0.34, 3]} />
        <meshStandardMaterial color="#55bcc9" roughness={0.5} />
      </mesh>
      <mesh position={[0.2, 0.38, -0.2]} castShadow>
        <sphereGeometry args={[0.026, 14, 10]} />
        <meshStandardMaterial color="#203233" roughness={0.42} />
      </mesh>
    </group>
  );
}

function LionToy(): JSX.Element {
  return (
    <group>
      <mesh position={[0, 0.25, 0]} rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
        <capsuleGeometry args={[0.2, 0.58, 7, 18]} />
        <meshStandardMaterial color="#d99a45" roughness={0.64} />
      </mesh>
      <mesh position={[0.43, 0.37, 0]} castShadow receiveShadow>
        <sphereGeometry args={[0.27, 28, 20]} />
        <meshStandardMaterial color="#aa6637" roughness={0.76} />
      </mesh>
      <mesh position={[0.49, 0.39, -0.08]} castShadow receiveShadow>
        <sphereGeometry args={[0.18, 24, 16]} />
        <meshStandardMaterial color="#e8b45b" roughness={0.58} />
      </mesh>
      <mesh position={[0.54, 0.41, -0.245]} castShadow>
        <sphereGeometry args={[0.025, 14, 10]} />
        <meshStandardMaterial color="#1e2523" roughness={0.4} />
      </mesh>
      <mesh position={[-0.44, 0.43, 0]} rotation={[0, 0, 0.72]} castShadow>
        <capsuleGeometry args={[0.035, 0.34, 5, 10]} />
        <meshStandardMaterial color="#9d5a2c" roughness={0.72} />
      </mesh>
    </group>
  );
}

function BridgeToy(): JSX.Element {
  return (
    <group>
      <RoundedBoxMesh size={[1.25, 0.14, 0.36]} radius={0.05} smoothness={5} position={[0, 0.18, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#bc8550" roughness={0.78} />
      </RoundedBoxMesh>
      {[-0.4, 0, 0.4].map((x) => (
        <RoundedBoxMesh key={x} size={[0.08, 0.26, 0.46]} radius={0.025} smoothness={4} position={[x, 0.31, 0]} castShadow>
          <meshStandardMaterial color="#e1b276" roughness={0.74} />
        </RoundedBoxMesh>
      ))}
      {[-0.24, 0.24].map((z) => (
        <RoundedBoxMesh key={z} size={[1.34, 0.06, 0.06]} radius={0.02} smoothness={4} position={[0, 0.42, z]} castShadow>
          <meshStandardMaterial color="#8a5d36" roughness={0.76} />
        </RoundedBoxMesh>
      ))}
    </group>
  );
}

function FenceToy(): JSX.Element {
  return (
    <group>
      {[-0.48, -0.16, 0.16, 0.48].map((x) => (
        <RoundedBoxMesh key={x} size={[0.08, 0.46, 0.08]} radius={0.025} smoothness={4} position={[x, 0.23, 0]} castShadow receiveShadow>
          <meshStandardMaterial color="#d9b477" roughness={0.72} />
        </RoundedBoxMesh>
      ))}
      {[0.14, 0.32].map((y) => (
        <RoundedBoxMesh key={y} size={[1.08, 0.07, 0.08]} radius={0.02} smoothness={4} position={[0, y, -0.02]} castShadow>
          <meshStandardMaterial color="#bb8150" roughness={0.75} />
        </RoundedBoxMesh>
      ))}
    </group>
  );
}

function TowerToy(): JSX.Element {
  return (
    <group>
      <mesh position={[0, 0.42, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.27, 0.34, 0.84, 24]} />
        <meshStandardMaterial color="#d7c6ad" roughness={0.74} />
      </mesh>
      <mesh position={[0, 1.02, 0]} castShadow receiveShadow>
        <coneGeometry args={[0.42, 0.48, 24]} />
        <meshStandardMaterial color="#c55e46" roughness={0.58} />
      </mesh>
      <RoundedBoxMesh size={[0.15, 0.24, 0.035]} radius={0.02} smoothness={4} position={[0, 0.34, -0.345]} castShadow>
        <meshStandardMaterial color="#6ba9bd" roughness={0.42} />
      </RoundedBoxMesh>
    </group>
  );
}

function TreeToy(): JSX.Element {
  return (
    <group>
      <mesh position={[0, 0.2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.13, 0.18, 0.64, 18]} />
        <meshStandardMaterial color="#a66b3d" roughness={0.78} />
      </mesh>
      <mesh position={[-0.12, 0.72, 0.05]} castShadow receiveShadow>
        <sphereGeometry args={[0.34, 32, 22]} />
        <meshStandardMaterial color="#73c985" roughness={0.64} />
      </mesh>
      <mesh position={[0.2, 0.65, -0.03]} castShadow receiveShadow>
        <sphereGeometry args={[0.3, 32, 22]} />
        <meshStandardMaterial color="#61b979" roughness={0.66} />
      </mesh>
      <mesh position={[0.02, 0.92, -0.02]} castShadow receiveShadow>
        <sphereGeometry args={[0.33, 32, 22]} />
        <meshStandardMaterial color="#8edc8b" roughness={0.62} />
      </mesh>
    </group>
  );
}

function WaterToy(): JSX.Element {
  return (
    <group>
      <mesh position={[0, 0.02, 0]} scale={[1.35, 0.24, 0.82]} receiveShadow>
        <sphereGeometry args={[0.42, 48, 18]} />
        <meshStandardMaterial color="#74d4e8" roughness={0.28} metalness={0.02} transparent opacity={0.86} />
      </mesh>
      {[-0.45, 0.5].map((x) => (
        <mesh key={x} position={[x, 0.08, 0.24]} castShadow receiveShadow>
          <sphereGeometry args={[0.13, 18, 12]} />
          <meshStandardMaterial color="#8b7d6a" roughness={0.82} />
        </mesh>
      ))}
    </group>
  );
}

function RockToy(): JSX.Element {
  return (
    <group>
      <mesh position={[-0.16, 0.19, 0.02]} scale={[1.2, 0.82, 1]} castShadow receiveShadow>
        <sphereGeometry args={[0.24, 24, 16]} />
        <meshStandardMaterial color="#9a978d" roughness={0.82} />
      </mesh>
      <mesh position={[0.16, 0.16, -0.04]} scale={[1, 0.68, 0.92]} castShadow receiveShadow>
        <sphereGeometry args={[0.22, 24, 16]} />
        <meshStandardMaterial color="#b4afa1" roughness={0.84} />
      </mesh>
    </group>
  );
}

function SunToy(): JSX.Element {
  return (
    <group>
      <mesh position={[0, 0.48, 0]} castShadow receiveShadow>
        <sphereGeometry args={[0.28, 32, 22]} />
        <meshStandardMaterial color="#ffd65a" roughness={0.42} emissive="#d9911d" emissiveIntensity={0.18} />
      </mesh>
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
            <meshStandardMaterial color="#ffbe43" roughness={0.5} />
          </mesh>
        );
      })}
      <mesh position={[0, 0.17, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.04, 0.05, 0.36, 12]} />
        <meshStandardMaterial color="#8e6335" roughness={0.78} />
      </mesh>
    </group>
  );
}

function MonsterToy(): JSX.Element {
  return (
    <group>
      <RoundedBoxMesh size={[0.58, 0.62, 0.48]} radius={0.22} smoothness={9} position={[0, 0.32, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#8067d8" roughness={0.58} />
      </RoundedBoxMesh>
      {[-0.17, 0.17].map((x) => (
        <mesh key={x} position={[x, 0.72, 0]} rotation={[0, 0, x > 0 ? -0.36 : 0.36]} castShadow>
          <coneGeometry args={[0.08, 0.24, 18]} />
          <meshStandardMaterial color="#f4d875" roughness={0.48} />
        </mesh>
      ))}
      {[-0.1, 0.1].map((x) => (
        <mesh key={x} position={[x, 0.42, -0.25]} castShadow>
          <sphereGeometry args={[0.045, 16, 12]} />
          <meshStandardMaterial color="#192222" roughness={0.36} />
        </mesh>
      ))}
    </group>
  );
}

function RobotToy(): JSX.Element {
  return (
    <group>
      <RoundedBoxMesh size={[0.42, 0.48, 0.32]} radius={0.09} smoothness={6} position={[0, 0.2, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#aebec3" roughness={0.52} />
      </RoundedBoxMesh>
      <RoundedBoxMesh size={[0.46, 0.34, 0.36]} radius={0.1} smoothness={6} position={[0, 0.62, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#d4e0de" roughness={0.48} />
      </RoundedBoxMesh>
      {[-0.11, 0.11].map((x) => (
        <mesh key={x} position={[x, 0.66, -0.2]} castShadow>
          <sphereGeometry args={[0.035, 14, 10]} />
          <meshStandardMaterial color="#2d5562" roughness={0.36} />
        </mesh>
      ))}
      <mesh position={[0, 0.88, 0]} castShadow>
        <cylinderGeometry args={[0.018, 0.018, 0.24, 10]} />
        <meshStandardMaterial color="#8a969b" roughness={0.55} />
      </mesh>
      <mesh position={[0, 1.02, 0]} castShadow>
        <sphereGeometry args={[0.04, 14, 10]} />
        <meshStandardMaterial color="#ee8e85" roughness={0.42} />
      </mesh>
    </group>
  );
}

function SkullToy(): JSX.Element {
  return (
    <group>
      <mesh position={[0, 0.42, 0]} scale={[1, 1.04, 0.88]} castShadow receiveShadow>
        <sphereGeometry args={[0.28, 32, 20]} />
        <meshStandardMaterial color="#ece3cc" roughness={0.72} />
      </mesh>
      <RoundedBoxMesh size={[0.3, 0.18, 0.2]} radius={0.06} smoothness={5} position={[0, 0.18, -0.02]} castShadow receiveShadow>
        <meshStandardMaterial color="#d7ccb4" roughness={0.78} />
      </RoundedBoxMesh>
      {[-0.09, 0.09].map((x) => (
        <mesh key={x} position={[x, 0.45, -0.23]} castShadow>
          <sphereGeometry args={[0.06, 16, 12]} />
          <meshStandardMaterial color="#25231f" roughness={0.5} />
        </mesh>
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
        <meshStandardMaterial color="#7f6648" roughness={0.72} />
      </mesh>
      <mesh position={[0, 0.58, 0]} castShadow receiveShadow>
        <sphereGeometry args={[0.22, 32, 18]} />
        <meshStandardMaterial color="#ffe19b" roughness={0.34} emissive="#f5b64f" emissiveIntensity={0.35} />
      </mesh>
    </group>
  );
}

function FallbackToy(): JSX.Element {
  return (
    <RoundedBoxMesh size={[0.52, 0.52, 0.52]} radius={0.16} smoothness={8} position={[0, 0.26, 0]} castShadow receiveShadow>
      <meshStandardMaterial color="#b9e2d6" roughness={0.58} />
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

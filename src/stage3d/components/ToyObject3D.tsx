import { RoundedBoxMesh } from "./RoundedBoxMesh";

type ToyKind = "house" | "person" | "tree";
type Vec3 = [number, number, number];

interface ToyObject3DProps {
  kind: ToyKind;
  position: Vec3;
  rotation?: Vec3;
  scale?: number;
}

export function ToyObject3D({ kind, position, rotation = [0, 0, 0], scale = 1 }: ToyObject3DProps): JSX.Element {
  return (
    <group position={position} rotation={rotation} scale={scale}>
      {kind === "house" ? <HouseToy /> : null}
      {kind === "person" ? <PersonToy /> : null}
      {kind === "tree" ? <TreeToy /> : null}
    </group>
  );
}

function HouseToy(): JSX.Element {
  return (
    <group>
      <mesh position={[0, -0.18, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[0.68, 48]} />
        <meshBasicMaterial color="#1e160c" transparent opacity={0.23} />
      </mesh>
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

function PersonToy(): JSX.Element {
  return (
    <group>
      <mesh position={[0, -0.18, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[0.42, 40]} />
        <meshBasicMaterial color="#1e160c" transparent opacity={0.24} />
      </mesh>
      <RoundedBoxMesh size={[0.38, 0.58, 0.28]} radius={0.14} smoothness={8} position={[0, 0.24, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#66b6cf" roughness={0.56} />
      </RoundedBoxMesh>
      <mesh position={[0, 0.72, 0]} castShadow receiveShadow>
        <sphereGeometry args={[0.24, 32, 24]} />
        <meshStandardMaterial color="#f5be8d" roughness={0.5} />
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
        <meshStandardMaterial color="#49301f" roughness={0.64} />
      </mesh>
      <mesh position={[-0.2, 0.23, -0.02]} rotation={[0.15, 0, 0.28]} castShadow receiveShadow>
        <capsuleGeometry args={[0.065, 0.36, 6, 16]} />
        <meshStandardMaterial color="#f2c297" roughness={0.58} />
      </mesh>
      <mesh position={[0.2, 0.23, -0.02]} rotation={[0.1, 0, -0.28]} castShadow receiveShadow>
        <capsuleGeometry args={[0.065, 0.36, 6, 16]} />
        <meshStandardMaterial color="#f2c297" roughness={0.58} />
      </mesh>
    </group>
  );
}

function TreeToy(): JSX.Element {
  return (
    <group>
      <mesh position={[0, -0.18, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[0.62, 40]} />
        <meshBasicMaterial color="#1e160c" transparent opacity={0.22} />
      </mesh>
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

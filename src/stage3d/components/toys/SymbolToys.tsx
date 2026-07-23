import { RoundedBoxMesh } from "../RoundedBoxMesh";
import { Cheeks, EyePair, Smile, ToyHighlight, ToyMaterial } from "./toyPrimitives";

export function MonsterToy(): JSX.Element {
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

export function RobotToy(): JSX.Element {
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

export function SkullToy(): JSX.Element {
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

export function LightToy(): JSX.Element {
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

export function FallbackToy(): JSX.Element {
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

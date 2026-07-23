import { Cheeks, EyePair, Smile, ToyHighlight, ToyMaterial, type Vec3 } from "./toyPrimitives";

export function TreeToy(): JSX.Element {
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

export function WaterToy(): JSX.Element {
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

export function RockToy(): JSX.Element {
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

export function SunToy(): JSX.Element {
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

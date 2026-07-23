import { Cheeks, EyePair, TOY_DARK, ToyHighlight, ToyMaterial } from "./toyPrimitives";

export function DogToy(): JSX.Element {
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

export function BirdToy(): JSX.Element {
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

export function FishToy(): JSX.Element {
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

export function LionToy(): JSX.Element {
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

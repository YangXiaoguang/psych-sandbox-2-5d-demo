import { RoundedBoxMesh } from "../RoundedBoxMesh";
import { ToyHighlight, ToyMaterial } from "./toyPrimitives";

export function HouseToy(): JSX.Element {
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

export function BridgeToy(): JSX.Element {
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

export function FenceToy(): JSX.Element {
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

export function TowerToy(): JSX.Element {
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

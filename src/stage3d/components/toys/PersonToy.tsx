import { RoundedBoxMesh } from "../RoundedBoxMesh";
import { Cheeks, EyePair, Smile, ToyHighlight, ToyMaterial } from "./toyPrimitives";

interface PersonToyProps {
  bodyScale: number;
  cloth: string;
  elder?: boolean;
  skin: string;
}

export function PersonToy({ bodyScale, cloth, elder, skin }: PersonToyProps): JSX.Element {
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

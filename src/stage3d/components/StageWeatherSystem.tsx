import type { SandboxEnvironment } from "../../types";

interface StageWeatherSystemProps {
  environment: SandboxEnvironment;
}

export function StageWeatherSystem({ environment }: StageWeatherSystemProps): JSX.Element {
  const night = environment.light === "night";
  const rainy = environment.weather === "rainy";
  const cloudy = environment.weather === "cloudy";

  return (
    <group position={[0, 0, -3.6]}>
      {night ? <NightSky /> : null}
      {cloudy || rainy ? <CloudBank night={night} rainy={rainy} /> : <DayClouds />}
      {rainy ? <RainField /> : null}
    </group>
  );
}

function DayClouds(): JSX.Element {
  return (
    <group position={[0, 3.2, 0]}>
      <CloudPuff x={-3.2} y={0.2} scale={0.95} opacity={0.32} />
      <CloudPuff x={2.9} y={0.45} scale={0.72} opacity={0.26} />
    </group>
  );
}

function CloudBank({ night, rainy }: { night: boolean; rainy: boolean }): JSX.Element {
  const color = night ? "#7f969e" : "#d7e7e8";
  return (
    <group position={[0, 3.05, 0]}>
      <CloudPuff color={color} x={-3.5} y={0.3} scale={1.18} opacity={rainy ? 0.28 : 0.26} />
      <CloudPuff color={color} x={-0.2} y={0.48} scale={1.34} opacity={rainy ? 0.34 : 0.28} />
      <CloudPuff color={color} x={3.1} y={0.25} scale={1.08} opacity={rainy ? 0.28 : 0.24} />
    </group>
  );
}

function CloudPuff({
  color = "#d7e7e8",
  x,
  y,
  scale,
  opacity,
}: {
  color?: string;
  x: number;
  y: number;
  scale: number;
  opacity: number;
}): JSX.Element {
  return (
    <group position={[x, y, 0]} scale={scale}>
      {[-0.42, -0.12, 0.2, 0.52].map((offset, index) => (
        <mesh key={index} position={[offset, Math.sin(index) * 0.05, 0]} scale={[1.58 - index * 0.08, 0.46 + index * 0.025, 0.12]}>
          <sphereGeometry args={[0.42 - index * 0.025, 18, 12]} />
          <meshBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

function NightSky(): JSX.Element {
  return (
    <group>
      {Array.from({ length: 34 }, (_, index) => {
        const x = -5.2 + seeded(index * 19) * 10.4;
        const y = 2.6 + seeded(index * 31) * 2.2;
        return (
          <mesh key={index} position={[x, y, -0.15]}>
            <sphereGeometry args={[0.012 + seeded(index * 43) * 0.016, 8, 6]} />
            <meshBasicMaterial color="#f4e8b9" transparent opacity={0.32 + seeded(index * 47) * 0.4} />
          </mesh>
        );
      })}
      <mesh position={[3.4, 3.65, -0.12]}>
        <sphereGeometry args={[0.3, 32, 16]} />
        <meshBasicMaterial color="#e9ddb1" transparent opacity={0.7} />
      </mesh>
    </group>
  );
}

function RainField(): JSX.Element {
  return (
    <group>
      {Array.from({ length: 44 }, (_, index) => {
        const x = -5.6 + seeded(index * 11) * 11.2;
        const y = 0.8 + seeded(index * 23) * 4.4;
        return (
          <mesh key={index} position={[x, y, 0]} rotation={[0, 0, -0.28]}>
            <boxGeometry args={[0.01, 0.34 + seeded(index * 37) * 0.24, 0.01]} />
            <meshBasicMaterial color="#d8eef6" transparent opacity={0.135} depthWrite={false} />
          </mesh>
        );
      })}
    </group>
  );
}

function seeded(seed: number): number {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

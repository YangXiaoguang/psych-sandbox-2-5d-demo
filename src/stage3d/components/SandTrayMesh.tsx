import { useMemo } from "react";
import * as THREE from "three";
import type { SandboxEnvironment } from "../../types";
import { RoundedBoxMesh } from "./RoundedBoxMesh";

const TRAY_WIDTH = 7.8;
const TRAY_DEPTH = 5.1;
const WALL = 0.24;
const WALL_HEIGHT = 0.52;

interface SandTrayMeshProps {
  environment: SandboxEnvironment;
}

export function SandTrayMesh({ environment }: SandTrayMeshProps): JSX.Element {
  const night = environment.light === "night";
  const rainy = environment.weather === "rainy";
  const sandTexture = useMemo(() => createSandTexture(environment), [environment]);
  const woodTexture = useMemo(() => createWoodTexture(environment), [environment]);

  return (
    <group>
      <mesh receiveShadow position={[0, -0.08, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[13, 9]} />
        <meshStandardMaterial color={night ? "#172832" : "#ead8b6"} roughness={0.88} metalness={0.02} />
      </mesh>

      <RoundedBoxMesh size={[TRAY_WIDTH, WALL_HEIGHT, WALL]} radius={0.07} smoothness={6} position={[0, WALL_HEIGHT / 2, -TRAY_DEPTH / 2]} castShadow receiveShadow>
        <meshStandardMaterial map={woodTexture} color={night ? "#7e5b38" : "#c48b50"} roughness={0.72} />
      </RoundedBoxMesh>
      <RoundedBoxMesh size={[TRAY_WIDTH, WALL_HEIGHT, WALL]} radius={0.07} smoothness={6} position={[0, WALL_HEIGHT / 2, TRAY_DEPTH / 2]} castShadow receiveShadow>
        <meshStandardMaterial map={woodTexture} color={night ? "#8a633d" : "#d59a5d"} roughness={0.68} />
      </RoundedBoxMesh>
      <RoundedBoxMesh size={[WALL, WALL_HEIGHT, TRAY_DEPTH]} radius={0.07} smoothness={6} position={[-TRAY_WIDTH / 2, WALL_HEIGHT / 2, 0]} castShadow receiveShadow>
        <meshStandardMaterial map={woodTexture} color={night ? "#705134" : "#b97f49"} roughness={0.75} />
      </RoundedBoxMesh>
      <RoundedBoxMesh size={[WALL, WALL_HEIGHT, TRAY_DEPTH]} radius={0.07} smoothness={6} position={[TRAY_WIDTH / 2, WALL_HEIGHT / 2, 0]} castShadow receiveShadow>
        <meshStandardMaterial map={woodTexture} color={night ? "#8a623d" : "#ca9054"} roughness={0.72} />
      </RoundedBoxMesh>

      <RoundedBoxMesh size={[TRAY_WIDTH - WALL * 2.45, 0.08, TRAY_DEPTH - WALL * 2.45]} radius={0.08} smoothness={8} position={[0, 0.2, 0]} receiveShadow>
        <meshStandardMaterial
          map={sandTexture}
          color={night ? "#b8aa88" : rainy ? "#d2be8f" : "#ecd39b"}
          roughness={rainy ? 0.62 : 0.94}
          metalness={0}
        />
      </RoundedBoxMesh>

      <BlueLiner position={[0, 0.235, -TRAY_DEPTH / 2 + WALL * 1.1]} size={[TRAY_WIDTH - WALL * 1.6, 0.04, 0.05]} />
      <BlueLiner position={[0, 0.235, TRAY_DEPTH / 2 - WALL * 1.1]} size={[TRAY_WIDTH - WALL * 1.6, 0.04, 0.05]} />
      <BlueLiner position={[-TRAY_WIDTH / 2 + WALL * 1.1, 0.235, 0]} size={[0.05, 0.04, TRAY_DEPTH - WALL * 1.6]} />
      <BlueLiner position={[TRAY_WIDTH / 2 - WALL * 1.1, 0.235, 0]} size={[0.05, 0.04, TRAY_DEPTH - WALL * 1.6]} />

      <mesh position={[1.95, 0.255, 0.88]} receiveShadow>
        <cylinderGeometry args={[0.72, 0.78, 0.08, 48]} />
        <meshStandardMaterial color={night ? "#6bb9c5" : "#77cfe2"} roughness={0.32} transparent opacity={0.78} />
      </mesh>

    </group>
  );
}

function BlueLiner({ position, size }: { position: [number, number, number]; size: [number, number, number] }): JSX.Element {
  return (
    <RoundedBoxMesh size={size} radius={0.025} smoothness={4} position={position} receiveShadow>
      <meshStandardMaterial color="#48a9c5" roughness={0.5} metalness={0.02} />
    </RoundedBoxMesh>
  );
}

function createSandTexture(environment: SandboxEnvironment): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext("2d");
  if (context) {
    const night = environment.light === "night";
    context.fillStyle = night ? "#b8aa88" : "#ecd39b";
    context.fillRect(0, 0, canvas.width, canvas.height);
    for (let index = 0; index < 2400; index += 1) {
      const x = seeded(index * 31) * canvas.width;
      const y = seeded(index * 47) * canvas.height;
      const alpha = 0.035 + seeded(index * 59) * 0.09;
      context.fillStyle = seeded(index * 19) > 0.5 ? `rgba(255,247,213,${alpha})` : `rgba(122,95,52,${alpha})`;
      context.beginPath();
      context.arc(x, y, 0.45 + seeded(index * 71) * 1.4, 0, Math.PI * 2);
      context.fill();
    }
    context.strokeStyle = environment.weather === "rainy" ? "rgba(255,255,255,0.08)" : "rgba(134,102,58,0.08)";
    for (let ridge = 0; ridge < 18; ridge += 1) {
      context.beginPath();
      const y = 34 + ridge * 26 + seeded(ridge * 13) * 12;
      context.moveTo(35, y);
      context.bezierCurveTo(150, y - 28, 330, y + 22, 478, y - 14);
      context.stroke();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2.8, 2);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createWoodTexture(environment: SandboxEnvironment): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 160;
  const context = canvas.getContext("2d");
  if (context) {
    const night = environment.light === "night";
    const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, night ? "#8a6744" : "#e1ad70");
    gradient.addColorStop(0.5, night ? "#6c4d31" : "#bc7d43");
    gradient.addColorStop(1, night ? "#4f3826" : "#8c582e");
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);
    for (let line = 0; line < 34; line += 1) {
      const y = seeded(line * 17) * canvas.height;
      context.strokeStyle = line % 3 === 0 ? "rgba(255,232,173,0.14)" : "rgba(70,41,20,0.18)";
      context.beginPath();
      context.moveTo(0, y);
      context.bezierCurveTo(130, y + seeded(line * 31) * 18 - 9, 290, y - 10, 512, y + seeded(line * 43) * 22 - 11);
      context.stroke();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2.2, 1);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function seeded(seed: number): number {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

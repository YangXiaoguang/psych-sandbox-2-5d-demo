import type { ThreeEvent } from "@react-three/fiber";
import { useMemo, useState } from "react";
import * as THREE from "three";
import { getToyShadowRadius, renderToyModel } from "./toys/toyRegistry";
import type { Vec3 } from "./toys/toyPrimitives";
import type { ToyModelRecipe } from "../../types";

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
  const [hovered, setHovered] = useState(false);
  const active = selected || hovered || dragging;
  const interactiveScale = scale * (dragging ? 1.055 : hovered ? 1.025 : 1);

  return (
    <group
      position={position}
      rotation={rotation}
      scale={interactiveScale}
      onPointerDown={onPointerDown}
      onPointerOver={() => {
        setHovered(true);
        document.body.style.cursor = dragging ? "grabbing" : "grab";
      }}
      onPointerOut={() => {
        setHovered(false);
        if (!dragging) {
          document.body.style.cursor = "";
        }
      }}
    >
      <SelectionHalo active={active} dragging={dragging} selected={selected} />
      <ToyDropShadow
        opacity={dragging ? 0.42 : selected ? 0.34 : hovered ? 0.3 : 0.24}
        radius={getToyShadowRadius(modelRecipe.kind) * (dragging ? 1.08 : hovered ? 1.04 : 1)}
      />
      {renderToyModel(modelRecipe)}
    </group>
  );
}

function SelectionHalo({
  active,
  dragging,
  selected,
}: {
  active: boolean;
  dragging: boolean;
  selected: boolean;
}): JSX.Element | null {
  if (!active) {
    return null;
  }

  const color = dragging ? "#f7d46b" : selected ? "#63d7cb" : "#dff9f3";

  return (
    <group position={[0, -0.16, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={10}>
      <mesh>
        <ringGeometry args={[dragging ? 0.57 : 0.54, dragging ? 0.68 : 0.62, 64]} />
        <meshBasicMaterial color={color} transparent opacity={dragging ? 0.96 : selected ? 0.9 : 0.58} depthWrite={false} />
      </mesh>
      {(dragging || selected) && (
        <mesh>
          <circleGeometry args={[dragging ? 0.56 : 0.5, 48]} />
          <meshBasicMaterial color={color} transparent opacity={dragging ? 0.16 : 0.09} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}

function ToyDropShadow({ opacity, radius }: { opacity: number; radius: number }): JSX.Element {
  const shadowTexture = useMemo(() => createSoftShadowTexture(), []);

  return (
    <mesh position={[0, -0.181, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow renderOrder={1}>
      <circleGeometry args={[radius, 48]} />
      <meshBasicMaterial map={shadowTexture} color="#1e160c" transparent opacity={opacity} depthWrite={false} />
    </mesh>
  );
}

function createSoftShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  if (context) {
    const gradient = context.createRadialGradient(128, 128, 8, 128, 128, 126);
    gradient.addColorStop(0, "rgba(255,255,255,0.98)");
    gradient.addColorStop(0.42, "rgba(255,255,255,0.58)");
    gradient.addColorStop(0.72, "rgba(255,255,255,0.18)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

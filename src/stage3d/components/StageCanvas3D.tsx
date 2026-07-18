import { Canvas } from "@react-three/fiber";
import { useState } from "react";
import type { WebGLRenderer } from "three";
import type { SandboxEnvironment, SandboxEventDraft, SandboxObject } from "../../types";
import { SandTrayMesh } from "./SandTrayMesh";
import { StageCameraControls } from "./StageCameraControls";
import { StageObjectsLayer3D } from "./StageObjectsLayer3D";
import { StageWeatherSystem } from "./StageWeatherSystem";

interface StageCanvas3DProps {
  environment: SandboxEnvironment;
  onCanvasReady: (canvas: HTMLCanvasElement) => void;
  objects: SandboxObject[];
  onPatchObject: (objectId: string, patch: Partial<SandboxObject>) => void;
  onRecordEvent: (draft: SandboxEventDraft) => void;
  onSelectObject: (objectId: string | null) => void;
  selectedId: string | null;
}

export function StageCanvas3D({
  environment,
  objects,
  onCanvasReady,
  onPatchObject,
  onRecordEvent,
  onSelectObject,
  selectedId,
}: StageCanvas3DProps): JSX.Element {
  const [objectDragging, setObjectDragging] = useState(false);
  const night = environment.light === "night";
  const rainy = environment.weather === "rainy";
  const cloudy = environment.weather === "cloudy";
  const background = night ? "#0b1923" : rainy ? "#c9d8d0" : cloudy ? "#e7ebdc" : "#f7ead2";
  const keyLight = night ? 1.25 : rainy ? 1.45 : cloudy ? 1.55 : 2.25;

  return (
    <Canvas
      className="stage-v2-canvas"
      shadows
      dpr={[1, 2]}
      orthographic
      camera={{ position: [6.8, 6.2, 8.2], zoom: 82, near: 0.1, far: 120 }}
      gl={{ antialias: true, alpha: false, preserveDrawingBuffer: true, powerPreference: "high-performance" }}
      onCreated={({ gl }: { gl: WebGLRenderer }) => {
        gl.setClearColor(background);
        onCanvasReady(gl.domElement);
      }}
      onPointerMissed={() => {
        if (!objectDragging) {
          onSelectObject(null);
        }
      }}
    >
      <color attach="background" args={[background]} />
      <fog attach="fog" args={[night ? "#0b1923" : background, 14, 28]} />

      <ambientLight intensity={night ? 0.42 : cloudy || rainy ? 0.62 : 0.5} color={night ? "#9fc8de" : "#fff4df"} />
      <hemisphereLight
        args={[night ? "#9fc8ff" : "#fff7df", night ? "#162b33" : "#8aa189", night ? 0.82 : 0.58]}
      />
      <directionalLight
        castShadow
        position={night ? [-4.5, 8, 4.8] : [-5.5, 8.5, 6.4]}
        intensity={keyLight}
        color={night ? "#d6efff" : "#fff0cc"}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={8}
        shadow-camera-bottom={-8}
        shadow-camera-near={0.5}
        shadow-camera-far={28}
        shadow-bias={-0.00025}
      />

      <StageWeatherSystem environment={environment} />
      <SandTrayMesh environment={environment} />
      <StageObjectsLayer3D
        objects={objects}
        selectedId={selectedId}
        onDragStateChange={setObjectDragging}
        onPatchObject={onPatchObject}
        onRecordEvent={onRecordEvent}
        onSelectObject={onSelectObject}
      />
      <StageCameraControls enabled={!objectDragging} />
    </Canvas>
  );
}

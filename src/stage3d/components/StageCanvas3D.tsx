import { Canvas, events as createPointerEvents } from "@react-three/fiber";
import { useEffect, useState } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { WebGLRenderer } from "three";
import type { SandboxEnvironment, SandboxEventDraft, SandboxObject } from "../../types";
import type { StageInteractionMode } from "../types";
import { SandTrayMesh } from "./SandTrayMesh";
import { StageCameraControls } from "./StageCameraControls";
import { StageObjectsLayer3D } from "./StageObjectsLayer3D";
import { StageWeatherSystem } from "./StageWeatherSystem";

interface StageCanvas3DProps {
  cameraResetSignal: number;
  environment: SandboxEnvironment;
  onCanvasReady: (canvas: HTMLCanvasElement) => void;
  objects: SandboxObject[];
  onPatchObject: (objectId: string, patch: Partial<SandboxObject>) => void;
  onRecordEvent: (draft: SandboxEventDraft) => void;
  onSelectObject: (objectId: string | null) => void;
  onInteractionModeChange?: (mode: StageInteractionMode) => void;
  onToyDragLabelChange?: (label: string | null) => void;
  selectedId: string | null;
}

export function StageCanvas3D({
  cameraResetSignal,
  environment,
  objects,
  onCanvasReady,
  onPatchObject,
  onRecordEvent,
  onSelectObject,
  onInteractionModeChange,
  onToyDragLabelChange,
  selectedId,
}: StageCanvas3DProps): JSX.Element {
  const [objectDragging, setObjectDragging] = useState(false);
  const night = environment.light === "night";
  const rainy = environment.weather === "rainy";
  const cloudy = environment.weather === "cloudy";
  const background = night ? "#061822" : rainy ? "#75bbc7" : cloudy ? "#9bd9d8" : "#8de8ec";
  const keyLight = night ? 1.25 : rainy ? 1.45 : cloudy ? 1.55 : 2.25;
  const exposure = night ? 0.92 : rainy ? 0.98 : 1.06;
  const handleDragStateChange = (dragging: boolean, label?: string) => {
    setObjectDragging(dragging);
    onToyDragLabelChange?.(dragging ? label ?? null : null);
    onInteractionModeChange?.(dragging ? "drag-toy" : "idle");
  };

  return (
    <Canvas
      className="stage-v2-canvas"
      events={createStagePointerEvents}
      shadows="percentage"
      dpr={[1, 2]}
      orthographic
      camera={{ position: [6.8, 6.2, 8.2], zoom: 82, near: 0.1, far: 120 }}
      gl={{ antialias: true, alpha: false, preserveDrawingBuffer: true, powerPreference: "high-performance" }}
      onCreated={({ gl }: { gl: WebGLRenderer }) => {
        gl.outputColorSpace = THREE.SRGBColorSpace;
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        onCanvasReady(gl.domElement);
      }}
      onPointerMissed={() => {
        if (!objectDragging) {
          onSelectObject(null);
        }
      }}
    >
      <StageRenderSettings background={background} exposure={exposure} />
      <color attach="background" args={[background]} />
      <fog attach="fog" args={[night ? "#061822" : background, 18, 34]} />

      <ambientLight intensity={night ? 0.38 : cloudy || rainy ? 0.56 : 0.46} color={night ? "#9fc8de" : "#fff4df"} />
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
      <directionalLight
        position={night ? [3.8, 3.5, -5.4] : [4.2, 4.6, -5.2]}
        intensity={night ? 0.48 : rainy ? 0.26 : cloudy ? 0.32 : 0.42}
        color={night ? "#7fbfff" : "#d7fff3"}
      />
      <pointLight
        position={night ? [1.8, 2.2, 1.4] : [-2.6, 1.6, 1.8]}
        intensity={night ? 0.45 : 0.16}
        color={night ? "#8ff7d9" : "#fff3cc"}
        distance={7}
      />

      <StageWeatherSystem environment={environment} />
      <SandTrayMesh environment={environment} />
      <StageObjectsLayer3D
        objects={objects}
        selectedId={selectedId}
        onDragStateChange={handleDragStateChange}
        onPatchObject={onPatchObject}
        onRecordEvent={onRecordEvent}
        onSelectObject={onSelectObject}
      />
      <StageCameraControls
        enabled={!objectDragging}
        resetSignal={cameraResetSignal}
        onInteractionModeChange={onInteractionModeChange}
      />
    </Canvas>
  );
}

function createStagePointerEvents(
  store: Parameters<typeof createPointerEvents>[0],
): ReturnType<typeof createPointerEvents> {
  const manager = createPointerEvents(store);
  const baseConnect = manager.connect?.bind(manager);

  manager.connect = (target) => {
    baseConnect?.(target);
    const wheelHandler = store.getState().events.handlers?.onWheel;
    if (target instanceof HTMLElement && wheelHandler) {
      target.removeEventListener("wheel", wheelHandler);
      target.addEventListener("wheel", wheelHandler, { passive: false });
    }
  };

  return manager;
}

function StageRenderSettings({ background, exposure }: { background: string; exposure: number }): null {
  const { gl } = useThree();

  useEffect(() => {
    gl.setClearColor(background);
    gl.toneMappingExposure = exposure;
  }, [background, exposure, gl]);

  return null;
}

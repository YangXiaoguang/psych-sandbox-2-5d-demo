import { Canvas, events as createPointerEvents } from "@react-three/fiber";
import { useEffect, useMemo, useState } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { WebGLRenderer } from "three";
import type { SandboxAsset, SandboxEnvironment, SandboxEventDraft, SandboxObject } from "../../types";
import { SANDBOX_ASSET_DRAG_MIME } from "../../utils/dragAndDrop";
import type { StageInteractionMode } from "../types";
import { intersectSandPlane, stageToBoard } from "../utils/stageMapping";
import { SandTrayMesh } from "./SandTrayMesh";
import { StageCameraControls } from "./StageCameraControls";
import { StageObjectsLayer3D } from "./StageObjectsLayer3D";
import { StageWeatherSystem } from "./StageWeatherSystem";

interface StageCanvas3DProps {
  cameraResetSignal: number;
  draggingAsset: SandboxAsset | null;
  environment: SandboxEnvironment;
  onCanvasReady: (canvas: HTMLCanvasElement) => void;
  objects: SandboxObject[];
  onDropAsset: (assetId: string, position: { x: number; y: number }) => void;
  onPatchObject: (objectId: string, patch: Partial<SandboxObject>) => void;
  onRecordEvent: (draft: SandboxEventDraft) => void;
  onSelectObject: (objectId: string | null) => void;
  onInteractionModeChange?: (mode: StageInteractionMode) => void;
  onToyDragLabelChange?: (label: string | null) => void;
  selectedId: string | null;
}

export function StageCanvas3D({
  cameraResetSignal,
  draggingAsset,
  environment,
  objects,
  onCanvasReady,
  onDropAsset,
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
  const background = night ? "#082331" : rainy ? "#75bbc7" : cloudy ? "#9bd9d8" : "#8de8ec";
  const keyLight = night ? 1.55 : rainy ? 1.45 : cloudy ? 1.55 : 2.25;
  const exposure = night ? 1.02 : rainy ? 0.98 : 1.06;
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
      camera={{ position: [6.8, 6.2, 8.2], zoom: 110, near: 0.1, far: 120 }}
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
      <fog attach="fog" args={[night ? "#082331" : background, 20, 38]} />

      <ambientLight intensity={night ? 0.52 : cloudy || rainy ? 0.56 : 0.46} color={night ? "#b8dff0" : "#fff4df"} />
      <hemisphereLight
        args={[night ? "#b7dcff" : "#fff7df", night ? "#243a3b" : "#8aa189", night ? 0.96 : 0.58]}
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
        intensity={night ? 0.66 : rainy ? 0.26 : cloudy ? 0.32 : 0.42}
        color={night ? "#7fbfff" : "#d7fff3"}
      />
      <pointLight
        position={night ? [1.8, 2.2, 1.4] : [-2.6, 1.6, 1.8]}
        intensity={night ? 0.56 : 0.16}
        color={night ? "#8ff7d9" : "#fff3cc"}
        distance={7}
      />

      <StageWeatherSystem environment={environment} />
      <StageAssetDropBridge
        draggingAsset={draggingAsset}
        onDropAsset={onDropAsset}
        onInteractionModeChange={onInteractionModeChange}
      />
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

function StageAssetDropBridge({
  draggingAsset,
  onDropAsset,
  onInteractionModeChange,
}: {
  draggingAsset: SandboxAsset | null;
  onDropAsset: (assetId: string, position: { x: number; y: number }) => void;
  onInteractionModeChange?: (mode: StageInteractionMode) => void;
}): null {
  const { camera, gl } = useThree();
  const raycaster = useMemo(() => new THREE.Raycaster(), []);

  useEffect(() => {
    const canvas = gl.domElement;

    const hasSandboxAssetPayload = (event: DragEvent): boolean => {
      const types = Array.from(event.dataTransfer?.types ?? []);
      return types.includes(SANDBOX_ASSET_DRAG_MIME) || Boolean(draggingAsset);
    };

    const getBoardPoint = (event: DragEvent): { x: number; y: number } | null => {
      const stagePoint = intersectSandPlane({ x: event.clientX, y: event.clientY }, canvas, camera, raycaster);
      return stagePoint ? stageToBoard(stagePoint) : null;
    };

    const handleDragEnter = (event: DragEvent) => {
      if (!hasSandboxAssetPayload(event)) {
        return;
      }
      event.preventDefault();
      onInteractionModeChange?.("place-asset");
    };

    const handleDragOver = (event: DragEvent) => {
      if (!hasSandboxAssetPayload(event)) {
        return;
      }
      event.preventDefault();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = "copy";
      }
      onInteractionModeChange?.("place-asset");
    };

    const handleDragLeave = (event: DragEvent) => {
      if (!hasSandboxAssetPayload(event)) {
        return;
      }
      const relatedTarget = event.relatedTarget;
      if (relatedTarget instanceof Node && canvas.contains(relatedTarget)) {
        return;
      }
      onInteractionModeChange?.("idle");
    };

    const handleDrop = (event: DragEvent) => {
      if (!hasSandboxAssetPayload(event)) {
        return;
      }
      event.preventDefault();
      const assetId = event.dataTransfer?.getData(SANDBOX_ASSET_DRAG_MIME) || draggingAsset?.assetId;
      const boardPoint = getBoardPoint(event);
      if (assetId && boardPoint) {
        onDropAsset(assetId, {
          x: Number(boardPoint.x.toFixed(1)),
          y: Number(boardPoint.y.toFixed(1)),
        });
      }
      onInteractionModeChange?.("idle");
    };

    canvas.addEventListener("dragenter", handleDragEnter);
    canvas.addEventListener("dragover", handleDragOver);
    canvas.addEventListener("dragleave", handleDragLeave);
    canvas.addEventListener("drop", handleDrop);

    return () => {
      canvas.removeEventListener("dragenter", handleDragEnter);
      canvas.removeEventListener("dragover", handleDragOver);
      canvas.removeEventListener("dragleave", handleDragLeave);
      canvas.removeEventListener("drop", handleDrop);
    };
  }, [camera, draggingAsset, gl.domElement, onDropAsset, onInteractionModeChange, raycaster]);

  return null;
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

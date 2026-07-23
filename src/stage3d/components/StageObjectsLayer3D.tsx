import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { SandboxEventDraft, SandboxObject } from "../../types";
import { boardToStage, getObjectStageScale, intersectSandPlane, stageToBoard, STAGE_TRAY } from "../utils/stageMapping";
import { ToyObject3D } from "./ToyObject3D";

interface StageObjectsLayer3DProps {
  objects: SandboxObject[];
  selectedId: string | null;
  onDragStateChange: (dragging: boolean, objectName?: string) => void;
  onPatchObject: (objectId: string, patch: Partial<SandboxObject>) => void;
  onRecordEvent: (draft: SandboxEventDraft) => void;
  onSelectObject: (objectId: string | null) => void;
}

interface DragState {
  assetId: string;
  lastBoard: { x: number; y: number };
  name: string;
  objectId: string;
  objectStage: { x: number; z: number };
  startBoard: { x: number; y: number };
  startStage: { x: number; z: number };
}

export function StageObjectsLayer3D({
  objects,
  selectedId,
  onDragStateChange,
  onPatchObject,
  onRecordEvent,
  onSelectObject,
}: StageObjectsLayer3DProps): JSX.Element {
  const { camera, gl } = useThree();
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const dragRef = useRef<DragState | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const sortedObjects = useMemo(
    () => [...objects].sort((a, b) => a.y - b.y || a.createdAt - b.createdAt),
    [objects],
  );

  const finishDrag = useCallback(() => {
    const drag = dragRef.current;
    dragRef.current = null;
    setDraggingId(null);
    onDragStateChange(false);
    document.body.style.cursor = "";

    if (!drag) {
      return;
    }

    const moved = Math.hypot(drag.lastBoard.x - drag.startBoard.x, drag.lastBoard.y - drag.startBoard.y) > 2;
    if (!moved) {
      return;
    }

    onRecordEvent({
      type: "move",
      objectId: drag.objectId,
      assetId: drag.assetId,
      label: `Stage v2 移动沙具: ${drag.name}`,
      payload: {
        from: {
          x: Math.round(drag.startBoard.x),
          y: Math.round(drag.startBoard.y),
        },
        to: {
          x: Math.round(drag.lastBoard.x),
          y: Math.round(drag.lastBoard.y),
        },
      },
    });
  }, [onDragStateChange, onRecordEvent]);

  useEffect(() => {
    if (!draggingId) {
      return undefined;
    }

    const handlePointerMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) {
        return;
      }

      const currentStage = intersectSandPlane({ x: event.clientX, y: event.clientY }, gl.domElement, camera, raycaster);
      if (!currentStage) {
        return;
      }

      const nextBoard = stageToBoard({
        x: drag.objectStage.x + currentStage.x - drag.startStage.x,
        z: drag.objectStage.z + currentStage.z - drag.startStage.z,
      });
      drag.lastBoard = nextBoard;
      onPatchObject(drag.objectId, {
        x: Number(nextBoard.x.toFixed(1)),
        y: Number(nextBoard.y.toFixed(1)),
      });
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", finishDrag, { once: true });
    window.addEventListener("pointercancel", finishDrag, { once: true });

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", finishDrag);
      window.removeEventListener("pointercancel", finishDrag);
    };
  }, [camera, draggingId, finishDrag, gl.domElement, onPatchObject, raycaster]);

  const handlePointerDown = useCallback(
    (object: SandboxObject) => (event: ThreeEvent<PointerEvent>) => {
      if (event.nativeEvent.button !== 0) {
        return;
      }

      event.stopPropagation();
      onSelectObject(object.id);
      onDragStateChange(true, object.name);
      document.body.style.cursor = "grabbing";

      const objectStage = boardToStage(object);
      const startStage =
        intersectSandPlane(
          { x: event.nativeEvent.clientX, y: event.nativeEvent.clientY },
          gl.domElement,
          camera,
          raycaster,
        ) ?? objectStage;

      dragRef.current = {
        assetId: object.assetId,
        lastBoard: { x: object.x, y: object.y },
        name: object.name,
        objectStage,
        objectId: object.id,
        startBoard: { x: object.x, y: object.y },
        startStage,
      };
      setDraggingId(object.id);
    },
    [camera, gl.domElement, onDragStateChange, onSelectObject, raycaster],
  );

  return (
    <group>
      {sortedObjects.map((object) => {
        const position = boardToStage(object);
        const selected = object.id === selectedId;
        const dragging = object.id === draggingId;
        return (
          <ToyObject3D
            key={object.id}
            dragging={dragging}
            modelRecipe={object.modelRecipe}
            onPointerDown={handlePointerDown(object)}
            position={[position.x, STAGE_TRAY.objectY + (dragging ? 0.06 : 0), position.z]}
            rotation={[0, (-object.rotation * Math.PI) / 180, 0]}
            scale={getObjectStageScale(object)}
            selected={selected}
          />
        );
      })}
    </group>
  );
}

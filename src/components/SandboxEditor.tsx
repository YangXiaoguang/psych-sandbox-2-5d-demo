import type Konva from "konva";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { Group, Layer, Stage, Transformer } from "react-konva";
import type { SandboxEventDraft, SandboxObject } from "../types";
import { BOARD_HEIGHT, BOARD_WIDTH, clamp, depthSortObjects } from "../utils/analysis";
import { downloadDataUrl, safeTimestamp } from "../utils/download";
import { getDepthScale, projectPoint, unprojectPoint, VIEW_HEIGHT, VIEW_WIDTH } from "../utils/projection";
import { AiCompanionAvatar } from "./AiCompanionAvatar";
import { DRAG_MIME } from "./AssetLibrary";
import { SandboxGuideLayer } from "./SandboxGuideLayer";
import { SandboxObjectShape } from "./SandboxObjectShape";

export interface SandboxEditorHandle {
  exportPng: () => void;
}

interface SandboxEditorProps {
  objects: SandboxObject[];
  selectedId: string | null;
  showGuides: boolean;
  onSelectObject: (objectId: string | null) => void;
  onPatchObject: (objectId: string, patch: Partial<SandboxObject>) => void;
  onDropAsset: (assetId: string, position: { x: number; y: number }) => void;
  onDeleteSelected: () => void;
  onRecordEvent: (draft: SandboxEventDraft) => void;
  aiCompanionActive: boolean;
  onOpenAiCompanion: () => void;
}

interface TransformState {
  x: number;
  y: number;
  rotation: number;
  scale: number;
}

export const SandboxEditor = forwardRef<SandboxEditorHandle, SandboxEditorProps>(function SandboxEditor(
  {
    objects,
    selectedId,
    showGuides,
    onSelectObject,
    onPatchObject,
    onDropAsset,
    onDeleteSelected,
    onRecordEvent,
    aiCompanionActive,
    onOpenAiCompanion,
  },
  ref,
) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const stageFrameRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<Konva.Stage | null>(null);
  const transformerRef = useRef<Konva.Transformer | null>(null);
  const objectRefs = useRef<Record<string, Konva.Group | null>>({});
  const dragStartRef = useRef<Record<string, { x: number; y: number }>>({});
  const transformStartRef = useRef<Record<string, TransformState>>({});
  const [scale, setScale] = useState(1);

  const sortedObjects = useMemo(() => depthSortObjects(objects), [objects]);

  useEffect(() => {
    const node = hostRef.current;
    if (!node) {
      return;
    }

    const updateScale = () => {
      const nextScale = Math.min(
        (node.clientWidth - 24) / VIEW_WIDTH,
        (node.clientHeight - 24) / VIEW_HEIGHT,
      );
      setScale(clamp(Number(nextScale.toFixed(3)), 0.5, 1.2));
    };

    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(node);
    window.addEventListener("resize", updateScale);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateScale);
    };
  }, []);

  useEffect(() => {
    const transformer = transformerRef.current;
    if (!transformer) {
      return;
    }

    if (!selectedId) {
      transformer.nodes([]);
      transformer.getLayer()?.batchDraw();
      return;
    }

    const node = objectRefs.current[selectedId];
    transformer.nodes(node ? [node] : []);
    transformer.getLayer()?.batchDraw();
  }, [objects, selectedId]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!selectedId) {
        return;
      }

      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) {
        return;
      }

      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        onDeleteSelected();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onDeleteSelected, selectedId]);

  const toBoardPoint = useCallback(
    (clientX: number, clientY: number) => {
      const frame = stageFrameRef.current;
      if (!frame) {
        return { x: BOARD_WIDTH / 2, y: BOARD_HEIGHT / 2 };
      }

      const rect = frame.getBoundingClientRect();
      return unprojectPoint({
        x: (clientX - rect.left) / scale,
        y: (clientY - rect.top) / scale,
      });
    },
    [scale],
  );

  const exportPng = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) {
      return;
    }

    const transformer = transformerRef.current;
    const wasVisible = transformer?.visible();
    transformer?.visible(false);
    transformer?.getLayer()?.batchDraw();

    const dataUrl = stage.toDataURL({
      mimeType: "image/png",
      pixelRatio: 2,
    });
    downloadDataUrl(dataUrl, `psych-sandbox-${safeTimestamp()}.png`);

    if (transformer && wasVisible !== undefined) {
      transformer.visible(wasVisible);
      transformer.getLayer()?.batchDraw();
    }
  }, []);

  useImperativeHandle(ref, () => ({ exportPng }), [exportPng]);

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const assetId = event.dataTransfer.getData(DRAG_MIME);
    if (!assetId) {
      return;
    }

    onDropAsset(assetId, toBoardPoint(event.clientX, event.clientY));
  };

  const handleStageMouseDown = (event: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    const targetName = event.target.name();
    if (event.target === event.target.getStage() || targetName === "tray") {
      onSelectObject(null);
    }
  };

  const handleDragMove = (object: SandboxObject, event: Konva.KonvaEventObject<DragEvent>) => {
    const node = event.target as Konva.Group;
    const next = unprojectPoint({ x: node.x(), y: node.y() });
    node.position(projectPoint(next));
    onPatchObject(object.id, next);
  };

  const handleTransformEnd = (object: SandboxObject) => {
    const node = objectRefs.current[object.id];
    if (!node) {
      return;
    }

    const boardPoint = unprojectPoint({ x: node.x(), y: node.y() });
    const depthScale = getDepthScale(boardPoint.y);
    const rawScale = (Math.abs(node.scaleX()) + Math.abs(node.scaleY())) / 2 / depthScale;
    const nextScale = clamp(Number(rawScale.toFixed(2)), 0.35, 2.4);
    const patch = {
      x: boardPoint.x,
      y: boardPoint.y,
      rotation: normalizeRotation(node.rotation()),
      scale: nextScale,
    };
    node.position(projectPoint(boardPoint));
    node.scale({ x: nextScale * depthScale, y: nextScale * depthScale });
    onPatchObject(object.id, patch);

    const from = transformStartRef.current[object.id];
    onRecordEvent({
      type: "transform",
      objectId: object.id,
      assetId: object.assetId,
      label: `变换沙具: ${object.name}`,
      payload: {
        from,
        to: patch,
      },
    });
  };

  return (
    <main className="sandbox-editor" aria-label="沙盘画布">
      <div className="stage-host" ref={hostRef}>
        <div
          className="stage-frame"
          ref={stageFrameRef}
          style={{ width: VIEW_WIDTH * scale, height: VIEW_HEIGHT * scale }}
          onDragOver={(event) => event.preventDefault()}
          onDrop={handleDrop}
        >
          <Stage
            ref={stageRef}
            width={VIEW_WIDTH * scale}
            height={VIEW_HEIGHT * scale}
            onMouseDown={handleStageMouseDown}
            onTouchStart={handleStageMouseDown}
          >
            <Layer scaleX={scale} scaleY={scale}>
              <SandboxGuideLayer showGuides={showGuides} />

              {sortedObjects.map((object, index) => {
                const projected = projectPoint(object);
                const depthScale = getDepthScale(object.y);
                return (
                  <Group
                    key={object.id}
                    ref={(node) => {
                      objectRefs.current[object.id] = node;
                    }}
                    name="sandbox-object"
                    x={projected.x}
                    y={projected.y}
                    rotation={object.rotation}
                    scaleX={object.scale * depthScale}
                    scaleY={object.scale * depthScale}
                    draggable
                    onMouseDown={(event) => {
                      event.cancelBubble = true;
                      onSelectObject(object.id);
                    }}
                    onTouchStart={(event) => {
                      event.cancelBubble = true;
                      onSelectObject(object.id);
                    }}
                    onDragStart={() => {
                      onSelectObject(object.id);
                      dragStartRef.current[object.id] = { x: object.x, y: object.y };
                    }}
                    onDragMove={(event) => handleDragMove(object, event)}
                    onDragEnd={(event) => {
                      handleDragMove(object, event);
                      const node = event.target as Konva.Group;
                      const dropped = unprojectPoint({ x: node.x(), y: node.y() });
                      onRecordEvent({
                        type: "move",
                        objectId: object.id,
                        assetId: object.assetId,
                        label: `移动沙具: ${object.name}`,
                        payload: {
                          from: dragStartRef.current[object.id],
                          to: {
                            x: Number(dropped.x.toFixed(1)),
                            y: Number(dropped.y.toFixed(1)),
                          },
                          depthIndex: index,
                        },
                      });
                    }}
                    onTransformStart={() => {
                      transformStartRef.current[object.id] = {
                        x: object.x,
                        y: object.y,
                        rotation: object.rotation,
                        scale: object.scale,
                      };
                    }}
                    onTransformEnd={() => handleTransformEnd(object)}
                  >
                    <SandboxObjectShape
                      assetId={object.assetId}
                      width={object.width}
                      height={object.height}
                      riskTag={object.riskTag}
                    />
                  </Group>
                );
              })}

              <Transformer
                ref={transformerRef}
                rotateEnabled
                keepRatio
                anchorSize={9}
                anchorCornerRadius={4}
                borderStroke="#256c65"
                borderStrokeWidth={1.4}
                borderDash={[6, 5]}
                anchorFill="#fffdf2"
                anchorStroke="#256c65"
                anchorStrokeWidth={1.5}
                rotateAnchorOffset={30}
                rotationSnaps={[0, 45, 90, 135, 180, 225, 270, 315]}
                boundBoxFunc={(oldBox, newBox) => {
                  if (newBox.width < 24 || newBox.height < 24) {
                    return oldBox;
                  }
                  return newBox;
                }}
              />
            </Layer>
          </Stage>
        </div>
      </div>
      <AiCompanionAvatar active={aiCompanionActive} onOpen={onOpenAiCompanion} />
    </main>
  );
});

function normalizeRotation(rotation: number): number {
  const normalized = ((rotation % 360) + 360) % 360;
  return Number(normalized.toFixed(1));
}

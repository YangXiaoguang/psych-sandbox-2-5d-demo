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
import { Circle, Ellipse, Group, Layer, Line, Stage, Transformer } from "react-konva";
import type { SandboxAsset, SandboxEnvironment, SandboxEventDraft, SandboxObject } from "../types";
import { BOARD_HEIGHT, BOARD_WIDTH, clamp, depthSortObjects } from "../utils/analysis";
import { downloadDataUrl, safeTimestamp } from "../utils/download";
import { getDepthScale, projectPoint, unprojectPoint, VIEW_HEIGHT, VIEW_WIDTH } from "../utils/projection";
import { AiCompanionAvatar } from "./AiCompanionAvatar";
import { DRAG_MIME } from "./AssetLibrary";
import { SandboxGuideLayer } from "./SandboxGuideLayer";
import { SandboxObjectShape } from "./SandboxObjectShape";
import { WeatherLayer } from "./WeatherLayer";

export interface SandboxEditorHandle {
  exportPng: () => void;
}

interface SandboxEditorProps {
  objects: SandboxObject[];
  selectedId: string | null;
  draggingAsset: SandboxAsset | null;
  environment: SandboxEnvironment;
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
    draggingAsset,
    environment,
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
  const dropPulseTimerRef = useRef<number | null>(null);
  const [scale, setScale] = useState(1);
  const [dropPreview, setDropPreview] = useState<{ x: number; y: number } | null>(null);
  const [dropPulse, setDropPulse] = useState<{ x: number; y: number; id: number } | null>(null);

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

  useEffect(() => {
    if (!draggingAsset) {
      setDropPreview(null);
    }
  }, [draggingAsset]);

  useEffect(
    () => () => {
      if (dropPulseTimerRef.current !== null) {
        window.clearTimeout(dropPulseTimerRef.current);
      }
    },
    [],
  );

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

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const hasSandboxAsset = Array.from(event.dataTransfer.types).includes(DRAG_MIME);
    if (!hasSandboxAsset && !draggingAsset) {
      return;
    }
    event.dataTransfer.dropEffect = "copy";
    setDropPreview(toBoardPoint(event.clientX, event.clientY));
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) {
      return;
    }
    setDropPreview(null);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const assetId = event.dataTransfer.getData(DRAG_MIME);
    if (!assetId) {
      setDropPreview(null);
      return;
    }

    const point = toBoardPoint(event.clientX, event.clientY);
    onDropAsset(assetId, point);
    setDropPreview(null);

    const pulse = { ...point, id: Date.now() };
    setDropPulse(pulse);
    if (dropPulseTimerRef.current !== null) {
      window.clearTimeout(dropPulseTimerRef.current);
    }
    dropPulseTimerRef.current = window.setTimeout(() => {
      setDropPulse((current) => (current?.id === pulse.id ? null : current));
      dropPulseTimerRef.current = null;
    }, 520);
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
          className={dropPreview ? "stage-frame accepting-drop" : "stage-frame"}
          ref={stageFrameRef}
          style={{ width: VIEW_WIDTH * scale, height: VIEW_HEIGHT * scale }}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
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
              <SandboxGuideLayer environment={environment} showGuides={showGuides} />

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
                      environment={environment}
                    />
                  </Group>
                );
              })}

              <WeatherLayer environment={environment} />

              {dropPreview ? (
                <DropPlacementPreview point={dropPreview} asset={draggingAsset} environment={environment} />
              ) : null}

              {dropPulse ? <DropPlacementPulse point={dropPulse} environment={environment} /> : null}

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

function DropPlacementPreview({
  point,
  asset,
  environment,
}: {
  point: { x: number; y: number };
  asset: SandboxAsset | null;
  environment: SandboxEnvironment;
}): JSX.Element {
  const projected = projectPoint(point);
  const width = Math.max(48, Math.min(150, (asset?.footprint?.width ?? asset?.defaultWidth ?? 86) * 0.76));
  const height = Math.max(28, Math.min(82, (asset?.footprint?.depth ?? asset?.defaultHeight ?? 54) * 0.58));
  const isNight = environment.light === "night";
  const accent = isNight ? "#96fff0" : "#2f9a89";

  return (
    <Group x={projected.x} y={projected.y} listening={false} opacity={isNight ? 0.92 : 0.86}>
      <Ellipse
        radiusX={width * 0.58}
        radiusY={height * 0.62}
        fill={isNight ? "rgba(80, 220, 202, 0.2)" : "rgba(55, 161, 139, 0.16)"}
        stroke={accent}
        strokeWidth={1.5}
        dash={[7, 6]}
        shadowColor={accent}
        shadowBlur={isNight ? 16 : 8}
        shadowOpacity={isNight ? 0.42 : 0.18}
      />
      <Ellipse
        radiusX={width * 0.38}
        radiusY={height * 0.38}
        fill="rgba(255, 255, 255, 0.16)"
        opacity={0.72}
      />
      <Line points={[-width * 0.34, 0, width * 0.34, 0]} stroke={accent} strokeWidth={1.1} opacity={0.7} />
      <Line points={[0, -height * 0.32, 0, height * 0.32]} stroke={accent} strokeWidth={1.1} opacity={0.7} />
      <Circle radius={4} fill={accent} opacity={0.88} y={-height * 0.52} />
      <Circle radius={2.8} fill={accent} opacity={0.68} x={width * 0.46} y={height * 0.1} />
      <Circle radius={2.8} fill={accent} opacity={0.68} x={-width * 0.46} y={height * 0.1} />
    </Group>
  );
}

function DropPlacementPulse({
  point,
  environment,
}: {
  point: { x: number; y: number };
  environment: SandboxEnvironment;
}): JSX.Element {
  const projected = projectPoint(point);
  const isNight = environment.light === "night";
  const accent = isNight ? "#95fff0" : "#4db7a2";

  return (
    <Group x={projected.x} y={projected.y} listening={false}>
      <Ellipse
        radiusX={58}
        radiusY={25}
        fill={isNight ? "rgba(110, 244, 226, 0.12)" : "rgba(255, 251, 220, 0.36)"}
        stroke={accent}
        strokeWidth={1.2}
        opacity={0.78}
        shadowColor={accent}
        shadowBlur={isNight ? 22 : 12}
        shadowOpacity={isNight ? 0.38 : 0.2}
      />
      {[-34, -16, 15, 33].map((x, index) => (
        <Circle
          key={x}
          x={x}
          y={index % 2 === 0 ? 8 : -5}
          radius={index % 2 === 0 ? 2.6 : 2.1}
          fill={isNight ? "#b6fff6" : "#fff3c5"}
          opacity={0.84}
        />
      ))}
    </Group>
  );
}

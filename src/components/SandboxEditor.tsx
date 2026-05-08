import Konva from "konva";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { Circle, Ellipse, Group, Layer, Line, Shape, Stage, Transformer } from "react-konva";
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

type ObjectGestureMode = "drag" | "transform";
type SelectedObjectMode = ObjectGestureMode | "selected";

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
  const objectLayerRef = useRef<Konva.Layer | null>(null);
  const transformerRef = useRef<Konva.Transformer | null>(null);
  const interactionOverlayRef = useRef<Konva.Group | null>(null);
  const objectRefs = useRef<Record<string, Konva.Group | null>>({});
  const visualRefs = useRef<Record<string, Konva.Group | null>>({});
  const objectsRef = useRef<SandboxObject[]>(objects);
  const selectedIdRef = useRef<string | null>(selectedId);
  const activeGestureRef = useRef<{ objectId: string; mode: ObjectGestureMode } | null>(null);
  const environmentRef = useRef<SandboxEnvironment>(environment);
  const reduceMotionRef = useRef(false);
  const previousObjectIdsRef = useRef<Set<string>>(new Set(objects.map((object) => object.id)));
  const settleStartRef = useRef<Record<string, number>>({});
  const dragStartRef = useRef<Record<string, { x: number; y: number }>>({});
  const transformStartRef = useRef<Record<string, TransformState>>({});
  const dropPulseTimerRef = useRef<number | null>(null);
  const [scale, setScale] = useState(1);
  const [dropPreview, setDropPreview] = useState<{ x: number; y: number } | null>(null);
  const [dropPulse, setDropPulse] = useState<{ x: number; y: number; id: number } | null>(null);
  const [activeGesture, setActiveGesture] = useState<{ objectId: string; mode: ObjectGestureMode } | null>(null);

  const sortedObjects = useMemo(() => depthSortObjects(objects), [objects]);
  const selectedObject = useMemo(
    () => objects.find((object) => object.id === selectedId) ?? null,
    [objects, selectedId],
  );
  const interactionPalette = getInteractionPalette(environment);
  const selectedObjectMode: SelectedObjectMode | null =
    activeGesture && selectedObject && activeGesture.objectId === selectedObject.id
      ? activeGesture.mode
      : selectedObject
        ? "selected"
        : null;
  const stageFrameClassName = [
    "stage-frame",
    dropPreview ? "accepting-drop" : "",
    selectedId ? "has-selection" : "",
    activeGesture?.mode === "drag" ? "object-dragging" : "",
    activeGesture?.mode === "transform" ? "object-transforming" : "",
  ]
    .filter(Boolean)
    .join(" ");

  useEffect(() => {
    objectsRef.current = objects;
    const previousIds = previousObjectIdsRef.current;
    const currentIds = new Set(objects.map((object) => object.id));
    const now = performance.now();

    objects.forEach((object) => {
      if (!previousIds.has(object.id)) {
        settleStartRef.current[object.id] = now;
      }
    });

    Object.keys(settleStartRef.current).forEach((objectId) => {
      if (!currentIds.has(objectId)) {
        delete settleStartRef.current[objectId];
      }
    });

    previousObjectIdsRef.current = currentIds;
  }, [objects]);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    activeGestureRef.current = activeGesture;
  }, [activeGesture]);

  useEffect(() => {
    environmentRef.current = environment;
  }, [environment]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      reduceMotionRef.current = media.matches;
    };

    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

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

  useEffect(() => {
    const layer = objectLayerRef.current;
    if (!layer) {
      return;
    }

    const animation = new Konva.Animation(() => {
      const now = performance.now();
      const active = activeGestureRef.current;
      const selected = selectedIdRef.current;
      const currentEnvironment = environmentRef.current;
      const reduceMotion = reduceMotionRef.current;
      const objectById = new Map(objectsRef.current.map((object) => [object.id, object]));

      Object.entries(visualRefs.current).forEach(([objectId, node]) => {
        if (!node) {
          return;
        }

        const object = objectById.get(objectId);
        if (!object) {
          node.y(0);
          node.rotation(0);
          node.scale({ x: 1, y: 1 });
          node.opacity(1);
          return;
        }

        const isActive = active?.objectId === objectId;
        const isSelected = selected === objectId;
        const settle = reduceMotion
          ? { active: false, done: true, y: 0, rotation: 0, scale: 0 }
          : getSettleFrame(settleStartRef.current[objectId], now);
        if (settle.done) {
          delete settleStartRef.current[objectId];
        }

        if (reduceMotion) {
          node.y(0);
          node.rotation(0);
          node.scale({ x: 1, y: 1 });
          node.opacity(1);
          return;
        }

        if (isActive && active?.mode === "transform") {
          node.y(0);
          node.rotation(0);
          node.scale({ x: 1, y: 1 });
          node.opacity(1);
          return;
        }

        if (isActive && active?.mode === "drag") {
          node.y(-5 + settle.y);
          node.rotation(settle.rotation * 0.5);
          node.scale({ x: 1.018 + settle.scale * 0.2, y: 1.018 - settle.scale * 0.14 });
          node.opacity(1);
          return;
        }

        const motion = getObjectMotionProfile(object, currentEnvironment);
        const phase = now * motion.speed + getMotionSeed(objectId);
        const shouldIdle = !isSelected || Boolean(settle.active);
        const breath = shouldIdle ? Math.sin(phase) : 0;
        const sway = shouldIdle ? Math.sin(phase * 0.64 + 0.7) : 0;

        node.y(breath * motion.lift + settle.y);
        node.rotation(sway * motion.rotation + settle.rotation);
        node.scale({
          x: 1 - breath * motion.scaleX + settle.scale * 0.22,
          y: 1 + breath * motion.scaleY - settle.scale * 0.16,
        });
        node.opacity(motion.opacity);
      });
    }, layer);

    animation.start();
    return () => {
      animation.stop();
    };
  }, []);

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
    const interactionOverlay = interactionOverlayRef.current;
    const wasVisible = transformer?.visible();
    const wasOverlayVisible = interactionOverlay?.visible();
    transformer?.visible(false);
    interactionOverlay?.visible(false);
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
    if (interactionOverlay && wasOverlayVisible !== undefined) {
      interactionOverlay.visible(wasOverlayVisible);
      interactionOverlay.getLayer()?.batchDraw();
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
      setActiveGesture(null);
      onSelectObject(null);
    }
  };

  const setStageCursor = (cursor: string) => {
    const container = stageRef.current?.container();
    if (container) {
      container.style.cursor = cursor;
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
          className={stageFrameClassName}
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
            <Layer ref={objectLayerRef} scaleX={scale} scaleY={scale}>
              <SandboxGuideLayer environment={environment} showGuides={showGuides} />

              {sortedObjects.map((object, index) => {
                const projected = projectPoint(object);
                const depthScale = getDepthScale(object.y);
                return (
                  <Group
                    key={object.id}
                    ref={(node) => {
                      if (node) {
                        objectRefs.current[object.id] = node;
                      } else {
                        delete objectRefs.current[object.id];
                      }
                    }}
                    name="sandbox-object"
                    x={projected.x}
                    y={projected.y}
                    rotation={object.rotation}
                    scaleX={object.scale * depthScale}
                    scaleY={object.scale * depthScale}
                    draggable
                    onMouseEnter={() => setStageCursor(activeGesture?.mode === "drag" ? "grabbing" : "grab")}
                    onMouseLeave={() => {
                      if (!activeGesture) {
                        setStageCursor("default");
                      }
                    }}
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
                      setActiveGesture({ objectId: object.id, mode: "drag" });
                      setStageCursor("grabbing");
                      dragStartRef.current[object.id] = { x: object.x, y: object.y };
                    }}
                    onDragMove={(event) => handleDragMove(object, event)}
                    onDragEnd={(event) => {
                      handleDragMove(object, event);
                      settleStartRef.current[object.id] = performance.now();
                      setActiveGesture(null);
                      setStageCursor("grab");
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
                      setActiveGesture({ objectId: object.id, mode: "transform" });
                      transformStartRef.current[object.id] = {
                        x: object.x,
                        y: object.y,
                        rotation: object.rotation,
                        scale: object.scale,
                      };
                    }}
                    onTransformEnd={() => {
                      handleTransformEnd(object);
                      settleStartRef.current[object.id] = performance.now();
                      setActiveGesture(null);
                    }}
                  >
                    <ObjectInteractionHitArea object={object} />
                    <Group
                      ref={(node) => {
                        if (node) {
                          visualRefs.current[object.id] = node;
                        } else {
                          delete visualRefs.current[object.id];
                        }
                      }}
                    >
                      <SandboxObjectShape
                        assetId={object.assetId}
                        width={object.width}
                        height={object.height}
                        riskTag={object.riskTag}
                        environment={environment}
                      />
                    </Group>
                  </Group>
                );
              })}

              <WeatherLayer environment={environment} />

              <Group ref={interactionOverlayRef} listening={false}>
                {selectedObject && selectedObjectMode ? (
                  <SelectedObjectOverlay
                    object={selectedObject}
                    environment={environment}
                    mode={selectedObjectMode}
                  />
                ) : null}

                {dropPreview ? (
                  <DropPlacementPreview point={dropPreview} asset={draggingAsset} environment={environment} />
                ) : null}

                {dropPulse ? <DropPlacementPulse point={dropPulse} environment={environment} /> : null}
              </Group>

              <Transformer
                ref={transformerRef}
                rotateEnabled
                keepRatio
                anchorSize={11}
                anchorCornerRadius={6}
                borderStroke={interactionPalette.stroke}
                borderStrokeWidth={1.6}
                borderDash={[8, 5]}
                anchorFill={interactionPalette.anchorFill}
                anchorStroke={interactionPalette.stroke}
                anchorStrokeWidth={1.7}
                rotateAnchorOffset={36}
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

function ObjectInteractionHitArea({ object }: { object: SandboxObject }): JSX.Element {
  const hitWidth = Math.max(42, object.width * 1.08, object.footprint.width * 0.9);
  const hitHeight = Math.max(38, object.height * 1.08, object.footprint.depth * 0.9);

  return (
    <Shape
      name="sandbox-object-hit-area"
      fill="#000000"
      sceneFunc={() => undefined}
      hitFunc={(context, shape) => {
        context.beginPath();
        context.rect(-hitWidth * 0.5, -hitHeight * 0.86, hitWidth, hitHeight);
        context.closePath();
        context.fillStrokeShape(shape);
      }}
      listening
    />
  );
}

function normalizeRotation(rotation: number): number {
  const normalized = ((rotation % 360) + 360) % 360;
  return Number(normalized.toFixed(1));
}

function getMotionSeed(value: string): number {
  let seed = 0;
  for (let index = 0; index < value.length; index += 1) {
    seed = (seed * 31 + value.charCodeAt(index)) % 997;
  }
  return seed / 997 * Math.PI * 2;
}

function getObjectMotionProfile(
  object: SandboxObject,
  environment: SandboxEnvironment,
): {
  lift: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  speed: number;
  opacity: number;
} {
  const footprintFactor =
    object.footprint.kind === "flat" ? 0.35 : object.footprint.kind === "tall" ? 1.08 : object.footprint.kind === "wide" ? 0.72 : 0.9;
  const recipeFactor =
    object.modelRecipe.kind === "bird" || object.modelRecipe.kind === "fish"
      ? 1.2
      : object.modelRecipe.kind === "water"
        ? 0.5
        : object.modelRecipe.kind === "tree"
          ? 0.7
          : 1;
  const lightFactor = environment.light === "night" ? 0.7 : 1;
  const weatherFactor = environment.weather === "rainy" ? 0.78 : environment.weather === "cloudy" ? 0.86 : 1;
  const calm = footprintFactor * recipeFactor * lightFactor * weatherFactor;

  return {
    lift: 0.42 * calm,
    rotation: 0.16 * calm,
    scaleX: 0.0018 * calm,
    scaleY: 0.0026 * calm,
    speed: 0.0012 * (environment.weather === "rainy" ? 0.84 : environment.light === "night" ? 0.7 : 1),
    opacity: environment.light === "night" ? 0.985 : 1,
  };
}

function getSettleFrame(
  startedAt: number | undefined,
  now: number,
): {
  active: boolean;
  done: boolean;
  y: number;
  rotation: number;
  scale: number;
} {
  if (!startedAt) {
    return { active: false, done: false, y: 0, rotation: 0, scale: 0 };
  }

  const duration = 680;
  const progress = clamp((now - startedAt) / duration, 0, 1);
  if (progress >= 1) {
    return { active: false, done: true, y: 0, rotation: 0, scale: 0 };
  }

  const decay = 1 - progress;
  const bounce = Math.sin(progress * Math.PI * 3.1) * decay;
  return {
    active: true,
    done: false,
    y: -4.8 * Math.sin(progress * Math.PI) * decay,
    rotation: bounce * 0.55,
    scale: Math.sin(progress * Math.PI * 1.25) * decay * 0.06,
  };
}

function getInteractionPalette(environment: SandboxEnvironment): {
  stroke: string;
  fill: string;
  glow: string;
  dot: string;
  anchorFill: string;
} {
  if (environment.light === "night") {
    return {
      stroke: "#98fff0",
      fill: "rgba(85, 224, 205, 0.15)",
      glow: "#65e9d7",
      dot: "#c8fff8",
      anchorFill: "#0c232b",
    };
  }

  return {
    stroke: "#28796d",
    fill: "rgba(51, 155, 136, 0.13)",
    glow: "#57bda9",
    dot: "#fff8d9",
    anchorFill: "#fffdf2",
  };
}

function SelectedObjectOverlay({
  object,
  environment,
  mode,
}: {
  object: SandboxObject;
  environment: SandboxEnvironment;
  mode: SelectedObjectMode;
}): JSX.Element {
  const projected = projectPoint(object);
  const depthScale = getDepthScale(object.y) * object.scale;
  const palette = getInteractionPalette(environment);
  const width = Math.max(54, Math.min(180, object.footprint.width * 0.86));
  const height = Math.max(24, Math.min(92, object.footprint.depth * 0.62));
  const y = Math.max(8, object.height * 0.12);
  const activeBoost = mode === "drag" ? 1.18 : mode === "transform" ? 1.08 : 1;
  const strokeOpacity = mode === "selected" ? 0.82 : 0.96;
  const dash = mode === "selected" ? [8, 6] : mode === "transform" ? [12, 5] : undefined;

  return (
    <Group
      x={projected.x}
      y={projected.y}
      rotation={object.rotation}
      scaleX={depthScale}
      scaleY={depthScale}
      listening={false}
    >
      <Ellipse
        y={y}
        radiusX={width * 0.62 * activeBoost}
        radiusY={height * 0.64 * activeBoost}
        fill={palette.fill}
        stroke={palette.stroke}
        strokeWidth={1.35}
        dash={dash}
        opacity={strokeOpacity}
        shadowColor={palette.glow}
        shadowBlur={mode === "drag" ? 18 : 10}
        shadowOpacity={environment.light === "night" ? 0.34 : 0.18}
      />
      {mode === "drag" ? (
        <Ellipse
          y={y + height * 0.08}
          radiusX={width * 0.78}
          radiusY={height * 0.62}
          fill={environment.light === "night" ? "rgba(0, 0, 0, 0.22)" : "rgba(73, 58, 35, 0.12)"}
          opacity={0.64}
        />
      ) : null}
      {[
        [-width * 0.52, y - height * 0.42],
        [width * 0.52, y - height * 0.42],
        [-width * 0.52, y + height * 0.42],
        [width * 0.52, y + height * 0.42],
      ].map(([x, dotY], index) => (
        <Circle
          key={`${x}-${dotY}`}
          x={x}
          y={dotY}
          radius={mode === "selected" ? 2.6 : 3.2}
          fill={palette.dot}
          stroke={palette.stroke}
          strokeWidth={1}
          opacity={index < 2 && mode === "drag" ? 0.72 : 0.92}
        />
      ))}
      {mode === "transform" ? (
        <Line
          points={[0, y - height * 0.9, 0, y - height * 0.58]}
          stroke={palette.stroke}
          strokeWidth={1.2}
          opacity={0.82}
          lineCap="round"
        />
      ) : null}
    </Group>
  );
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

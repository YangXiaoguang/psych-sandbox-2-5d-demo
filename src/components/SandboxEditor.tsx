import Konva from "konva";
import { Hand, MousePointer2, Orbit, RotateCcw, Trash2, ZoomIn, ZoomOut } from "lucide-react";
import {
  forwardRef,
  type CSSProperties,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { Circle, Ellipse, Group, Layer, Line, Rect, Stage, Transformer } from "react-konva";
import type { SandboxAsset, SandboxCameraState, SandboxEnvironment, SandboxEventDraft, SandboxObject } from "../types";
import { BOARD_HEIGHT, BOARD_WIDTH, clamp } from "../utils/analysis";
import { downloadDataUrl, safeTimestamp } from "../utils/download";
import {
  DEFAULT_SANDBOX_CAMERA,
  getDepthScale,
  getViewDepth,
  normalizeSandboxCamera,
  projectPoint,
  unprojectPoint,
  VIEW_HEIGHT,
  VIEW_WIDTH,
} from "../utils/projection";
import { AiCompanionAvatar } from "./AiCompanionAvatar";
import { DRAG_MIME } from "./AssetLibrary";
import { SandboxGuideLayer } from "./SandboxGuideLayer";
import { SandboxSandMaterialLayer } from "./SandboxSandMaterialLayer";
import { SandboxObjectShape } from "./SandboxObjectShape";
import { SandboxObjectContactLayer } from "./SandboxObjectContactLayer";
import { ThreeSandboxStageLayer } from "./ThreeSandboxStageLayer";
import { SandboxTrayPolishLayer } from "./SandboxTrayPolishLayer";
import { WeatherLayer } from "./WeatherLayer";

export interface SandboxEditorHandle {
  exportPng: () => void;
}

interface SandboxEditorProps {
  objects: SandboxObject[];
  selectedId: string | null;
  draggingAsset: SandboxAsset | null;
  environment: SandboxEnvironment;
  camera: SandboxCameraState;
  showGuides: boolean;
  onSelectObject: (objectId: string | null) => void;
  onPatchObject: (objectId: string, patch: Partial<SandboxObject>) => void;
  onDropAsset: (assetId: string, position: { x: number; y: number }) => void;
  onDeleteSelected: () => void;
  onRecordEvent: (draft: SandboxEventDraft) => void;
  onCameraChange: (patch: Partial<SandboxCameraState>) => void;
  aiCompanionActive: boolean;
  onOpenAiCompanion: () => void;
}

interface TransformState {
  x: number;
  y: number;
  rotation: number;
  scale: number;
}

interface CameraGesture {
  mode: "pan" | "orbit";
  clientX: number;
  clientY: number;
  panX: number;
  panY: number;
  yaw: number;
  pitch: number;
}

type ObjectGestureMode = "drag" | "transform";
type SelectedObjectMode = ObjectGestureMode | "selected";
type CameraGestureMode = CameraGesture["mode"];
type StageToolMode = "select" | "pan" | "orbit";
type NativeCameraEvent = MouseEvent | TouchEvent | PointerEvent;

export const SandboxEditor = forwardRef<SandboxEditorHandle, SandboxEditorProps>(function SandboxEditor(
  {
    objects,
    selectedId,
    draggingAsset,
    environment,
    camera,
    showGuides,
    onSelectObject,
    onPatchObject,
    onDropAsset,
    onDeleteSelected,
    onRecordEvent,
    onCameraChange,
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
  const transformProxyRefs = useRef<Record<string, Konva.Rect | null>>({});
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
  const cameraRef = useRef<SandboxCameraState>(camera);
  const spacePanRef = useRef(false);
  const cameraPanRef = useRef<CameraGesture | null>(null);
  const cameraDocumentCleanupRef = useRef<(() => void) | null>(null);
  const cameraDocumentTrackingRef = useRef(false);
  const [scale, setScale] = useState(1);
  const scaleRef = useRef(scale);
  const [dropPreview, setDropPreview] = useState<{ x: number; y: number } | null>(null);
  const [dropPulse, setDropPulse] = useState<{ x: number; y: number; id: number } | null>(null);
  const [activeGesture, setActiveGesture] = useState<{ objectId: string; mode: ObjectGestureMode } | null>(null);
  const [cameraGestureMode, setCameraGestureMode] = useState<CameraGestureMode | null>(null);
  const [spacePanActive, setSpacePanActive] = useState(false);
  const [stageToolMode, setStageToolMode] = useState<StageToolMode>("select");
  const isCameraPanning = cameraGestureMode === "pan";
  const isCameraOrbiting = cameraGestureMode === "orbit";

  useEffect(
    () => () => {
      cameraDocumentCleanupRef.current?.();
      cameraDocumentCleanupRef.current = null;
      cameraDocumentTrackingRef.current = false;
    },
    [],
  );

  const sortedObjects = useMemo(
    () =>
      [...objects].sort(
        (a, b) => getViewDepth(a, camera) - getViewDepth(b, camera) || a.createdAt - b.createdAt,
      ),
    [camera, objects],
  );
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
    isCameraPanning ? "camera-panning" : "",
    isCameraOrbiting ? "camera-orbiting" : "",
    spacePanActive || stageToolMode === "pan" || stageToolMode === "select" ? "camera-pan-ready" : "",
    stageToolMode === "orbit" ? "camera-orbit-ready" : "",
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
    cameraRef.current = camera;
  }, [camera]);

  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);

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
      const styles = window.getComputedStyle(node);
      const isFocusMode = Boolean(node.closest(".focus-mode"));
      const horizontalPadding = isFocusMode ? parseCssPixels(styles.paddingLeft) + parseCssPixels(styles.paddingRight) : 0;
      const verticalPadding = isFocusMode ? parseCssPixels(styles.paddingTop) + parseCssPixels(styles.paddingBottom) : 0;
      const safetyInset = isFocusMode ? 16 : 24;
      const nextScale = Math.min(
        (node.clientWidth - horizontalPadding - safetyInset) / VIEW_WIDTH,
        (node.clientHeight - verticalPadding - safetyInset) / VIEW_HEIGHT,
      );
      const minScale = node.clientWidth < 640 ? 0.32 : 0.5;
      setScale(clamp(Number(nextScale.toFixed(3)), minScale, 1.2));
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

    const node = transformProxyRefs.current[selectedId] ?? objectRefs.current[selectedId];
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
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) {
        return;
      }

      if (event.code !== "Space") {
        return;
      }

      event.preventDefault();
      spacePanRef.current = true;
      setSpacePanActive(true);
      if (!cameraPanRef.current) {
        setStageCursor("grab");
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code !== "Space") {
        return;
      }

      spacePanRef.current = false;
      setSpacePanActive(false);
      if (!cameraPanRef.current && !activeGestureRef.current) {
        setStageCursor("default");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

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
      return unprojectPoint(
        {
          x: (clientX - rect.left) / scale,
          y: (clientY - rect.top) / scale,
        },
        camera,
      );
    },
    [camera, scale],
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

  const updateStagePointerLight = (clientX: number, clientY: number) => {
    const frame = stageFrameRef.current;
    if (!frame || reduceMotionRef.current) {
      return;
    }

    const rect = frame.getBoundingClientRect();
    if (!rect.width || !rect.height) {
      return;
    }

    const x = clamp(((clientX - rect.left) / rect.width) * 100, 8, 92);
    const y = clamp(((clientY - rect.top) / rect.height) * 100, 8, 78);
    frame.style.setProperty("--stage-light-x", `${x.toFixed(1)}%`);
    frame.style.setProperty("--stage-light-y", `${y.toFixed(1)}%`);
    hostRef.current?.style.setProperty("--stage-light-x", `${x.toFixed(1)}%`);
    hostRef.current?.style.setProperty("--stage-light-y", `${y.toFixed(1)}%`);
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    updateStagePointerLight(event.clientX, event.clientY);
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

  const handleStageMouseDown = (event: Konva.KonvaEventObject<MouseEvent | TouchEvent | PointerEvent>) => {
    const isTraySurface = !isSandboxObjectTarget(event.target);

    if (shouldStartCameraOrbit(event.evt, isTraySurface)) {
      event.evt.preventDefault();
      event.cancelBubble = true;
      beginCameraOrbit(event.evt);
      if (isTraySurface) {
        setActiveGesture(null);
        onSelectObject(null);
      }
      return;
    }

    if (shouldStartCameraPan(event.evt, isTraySurface)) {
      event.evt.preventDefault();
      event.cancelBubble = true;
      beginCameraPan(event.evt);
      if (isTraySurface) {
        setActiveGesture(null);
        onSelectObject(null);
      }
      return;
    }

    if (isTraySurface) {
      setActiveGesture(null);
      onSelectObject(null);
    }
  };

  const handleStageMouseMove = (event: Konva.KonvaEventObject<MouseEvent | TouchEvent | PointerEvent>) => {
    const point = getNativeClientPoint(event.evt);
    if (point) {
      updateStagePointerLight(point.clientX, point.clientY);
    }
    if (!point || !cameraPanRef.current) {
      return;
    }
    if (cameraDocumentTrackingRef.current) {
      return;
    }
    event.evt.preventDefault();
    updateCameraGesture(point.clientX, point.clientY);
  };

  const handleStageMouseUp = () => {
    if (cameraPanRef.current) {
      endCameraGesture();
    }
  };

  const handleStageWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    updateStagePointerLight(event.clientX, event.clientY);

    if (event.shiftKey) {
      onCameraChange({ yaw: Number(clamp(camera.yaw - event.deltaY * 0.035, -32, 32).toFixed(1)) });
      return;
    }

    if (event.altKey) {
      onCameraChange({ pitch: Number(clamp(camera.pitch - event.deltaY * 0.0008, 0.48, 0.74).toFixed(3)) });
      return;
    }

    const frame = stageFrameRef.current;
    const rect = frame?.getBoundingClientRect();
    const pointer = rect
      ? {
          x: (event.clientX - rect.left) / scale,
          y: (event.clientY - rect.top) / scale,
        }
      : { x: VIEW_WIDTH / 2, y: VIEW_HEIGHT / 2 };
    const nextZoom = clamp(Number((camera.zoom - event.deltaY * 0.0012).toFixed(3)), 0.7, 1.48);
    const anchor = unprojectPoint(pointer, camera);
    const nextCamera = normalizeSandboxCamera({ ...camera, zoom: nextZoom });
    const projectedAnchor = projectPoint(anchor, nextCamera);

    onCameraChange({
      zoom: nextCamera.zoom,
      panX: Number((nextCamera.panX + pointer.x - projectedAnchor.x).toFixed(1)),
      panY: Number((nextCamera.panY + pointer.y - projectedAnchor.y).toFixed(1)),
    });
  };

  const setStageCursor = (cursor: string) => {
    const container = stageRef.current?.container();
    if (container) {
      container.style.cursor = cursor;
    }
  };

  function shouldStartCameraPan(event: NativeCameraEvent, isTraySurface: boolean): boolean {
    if ("touches" in event) {
      return isTraySurface || stageToolMode === "pan";
    }

    const isPrimaryButton = isPrimaryPointerButton(event);
    const isMousePanShortcut = event.button === 1 || event.button === 2 || spacePanRef.current;

    if (stageToolMode === "pan") {
      return isPrimaryButton || isMousePanShortcut;
    }

    return (isTraySurface && isPrimaryButton && stageToolMode !== "orbit") || isMousePanShortcut;
  }

  function shouldStartCameraOrbit(event: NativeCameraEvent, isTraySurface: boolean): boolean {
    if ("touches" in event) {
      return false;
    }

    const isPrimaryButton = isPrimaryPointerButton(event);
    return isPrimaryButton && (stageToolMode === "orbit" || (isTraySurface && event.altKey));
  }

  const beginCameraPan = (event: NativeCameraEvent) => {
    beginCameraGesture(event, "pan");
  };

  const beginCameraOrbit = (event: NativeCameraEvent) => {
    beginCameraGesture(event, "orbit");
  };

  const beginCameraGesture = (event: NativeCameraEvent, mode: CameraGestureMode) => {
    if (cameraPanRef.current) {
      return;
    }

    const point = getNativeClientPoint(event);
    if (!point) {
      return;
    }

    const current = cameraRef.current;
    cameraPanRef.current = {
      clientX: point.clientX,
      clientY: point.clientY,
      panX: current.panX,
      panY: current.panY,
      yaw: current.yaw,
      pitch: current.pitch,
      mode,
    };
    setCameraGestureMode(mode);
    setStageCursor("grabbing");
    bindCameraDocumentGestureListeners();
  };

  const clearCameraDocumentGestureListeners = () => {
    cameraDocumentCleanupRef.current?.();
    cameraDocumentCleanupRef.current = null;
    cameraDocumentTrackingRef.current = false;
  };

  const bindCameraDocumentGestureListeners = () => {
    clearCameraDocumentGestureListeners();
    cameraDocumentTrackingRef.current = true;

    const handleMove = (event: NativeCameraEvent) => {
      const point = getNativeClientPoint(event);
      if (!point || !cameraPanRef.current) {
        return;
      }
      event.preventDefault();
      updateStagePointerLight(point.clientX, point.clientY);
      updateCameraGesture(point.clientX, point.clientY);
    };

    const handleEnd = () => {
      if (cameraPanRef.current) {
        endCameraGesture();
      }
    };

    window.addEventListener("mousemove", handleMove as EventListener, { passive: false });
    window.addEventListener("mouseup", handleEnd);
    window.addEventListener("pointermove", handleMove as EventListener, { passive: false });
    window.addEventListener("pointerup", handleEnd);
    window.addEventListener("pointercancel", handleEnd);
    window.addEventListener("touchmove", handleMove as EventListener, { passive: false });
    window.addEventListener("touchend", handleEnd);
    window.addEventListener("touchcancel", handleEnd);
    window.addEventListener("blur", handleEnd);

    cameraDocumentCleanupRef.current = () => {
      window.removeEventListener("mousemove", handleMove as EventListener);
      window.removeEventListener("mouseup", handleEnd);
      window.removeEventListener("pointermove", handleMove as EventListener);
      window.removeEventListener("pointerup", handleEnd);
      window.removeEventListener("pointercancel", handleEnd);
      window.removeEventListener("touchmove", handleMove as EventListener);
      window.removeEventListener("touchend", handleEnd);
      window.removeEventListener("touchcancel", handleEnd);
      window.removeEventListener("blur", handleEnd);
    };
  };

  const updateCameraGesture = (clientX: number, clientY: number) => {
    const gesture = cameraPanRef.current;
    if (!gesture) {
      return;
    }

    if (gesture.mode === "orbit") {
      const deltaX = (clientX - gesture.clientX) / scaleRef.current;
      const deltaY = (clientY - gesture.clientY) / scaleRef.current;
      onCameraChange({
        yaw: Number(clamp(gesture.yaw + deltaX * 0.16, -32, 32).toFixed(1)),
        pitch: Number(clamp(gesture.pitch - deltaY * 0.0012, 0.48, 0.74).toFixed(3)),
      });
      return;
    }

    onCameraChange({
      panX: Number((gesture.panX + (clientX - gesture.clientX) / scaleRef.current).toFixed(1)),
      panY: Number((gesture.panY + (clientY - gesture.clientY) / scaleRef.current).toFixed(1)),
    });
  };

  const endCameraGesture = () => {
    cameraPanRef.current = null;
    setCameraGestureMode(null);
    clearCameraDocumentGestureListeners();
    if (spacePanRef.current) {
      setStageCursor("grab");
      return;
    }
    setStageCursor(activeGestureRef.current ? "grabbing" : stageToolMode === "select" ? "default" : "grab");
  };

  const handleDragMove = (object: SandboxObject, event: Konva.KonvaEventObject<DragEvent>) => {
    const node = event.target as Konva.Group;
    const next = unprojectPoint({ x: node.x(), y: node.y() }, camera);
    node.position(projectPoint(next, camera));
    onPatchObject(object.id, next);
  };

  const resetTransformProxy = (object: SandboxObject) => {
    const node = transformProxyRefs.current[object.id];
    if (!node) {
      return;
    }
    const proxyBox = getTransformProxyBox(object);
    node.position({ x: proxyBox.x, y: proxyBox.y });
    node.size({ width: proxyBox.width, height: proxyBox.height });
    node.rotation(0);
    node.scale({ x: 1, y: 1 });
  };

  const handleProxyTransformPreview = (object: SandboxObject) => {
    const proxy = transformProxyRefs.current[object.id];
    const objectNode = objectRefs.current[object.id];
    if (!proxy || !objectNode) {
      return;
    }

    const boardPoint = unprojectPoint({ x: objectNode.x(), y: objectNode.y() }, camera);
    const depthScale = getDepthScale(boardPoint, camera);
    const scaleDelta = (Math.abs(proxy.scaleX()) + Math.abs(proxy.scaleY())) / 2;
    const previewScale = clamp(object.scale * scaleDelta, 0.35, 2.4) * depthScale;
    objectNode.rotation(normalizeRotation(object.rotation + proxy.rotation()));
    objectNode.scale({ x: previewScale, y: previewScale });
  };

  const handleProxyTransformEnd = (object: SandboxObject) => {
    const proxy = transformProxyRefs.current[object.id];
    const objectNode = objectRefs.current[object.id];
    if (!proxy || !objectNode) {
      return;
    }

    const boardPoint = unprojectPoint({ x: objectNode.x(), y: objectNode.y() }, camera);
    const depthScale = getDepthScale(boardPoint, camera);
    const scaleDelta = (Math.abs(proxy.scaleX()) + Math.abs(proxy.scaleY())) / 2;
    const nextScale = clamp(Number((object.scale * scaleDelta).toFixed(2)), 0.35, 2.4);
    const patch = {
      x: Number(boardPoint.x.toFixed(1)),
      y: Number(boardPoint.y.toFixed(1)),
      rotation: normalizeRotation(object.rotation + proxy.rotation()),
      scale: nextScale,
    };

    objectNode.position(projectPoint(boardPoint, camera));
    objectNode.rotation(patch.rotation);
    objectNode.scale({ x: nextScale * depthScale, y: nextScale * depthScale });
    resetTransformProxy(object);
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

  const handleTransformEnd = (object: SandboxObject) => {
    const node = objectRefs.current[object.id];
    if (!node) {
      return;
    }

    const boardPoint = unprojectPoint({ x: node.x(), y: node.y() }, camera);
    const depthScale = getDepthScale(boardPoint, camera);
    const rawScale = (Math.abs(node.scaleX()) + Math.abs(node.scaleY())) / 2 / depthScale;
    const nextScale = clamp(Number(rawScale.toFixed(2)), 0.35, 2.4);
    const patch = {
      x: boardPoint.x,
      y: boardPoint.y,
      rotation: normalizeRotation(node.rotation()),
      scale: nextScale,
    };
    node.position(projectPoint(boardPoint, camera));
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

  const handleZoomStep = (step: number) => {
    onCameraChange({ zoom: Number(clamp(camera.zoom + step, 0.7, 1.48).toFixed(2)) });
  };

  return (
    <main className="sandbox-editor" aria-label="沙盘画布">
      <div className="stage-host" ref={hostRef}>
        <div
          className={stageFrameClassName}
          ref={stageFrameRef}
          data-camera-pan-x={camera.panX.toFixed(1)}
          data-camera-pan-y={camera.panY.toFixed(1)}
          data-camera-yaw={camera.yaw.toFixed(1)}
          data-camera-pitch={camera.pitch.toFixed(3)}
          data-camera-zoom={camera.zoom.toFixed(3)}
          data-stage-tool-mode={stageToolMode}
          style={
            {
              width: VIEW_WIDTH * scale,
              height: VIEW_HEIGHT * scale,
              "--stage-light-x": "50%",
              "--stage-light-y": "30%",
            } as CSSProperties
          }
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onWheel={handleStageWheel}
        >
          <Stage
            ref={stageRef}
            width={VIEW_WIDTH * scale}
            height={VIEW_HEIGHT * scale}
            onMouseDown={handleStageMouseDown}
            onMouseMove={handleStageMouseMove}
            onMouseUp={handleStageMouseUp}
            onMouseLeave={handleStageMouseUp}
            onPointerDown={handleStageMouseDown}
            onPointerMove={handleStageMouseMove}
            onPointerUp={handleStageMouseUp}
            onPointerCancel={handleStageMouseUp}
            onContextMenu={(event) => event.evt.preventDefault()}
            onTouchStart={handleStageMouseDown}
            onTouchMove={handleStageMouseMove}
            onTouchEnd={handleStageMouseUp}
          >
            <Layer ref={objectLayerRef} scaleX={scale} scaleY={scale}>
              <ThreeSandboxStageLayer environment={environment} camera={camera} />
              <SandboxSandMaterialLayer environment={environment} camera={camera} />
              <SandboxTrayPolishLayer environment={environment} camera={camera} />
              <SandboxGuideLayer environment={environment} camera={camera} showGuides={showGuides} renderBackdrop={false} />
              <SandboxObjectContactLayer objects={objects} environment={environment} camera={camera} />
              <Rect
                name="sandbox-camera-pan-surface"
                x={0}
                y={0}
                width={VIEW_WIDTH}
                height={VIEW_HEIGHT}
                fill="rgba(255,255,255,0.001)"
                listening
              />

              {sortedObjects.map((object, index) => {
                const projected = projectPoint(object, camera);
                const depthScale = getDepthScale(object, camera);
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
                    draggable={stageToolMode === "select" && !spacePanActive && !cameraGestureMode}
                    onMouseEnter={() =>
                      setStageCursor(
                        spacePanActive || stageToolMode !== "select"
                          ? "grab"
                          : activeGesture?.mode === "drag"
                            ? "grabbing"
                            : "grab",
                      )
                    }
                    onMouseLeave={() => {
                      if (!activeGesture && !spacePanActive && !cameraGestureMode && stageToolMode === "select") {
                        setStageCursor("default");
                      }
                    }}
                    onMouseDown={(event) => {
                      if (shouldStartCameraOrbit(event.evt, false)) {
                        event.cancelBubble = true;
                        event.evt.preventDefault();
                        beginCameraOrbit(event.evt);
                        return;
                      }
                      if (shouldStartCameraPan(event.evt, false)) {
                        event.cancelBubble = true;
                        event.evt.preventDefault();
                        beginCameraPan(event.evt);
                        return;
                      }
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
                      const dropped = unprojectPoint({ x: node.x(), y: node.y() }, camera);
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
                        camera={camera}
                        rotation={object.rotation}
                        footprint={object.footprint}
                      />
                    </Group>
                    <Rect
                      ref={(node) => {
                        if (node) {
                          transformProxyRefs.current[object.id] = node;
                        } else {
                          delete transformProxyRefs.current[object.id];
                        }
                      }}
                      name="sandbox-object-transform-proxy"
                      {...getTransformProxyBox(object)}
                      fill="rgba(0,0,0,0.001)"
                      opacity={0.001}
                      listening={false}
                      onTransformStart={(event) => {
                        event.cancelBubble = true;
                        setActiveGesture({ objectId: object.id, mode: "transform" });
                        transformStartRef.current[object.id] = {
                          x: object.x,
                          y: object.y,
                          rotation: object.rotation,
                          scale: object.scale,
                        };
                      }}
                      onTransform={(event) => {
                        event.cancelBubble = true;
                        handleProxyTransformPreview(object);
                      }}
                      onTransformEnd={(event) => {
                        event.cancelBubble = true;
                        handleProxyTransformEnd(object);
                        settleStartRef.current[object.id] = performance.now();
                        setActiveGesture(null);
                      }}
                    />
                  </Group>
                );
              })}

              <WeatherLayer environment={environment} />

              <Group ref={interactionOverlayRef} listening={false}>
                {selectedObject && selectedObjectMode ? (
                  <SelectedObjectOverlay
                    object={selectedObject}
                    environment={environment}
                    camera={camera}
                    mode={selectedObjectMode}
                  />
                ) : null}

                {dropPreview ? (
                  <DropPlacementPreview point={dropPreview} asset={draggingAsset} environment={environment} camera={camera} />
                ) : null}

                {dropPulse ? <DropPlacementPulse point={dropPulse} environment={environment} camera={camera} /> : null}
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
      <StageCameraHud
        camera={camera}
        mode={stageToolMode}
        gestureMode={cameraGestureMode}
        spacePanActive={spacePanActive}
      />
      <StageToolDock
        mode={stageToolMode}
        hasSelection={Boolean(selectedObject)}
        onModeChange={(mode) => {
          setStageToolMode(mode);
          setStageCursor(mode === "select" ? "default" : "grab");
        }}
        onZoomIn={() => handleZoomStep(0.08)}
        onZoomOut={() => handleZoomStep(-0.08)}
        onResetCamera={() => onCameraChange(DEFAULT_SANDBOX_CAMERA)}
        onDeleteSelected={onDeleteSelected}
      />
      <AiCompanionAvatar active={aiCompanionActive} onOpen={onOpenAiCompanion} />
    </main>
  );
});

function StageCameraHud({
  camera,
  mode,
  gestureMode,
  spacePanActive,
}: {
  camera: SandboxCameraState;
  mode: StageToolMode;
  gestureMode: CameraGestureMode | null;
  spacePanActive: boolean;
}): JSX.Element {
  const stateLabel =
    gestureMode === "orbit"
      ? "转动中"
      : gestureMode === "pan"
        ? "移动中"
        : mode === "orbit"
          ? "转动视角"
          : mode === "pan" || spacePanActive
            ? "移动视角"
            : "空白沙面可拖动";
  const CameraIcon = gestureMode === "orbit" || mode === "orbit" ? Orbit : Hand;
  const tipLabel =
    gestureMode === "orbit"
      ? "拖动鼠标调整角度与俯仰"
      : gestureMode === "pan"
        ? "拖动鼠标移动沙盘视角"
        : mode === "orbit"
          ? "按住鼠标拖动即可转动沙盘"
          : mode === "pan" || spacePanActive
            ? "按住鼠标拖动即可移动沙盘"
            : "拖空白处移动视角，点住沙具调整作品";
  const isCameraHudActive = Boolean(gestureMode) || mode !== "select" || spacePanActive;

  return (
    <aside
      className={`stage-camera-hud ${isCameraHudActive ? "active" : ""}`}
      data-mode={gestureMode ?? mode}
      data-gesture={gestureMode ? "true" : "false"}
      aria-label="沙盘视角状态"
      aria-live="polite"
    >
      <div className="stage-camera-hud-status">
        <CameraIcon size={15} aria-hidden="true" />
        <span>{stateLabel}</span>
      </div>
      <p className="stage-camera-hud-tip">{tipLabel}</p>
      <dl>
        <div>
          <dt>角度</dt>
          <dd>{Math.round(camera.yaw)}°</dd>
        </div>
        <div>
          <dt>缩放</dt>
          <dd>{camera.zoom.toFixed(2)}x</dd>
        </div>
        <div>
          <dt>俯仰</dt>
          <dd>{Math.round(camera.pitch * 100)}%</dd>
        </div>
        <div>
          <dt>位置</dt>
          <dd>
            {Math.round(camera.panX)},{Math.round(camera.panY)}
          </dd>
        </div>
      </dl>
    </aside>
  );
}

function isSandboxObjectTarget(target: Konva.Node): boolean {
  let node: Konva.Node | null = target;
  while (node) {
    const name = node.name();
    const className = node.getClassName();
    if (
      name === "sandbox-object" ||
      name === "sandbox-object-hit-area" ||
      name === "sandbox-object-transform-proxy" ||
      name.includes("_anchor") ||
      className === "Transformer"
    ) {
      return true;
    }
    node = node.getParent();
  }
  return false;
}

function ObjectInteractionHitArea({ object }: { object: SandboxObject }): JSX.Element {
  const hitWidth = Math.max(42, object.width * 1.08, object.footprint.width * 0.9);
  const topReach = Math.max(object.height * 0.94, object.footprint.height * 0.78, 38);
  const bottomReach = Math.max(object.height * 0.16, object.footprint.depth * 0.26, 12);
  const hitHeight = topReach + bottomReach;

  return (
    <Rect
      name="sandbox-object-hit-area"
      x={-hitWidth * 0.5}
      y={-topReach}
      width={hitWidth}
      height={hitHeight}
      fill="rgba(0,0,0,0.01)"
      listening
    />
  );
}

function getTransformProxyBox(object: SandboxObject): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  const width = clamp(Math.max(object.width * 0.74, object.footprint.width * 0.62, 34), 34, object.width * 1.04);
  const height = clamp(Math.max(object.height * 0.72, object.footprint.height * 0.76, 34), 34, object.height * 1.02);

  return {
    x: Number((-width * 0.5).toFixed(1)),
    y: Number((-height * 0.86).toFixed(1)),
    width: Number(width.toFixed(1)),
    height: Number(height.toFixed(1)),
  };
}

function StageToolDock({
  mode,
  hasSelection,
  onModeChange,
  onZoomIn,
  onZoomOut,
  onResetCamera,
  onDeleteSelected,
}: {
  mode: StageToolMode;
  hasSelection: boolean;
  onModeChange: (mode: StageToolMode) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetCamera: () => void;
  onDeleteSelected: () => void;
}): JSX.Element {
  return (
    <div className="stage-tool-dock" role="toolbar" aria-label="沙盘快捷工具">
      <button
        type="button"
        className={mode === "select" ? "active" : ""}
        onClick={() => onModeChange("select")}
        aria-pressed={mode === "select"}
        title="选择沙具。拖动沙盘空白处可移动视角。"
      >
        <MousePointer2 size={18} />
        <span>选择</span>
      </button>
      <button
        type="button"
        className={mode === "pan" ? "active" : ""}
        onClick={() => onModeChange("pan")}
        aria-pressed={mode === "pan"}
        title="移动沙盘视角。按住鼠标拖动画面。"
      >
        <Hand size={18} />
        <span>移动沙盘</span>
      </button>
      <button
        type="button"
        className={mode === "orbit" ? "active" : ""}
        onClick={() => onModeChange("orbit")}
        aria-pressed={mode === "orbit"}
        title="转动沙盘视角。按住鼠标拖动可调整角度和俯仰。"
      >
        <Orbit size={18} />
        <span>转动</span>
      </button>
      <button type="button" onClick={onZoomIn}>
        <ZoomIn size={18} />
        <span>放大</span>
      </button>
      <button type="button" onClick={onZoomOut}>
        <ZoomOut size={18} />
        <span>缩小</span>
      </button>
      <button type="button" onClick={onResetCamera}>
        <RotateCcw size={18} />
        <span>复位</span>
      </button>
      <button type="button" className="danger" onClick={onDeleteSelected} disabled={!hasSelection}>
        <Trash2 size={18} />
        <span>删除</span>
      </button>
    </div>
  );
}

function getNativeClientPoint(event: NativeCameraEvent): { clientX: number; clientY: number } | null {
  if ("touches" in event) {
    const touch = event.touches[0] ?? event.changedTouches[0];
    return touch ? { clientX: touch.clientX, clientY: touch.clientY } : null;
  }

  return { clientX: event.clientX, clientY: event.clientY };
}

function isPrimaryPointerButton(event: MouseEvent | PointerEvent): boolean {
  return event.button === 0 || event.buttons === 1 || event.button === -1;
}

function normalizeRotation(rotation: number): number {
  const normalized = ((rotation % 360) + 360) % 360;
  return Number(normalized.toFixed(1));
}

function parseCssPixels(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
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
  camera,
  mode,
}: {
  object: SandboxObject;
  environment: SandboxEnvironment;
  camera: SandboxCameraState;
  mode: SelectedObjectMode;
}): JSX.Element {
  const projected = projectPoint(object, camera);
  const depthScale = getDepthScale(object, camera) * object.scale;
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
  camera,
}: {
  point: { x: number; y: number };
  asset: SandboxAsset | null;
  environment: SandboxEnvironment;
  camera: SandboxCameraState;
}): JSX.Element {
  const projected = projectPoint(point, camera);
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
  camera,
}: {
  point: { x: number; y: number };
  environment: SandboxEnvironment;
  camera: SandboxCameraState;
}): JSX.Element {
  const projected = projectPoint(point, camera);
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

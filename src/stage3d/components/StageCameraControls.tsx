import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { Camera, OrthographicCamera } from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { StageInteractionMode } from "../types";

interface StageCameraControlsProps {
  enabled: boolean;
  onInteractionModeChange?: (mode: StageInteractionMode) => void;
  resetSignal: number;
}

const DEFAULT_STAGE_CAMERA_POSITION = [6.8, 6.2, 8.2] as const;
const DEFAULT_STAGE_CAMERA_ZOOM = 82;
const DEFAULT_STAGE_CAMERA_TARGET = [0, 0.12, 0] as const;
const MAX_TARGET_X = 1.72;
const MAX_TARGET_Z = 1.24;

export function StageCameraControls({ enabled, onInteractionModeChange, resetSignal }: StageCameraControlsProps): null {
  const { camera, gl } = useThree();
  const controls = useMemo(() => new OrbitControls(camera, gl.domElement), [camera, gl.domElement]);

  useEffect(() => {
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.enablePan = true;
    controls.panSpeed = 0.78;
    controls.rotateSpeed = 0.62;
    controls.zoomSpeed = 0.94;
    controls.screenSpacePanning = false;
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.PAN,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.ROTATE,
    };
    controls.touches = {
      ONE: THREE.TOUCH.PAN,
      TWO: THREE.TOUCH.DOLLY_ROTATE,
    };
    controls.minPolarAngle = 0.78;
    controls.maxPolarAngle = 1.1;
    controls.minAzimuthAngle = -0.55;
    controls.maxAzimuthAngle = 0.55;
    controls.minZoom = 54;
    controls.maxZoom = 132;
    controls.target.set(...DEFAULT_STAGE_CAMERA_TARGET);
    controls.update();

    return () => controls.dispose();
  }, [controls]);

  useEffect(() => {
    const element = gl.domElement;
    let zoomIdleTimer = 0;

    const announce = (mode: StageInteractionMode) => {
      onInteractionModeChange?.(mode);
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (!controls.enabled) {
        return;
      }

      if (event.button === 0) {
        announce("pan");
      }

      if (event.button === 2) {
        announce("rotate");
      }
    };

    const handlePointerUp = () => {
      if (!controls.enabled) {
        return;
      }
      announce("idle");
    };

    const handleWheel = () => {
      if (!controls.enabled) {
        return;
      }

      window.clearTimeout(zoomIdleTimer);
      announce("zoom");
      zoomIdleTimer = window.setTimeout(() => announce("idle"), 620);
    };

    const preventContextMenu = (event: MouseEvent) => {
      event.preventDefault();
    };

    element.addEventListener("pointerdown", handlePointerDown);
    element.addEventListener("wheel", handleWheel);
    element.addEventListener("contextmenu", preventContextMenu);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);

    return () => {
      window.clearTimeout(zoomIdleTimer);
      element.removeEventListener("pointerdown", handlePointerDown);
      element.removeEventListener("wheel", handleWheel);
      element.removeEventListener("contextmenu", preventContextMenu);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [controls, gl.domElement, onInteractionModeChange]);

  useEffect(() => {
    controls.enabled = enabled;
  }, [controls, enabled]);

  useEffect(() => {
    camera.position.set(...DEFAULT_STAGE_CAMERA_POSITION);
    if (isOrthographicCamera(camera)) {
      camera.zoom = DEFAULT_STAGE_CAMERA_ZOOM;
      camera.updateProjectionMatrix();
    }
    controls.target.set(...DEFAULT_STAGE_CAMERA_TARGET);
    controls.update();
  }, [camera, controls, resetSignal]);

  useFrame(() => {
    clampControlTarget(controls);
    controls.update();
  });

  return null;
}

function isOrthographicCamera(camera: Camera): camera is OrthographicCamera {
  return "isOrthographicCamera" in camera;
}

function clampControlTarget(controls: OrbitControls): void {
  controls.target.x = clampNumber(controls.target.x, -MAX_TARGET_X, MAX_TARGET_X);
  controls.target.z = clampNumber(controls.target.z, -MAX_TARGET_Z, MAX_TARGET_Z);
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

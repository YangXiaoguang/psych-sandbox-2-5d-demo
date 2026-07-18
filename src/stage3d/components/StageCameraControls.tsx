import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { Camera, OrthographicCamera } from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

interface StageCameraControlsProps {
  enabled: boolean;
  resetSignal: number;
}

const DEFAULT_STAGE_CAMERA_POSITION = [6.8, 6.2, 8.2] as const;
const DEFAULT_STAGE_CAMERA_ZOOM = 82;
const DEFAULT_STAGE_CAMERA_TARGET = [0, 0.12, 0] as const;

export function StageCameraControls({ enabled, resetSignal }: StageCameraControlsProps): null {
  const { camera, gl } = useThree();
  const controls = useMemo(() => new OrbitControls(camera, gl.domElement), [camera, gl.domElement]);

  useEffect(() => {
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minPolarAngle = 0.78;
    controls.maxPolarAngle = 1.1;
    controls.minAzimuthAngle = -0.55;
    controls.maxAzimuthAngle = 0.55;
    controls.minZoom = 52;
    controls.maxZoom = 118;
    controls.target.set(...DEFAULT_STAGE_CAMERA_TARGET);
    controls.update();

    return () => controls.dispose();
  }, [controls]);

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

  useFrame(() => controls.update());

  return null;
}

function isOrthographicCamera(camera: Camera): camera is OrthographicCamera {
  return "isOrthographicCamera" in camera;
}

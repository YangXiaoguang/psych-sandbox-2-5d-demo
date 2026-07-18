import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export function StageCameraControls(): null {
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
    controls.target.set(0, 0.12, 0);
    controls.update();

    return () => controls.dispose();
  }, [controls]);

  useFrame(() => controls.update());

  return null;
}


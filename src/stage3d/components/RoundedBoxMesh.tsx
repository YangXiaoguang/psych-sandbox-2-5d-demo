import { useEffect, useMemo } from "react";
import type { ReactNode } from "react";
import type { ThreeElements } from "@react-three/fiber";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

interface RoundedBoxMeshProps extends Omit<ThreeElements["mesh"], "args"> {
  children: ReactNode;
  radius?: number;
  size: [number, number, number];
  smoothness?: number;
}

export function RoundedBoxMesh({
  children,
  radius = 0.05,
  size,
  smoothness = 5,
  ...meshProps
}: RoundedBoxMeshProps): JSX.Element {
  const geometry = useMemo(
    () => new RoundedBoxGeometry(size[0], size[1], size[2], smoothness, radius),
    [radius, size, smoothness],
  );

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh {...meshProps} geometry={geometry}>
      {children}
    </mesh>
  );
}


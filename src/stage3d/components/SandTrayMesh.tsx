import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { SandboxEnvironment } from "../../types";

const ISLAND_RADIUS_X = 4.28;
const ISLAND_RADIUS_Z = 3.34;
const SAND_SURFACE_Y = 0.285;
const SAND_BASE_Y = -0.18;
const WATER_Y = -0.135;
const EDGE_SEGMENTS = 112;
const SURFACE_RINGS = 9;

interface SandTrayMeshProps {
  environment: SandboxEnvironment;
}

export function SandTrayMesh({ environment }: SandTrayMeshProps): JSX.Element {
  const night = environment.light === "night";
  const rainy = environment.weather === "rainy";
  const cloudy = environment.weather === "cloudy";
  const sandTexture = useMemo(() => createSandTexture(environment), [environment]);
  const sandSideTexture = useMemo(() => createSandSideTexture(environment), [environment]);
  const oceanTexture = useMemo(() => createOceanTexture(environment), [environment]);
  const foamTexture = useMemo(() => createFoamTexture(environment), [environment]);
  const causticTexture = useMemo(() => createCausticTexture(environment), [environment]);
  const softPatchTexture = useMemo(() => createSoftPatchTexture(), []);
  const islandTopGeometry = useMemo(() => createIslandTopGeometry(), []);
  const islandSideGeometry = useMemo(() => createIslandSideGeometry(), []);
  const shoreShadowGeometry = useMemo(() => createIslandRingGeometry(0.98, 1.22, WATER_Y + 0.034), []);
  const wetSandGeometry = useMemo(() => createIslandRingGeometry(0.86, 1.012, SAND_SURFACE_Y + 0.011), []);
  const foamGeometry = useMemo(() => createIslandRingGeometry(1.006, 1.092, SAND_SURFACE_Y + 0.017), []);
  const tideFoamGeometry = useMemo(() => createIslandRingGeometry(1.04, 1.18, SAND_SURFACE_Y + 0.021), []);
  const shellSeeds = useMemo(() => createShellSeeds(), []);
  const surfaceSeeds = useMemo(() => createSurfaceSandSeeds(), []);
  const rakeSeeds = useMemo(() => createSandRakeSeeds(), []);
  const foamFleckSeeds = useMemo(() => createFoamFleckSeeds(), []);
  const dunePatchSeeds = useMemo(() => createDunePatchSeeds(), []);
  const sandSparkleSeeds = useMemo(() => createSandSparkleSeeds(), []);
  const oceanBandSeeds = useMemo(() => createOceanBandSeeds(), []);

  useFrame(({ clock }) => {
    const elapsed = clock.getElapsedTime();
    oceanTexture.offset.set(elapsed * 0.018, elapsed * 0.012);
    foamTexture.offset.set(-elapsed * 0.035, elapsed * 0.014);
  });

  const waterColor = night ? "#2c6571" : rainy ? "#6cb8c8" : cloudy ? "#83d3d7" : "#5ed4dc";
  const waterEmissive = night ? "#082936" : "#0a3640";
  const sandColor = night ? "#d5c895" : rainy ? "#d8bd83" : "#f0cc78";
  const wetSandColor = night ? "#b9ad82" : rainy ? "#c79d65" : "#dfb05d";

  return (
    <group>
      <mesh receiveShadow position={[0, WATER_Y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <OceanSurface
          bumpScale={rainy ? 0.07 : 0.045}
          color={waterColor}
          emissive={waterEmissive}
          emissiveIntensity={night ? 0.24 : 0.05}
          rainy={rainy}
          texture={oceanTexture}
        />
      </mesh>
      <OceanGlimmer night={night} rainy={rainy} texture={causticTexture} />
      <OceanCurrentBands seeds={oceanBandSeeds} night={night} rainy={rainy} texture={softPatchTexture} />
      <ShoreWaterShadow geometry={shoreShadowGeometry} night={night} rainy={rainy} />

      <mesh geometry={islandSideGeometry} castShadow receiveShadow>
        <meshStandardMaterial
          map={sandSideTexture}
          color={night ? "#af9666" : rainy ? "#c99c61" : "#d7a15b"}
          roughness={0.88}
          metalness={0}
        />
      </mesh>

      <mesh geometry={wetSandGeometry} receiveShadow renderOrder={2}>
        <meshStandardMaterial
          color={wetSandColor}
          roughness={rainy ? 0.58 : 0.76}
          metalness={0}
          transparent
          opacity={night ? 0.42 : 0.48}
          depthWrite={false}
        />
      </mesh>

      <mesh geometry={islandTopGeometry} castShadow receiveShadow>
        <meshStandardMaterial
          map={sandTexture}
          bumpMap={sandTexture}
          bumpScale={rainy ? 0.035 : 0.052}
          color={sandColor}
          roughness={rainy ? 0.66 : 0.96}
          metalness={0}
        />
      </mesh>
      <DuneReliefPatches seeds={dunePatchSeeds} night={night} rainy={rainy} texture={softPatchTexture} />
      <SandSparkleFlecks seeds={sandSparkleSeeds} night={night} rainy={rainy} />

      <mesh geometry={foamGeometry} receiveShadow renderOrder={3}>
        <meshBasicMaterial
          map={foamTexture}
          color={night ? "#b7dce3" : "#f5ffff"}
          transparent
          opacity={night ? 0.34 : rainy ? 0.64 : 0.52}
          depthWrite={false}
        />
      </mesh>
      <TideFoam geometry={tideFoamGeometry} night={night} rainy={rainy} texture={foamTexture} />
      <ShoreFoamFlecks seeds={foamFleckSeeds} night={night} rainy={rainy} />

      <mesh position={[1.58, SAND_SURFACE_Y + 0.035, 0.82]} receiveShadow>
        <cylinderGeometry args={[0.64, 0.7, 0.06, 56]} />
        <meshPhysicalMaterial
          color={night ? "#69becb" : "#74d8e8"}
          roughness={0.26}
          metalness={0.02}
          transmission={0.08}
          transparent
          opacity={0.78}
        />
      </mesh>

      <ShoreDetails seeds={shellSeeds} night={night} />
      <SurfaceSandDetails seeds={surfaceSeeds} night={night} rainy={rainy} />
      <SandRakeMarks seeds={rakeSeeds} night={night} rainy={rainy} />
    </group>
  );
}

function ShoreWaterShadow({
  geometry,
  night,
  rainy,
}: {
  geometry: THREE.BufferGeometry;
  night: boolean;
  rainy: boolean;
}): JSX.Element {
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);

  useFrame(({ clock }) => {
    if (!materialRef.current) {
      return;
    }
    const breathe = 0.5 + Math.sin(clock.getElapsedTime() * (rainy ? 0.88 : 0.64)) * 0.5;
    materialRef.current.opacity = night ? 0.34 + breathe * 0.07 : rainy ? 0.24 + breathe * 0.06 : 0.2 + breathe * 0.045;
  });

  return (
    <mesh geometry={geometry} renderOrder={1}>
      <meshBasicMaterial
        ref={materialRef}
        color={night ? "#03131c" : rainy ? "#1c6e76" : "#127a84"}
        transparent
        opacity={night ? 0.36 : 0.22}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function OceanCurrentBands({
  night,
  rainy,
  seeds,
  texture,
}: {
  night: boolean;
  rainy: boolean;
  seeds: OceanBandSeed[];
  texture: THREE.Texture;
}): JSX.Element {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!groupRef.current) {
      return;
    }
    const elapsed = clock.getElapsedTime();
    groupRef.current.position.x = Math.sin(elapsed * 0.12) * 0.08;
    groupRef.current.position.z = Math.cos(elapsed * 0.1) * 0.06;
    groupRef.current.rotation.y = Math.sin(elapsed * 0.08) * 0.012;
  });

  return (
    <group ref={groupRef}>
      {seeds.map((seed, index) => (
        <mesh
          key={`${seed.x}-${seed.z}-${index}`}
          position={[seed.x, WATER_Y + 0.028 + seed.lift, seed.z]}
          rotation={[-Math.PI / 2, 0, seed.rotation]}
          scale={[seed.length, seed.width, 1]}
          renderOrder={1}
        >
          <circleGeometry args={[1, 28]} />
          <meshBasicMaterial
            map={texture}
            color={night ? "#8fd4df" : rainy ? "#c8f3f0" : "#f5fff8"}
            transparent
            opacity={(night ? 0.045 : rainy ? 0.07 : 0.092) * seed.opacity}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}

function DuneReliefPatches({
  night,
  rainy,
  seeds,
  texture,
}: {
  night: boolean;
  rainy: boolean;
  seeds: DunePatchSeed[];
  texture: THREE.Texture;
}): JSX.Element {
  return (
    <group>
      {seeds.map((seed, index) => {
        const isShadow = seed.kind === "shadow";
        const isCool = seed.kind === "cool";
        const color = isShadow
          ? night
            ? "#5f4b2e"
            : rainy
              ? "#8f6a3f"
              : "#9e6a31"
          : isCool
            ? night
              ? "#ddf2d5"
              : rainy
                ? "#e3ead1"
                : "#fff0b8"
            : night
              ? "#fff0b8"
              : rainy
                ? "#f3d093"
                : "#ffe09a";
        return (
          <mesh
            key={`${seed.x}-${seed.z}-${index}`}
            position={[seed.x, SAND_SURFACE_Y + 0.086 + seed.lift, seed.z]}
            rotation={[-Math.PI / 2, 0, seed.rotation]}
            scale={[seed.radiusX, seed.radiusZ, 1]}
            renderOrder={7}
          >
            <circleGeometry args={[1, 36]} />
            <meshBasicMaterial
              map={texture}
              color={color}
              transparent
              opacity={seed.opacity * (isShadow ? (night ? 0.14 : 0.12) : rainy ? 0.11 : 0.145)}
              depthWrite={false}
              side={THREE.DoubleSide}
            />
          </mesh>
        );
      })}
    </group>
  );
}

function SandSparkleFlecks({
  night,
  rainy,
  seeds,
}: {
  night: boolean;
  rainy: boolean;
  seeds: SandSparkleSeed[];
}): JSX.Element {
  const materialColor = night ? "#fff2ba" : rainy ? "#e8dfbd" : "#fff3c5";
  const opacityScale = night ? 0.48 : rainy ? 0.28 : 0.62;

  return (
    <group>
      {seeds.map((seed, index) => (
        <mesh
          key={`${seed.x}-${seed.z}-${index}`}
          position={[seed.x, SAND_SURFACE_Y + 0.092 + seed.lift, seed.z]}
          rotation={[-Math.PI / 2, 0, seed.rotation]}
          scale={[seed.length, seed.width, 1]}
          renderOrder={8}
        >
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial color={materialColor} transparent opacity={seed.opacity * opacityScale} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

function SandRakeMarks({ night, rainy, seeds }: { night: boolean; rainy: boolean; seeds: SandRakeSeed[] }): JSX.Element {
  const grooveColor = night ? "#7d6741" : rainy ? "#9e7442" : "#b3762f";
  const highlightColor = night ? "#fff0b7" : rainy ? "#ffe4a7" : "#fff0ba";
  const grooveOpacity = night ? 0.14 : rainy ? 0.11 : 0.16;
  const highlightOpacity = night ? 0.11 : rainy ? 0.075 : 0.13;

  return (
    <group>
      {seeds.map((seed, index) => (
        <group key={`${seed.x}-${seed.z}-${index}`} position={[seed.x, SAND_SURFACE_Y + 0.072 + seed.lift, seed.z]} rotation={[0, seed.rotation, 0]}>
          {Array.from({ length: seed.lines }, (_, lineIndex) => {
            const centered = lineIndex - (seed.lines - 1) / 2;
            const offset = centered * seed.spacing;
            return (
              <group key={lineIndex} position={[0, 0, offset]}>
                <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={5}>
                  <planeGeometry args={[seed.length * (0.82 + seeded(index * 71 + lineIndex * 13) * 0.28), seed.thickness]} />
                  <meshBasicMaterial color={grooveColor} transparent opacity={grooveOpacity} depthWrite={false} />
                </mesh>
                <mesh position={[0.015, 0.004, seed.thickness * 1.65]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={6}>
                  <planeGeometry args={[seed.length * 0.64, seed.thickness * 0.42]} />
                  <meshBasicMaterial color={highlightColor} transparent opacity={highlightOpacity} depthWrite={false} />
                </mesh>
              </group>
            );
          })}
        </group>
      ))}
    </group>
  );
}

function ShoreFoamFlecks({ night, rainy, seeds }: { night: boolean; rainy: boolean; seeds: FoamFleckSeed[] }): JSX.Element {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!groupRef.current) {
      return;
    }
    const pulse = 1 + Math.sin(clock.getElapsedTime() * (rainy ? 1.24 : 0.86)) * 0.008;
    groupRef.current.scale.set(pulse, 1, pulse);
  });

  return (
    <group ref={groupRef}>
      {seeds.map((seed, index) => {
        const point = getIslandEdgePoint(seed.angle, seed.scale);
        const opacity = night ? seed.opacity * 0.56 : rainy ? seed.opacity * 0.9 : seed.opacity;
        return (
          <mesh
            key={`${seed.angle}-${index}`}
            position={[point.x, SAND_SURFACE_Y + 0.034 + seed.lift, point.z]}
            rotation={[-Math.PI / 2, 0, seed.angle + seed.rotation]}
            scale={[seed.size * 2.4, seed.size * 0.62, 1]}
            renderOrder={6}
          >
            <circleGeometry args={[1, 16]} />
            <meshBasicMaterial color={night ? "#d8f1f3" : "#ffffff"} transparent opacity={opacity} depthWrite={false} />
          </mesh>
        );
      })}
    </group>
  );
}

function ShoreDetails({ night, seeds }: { night: boolean; seeds: ShoreSeed[] }): JSX.Element {
  return (
    <group>
      {seeds.map((seed, index) => {
        const edge = getIslandEdgePoint(seed.angle, seed.scale);
        const color = seed.kind === "shell" ? (night ? "#d9cdae" : "#fff0cf") : night ? "#8d8774" : "#b9aa8a";
        return (
          <mesh
            key={`${seed.angle}-${index}`}
            position={[edge.x, SAND_SURFACE_Y + 0.028 + seed.lift, edge.z]}
            rotation={[seed.rotation, seed.angle, seed.rotation * 0.5]}
            scale={[seed.size * 1.34, seed.size * 0.44, seed.size]}
            castShadow
            receiveShadow
          >
            <sphereGeometry args={[1, 12, 8]} />
            <meshStandardMaterial color={color} roughness={0.86} metalness={0} />
          </mesh>
        );
      })}
    </group>
  );
}

function SurfaceSandDetails({ night, rainy, seeds }: { night: boolean; rainy: boolean; seeds: SurfaceSandSeed[] }): JSX.Element {
  return (
    <group>
      {seeds.map((seed, index) => {
        const point = getIslandEdgePoint(seed.angle, seed.scale);
        const y = SAND_SURFACE_Y + 0.052 + seed.lift;
        const color = seed.kind === "shell" ? (night ? "#d8cbaa" : "#fff0c8") : rainy ? "#b39b75" : "#cfb27b";
        return (
          <mesh
            key={`${seed.angle}-${seed.scale}-${index}`}
            position={[point.x, y, point.z]}
            rotation={[seed.rotation, seed.angle * 0.35, seed.rotation * 0.3]}
            scale={seed.kind === "shell" ? [seed.size * 1.8, seed.size * 0.38, seed.size * 0.86] : [seed.size * 1.15, seed.size * 0.46, seed.size]}
            castShadow
            receiveShadow
          >
            <sphereGeometry args={[1, 10, 7]} />
            <meshStandardMaterial color={color} roughness={0.9} metalness={0} />
          </mesh>
        );
      })}
    </group>
  );
}

function OceanSurface({
  bumpScale,
  color,
  emissive,
  emissiveIntensity,
  rainy,
  texture,
}: {
  bumpScale: number;
  color: string;
  emissive: string;
  emissiveIntensity: number;
  rainy: boolean;
  texture: THREE.Texture;
}): JSX.Element {
  const geometry = useMemo(() => new THREE.PlaneGeometry(24, 17, 88, 64), []);
  const basePositions = useMemo(() => Float32Array.from(geometry.attributes.position.array as ArrayLike<number>), [geometry]);
  const frameCounter = useRef(0);

  useFrame(({ clock }) => {
    const position = geometry.attributes.position as THREE.BufferAttribute;
    const values = position.array as Float32Array;
    const elapsed = clock.getElapsedTime();
    const amplitude = rainy ? 0.055 : 0.034;

    for (let index = 0; index < values.length; index += 3) {
      const x = basePositions[index];
      const y = basePositions[index + 1];
      values[index + 2] =
        Math.sin(x * 1.15 + elapsed * 0.82) * amplitude +
        Math.cos(y * 1.65 - elapsed * 0.64) * amplitude * 0.62 +
        Math.sin((x + y) * 0.72 + elapsed * 0.44) * amplitude * 0.38;
    }

    position.needsUpdate = true;
    frameCounter.current += 1;
    if (frameCounter.current % 8 === 0) {
      geometry.computeVertexNormals();
    }
  });

  return (
    <>
      <primitive object={geometry} attach="geometry" />
      <meshPhysicalMaterial
        map={texture}
        bumpMap={texture}
        bumpScale={bumpScale}
        color={color}
        emissive={emissive}
        emissiveIntensity={emissiveIntensity}
        metalness={0.02}
        roughness={rainy ? 0.34 : 0.2}
        clearcoat={0.82}
        clearcoatRoughness={rainy ? 0.3 : 0.18}
      />
    </>
  );
}

function OceanGlimmer({ night, rainy, texture }: { night: boolean; rainy: boolean; texture: THREE.Texture }): JSX.Element {
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);

  useFrame(({ clock }) => {
    const elapsed = clock.getElapsedTime();
    texture.offset.set(elapsed * 0.024, -elapsed * 0.018);
    if (materialRef.current) {
      const pulse = 0.5 + Math.sin(elapsed * (rainy ? 0.9 : 0.62)) * 0.5;
      materialRef.current.opacity = night ? 0.08 + pulse * 0.035 : rainy ? 0.12 + pulse * 0.04 : 0.18 + pulse * 0.055;
    }
  });

  return (
    <mesh position={[0, WATER_Y + 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={0}>
      <planeGeometry args={[24, 17, 1, 1]} />
      <meshBasicMaterial
        ref={materialRef}
        map={texture}
        color={night ? "#9ad3de" : "#f5ffff"}
        transparent
        opacity={night ? 0.08 : 0.18}
        depthWrite={false}
      />
    </mesh>
  );
}

function TideFoam({
  geometry,
  night,
  rainy,
  texture,
}: {
  geometry: THREE.BufferGeometry;
  night: boolean;
  rainy: boolean;
  texture: THREE.Texture;
}): JSX.Element {
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);
  const groupRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    const elapsed = clock.getElapsedTime();
    if (materialRef.current) {
      const wave = 0.5 + Math.sin(elapsed * (rainy ? 1.45 : 1.05)) * 0.5;
      materialRef.current.opacity = night ? 0.18 + wave * 0.12 : rainy ? 0.36 + wave * 0.24 : 0.28 + wave * 0.16;
    }
    if (groupRef.current) {
      const scale = 1 + Math.sin(elapsed * 0.68) * 0.006;
      groupRef.current.scale.set(scale, 1, scale);
    }
  });

  return (
    <group ref={groupRef}>
      <mesh geometry={geometry} receiveShadow renderOrder={4}>
        <meshBasicMaterial
          ref={materialRef}
          map={texture}
          color={night ? "#c7e7ee" : "#ffffff"}
          transparent
          opacity={night ? 0.2 : 0.36}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

function createSandTexture(environment: SandboxEnvironment): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 1024;
  const context = canvas.getContext("2d");
  if (context) {
    const night = environment.light === "night";
    const rainy = environment.weather === "rainy";
    const base = context.createRadialGradient(260, 190, 24, 540, 580, 850);
    base.addColorStop(0, night ? "#efe0ad" : rainy ? "#e8c985" : "#f7d889");
    base.addColorStop(0.38, night ? "#d7c48d" : rainy ? "#ddbb79" : "#f0c96f");
    base.addColorStop(0.72, night ? "#b99a62" : rainy ? "#bd9360" : "#d39b50");
    base.addColorStop(1, night ? "#8d6941" : rainy ? "#a57849" : "#b97738");
    context.fillStyle = base;
    context.fillRect(0, 0, canvas.width, canvas.height);

    for (let patch = 0; patch < 74; patch += 1) {
      const x = seeded(patch * 37) * canvas.width;
      const y = seeded(patch * 61) * canvas.height;
      const radius = 42 + seeded(patch * 83) * 128;
      const gradient = context.createRadialGradient(x, y, 2, x, y, radius);
      const light = seeded(patch * 17) > 0.52;
      gradient.addColorStop(0, light ? (night ? "rgba(255,238,174,0.18)" : "rgba(255,239,170,0.13)") : "rgba(91,58,24,0.11)");
      gradient.addColorStop(1, "rgba(255,255,255,0)");
      context.fillStyle = gradient;
      context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }

    for (let index = 0; index < 11800; index += 1) {
      const x = seeded(index * 31) * canvas.width;
      const y = seeded(index * 47) * canvas.height;
      const alpha = 0.022 + seeded(index * 59) * (night ? 0.12 : 0.095);
      const warm = seeded(index * 19);
      context.fillStyle =
        warm > 0.68
          ? `rgba(255,246,205,${alpha})`
          : warm > 0.36
            ? `rgba(199,143,63,${alpha})`
            : `rgba(99,65,29,${alpha})`;
      context.beginPath();
      context.arc(x, y, 0.22 + seeded(index * 71) * 1.35, 0, Math.PI * 2);
      context.fill();
    }

    context.globalAlpha = 0.72;
    for (let sparkle = 0; sparkle < 360; sparkle += 1) {
      const x = seeded(sparkle * 97) * canvas.width;
      const y = seeded(sparkle * 109) * canvas.height;
      context.strokeStyle = rainy ? "rgba(255,252,219,0.1)" : "rgba(255,250,210,0.18)";
      context.lineWidth = 0.55 + seeded(sparkle * 67) * 0.8;
      context.beginPath();
      context.moveTo(x - 1.8, y);
      context.lineTo(x + 1.8, y + 0.7);
      context.stroke();
    }
    context.globalAlpha = 1;

    context.lineCap = "round";
    for (let ridge = 0; ridge < 34; ridge += 1) {
      const y = 42 + ridge * 27 + seeded(ridge * 13) * 18;
      const shade = rainy ? "rgba(255,255,255,0.075)" : night ? "rgba(91,65,35,0.14)" : "rgba(117,75,31,0.12)";
      const shine = rainy ? "rgba(226,244,232,0.075)" : night ? "rgba(255,233,169,0.16)" : "rgba(255,232,151,0.13)";
      context.lineWidth = 1.2 + seeded(ridge * 19) * 1.8;
      context.strokeStyle = shade;
      context.beginPath();
      context.moveTo(24, y);
      context.bezierCurveTo(224, y - 42, 578, y + 38, 990, y - 12);
      context.stroke();
      context.lineWidth = 0.8 + seeded(ridge * 23) * 1.1;
      context.strokeStyle = shine;
      context.beginPath();
      context.moveTo(34, y - 4);
      context.bezierCurveTo(230, y - 45, 586, y + 34, 984, y - 18);
      context.stroke();
    }

    for (let sweep = 0; sweep < 22; sweep += 1) {
      const centerX = 120 + seeded(sweep * 101) * 780;
      const centerY = 130 + seeded(sweep * 113) * 740;
      const length = 76 + seeded(sweep * 127) * 160;
      const gap = 6 + seeded(sweep * 139) * 5;
      const angle = -0.62 + seeded(sweep * 151) * 1.18;
      const lineCount = 4 + Math.floor(seeded(sweep * 163) * 4);
      context.save();
      context.translate(centerX, centerY);
      context.rotate(angle);
      for (let line = 0; line < lineCount; line += 1) {
        const offset = (line - (lineCount - 1) / 2) * gap;
        context.lineWidth = 1.15 + seeded(sweep * 181 + line) * 0.65;
        context.strokeStyle = night ? "rgba(82,57,28,0.16)" : rainy ? "rgba(99,66,30,0.1)" : "rgba(111,69,26,0.14)";
        context.beginPath();
        context.moveTo(-length * 0.48, offset);
        context.bezierCurveTo(-length * 0.12, offset - 10, length * 0.16, offset + 9, length * 0.48, offset - 2);
        context.stroke();
        context.lineWidth = 0.72;
        context.strokeStyle = night ? "rgba(255,237,173,0.12)" : rainy ? "rgba(255,239,186,0.08)" : "rgba(255,235,166,0.14)";
        context.beginPath();
        context.moveTo(-length * 0.42, offset - 2.6);
        context.bezierCurveTo(-length * 0.1, offset - 12, length * 0.18, offset + 5, length * 0.42, offset - 5);
        context.stroke();
      }
      context.restore();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2.45, 1.78);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createSandSideTexture(environment: SandboxEnvironment): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  if (context) {
    const night = environment.light === "night";
    const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, night ? "#bba77a" : "#efc271");
    gradient.addColorStop(0.42, night ? "#917b55" : "#bf8545");
    gradient.addColorStop(1, night ? "#55452f" : "#7a522f");
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);
    for (let line = 0; line < 56; line += 1) {
      const y = seeded(line * 17) * canvas.height;
      context.strokeStyle = line % 3 === 0 ? "rgba(255,230,171,0.16)" : "rgba(74,45,21,0.18)";
      context.beginPath();
      context.moveTo(0, y);
      context.bezierCurveTo(130, y + seeded(line * 31) * 18 - 9, 290, y - 10, 512, y + seeded(line * 43) * 22 - 11);
      context.stroke();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2.2, 1);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createOceanTexture(environment: SandboxEnvironment): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext("2d");
  if (context) {
    const night = environment.light === "night";
    const rainy = environment.weather === "rainy";
    context.fillStyle = night ? "#164050" : rainy ? "#58adbd" : "#26c4d0";
    context.fillRect(0, 0, canvas.width, canvas.height);

    const depth = context.createRadialGradient(156, 122, 20, 286, 304, 440);
    depth.addColorStop(0, night ? "rgba(113,184,197,0.25)" : rainy ? "rgba(178,236,232,0.16)" : "rgba(202,255,240,0.18)");
    depth.addColorStop(0.55, "rgba(255,255,255,0)");
    depth.addColorStop(1, night ? "rgba(0,16,26,0.18)" : "rgba(0,82,112,0.2)");
    context.fillStyle = depth;
    context.fillRect(0, 0, canvas.width, canvas.height);

    for (let wash = 0; wash < 620; wash += 1) {
      const x = seeded(wash * 13) * canvas.width;
      const y = seeded(wash * 29) * canvas.height;
      const alpha = night ? 0.012 + seeded(wash * 7) * 0.032 : 0.018 + seeded(wash * 7) * 0.045;
      context.fillStyle = seeded(wash * 5) > 0.5 ? `rgba(255,255,255,${alpha})` : `rgba(0,77,101,${alpha})`;
      context.fillRect(x, y, 1.2 + seeded(wash * 3) * 5.4, 0.6 + seeded(wash * 11) * 2.6);
    }

    for (let line = 0; line < 58; line += 1) {
      const y = -40 + seeded(line * 31) * (canvas.height + 80);
      context.strokeStyle = line % 2 === 0 ? "rgba(255,255,255,0.16)" : "rgba(7,105,126,0.13)";
      context.lineWidth = 0.9 + seeded(line * 41) * 1.8;
      context.beginPath();
      context.moveTo(-50, y);
      context.bezierCurveTo(86, y - 22, 214, y + 25, 354, y - 14);
      context.bezierCurveTo(454, y - 42, 552, y + 24, 612, y - 8);
      context.stroke();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4.6, 3.4);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createCausticTexture(environment: SandboxEnvironment): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext("2d");
  if (context) {
    const night = environment.light === "night";
    const rainy = environment.weather === "rainy";
    context.clearRect(0, 0, canvas.width, canvas.height);

    for (let band = 0; band < 42; band += 1) {
      const y = -60 + seeded(band * 37) * (canvas.height + 120);
      const x = -80 + seeded(band * 53) * 160;
      context.lineWidth = 1.2 + seeded(band * 29) * (rainy ? 1.6 : 2.8);
      context.strokeStyle = night ? "rgba(207,246,255,0.11)" : rainy ? "rgba(255,255,255,0.11)" : "rgba(255,255,245,0.22)";
      context.beginPath();
      context.moveTo(x, y);
      context.bezierCurveTo(x + 96, y - 34, x + 164, y + 36, x + 260, y - 5);
      context.bezierCurveTo(x + 360, y - 48, x + 438, y + 38, x + 620, y - 16);
      context.stroke();
    }

    for (let fleck = 0; fleck < 90; fleck += 1) {
      const x = seeded(fleck * 71) * canvas.width;
      const y = seeded(fleck * 97) * canvas.height;
      const radius = 3 + seeded(fleck * 113) * 12;
      const gradient = context.createRadialGradient(x, y, 1, x, y, radius);
      gradient.addColorStop(0, night ? "rgba(180,232,240,0.12)" : "rgba(255,255,255,0.18)");
      gradient.addColorStop(1, "rgba(255,255,255,0)");
      context.fillStyle = gradient;
      context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3.8, 2.8);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createFoamTexture(environment: SandboxEnvironment): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  if (context) {
    context.clearRect(0, 0, canvas.width, canvas.height);
    const rainy = environment.weather === "rainy";
    for (let index = 0; index < 120; index += 1) {
      const x = seeded(index * 17) * canvas.width;
      const y = 22 + seeded(index * 31) * 84;
      const radius = 3 + seeded(index * 43) * (rainy ? 10 : 7);
      const alpha = 0.08 + seeded(index * 59) * (rainy ? 0.34 : 0.24);
      context.fillStyle = `rgba(255,255,255,${alpha})`;
      context.beginPath();
      context.ellipse(x, y, radius * 1.8, radius * 0.52, seeded(index * 5) * Math.PI, 0, Math.PI * 2);
      context.fill();
    }

    for (let bead = 0; bead < 82; bead += 1) {
      const x = seeded(bead * 83) * canvas.width;
      const y = 18 + seeded(bead * 97) * 92;
      const radius = 1.2 + seeded(bead * 109) * (rainy ? 4.2 : 3);
      const alpha = 0.12 + seeded(bead * 127) * (rainy ? 0.34 : 0.22);
      context.fillStyle = `rgba(255,255,255,${alpha})`;
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.fill();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(5.2, 1);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createSoftPatchTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  if (context) {
    const gradient = context.createRadialGradient(128, 128, 4, 128, 128, 126);
    gradient.addColorStop(0, "rgba(255,255,255,0.92)");
    gradient.addColorStop(0.38, "rgba(255,255,255,0.54)");
    gradient.addColorStop(0.72, "rgba(255,255,255,0.16)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);

    context.globalCompositeOperation = "destination-out";
    for (let notch = 0; notch < 22; notch += 1) {
      const angle = seeded(notch * 23) * Math.PI * 2;
      const distance = 86 + seeded(notch * 31) * 28;
      const x = 128 + Math.cos(angle) * distance;
      const y = 128 + Math.sin(angle) * distance;
      const radius = 10 + seeded(notch * 37) * 22;
      const cut = context.createRadialGradient(x, y, 1, x, y, radius);
      cut.addColorStop(0, "rgba(255,255,255,0.18)");
      cut.addColorStop(1, "rgba(255,255,255,0)");
      context.fillStyle = cut;
      context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }
    context.globalCompositeOperation = "source-over";
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createIslandTopGeometry(): THREE.BufferGeometry {
  const vertices: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  vertices.push(0, SAND_SURFACE_Y + 0.035, 0);
  uvs.push(0.5, 0.5);

  for (let ring = 1; ring <= SURFACE_RINGS; ring += 1) {
    const radius = ring / SURFACE_RINGS;
    for (let segment = 0; segment < EDGE_SEGMENTS; segment += 1) {
      const angle = (segment / EDGE_SEGMENTS) * Math.PI * 2;
      const edge = getIslandEdgePoint(angle, radius);
      const dune =
        Math.sin(edge.x * 1.75 + edge.z * 0.42) * 0.026 * (1 - radius * 0.22) +
        Math.cos(edge.z * 2.1 - edge.x * 0.28) * 0.018 * (1 - radius * 0.38);
      const edgeDrop = Math.pow(radius, 7) * 0.062;
      const y = SAND_SURFACE_Y + 0.035 + dune - edgeDrop;
      vertices.push(edge.x, y, edge.z);
      uvs.push(edge.x / (ISLAND_RADIUS_X * 2.2) + 0.5, edge.z / (ISLAND_RADIUS_Z * 2.2) + 0.5);
    }
  }

  for (let segment = 0; segment < EDGE_SEGMENTS; segment += 1) {
    const current = 1 + segment;
    const next = 1 + ((segment + 1) % EDGE_SEGMENTS);
    indices.push(0, next, current);
  }

  for (let ring = 2; ring <= SURFACE_RINGS; ring += 1) {
    const previousStart = 1 + (ring - 2) * EDGE_SEGMENTS;
    const currentStart = 1 + (ring - 1) * EDGE_SEGMENTS;
    for (let segment = 0; segment < EDGE_SEGMENTS; segment += 1) {
      const next = (segment + 1) % EDGE_SEGMENTS;
      indices.push(previousStart + segment, previousStart + next, currentStart + segment);
      indices.push(currentStart + segment, previousStart + next, currentStart + next);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function createIslandSideGeometry(): THREE.BufferGeometry {
  const vertices: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let segment = 0; segment < EDGE_SEGMENTS; segment += 1) {
    const angle = (segment / EDGE_SEGMENTS) * Math.PI * 2;
    const top = getIslandEdgePoint(angle, 1);
    const bottom = getIslandEdgePoint(angle, 0.94);
    const topY = SAND_SURFACE_Y - 0.018 + Math.sin(angle * 5) * 0.012;
    vertices.push(top.x, topY, top.z, bottom.x, SAND_BASE_Y, bottom.z);
    uvs.push(segment / EDGE_SEGMENTS, 0, segment / EDGE_SEGMENTS, 1);
  }

  for (let segment = 0; segment < EDGE_SEGMENTS; segment += 1) {
    const next = (segment + 1) % EDGE_SEGMENTS;
    const topCurrent = segment * 2;
    const bottomCurrent = topCurrent + 1;
    const topNext = next * 2;
    const bottomNext = topNext + 1;
    indices.push(topCurrent, topNext, bottomCurrent);
    indices.push(bottomCurrent, topNext, bottomNext);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function createIslandRingGeometry(innerScale: number, outerScale: number, y: number): THREE.BufferGeometry {
  const vertices: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let segment = 0; segment < EDGE_SEGMENTS; segment += 1) {
    const angle = (segment / EDGE_SEGMENTS) * Math.PI * 2;
    const inner = getIslandEdgePoint(angle, innerScale);
    const outer = getIslandEdgePoint(angle, outerScale);
    vertices.push(inner.x, y, inner.z, outer.x, y, outer.z);
    uvs.push(segment / EDGE_SEGMENTS, 0, segment / EDGE_SEGMENTS, 1);
  }

  for (let segment = 0; segment < EDGE_SEGMENTS; segment += 1) {
    const next = (segment + 1) % EDGE_SEGMENTS;
    const innerCurrent = segment * 2;
    const outerCurrent = innerCurrent + 1;
    const innerNext = next * 2;
    const outerNext = innerNext + 1;
    indices.push(innerCurrent, outerCurrent, innerNext);
    indices.push(innerNext, outerCurrent, outerNext);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function getIslandEdgePoint(angle: number, scale: number): { x: number; z: number } {
  const superellipsePower = 0.62;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const variation =
    1 +
    Math.sin(angle * 3 + 0.45) * 0.035 +
    Math.sin(angle * 7 - 0.8) * 0.025 +
    Math.cos(angle * 11 + 1.2) * 0.014;
  const x = Math.sign(cos) * Math.pow(Math.abs(cos), superellipsePower) * ISLAND_RADIUS_X * variation * scale;
  const z = Math.sign(sin) * Math.pow(Math.abs(sin), superellipsePower) * ISLAND_RADIUS_Z * (1 + Math.cos(angle * 5) * 0.026) * scale;
  return { x, z };
}

interface ShoreSeed {
  angle: number;
  kind: "shell" | "pebble";
  lift: number;
  rotation: number;
  scale: number;
  size: number;
}

interface SurfaceSandSeed {
  angle: number;
  kind: "shell" | "pebble";
  lift: number;
  rotation: number;
  scale: number;
  size: number;
}

interface SandRakeSeed {
  lift: number;
  length: number;
  lines: number;
  rotation: number;
  spacing: number;
  thickness: number;
  x: number;
  z: number;
}

interface FoamFleckSeed {
  angle: number;
  lift: number;
  opacity: number;
  rotation: number;
  scale: number;
  size: number;
}

interface DunePatchSeed {
  kind: "highlight" | "shadow" | "cool";
  lift: number;
  opacity: number;
  radiusX: number;
  radiusZ: number;
  rotation: number;
  x: number;
  z: number;
}

interface SandSparkleSeed {
  length: number;
  lift: number;
  opacity: number;
  rotation: number;
  width: number;
  x: number;
  z: number;
}

interface OceanBandSeed {
  length: number;
  lift: number;
  opacity: number;
  rotation: number;
  width: number;
  x: number;
  z: number;
}

function createShellSeeds(): ShoreSeed[] {
  return Array.from({ length: 34 }, (_, index) => ({
    angle: seeded(index * 37) * Math.PI * 2,
    kind: seeded(index * 19) > 0.56 ? "shell" : "pebble",
    lift: seeded(index * 13) * 0.018,
    rotation: seeded(index * 23) * Math.PI,
    scale: 0.74 + seeded(index * 17) * 0.18,
    size: 0.028 + seeded(index * 29) * 0.052,
  }));
}

function createSurfaceSandSeeds(): SurfaceSandSeed[] {
  return Array.from({ length: 64 }, (_, index) => ({
    angle: seeded(index * 41 + 5) * Math.PI * 2,
    kind: seeded(index * 47 + 3) > 0.76 ? "shell" : "pebble",
    lift: seeded(index * 23 + 7) * 0.014,
    rotation: seeded(index * 31 + 2) * Math.PI,
    scale: 0.18 + seeded(index * 53 + 11) * 0.68,
    size: 0.012 + seeded(index * 67 + 13) * 0.024,
  }));
}

function createSandRakeSeeds(): SandRakeSeed[] {
  return Array.from({ length: 13 }, (_, index) => {
    const angle = seeded(index * 73 + 4) * Math.PI * 2;
    const scale = 0.24 + seeded(index * 89 + 9) * 0.56;
    const point = getIslandEdgePoint(angle, scale);
    return {
      lift: seeded(index * 17 + 3) * 0.01,
      length: 0.34 + seeded(index * 37 + 1) * 0.64,
      lines: 3 + Math.floor(seeded(index * 43 + 2) * 4),
      rotation: seeded(index * 47 + 6) * Math.PI * 2,
      spacing: 0.035 + seeded(index * 53 + 8) * 0.022,
      thickness: 0.012 + seeded(index * 59 + 10) * 0.008,
      x: point.x,
      z: point.z,
    };
  });
}

function createFoamFleckSeeds(): FoamFleckSeed[] {
  return Array.from({ length: 72 }, (_, index) => ({
    angle: seeded(index * 31 + 12) * Math.PI * 2,
    lift: seeded(index * 41 + 15) * 0.01,
    opacity: 0.08 + seeded(index * 43 + 3) * 0.18,
    rotation: seeded(index * 47 + 9) * Math.PI,
    scale: 1.048 + seeded(index * 37 + 7) * 0.11,
    size: 0.014 + seeded(index * 53 + 11) * 0.036,
  }));
}

function createDunePatchSeeds(): DunePatchSeed[] {
  return Array.from({ length: 18 }, (_, index) => {
    const angle = seeded(index * 67 + 9) * Math.PI * 2;
    const scale = 0.18 + seeded(index * 79 + 3) * 0.7;
    const point = getIslandEdgePoint(angle, scale);
    const kindRoll = seeded(index * 83 + 13);
    return {
      kind: kindRoll > 0.72 ? "cool" : kindRoll > 0.45 ? "highlight" : "shadow",
      lift: seeded(index * 47 + 5) * 0.008,
      opacity: 0.58 + seeded(index * 89 + 7) * 0.42,
      radiusX: 0.34 + seeded(index * 97 + 11) * 0.74,
      radiusZ: 0.16 + seeded(index * 101 + 17) * 0.38,
      rotation: seeded(index * 109 + 19) * Math.PI * 2,
      x: point.x,
      z: point.z,
    };
  });
}

function createSandSparkleSeeds(): SandSparkleSeed[] {
  return Array.from({ length: 118 }, (_, index) => {
    const angle = seeded(index * 113 + 5) * Math.PI * 2;
    const scale = 0.16 + seeded(index * 127 + 7) * 0.76;
    const point = getIslandEdgePoint(angle, scale);
    return {
      length: 0.018 + seeded(index * 131 + 11) * 0.05,
      lift: seeded(index * 137 + 13) * 0.006,
      opacity: 0.14 + seeded(index * 139 + 17) * 0.36,
      rotation: seeded(index * 149 + 19) * Math.PI,
      width: 0.0025 + seeded(index * 151 + 23) * 0.008,
      x: point.x,
      z: point.z,
    };
  });
}

function createOceanBandSeeds(): OceanBandSeed[] {
  return Array.from({ length: 24 }, (_, index) => {
    const side = seeded(index * 157 + 3) > 0.5 ? 1 : -1;
    return {
      length: 1.6 + seeded(index * 163 + 5) * 3.4,
      lift: seeded(index * 167 + 7) * 0.012,
      opacity: 0.55 + seeded(index * 173 + 11) * 0.45,
      rotation: -0.22 + seeded(index * 179 + 13) * 0.44,
      width: 0.045 + seeded(index * 181 + 17) * 0.18,
      x: side * (4.4 + seeded(index * 191 + 19) * 5.6),
      z: -4.5 + seeded(index * 193 + 23) * 9,
    };
  });
}

function seeded(seed: number): number {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

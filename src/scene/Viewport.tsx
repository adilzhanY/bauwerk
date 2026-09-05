import { Canvas } from "@react-three/fiber";
import { OrbitControls, OrthographicCamera } from "@react-three/drei";
import { bounds } from "@/geometry/polygon";
import { planCamera } from "./planView";
import { Dimensions } from "./Dimensions";
import { Underlay } from "./Underlay";
import { UValueBands } from "./UValueBand";
import { colors } from "@/lib/colors";
import { useEditorStore } from "@/store/building";
import { Camera } from "./Camera";
import { Grid } from "./Grid";
import { Storey } from "./Storey";
import { Ground } from "./Ground";
import { Tools } from "./tools/Tools";
import { Compass } from "./Compass";
import { storeyElevation } from "@/store/selectors";

export function Viewport() {
  const building = useEditorStore((s) => s.building);
  const activeStoreyId = useEditorStore((s) => s.activeStoreyId);
  const planView = useEditorStore((s) => s.planView);
  const activeElevation = activeStoreyId ? storeyElevation(building, activeStoreyId) : 0;
  const plan = planCamera(
    bounds(building.footprint),
    { width: 1000, height: 700 },
    activeElevation,
  );

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [18, 14, 18], fov: 45, near: 0.1, far: 500 }}
      gl={{ antialias: true, preserveDrawingBuffer: false }}
      style={{ background: colors.bg }}
    >
      <hemisphereLight args={["#dfe6f5", "#3a3f4b", 0.9]} />
      <directionalLight
        position={[20, 30, 10]}
        intensity={1.6}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-40}
        shadow-camera-right={40}
        shadow-camera-top={40}
        shadow-camera-bottom={-40}
      />
      <Ground />
      <Grid />
      <Underlay />
      <UValueBands />
      <Dimensions />
      {planView && (
        <OrthographicCamera
          makeDefault
          position={plan.position}
          zoom={plan.zoom}
          up={[0, 0, -1]}
          near={0.1}
          far={200}
        />
      )}
      {building.storeys
        .filter((storey) => !planView || storey.id === activeStoreyId)
        .map((storey) => (
          <Storey
            key={storey.id}
            building={building}
            storey={storey}
            elevation={storeyElevation(building, storey.id)}
            active={storey.id === activeStoreyId}
          />
        ))}
      <Compass />
      <Tools />
      <OrbitControls
        makeDefault
        enableRotate={!planView}
        target={planView ? plan.target : undefined}
        enableDamping
        dampingFactor={0.12}
        minDistance={2}
        maxDistance={150}
        maxPolarAngle={Math.PI / 2 - 0.03}
        mouseButtons={{ LEFT: 0, MIDDLE: 1, RIGHT: 2 }}
      />
      <Camera />
    </Canvas>
  );
}

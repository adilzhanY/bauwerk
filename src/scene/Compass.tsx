import { Html, Line } from "@react-three/drei";
import { northInPlan } from "@/geometry/geo";
import { bounds } from "@/geometry/polygon";
import { useSceneColors } from "./useSceneColors";
import { useT } from "@/i18n/useT";
import { useEditorStore } from "@/store/building";

/** A north arrow on the ground next to the footprint, following the geo rotation. */
export function Compass() {
  const t = useT();
  const footprint = useEditorStore((s) => s.building.footprint);
  const origin = useEditorStore((s) => s.building.origin);
  const scene = useSceneColors();
  const { min, max } = bounds(footprint);
  const north = northInPlan(origin);
  const base: [number, number] = [max.x + 2, min.y - 1];
  const tip: [number, number] = [base[0] + north.x * 2, base[1] + north.y * 2];
  const color = origin ? scene.select : scene.muted;
  return (
    <group>
      <Line
        points={[
          [base[0], 0.03, base[1]],
          [tip[0], 0.03, tip[1]],
        ]}
        color={color}
        lineWidth={2}
      />
      <mesh position={[tip[0], 0.03, tip[1]]}>
        <sphereGeometry args={[0.12, 8, 8]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <Html
        position={[tip[0] + north.x * 0.6, 0.05, tip[1] + north.y * 0.6]}
        center
        style={{ pointerEvents: "none" }}
      >
        <span className="font-num text-xs select-none" style={{ color }}>
          {t("location.north")}
        </span>
      </Html>
    </group>
  );
}

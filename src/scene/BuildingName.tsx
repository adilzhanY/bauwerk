import { useMemo, useState } from "react";
import { Html } from "@react-three/drei";
import { buildRoof } from "@/geometry/roof";
import { centroid } from "@/geometry/polygon";
import { useT } from "@/i18n/useT";
import { useEditorStore } from "@/store/building";
import { selectTotalHeight } from "@/store/selectors";
import { CustomButton } from "@/components/CustomButton";
import { CustomTextInput } from "@/components/CustomTextInput";

interface EditorProps {
  name: string;
  onRename: (name: string) => void;
}

/** Compact label editor shared by the 3D label and its component test. */
export function BuildingNameEditor({ name, onRename }: EditorProps) {
  const t = useT();
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <div
        className="w-52 rounded-card border border-line bg-paper/95 p-2 shadow-float"
        onBlur={() => {
          setEditing(false);
        }}
      >
        <CustomTextInput
          label={t("building.name")}
          value={name}
          onCommit={onRename}
          hideLabel
          autoFocus
        />
      </div>
    );
  }
  return (
    <CustomButton
      variant="default"
      aria-label={t("building.rename", { name })}
      title={t("building.renameHint")}
      className="h-8 bg-paper/95 px-3 shadow-float"
      onClick={(event) => {
        if (event.detail === 0) setEditing(true);
      }}
      onDoubleClick={() => {
        setEditing(true);
      }}
    >
      {name}
    </CustomButton>
  );
}

/** Building name floating above the roof. Double click it to rename, or use the keyboard. */
export function BuildingName() {
  const building = useEditorStore((s) => s.building);
  const top = useEditorStore(selectTotalHeight);
  const renameBuilding = useEditorStore((s) => s.renameBuilding);
  const placement = useMemo(() => {
    const centre = centroid(building.footprint);
    if (building.storeys.length === 0) return { centre, height: 0.8 };
    const roof = buildRoof(building, top);
    const highest = roof.faces.reduce(
      (height, face) => Math.max(height, ...face.points.map((point) => point.z)),
      top,
    );
    return { centre, height: highest + 0.8 };
  }, [building, top]);

  if (building.storeys.length === 0) return null;
  return (
    <Html
      position={[placement.centre.x, placement.height, placement.centre.y]}
      center
      zIndexRange={[20, 0]}
      style={{ pointerEvents: "auto" }}
    >
      <BuildingNameEditor name={building.name} onRename={renameBuilding} />
    </Html>
  );
}

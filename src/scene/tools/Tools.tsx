import { useEditorStore } from "@/store/building";
import { FootprintTool } from "./FootprintTool";
import { InteriorWallTool } from "./InteriorWallTool";
import { MeasureTool } from "./MeasureTool";
import { HvacTool } from "./HvacTool";
import { MoveTool } from "./MoveTool";

/** Mounts the scene-side part of the active tool. */
export function Tools() {
  const tool = useEditorStore((s) => s.tool);
  if (tool === "footprint") return <FootprintTool />;
  if (tool === "interiorWall") return <InteriorWallTool />;
  if (tool === "measure") return <MeasureTool />;
  if (tool === "hvac") return <HvacTool />;
  if (tool === "move") return <MoveTool />;
  return null;
}

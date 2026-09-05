import { Plus } from "lucide-react";
import { useT } from "@/i18n/useT";
import { useEditorStore } from "@/store/building";
import { Button } from "./controls/Button";

function Centered({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-bg p-8 text-center">
      <h1 className="text-title font-semibold text-fg">{title}</h1>
      <p className="max-w-md text-base text-muted">{body}</p>
      {children}
    </div>
  );
}

/** Shown in the viewport when the building has no storeys. */
export function EmptyState() {
  const t = useT();
  const addStorey = useEditorStore((s) => s.addStorey);
  return (
    <Centered title={t("empty.title")} body={t("empty.body")}>
      <Button variant="primary" icon={<Plus size={14} />} onClick={addStorey}>
        {t("storey.add")}
      </Button>
    </Centered>
  );
}

export function WebGLMissing() {
  const t = useT();
  return <Centered title={t("webgl.title")} body={t("webgl.body")} />;
}

export function TooNarrow() {
  const t = useT();
  return <Centered title={t("narrow.title")} body={t("narrow.body")} />;
}

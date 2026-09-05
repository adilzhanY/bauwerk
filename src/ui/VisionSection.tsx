import { useState } from "react";
import { ScanLine } from "lucide-react";
import { useT } from "@/i18n/useT";
import type { MessageKey } from "@/i18n";
import { formatNumber } from "@/lib/format";
import { useEditorStore } from "@/store/building";
import { useVision } from "@/vision/useVision";
import { CustomButton } from "@/components/CustomButton";
import { CustomCheckbox } from "@/components/CustomCheckbox";
import { CustomNumberInput } from "@/components/CustomNumberInput";

/** Runs the vision pipeline on the underlay and lets the user review and accept the proposal. */
export function VisionSection() {
  const t = useT();
  const language = useEditorStore((s) => s.language);
  const underlay = useEditorStore((s) => s.underlay);
  const proposal = useEditorStore((s) => s.proposal);
  const setProposal = useEditorStore((s) => s.setProposal);
  const toggleProposalWall = useEditorStore((s) => s.toggleProposalWall);
  const acceptProposal = useEditorStore((s) => s.acceptProposal);
  const { state, run, reset } = useVision();
  const [minConfidence, setMinConfidence] = useState(0.6);
  const [skew, setSkew] = useState(0);

  if (!underlay) return null;
  const running = state.status === "loading" || state.status === "running";

  const detect = () => {
    void run(
      underlay.url,
      { x: underlay.x, y: underlay.y, widthMetres: underlay.widthMetres },
      minConfidence,
    ).then(() => undefined);
  };

  // Move the worker result into the store once it arrives.
  if (state.status === "done" && state.proposal && !proposal) {
    setProposal({
      footprint: state.proposal.footprint,
      interiorWalls: state.proposal.interiorWalls.map((w) => ({ ...w, enabled: true })),
    });
    setSkew(state.proposal.skewDegrees);
    reset();
  }

  return (
    <div className="flex flex-col gap-3 border-t border-line pt-3">
      <p className="text-xs text-muted">{t("vision.hint")}</p>
      <CustomNumberInput
        label={t("vision.confidence")}
        value={minConfidence}
        min={0.2}
        max={1}
        step={0.05}
        language={language}
        onChange={setMinConfidence}
      />
      <CustomButton
        icon={<ScanLine size={14} />}
        loading={running}
        onClick={detect}
        className="self-start"
      >
        {running
          ? `${t("vision.running")}: ${t(`vision.step.${state.step || "image"}` as MessageKey)}`
          : t("vision.detect")}
      </CustomButton>
      {state.status === "done" && !state.proposal && (
        <p role="alert" className="text-xs text-mark">
          {t("vision.none")}
        </p>
      )}
      {state.status === "error" && (
        <p role="alert" className="text-xs text-mark">
          {state.error}
        </p>
      )}
      {proposal && (
        <div className="flex flex-col gap-2 rounded-inner border border-select bg-select-soft/40 p-3">
          <p className="text-sm text-ink">
            {t("vision.found", {
              corners: proposal.footprint.length,
              walls: proposal.interiorWalls.length,
              skew: formatNumber(skew, language, 1),
            })}
          </p>
          <ul className="flex flex-col gap-1">
            {proposal.interiorWalls.map((w, i) => (
              <li key={i}>
                <CustomCheckbox
                  label={`${t("vision.wall", { n: i + 1 })} · ${formatNumber(w.confidence * 100, language, 0)} %`}
                  checked={w.enabled}
                  onChange={() => {
                    toggleProposalWall(i);
                  }}
                />
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <CustomButton variant="primary" onClick={acceptProposal}>
              {t("vision.accept")}
            </CustomButton>
            <CustomButton
              variant="quiet"
              onClick={() => {
                setProposal(null);
              }}
            >
              {t("vision.discard")}
            </CustomButton>
          </div>
        </div>
      )}
    </div>
  );
}

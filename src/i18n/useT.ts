import { useCallback } from "react";
import { useEditorStore } from "@/store/building";
import { translate } from "./index";
import type { MessageKey, Params } from "./index";

/** Translation hook bound to the store language. Lives apart from index.ts to avoid an import cycle with the store. */
export function useT() {
  const language = useEditorStore((s) => s.language);
  return useCallback(
    (key: MessageKey, params?: Params) => translate(language, key, params),
    [language],
  );
}

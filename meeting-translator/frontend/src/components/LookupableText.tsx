import { useCallback, useRef, useState } from "react";
import type { LangCode } from "../types";
import { lookupDictionary, type DictionaryLookupResult } from "../api";
import { useAppSettings } from "../AppSettingsContext";
import WordLookupPopover from "./WordLookupPopover";

type Props = {
  text: string;
  className?: string;
  sourceLang?: LangCode;
  targetLang?: LangCode;
  enableLookup?: boolean;
};

export default function LookupableText({
  text,
  className = "",
  sourceLang = "ja",
  targetLang = "vi",
  enableLookup = true,
}: Props) {
  const { tr } = useAppSettings();
  const rootRef = useRef<HTMLParagraphElement>(null);
  const [result, setResult] = useState<DictionaryLookupResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);

  const closePopover = useCallback(() => {
    setAnchor(null);
    setResult(null);
    setError(null);
    setLoading(false);
  }, []);

  const handleMouseUp = useCallback(async () => {
    if (!enableLookup) return;
    const sel = window.getSelection();
    const selected = sel?.toString().trim() ?? "";
    if (!selected || selected.length > 80) {
      if (!selected) closePopover();
      return;
    }

    const range = sel?.rangeCount ? sel.getRangeAt(0) : null;
    const rect = range?.getBoundingClientRect();
    const x = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
    const y = rect ? rect.bottom : window.innerHeight / 2;

    setAnchor({ x, y });
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const data = await lookupDictionary(
        selected,
        sourceLang === "auto" ? "ja" : sourceLang,
        targetLang,
        text
      );
      setResult(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [enableLookup, sourceLang, targetLang, text, closePopover]);

  if (!text) return null;

  return (
    <>
      <p
        ref={rootRef}
        className={`lookupable-text ${className}`.trim()}
        onMouseUp={() => void handleMouseUp()}
        title={enableLookup ? tr("wordLookupHint") : undefined}
      >
        {text}
      </p>
      <WordLookupPopover
        result={result}
        loading={loading}
        error={error}
        anchor={anchor}
        onClose={closePopover}
        labels={{
          reading: tr("wordReading"),
          meanings: tr("wordMeanings"),
          pos: tr("wordPos"),
          loading: tr("wordLookupLoading"),
          noResult: tr("wordLookupEmpty"),
          close: tr("wordLookupClose"),
          selectHint: tr("wordLookupHint"),
        }}
      />
    </>
  );
}

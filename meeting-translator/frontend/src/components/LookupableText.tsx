import { useCallback, useEffect, useRef, useState } from "react";
import type { LangCode } from "../types";
import {
  lookupDictionary,
  tokenizeDictionary,
  type DictionaryLookupResult,
  type DictionaryToken,
} from "../api";
import { useAppSettings } from "../AppSettingsContext";
import WordLookupPopover from "./WordLookupPopover";

type Props = {
  text: string;
  className?: string;
  sourceLang?: LangCode;
  targetLang?: LangCode;
  enableLookup?: boolean;
  editable?: boolean;
  onEditCommit?: (wrong: string, fixed: string) => void;
};

export default function LookupableText({
  text,
  className = "",
  sourceLang = "ja",
  targetLang = "vi",
  enableLookup = true,
  editable = false,
  onEditCommit,
}: Props) {
  const { tr } = useAppSettings();
  const [result, setResult] = useState<DictionaryLookupResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);
  const [tokens, setTokens] = useState<DictionaryToken[]>([]);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(text);
  const originalRef = useRef(text);

  useEffect(() => {
    originalRef.current = text;
    setDraft(text);
  }, [text]);

  useEffect(() => {
    if (!enableLookup || sourceLang !== "ja" || !text.trim()) {
      setTokens([]);
      return;
    }
    let cancelled = false;
    tokenizeDictionary(text)
      .then((list) => {
        if (!cancelled) setTokens(list);
      })
      .catch(() => {
        if (!cancelled) setTokens([]);
      });
    return () => {
      cancelled = true;
    };
  }, [text, sourceLang, enableLookup]);

  const closePopover = useCallback(() => {
    setAnchor(null);
    setResult(null);
    setError(null);
    setLoading(false);
  }, []);

  const lookupWord = useCallback(
    async (word: string, x: number, y: number) => {
      if (!enableLookup || !word.trim()) return;
      setAnchor({ x, y });
      setLoading(true);
      setError(null);
      setResult(null);
      try {
        const data = await lookupDictionary(
          word,
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
    },
    [enableLookup, sourceLang, targetLang, text]
  );

  const handleMouseUp = useCallback(async () => {
    if (!enableLookup || editing) return;
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
    await lookupWord(selected, x, y);
  }, [enableLookup, editing, lookupWord, closePopover]);

  const handleTokenClick = useCallback(
    (word: string, ev: React.MouseEvent) => {
      if (!enableLookup || editing) return;
      ev.stopPropagation();
      void lookupWord(word, ev.clientX, ev.clientY);
    },
    [enableLookup, editing, lookupWord]
  );

  const commitEdit = useCallback(() => {
    const fixed = draft.trim();
    if (fixed && fixed !== originalRef.current && onEditCommit) {
      onEditCommit(originalRef.current, fixed);
    }
    setEditing(false);
  }, [draft, onEditCommit]);

  if (!text && !editing) return null;

  const useTokenSpans =
    enableLookup &&
    sourceLang === "ja" &&
    tokens.length > 0 &&
    !editing &&
    tokens.map((t) => t.surface).join("") === text.replace(/\s/g, "");

  return (
    <>
      {editing ? (
        <textarea
          className={`lookupable-edit ${className}`.trim()}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              commitEdit();
            }
            if (e.key === "Escape") {
              setDraft(originalRef.current);
              setEditing(false);
            }
          }}
          autoFocus
        />
      ) : (
        <p
          className={`lookupable-text ${className}`.trim()}
          onMouseUp={() => void handleMouseUp()}
          onDoubleClick={() => {
            if (editable) {
              setEditing(true);
              setDraft(text);
            }
          }}
          title={
            enableLookup
              ? editable
                ? `${tr("wordLookupHint")} · ${tr("editTranscriptHint")}`
                : tr("wordLookupHint")
              : editable
                ? tr("editTranscriptHint")
                : undefined
          }
        >
          {useTokenSpans
            ? tokens.map((tok) => (
                <span
                  key={`${tok.surface}-${tok.reading}`}
                  className="lookup-token"
                  onClick={(e) => handleTokenClick(tok.surface, e)}
                  title={
                    tok.reading ||
                    (Array.isArray(tok.meanings)
                      ? tok.meanings.join(", ")
                      : tok.meanings)
                  }
                >
                  {tok.surface}
                </span>
              ))
            : text}
        </p>
      )}
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

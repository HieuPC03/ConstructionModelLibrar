import type { DictionaryLookupResult } from "../api";

type Props = {
  result: DictionaryLookupResult | null;
  loading: boolean;
  error: string | null;
  anchor: { x: number; y: number } | null;
  onClose: () => void;
  labels: {
    reading: string;
    meanings: string;
    pos: string;
    loading: string;
    noResult: string;
    close: string;
    selectHint: string;
  };
};

export default function WordLookupPopover({
  result,
  loading,
  error,
  anchor,
  onClose,
  labels,
}: Props) {
  if (!anchor) return null;

  const style: React.CSSProperties = {
    left: Math.min(anchor.x, window.innerWidth - 320),
    top: Math.min(anchor.y + 12, window.innerHeight - 220),
  };

  return (
    <>
      <div className="word-lookup-backdrop" onClick={onClose} aria-hidden />
      <div className="word-lookup-popover" style={style} role="dialog">
        <button
          type="button"
          className="word-lookup-close"
          onClick={onClose}
          aria-label={labels.close}
        >
          ×
        </button>
        {loading && <p className="word-lookup-loading">{labels.loading}</p>}
        {error && <p className="word-lookup-error">{error}</p>}
        {!loading && !error && result && (
          <>
            <p className="word-lookup-word">{result.word}</p>
            {result.reading && (
              <p className="word-lookup-reading">
                {labels.reading}: <span>{result.reading}</span>
              </p>
            )}
            {result.kanji && result.kanji !== result.word && (
              <p className="word-lookup-kanji">
                漢字: <span>{result.kanji}</span>
              </p>
            )}
            {result.pos && (
              <p className="word-lookup-pos">
                {labels.pos}: {result.pos}
              </p>
            )}
            {result.meanings.length > 0 ? (
              <div className="word-lookup-meanings">
                <span className="word-lookup-label">{labels.meanings}</span>
                <ul>
                  {result.meanings.map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="word-lookup-empty">{labels.noResult}</p>
            )}
            {result.tokens.length > 1 && (
              <div className="word-lookup-tokens">
                {result.tokens.map((t) => (
                  <span key={`${t.surface}-${t.reading}`} className="word-token-chip">
                    {t.surface}
                    {t.reading ? `（${t.reading}）` : ""}
                  </span>
                ))}
              </div>
            )}
          </>
        )}
        {!loading && !error && !result && (
          <p className="word-lookup-empty">{labels.selectHint}</p>
        )}
      </div>
    </>
  );
}

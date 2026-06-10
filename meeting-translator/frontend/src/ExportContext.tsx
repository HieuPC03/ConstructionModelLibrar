import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { TranscriptSegment, Utterance } from "./types";
import ExportModal from "./components/ExportModal";

export type ExportPayload = {
  isTranslate: boolean;
  utterances: Utterance[];
  transcriptSegments: TranscriptSegment[];
  sessionId: string | null;
  hasTranscriptContent: boolean;
  setStatus: (status: string) => void;
};

type ExportContextValue = {
  canExport: boolean;
  registerPayload: (payload: ExportPayload | null) => void;
  openExportModal: () => void;
};

const ExportContext = createContext<ExportContextValue | null>(null);

export function ExportProvider({ children }: { children: ReactNode }) {
  const [payload, setPayload] = useState<ExportPayload | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const canExport = useMemo(() => {
    if (!payload) return false;
    if (payload.sessionId) return true;
    if (payload.isTranslate) return payload.utterances.length > 0;
    return payload.hasTranscriptContent;
  }, [payload]);

  const registerPayload = useCallback((next: ExportPayload | null) => {
    setPayload(next);
  }, []);

  const openExportModal = useCallback(() => {
    setModalOpen(true);
  }, []);

  const closeExportModal = useCallback(() => {
    setModalOpen(false);
  }, []);

  const value = useMemo(
    () => ({
      canExport,
      registerPayload,
      openExportModal,
    }),
    [canExport, registerPayload, openExportModal]
  );

  return (
    <ExportContext.Provider value={value}>
      {children}
      {modalOpen && payload && (
        <ExportModal payload={payload} onClose={closeExportModal} />
      )}
    </ExportContext.Provider>
  );
}

export function useExport(): ExportContextValue {
  const ctx = useContext(ExportContext);
  if (!ctx) throw new Error("useExport requires ExportProvider");
  return ctx;
}

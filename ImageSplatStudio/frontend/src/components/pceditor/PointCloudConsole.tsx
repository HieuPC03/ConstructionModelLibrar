import { useEffect, useState } from "react";
import { useI18n } from "../../i18n/I18nProvider";
import { clearConsole, subscribeConsole, type ConsoleEntry } from "../../utils/consoleLog";

interface PointCloudConsoleProps {
  collapsed?: boolean;
  onToggle?: () => void;
}

export function PointCloudConsole({ collapsed = false, onToggle }: PointCloudConsoleProps) {
  const { tr } = useI18n();
  const [entries, setEntries] = useState<ConsoleEntry[]>([]);

  useEffect(() => subscribeConsole(setEntries), []);

  return (
    <div className={`pc-console ${collapsed ? "pc-console-collapsed" : ""}`}>
      <div className="pc-console-header">
        <button type="button" className="pc-console-toggle" onClick={onToggle}>
          {collapsed ? "▲" : "▼"} {tr("consoleTitle")}
        </button>
        <button type="button" className="pc-console-clear" onClick={clearConsole}>
          {tr("consoleClear")}
        </button>
      </div>
      {!collapsed && (
        <div className="pc-console-body">
          {entries.length === 0 ? (
            <p className="pc-console-empty">{tr("consoleEmpty")}</p>
          ) : (
            entries.map((e) => (
              <div key={e.id} className={`pc-console-line pc-console-${e.level}`}>
                <span className="pc-console-time">{e.time}</span>
                <span className="pc-console-msg">{e.message}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

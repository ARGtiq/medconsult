import { useEffect, useState, type ReactNode } from "react";
import UnlockScreen from "@/legacy/components/UnlockScreen";
import { needsUnlock, trySessionUnlock } from "@/legacy/lib/clinicalLock";
import "@/legacy/legacy.css";

export function LockGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<"checking" | "locked" | "ready">("checking");

  useEffect(() => {
    if (!needsUnlock()) {
      setStatus("ready");
      return;
    }
    trySessionUnlock().then((ok: boolean) => setStatus(ok ? "ready" : "locked"));
  }, []);

  if (status === "checking") return null;
  if (status === "locked") {
    return (
      <div className="legacy-surface min-h-dvh">
        <UnlockScreen onUnlocked={() => setStatus("ready")} />
      </div>
    );
  }
  return <>{children}</>;
}

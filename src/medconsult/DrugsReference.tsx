import { useState } from "react";
import DrugGroupsTab from "@/legacy/components/DrugGroupsTab";
import DrugsTab from "@/legacy/components/DrugsTab";
import { store } from "@/legacy/lib/store";

export function DrugsReference({
  initialSub = "drugs",
  initialItemId = null,
}: {
  initialSub?: "drugs" | "groups" | "empty";
  initialItemId?: string | null;
}) {
  const [sub, setSub] = useState<"drugs" | "groups" | "empty">(initialSub === "groups" ? "groups" : initialSub === "empty" ? "empty" : "drugs");
  const [emptyN, setEmptyN] = useState(() => {
    try {
      return store.getEmptyDrugEntries().length;
    } catch {
      return 0;
    }
  });
  return (
    <div>
      <div className="settings-tabs">
        <button type="button" className={sub === "drugs" ? "active" : ""} onClick={() => setSub("drugs")}>
          Препараты
        </button>
        <button type="button" className={sub === "empty" ? "active" : ""} onClick={() => setSub("empty")}>
          Незаполненные{emptyN ? ` (${emptyN})` : ""}
        </button>
        <button type="button" className={sub === "groups" ? "active" : ""} onClick={() => setSub("groups")}>
          Группы
        </button>
      </div>
      {sub !== "groups" && (
        <DrugsTab
          key={sub}
          initialItemId={sub === "drugs" ? initialItemId || undefined : undefined}
          nameOnly={sub === "empty"}
          onDrugsChange={(n: number) => setEmptyN(n)}
        />
      )}
      {sub === "groups" && <DrugGroupsTab />}
    </div>
  );
}
import { useState } from "react";
import DrugGroupsTab from "@/legacy/components/DrugGroupsTab";
import DrugsTab from "@/legacy/components/DrugsTab";

export function DrugsReference({
  initialSub = "drugs",
  initialItemId = null,
}: {
  initialSub?: "drugs" | "groups";
  initialItemId?: string | null;
}) {
  const [sub, setSub] = useState<"drugs" | "groups">(initialSub === "groups" ? "groups" : "drugs");
  return (
    <div>
      <div className="settings-tabs">
        <button type="button" className={sub === "drugs" ? "active" : ""} onClick={() => setSub("drugs")}>
          Препараты
        </button>
        <button type="button" className={sub === "groups" ? "active" : ""} onClick={() => setSub("groups")}>
          Группы
        </button>
      </div>
      {sub === "drugs" && <DrugsTab initialItemId={initialItemId || undefined} />}
      {sub === "groups" && <DrugGroupsTab />}
    </div>
  );
}

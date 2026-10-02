import LegacyReference from "@/legacy/components/ReferencePage";
import "@/legacy/legacy.css";
import { AppShell } from "./AppShell";
import { DrugsReference } from "./DrugsReference";
import { GuidelinesReference } from "./GuidelinesReference";
import { RecPacksReference } from "./RecPacksReference";
import { TemplatesEditor } from "./TemplatesEditor";

export function ReferencePage() {
  return (
    <AppShell>
      <div className="legacy-surface min-h-[calc(100dvh-3rem)] bg-paper p-3 pb-24 md:p-6">
        <LegacyReference
          blocksContent={<TemplatesEditor layer="blocks" />}
          packsContent={<TemplatesEditor layer="packs" />}
          globalContent={<TemplatesEditor layer="global" />}
          drugsContent={(props: { initialSub?: "drugs" | "groups"; initialItemId?: string | null }) => (
            <DrugsReference initialSub={props?.initialSub} initialItemId={props?.initialItemId} />
          )}
          recPacksContent={() => <RecPacksReference />}
          guidelinesContent={(props: { initialItemId?: string | null }) => (
            <GuidelinesReference initialItemId={props?.initialItemId} />
          )}
        />
      </div>
    </AppShell>
  );
}
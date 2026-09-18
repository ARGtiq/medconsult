import LegacyReference from "@/legacy/components/ReferencePage";
import "@/legacy/legacy.css";
import { AppShell } from "./AppShell";
import { TemplatesEditor } from "./TemplatesEditor";

export function ReferencePage() {
  return (
    <AppShell>
      <div className="legacy-surface min-h-[calc(100dvh-3rem)] bg-paper p-3 pb-24 md:p-6">
        <LegacyReference templatesContent={<TemplatesEditor />} />
      </div>
    </AppShell>
  );
}

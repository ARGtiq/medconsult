import { useEffect, useState, type ComponentType, type ReactNode } from "react";

type Page = "protocol" | "reference" | "patients" | "settings" | "start";

export function ClientApp({ page }: { page: Page }) {
  const [node, setNode] = useState<ReactNode>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      const { RouterBridge } = await import("./RouterBridge");
      const loaders: Record<Page, () => Promise<ComponentType>> = {
        protocol: () => import("./ProtocolPage").then((m) => m.ProtocolPage),
        reference: () => import("./ReferencePage").then((m) => m.ReferencePage),
        patients: () => import("./PatientsPage").then((m) => m.PatientsPage),
        settings: () => import("./SettingsPage").then((m) => m.SettingsPage),
        start: () => import("./StartPage").then((m) => m.StartPage),
      };
      const PageComp = await loaders[page]();
      if (live) {
        setNode(
          <RouterBridge>
            <PageComp />
          </RouterBridge>,
        );
      }
    })();
    return () => {
      live = false;
    };
  }, [page]);

  if (!node) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-paper text-sm text-mute">
        Загрузка станка…
      </div>
    );
  }
  return node;
}

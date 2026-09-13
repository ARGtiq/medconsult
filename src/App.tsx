import { useEffect, useState } from "react";
import { NavProvider } from "./medconsult/NavContext";
import { PatientsPage } from "./medconsult/PatientsPage";
import { ProtocolPage } from "./medconsult/ProtocolPage";
import { ReferencePage } from "./medconsult/ReferencePage";
import { SettingsPage } from "./medconsult/SettingsPage";
import { StartPage } from "./medconsult/StartPage";
import { useAppStore } from "./medconsult/store";

function pageFromHash() {
  const h = window.location.hash.replace(/^#/, "") || "/";
  return h.startsWith("/") ? h : "/" + h;
}

export default function App() {
  const [path, setPath] = useState(pageFromHash);
  const openOnProtocol = useAppStore((s) => s.settings.openOnProtocol);

  useEffect(() => {
    useAppStore.getState().hydrate();
    const onHash = () => setPath(pageFromHash());
    window.addEventListener("hashchange", onHash);
    if (!window.location.hash) {
      window.location.hash = openOnProtocol ? "#/" : "#/start";
    }
    return () => window.removeEventListener("hashchange", onHash);
  }, [openOnProtocol]);

  function navigate(to: string) {
    window.location.hash = "#" + to;
    setPath(to);
  }

  let page = <ProtocolPage />;
  if (path.startsWith("/reference")) page = <ReferencePage />;
  else if (path.startsWith("/patients")) page = <PatientsPage />;
  else if (path.startsWith("/settings")) page = <SettingsPage />;
  else if (path.startsWith("/start")) page = <StartPage />;

  return (
    <NavProvider path={path === "" ? "/" : path} navigate={navigate}>
      {page}
    </NavProvider>
  );
}

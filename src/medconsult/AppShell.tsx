import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Home,
  Search,
  Settings,
  Users,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import ToastContainer from "@/legacy/components/ToastContainer";
import { initAutoSync } from "@/legacy/lib/autoSync";
import { initTheme } from "@/legacy/lib/theme";
import "@/legacy/legacy.css";
import { CommandPalette } from "./CommandPalette";
import { NavLink, useNav } from "./NavContext";
import { useAppStore } from "./store";

const NAV = [
  { to: "/", label: "протокол", icon: ClipboardList },
  { to: "/reference", label: "справочник", icon: BookOpen },
  { to: "/patients", label: "пациенты", icon: Users },
  { to: "/start", label: "старт", icon: Home },
  { to: "/settings", label: "настройки", icon: Settings },
];

export function AppShell({
  children,
  topRight,
}: {
  children: ReactNode;
  topRight?: ReactNode;
}) {
  const { path: pathname } = useNav();
  const { settings, setSettings, hydrate, hydrated, toast, patients, session } = useAppStore();
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrated, hydrate]);

  useEffect(() => {
    try {
      initTheme();
    } catch {
      /* */
    }
    try {
      return initAutoSync();
    } catch {
      return undefined;
    }
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      const typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === "Escape") setSearchOpen(false);
      if (!typing && (e.ctrlKey || e.metaKey) && e.key === "Enter") {
        window.dispatchEvent(new CustomEvent("medconsult-copy-all"));
      }
      if (!typing && (e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "c") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("medconsult-copy-block"));
      }
      if (!typing && (e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "h") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("medconsult-copy-header"));
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        const st = useAppStore.getState();
        if (st.aiUndo) {
          e.preventDefault();
          st.undoAi();
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const collapsed = settings.railCollapsed;
  const patient = patients.find((p) => p.id === session.patientId);

  return (
    <div className="flex min-h-dvh bg-paper text-ink">
      <aside
        className={`sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-line bg-rail md:flex ${
          collapsed ? "w-16 items-center px-2 py-3" : "w-48 px-3 py-4"
        }`}
      >
        <div className={`mb-4 flex items-center gap-2 ${collapsed ? "justify-center" : "px-1"}`}>
          <span className="rounded-md border-[1.5px] border-teal px-1.5 font-display text-sm font-bold text-teal">
            Rx
          </span>
          {!collapsed && (
            <div>
              <div className="font-display text-sm font-semibold">MedConsult</div>
              <div className="text-[10px] text-mute">текст → буфер</div>
            </div>
          )}
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                title={item.label}
                className={`flex items-center rounded-lg text-sm font-medium transition ${
                  collapsed ? "h-11 w-12 flex-col justify-center gap-0.5 px-0" : "gap-2 px-2.5 py-2"
                } ${active ? "bg-teal-soft text-teal" : "text-ink hover:bg-teal-soft/50"} ${
                  item.to === "/start" && !active ? "text-mute" : ""
                }`}
              >
                <Icon className="size-4" strokeWidth={1.75} />
                <span className={collapsed ? "text-[9px] leading-none" : ""}>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
        <button
          type="button"
          className="mt-auto flex h-8 w-full items-center justify-center rounded-lg border border-line bg-surface text-mute"
          onClick={() => setSettings({ railCollapsed: !collapsed })}
          aria-label={collapsed ? "Развернуть меню" : "Свернуть меню"}
        >
          {collapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
        </button>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 items-center gap-3 border-b border-line bg-surface px-3">
          {patient && (
            <div className="truncate text-sm text-ink-soft">
              {patient.lastName} {patient.firstName.split(" ").map((p) => p[0] + ".").join(" ")} {patient.age}
              {patient.allergies?.length ? (
                <span className="ml-2 rounded bg-warn px-1.5 text-[10px] font-semibold text-ink">
                  аллергия
                </span>
              ) : null}
            </div>
          )}
          <div className="flex-1" />
          {topRight}
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="hidden items-center gap-2 rounded-full border border-line bg-paper px-3 py-1.5 text-xs text-mute sm:flex"
          >
            <Search className="size-3.5" />
            Ctrl+K вставить
          </button>
        </header>
        <div className="min-h-0 flex-1">{children}</div>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 flex justify-around border-t border-line bg-surface px-2 pb-3 pt-2 md:hidden">
        {NAV.filter((n) => n.to !== "/start").map((item) => {
          const Icon = item.icon;
          const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={`flex min-w-14 flex-col items-center gap-1 text-[11px] ${
                active ? "text-teal" : "text-ink-soft"
              }`}
            >
              <Icon className="size-5" />
              {item.label}
            </NavLink>
          );
        })}
      </nav>

      {toast && (
        <div className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-ink px-4 py-2 text-sm text-paper shadow-lg md:bottom-6">
          {toast}
        </div>
      )}
      <div className="legacy-surface">
        <ToastContainer />
      </div>
      {searchOpen && <CommandPalette onClose={() => setSearchOpen(false)} />}
    </div>
  );
}

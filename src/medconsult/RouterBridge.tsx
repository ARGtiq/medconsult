import { useNavigate, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { LockGate } from "./LockGate";
import { NavProvider } from "./NavContext";

export function RouterBridge({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  return (
    <LockGate>
      <NavProvider path={path} navigate={(to) => navigate({ to })}>
        {children}
      </NavProvider>
    </LockGate>
  );
}

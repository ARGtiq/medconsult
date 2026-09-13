import { createContext, useContext, type ReactNode } from "react";

type Nav = {
  path: string;
  navigate: (to: string) => void;
};

const NavContext = createContext<Nav>({ path: "/", navigate: () => {} });

export function NavProvider({ path, navigate, children }: Nav & { children: ReactNode }) {
  return <NavContext.Provider value={{ path, navigate }}>{children}</NavContext.Provider>;
}

export function useNav() {
  return useContext(NavContext);
}

export function NavLink({
  to,
  className,
  title,
  children,
}: {
  to: string;
  className?: string;
  title?: string;
  children: ReactNode;
}) {
  const { navigate } = useNav();
  return (
    <a
      href={to}
      title={title}
      className={className}
      onClick={(e) => {
        e.preventDefault();
        navigate(to);
      }}
    >
      {children}
    </a>
  );
}

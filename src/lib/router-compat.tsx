import type { ReactNode } from "react";
import {
  Link as TanstackLink,
  Outlet as TanstackOutlet,
  useLocation as useTanstackLocation,
  useNavigate as useTanstackNavigate,
  useParams as useTanstackParams,
} from "@tanstack/react-router";

/**
 * Camada de compatibilidade: expõe a API do react-router-dom usada pelo
 * sistema original, implementada sobre o TanStack Router.
 */

type AnyLink = React.ComponentType<Record<string, unknown>>;
const RawLink = TanstackLink as unknown as AnyLink;

export const Outlet = TanstackOutlet;

/** "/rota?a=1" → caminho e search separados (o TanStack não aceita a query dentro do `to`). */
function separar(to: string): { to: string; search?: Record<string, string> } {
  const i = to.indexOf("?");
  if (i < 0) return { to };
  return { to: to.slice(0, i), search: Object.fromEntries(new URLSearchParams(to.slice(i + 1))) };
}

export function Link({
  to,
  children,
  ...rest
}: {
  to: string;
  children?: ReactNode;
  [key: string]: unknown;
}) {
  return (
    <RawLink {...separar(to)} {...rest}>
      {children}
    </RawLink>
  );
}

type NavLinkRender = ReactNode | ((state: { isActive: boolean }) => ReactNode);

export function NavLink({
  to,
  end,
  className,
  style,
  children,
  ...rest
}: {
  to: string;
  end?: boolean;
  className?: string | ((state: { isActive: boolean }) => string);
  style?: React.CSSProperties | ((state: { isActive: boolean }) => React.CSSProperties);
  children?: NavLinkRender;
  [key: string]: unknown;
}) {
  const { pathname, searchStr } = useTanstackLocation();
  const alvo = separar(to);
  // Item com query (ex.: Rotograma) só fica ativo com a mesma query.
  const mesmaQuery = alvo.search ? searchStr === `?${to.split("?")[1]}` : true;
  const isActive =
    (end ? pathname === alvo.to : pathname === alvo.to || pathname.startsWith(`${alvo.to}/`)) &&
    mesmaQuery;
  const state = { isActive };

  return (
    <RawLink
      {...alvo}
      className={typeof className === "function" ? className(state) : className}
      style={typeof style === "function" ? style(state) : style}
      {...rest}
    >
      {typeof children === "function" ? children(state) : children}
    </RawLink>
  );
}

export function useNavigate() {
  const navigate = useTanstackNavigate();
  return (to: string | number, options?: { replace?: boolean }) => {
    if (typeof to === "number") {
      if (typeof window !== "undefined") window.history.go(to);
      return;
    }
    navigate({ to, replace: options?.replace } as never);
  };
}

export function useLocation() {
  return useTanstackLocation();
}

export function useParams<T extends Record<string, string>>() {
  return useTanstackParams({ strict: false }) as unknown as Partial<T>;
}

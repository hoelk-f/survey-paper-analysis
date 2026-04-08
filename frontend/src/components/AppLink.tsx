import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from "react";

import { navigateTo, type RoutePath } from "../navigation";

interface AppLinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  children: ReactNode;
  to: RoutePath;
}

export function AppLink({ children, onClick, target, to, ...props }: AppLinkProps) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);

    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      target === "_blank"
    ) {
      return;
    }

    event.preventDefault();
    navigateTo(to);
  };

  return (
    <a {...props} href={to} onClick={handleClick} target={target}>
      {children}
    </a>
  );
}

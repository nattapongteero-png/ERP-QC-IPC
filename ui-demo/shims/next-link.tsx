import * as React from 'react';

/** next/link stub — renders a plain anchor that goes nowhere. */
export default function Link({
  href,
  children,
  ...rest
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  return (
    <a {...rest} href={href} onClick={(e) => e.preventDefault()}>
      {children}
    </a>
  );
}

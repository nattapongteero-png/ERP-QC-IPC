import * as React from 'react';
import { useRouter } from './next-navigation';

/** next/link stub — routes through the demo's screen switcher. */
export default function Link({
  href,
  children,
  ...rest
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  const router = useRouter();
  return (
    <a
      {...rest}
      href={href}
      onClick={(e) => {
        e.preventDefault();
        router.push(href);
      }}
    >
      {children}
    </a>
  );
}

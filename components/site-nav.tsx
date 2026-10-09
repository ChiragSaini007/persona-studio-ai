"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const links = [
  { href: "/demo/fan", label: "Demo" },
  { href: "/creator", label: "Creator studio" },
];

export function SiteNav({ className = "product-nav", children }: { className?: string; children?: ReactNode }) {
  const pathname = usePathname() || "";
  return (
    <nav className={className} aria-label="Main">
      <Link href="/" className="wordmark">
        Fanline
      </Link>
      <div>
        {links.map((link) => (
          <Link key={link.href} href={link.href} aria-current={pathname.startsWith(link.href) ? "page" : undefined}>
            {link.label}
          </Link>
        ))}
        {children}
      </div>
    </nav>
  );
}

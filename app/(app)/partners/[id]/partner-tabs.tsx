"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function PartnerTabs({ partnerId }: { partnerId: string }) {
  const pathname = usePathname();
  const base = `/partners/${partnerId}`;
  const tabs = [
    { label: "Overview", href: base },
    { label: "Upload", href: `${base}/upload` },
    { label: "Mappings", href: `${base}/mappings` },
    { label: "Settings", href: `${base}/settings` },
  ];

  return (
    <nav className="flex gap-1 -mb-3">
      {tabs.map((t) => {
        const active =
          t.href === base ? pathname === base : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "px-3 py-2 text-sm rounded-t-md border-b-2 transition",
              active
                ? "border-foreground font-medium"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

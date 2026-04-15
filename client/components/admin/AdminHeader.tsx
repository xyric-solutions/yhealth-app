"use client";

import { usePathname } from "next/navigation";
import { Home, ChevronRight } from "lucide-react";
import Link from "next/link";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

function getBreadcrumbs(pathname: string): BreadcrumbItem[] {
  const segments = pathname.split("/").filter(Boolean);
  const breadcrumbs: BreadcrumbItem[] = [
    { label: "Admin", href: "/admin" },
  ];

  if (segments.length > 1) {
    const section = segments[1];
    const sectionLabel = section.charAt(0).toUpperCase() + section.slice(1);
    breadcrumbs.push({
      label: sectionLabel,
      href: `/admin/${section}`,
    });

    if (segments.length > 2) {
      const action = segments[2];
      if (action !== "create" && action !== "edit") {
        breadcrumbs.push({
          label: action.charAt(0).toUpperCase() + action.slice(1),
        });
      } else {
        const actionLabel =
          action === "create" ? "Create" : "Edit";
        breadcrumbs.push({ label: actionLabel });
      }
    }
  }

  return breadcrumbs;
}

export function AdminHeader() {
  const pathname = usePathname();
  const breadcrumbs = getBreadcrumbs(pathname);

  return (
    <header className="sticky top-0 z-30  w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center gap-4 px-6 ">
        <nav className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link
            href="/admin"
            className="flex items-center gap-1 hover:text-foreground transition-colors"
          >
            <Home className="w-4 h-4" />
          </Link>
          {breadcrumbs.map((crumb, index) => (
            <div key={index} className="flex items-center gap-2">
              <ChevronRight className="w-4 h-4" />
              {crumb.href ? (
                <Link
                  href={crumb.href}
                  className="hover:text-foreground transition-colors"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-foreground font-medium">
                  {crumb.label}
                </span>
              )}
            </div>
          ))}
        </nav>
      </div>
    </header>
  );
}


"use client";

import type { ReactNode } from "react";
import LanguageSelector from "@/app/i18n/LanguageSelector";
import ThemeToggle from "@/app/theme/ThemeToggle";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import WorkspaceSwitcher from "@/components/shell/WorkspaceSwitcher";
import { productBrand } from "@/lib/product/brand";

export default function AppHeader({
  title,
  userLabel,
  onSignOut,
  onOpenNav,
  showAdmin,
  contextSlot,
}: {
  title: string;
  userLabel: string;
  onSignOut?: () => void;
  onOpenNav: () => void;
  showAdmin?: boolean;
  contextSlot?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-30 flex min-h-[var(--nx-header)] items-center gap-3 border-b border-line bg-[color-mix(in_srgb,var(--nx-bg)_88%,transparent)] px-3 py-2 backdrop-blur-md sm:px-5">
      <Button variant="icon" className="md:hidden" aria-label="Open navigation" onClick={onOpenNav}>
        <Icon name="menu" />
      </Button>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">{title}</p>
        <p className="hidden truncate text-xs text-muted sm:block">{productBrand.tagline}</p>
      </div>
      <div className="hidden min-w-0 lg:block">
        <WorkspaceSwitcher />
      </div>
      {contextSlot}
      <ThemeToggle />
      <div className="hidden sm:block">
        <LanguageSelector id="header-ui-language" compact />
      </div>
      {showAdmin ? (
        <a
          href="/admin"
          className="focus-ring hidden rounded-[var(--nx-radius-sm)] border border-line px-2.5 py-1.5 text-xs text-[var(--nx-text-secondary)] hover:text-ink sm:inline-flex"
        >
          Admin
        </a>
      ) : null}
      <div className="hidden items-center gap-2 md:flex">
        <span className="max-w-[10rem] truncate text-xs text-muted" title={userLabel}>
          {userLabel}
        </span>
        {onSignOut ? (
          <Button variant="ghost" size="sm" onClick={onSignOut}>
            Sign out
          </Button>
        ) : null}
      </div>
    </header>
  );
}

"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";
import AppHeader from "@/components/shell/AppHeader";
import Sidebar, { persistSidebarCollapsed, readSidebarCollapsed, subscribeSidebar } from "@/components/shell/Sidebar";
import WorkspaceSwitcher from "@/components/shell/WorkspaceSwitcher";
import { pageTitleForTab, type Tab } from "@/lib/ui/nav";

export default function AppShell({
  tab,
  onSelect,
  userLabel,
  onSignOut,
  showAdmin,
  children,
}: {
  tab: Tab;
  onSelect: (tab: Tab) => void;
  userLabel: string;
  onSignOut?: () => void;
  showAdmin?: boolean;
  children: ReactNode;
}) {
  const collapsed = useSyncExternalStore(subscribeSidebar, readSidebarCollapsed, () => false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [heading, setHeading] = useState(() => pageTitleForTab(tab));

  function select(next: Tab, label: string) {
    onSelect(next);
    setHeading(label);
    setMobileOpen(false);
  }

  return (
    <div className="flex min-h-screen bg-bg text-ink" data-app>
      <Sidebar
        tab={tab}
        activeLabel={heading}
        onSelect={select}
        collapsed={collapsed}
        onCollapsedChange={persistSidebarCollapsed}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader
          title={heading}
          userLabel={userLabel}
          onSignOut={onSignOut}
          onOpenNav={() => setMobileOpen(true)}
          showAdmin={showAdmin}
        />
        <div className="border-b border-line px-3 py-3 lg:hidden">
          <WorkspaceSwitcher compact={false} />
        </div>
        <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</div>
      </div>
    </div>
  );
}

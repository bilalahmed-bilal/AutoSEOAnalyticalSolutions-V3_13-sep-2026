"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/ui/cn";
import { productBrand } from "@/lib/product/brand";
import { navItemIsActive, SIDEBAR_SECTIONS, type NavItem, type Tab } from "@/lib/ui/nav";
import Image from "next/image";

const COLLAPSE_KEY = "nexora.sidebarCollapsed";
const COLLAPSE_EVENT = "nexora-sidebar";

export function readSidebarCollapsed() {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
}

export function persistSidebarCollapsed(value: boolean) {
  try {
    window.localStorage.setItem(COLLAPSE_KEY, value ? "1" : "0");
    window.dispatchEvent(new Event(COLLAPSE_EVENT));
  } catch {
    // ignore
  }
}

export function subscribeSidebar(onStoreChange: () => void) {
  window.addEventListener(COLLAPSE_EVENT, onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    window.removeEventListener(COLLAPSE_EVENT, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

export default function Sidebar({
  tab,
  activeLabel,
  onSelect,
  collapsed,
  onCollapsedChange,
  mobileOpen,
  onMobileClose,
}: {
  tab: Tab;
  activeLabel?: string;
  onSelect: (tab: Tab, label: string) => void;
  collapsed: boolean;
  onCollapsedChange: (value: boolean) => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}) {
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const nav = SIDEBAR_SECTIONS;

  function isGroupOpen(item: NavItem) {
    if (openGroups[item.label] !== undefined) return openGroups[item.label];
    return navItemIsActive(item, tab);
  }

  function toggleGroup(item: NavItem) {
    setOpenGroups((current) => ({ ...current, [item.label]: !isGroupOpen(item) }));
    if (item.navigateOnToggle !== false) onSelect(item.id, item.label);
  }

  const content = (
    <div className="flex h-full flex-col">
      <div className={cn("flex items-center gap-2 px-4 py-4", collapsed && "justify-center px-2")}>
        <Image
          src={productBrand.logo}
          alt={productBrand.productName}
          width={32}
          height={32}
          className="h-8 w-8 rounded-lg"
          unoptimized
        />
        {!collapsed ? (
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold tracking-tight text-ink">{productBrand.productName}</div>
            <div className="truncate text-[11px] text-muted">Free Beta</div>
          </div>
        ) : null}
      </div>
      <nav className="flex-1 overflow-y-auto px-2 pb-4" aria-label="Primary">
        {nav.map((section) => (
          <div key={section.id} className="mb-4">
            {!collapsed ? (
              <p className="nx-label px-2 pb-1.5">{section.label}</p>
            ) : (
              <div className="mx-2 mb-2 h-px bg-[var(--nx-border)]" />
            )}
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active = item.children
                  ? navItemIsActive(item, tab)
                  : item.id === tab && (!activeLabel || item.label === activeLabel);
                const expanded = isGroupOpen(item);
                return (
                  <li key={`${section.id}-${item.label}`}>
                    <button
                      type="button"
                      title={item.label}
                      onClick={() => (item.children ? toggleGroup(item) : onSelect(item.id, item.label))}
                      className={cn(
                        "focus-ring flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left text-sm transition-colors",
                        collapsed && "justify-center px-0",
                        active
                          ? "bg-[color-mix(in_srgb,var(--nx-primary)_12%,transparent)] text-ink"
                          : "text-[var(--nx-text-secondary)] hover:bg-[color-mix(in_srgb,var(--nx-text)_5%,transparent)] hover:text-ink"
                      )}
                      aria-current={active && !item.children ? "page" : undefined}
                      aria-expanded={item.children ? expanded : undefined}
                    >
                      <Icon name={item.icon} className={cn("h-4 w-4", active ? "text-primary" : "text-current")} />
                      {!collapsed ? (
                        <>
                          <span className="min-w-0 flex-1 truncate">{item.label}</span>
                          {item.children ? (
                            <Icon
                              name="chevron"
                              className={cn("h-3.5 w-3.5 text-muted transition-transform", expanded && "rotate-180")}
                            />
                          ) : null}
                        </>
                      ) : null}
                    </button>
                    {!collapsed && item.children && expanded ? (
                      <ul
                        className="mx-1 mb-1 ml-4 mt-1 space-y-0.5 rounded-[10px] border border-[var(--nx-subnav-border)] bg-[var(--nx-subnav-bg)] p-1.5 pl-2 shadow-[var(--nx-shadow-subtle)]"
                        aria-label={`${item.label} submenu`}
                      >
                        {item.children.map((child, index) => {
                          const previousGroup = item.children?.[index - 1]?.group;
                          const showGroup = Boolean(child.group && child.group !== previousGroup);
                          return (
                            <li key={`${child.group || "item"}-${child.id}-${child.label}`}>
                              {showGroup ? <p className="nx-label px-2.5 pb-1 pt-2">{child.group}</p> : null}
                              <button
                                type="button"
                                onClick={() => onSelect(child.id, child.label)}
                                className={cn(
                                  "focus-ring w-full rounded-[8px] px-2.5 py-1.5 text-left text-[13px] transition-colors",
                                  tab === child.id && (!activeLabel || child.label === activeLabel)
                                    ? "bg-[color-mix(in_srgb,var(--nx-primary)_12%,transparent)] font-medium text-ink"
                                    : "text-[var(--nx-text-secondary)] hover:bg-[color-mix(in_srgb,var(--nx-primary)_6%,transparent)] hover:text-ink"
                                )}
                                aria-current={
                                  tab === child.id && (!activeLabel || child.label === activeLabel) ? "page" : undefined
                                }
                              >
                                {child.label}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className={cn("hidden border-t border-line p-2 md:block", collapsed && "flex justify-center")}>
        <button
          type="button"
          className="focus-ring flex w-full items-center justify-center gap-2 rounded-[10px] px-2 py-2 text-xs text-muted hover:text-ink"
          onClick={() => onCollapsedChange(!collapsed)}
          aria-pressed={collapsed}
        >
          {collapsed ? "»" : "Collapse"}
        </button>
      </div>
    </div>
  );

  return (
    <>
      <aside
        className={cn(
          "sticky top-0 hidden h-screen shrink-0 border-r border-line bg-[color-mix(in_srgb,var(--nx-surface)_92%,var(--nx-bg))] md:block",
          collapsed ? "w-[var(--nx-sidebar-collapsed)]" : "w-[var(--nx-sidebar)]"
        )}
      >
        {content}
      </aside>
      {mobileOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-[var(--nx-overlay)]"
            aria-label="Close navigation"
            onClick={onMobileClose}
          />
          <aside className="relative h-full w-[min(20rem,88vw)] border-r border-line bg-surface shadow-[var(--nx-shadow-elevated)]">
            <div className="flex justify-end p-2">
              <button
                type="button"
                className="focus-ring rounded-[10px] p-2 text-muted"
                onClick={onMobileClose}
                aria-label="Close navigation"
              >
                <Icon name="close" />
              </button>
            </div>
            {content}
          </aside>
        </div>
      ) : null}
    </>
  );
}

"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useCallback, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  RiDashboardFill,
  RiSettings4Fill,
  RiPulseFill,
  RiTrophyFill,
  RiNotification3Fill,
  RiChat3Fill,
  RiLineChartFill,
  RiArrowLeftSLine,
  RiArrowRightSLine,
  RiLogoutCircleRLine,
  RiBoxingFill,
  RiRestaurantFill,
  RiRobotFill,
  RiMicFill,
  RiFlowerFill,
  RiMedalFill,
  RiTeamFill,
  RiShieldCheckFill,
  RiBookReadFill,
  RiEmotionHappyFill,
  RiLeafFill,
  RiMenuFill,
  RiCloseFill,
  RiMindMap,
  RiMore2Fill,
  RiQuestionAnswerFill,
  RiSearchLine,
  RiArrowDownSLine,
  RiCrosshairFill,
  RiCompassFill,
  RiBookOpenFill,
  RiCalendarCheckFill,
  RiHeartPulseFill,
  RiHeadphoneFill,
  RiLightbulbFill,
  RiBankFill,
  RiSparklingFill,
  RiPhoneFill,
  RiUserFill,
  RiEqualizerFill,
} from "react-icons/ri";
import Image from "next/image";
import { useAuth } from "@/app/context/AuthContext";
import { cn } from "@/lib/utils";
import { useUnreadCount } from "@/hooks/use-unread-count";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  href: string;
  badge?: string;
  unreadCount?: number;
  isPrimary?: boolean;
}

interface NavSection {
  id: string;
  label: string;
  items: NavItem[];
  collapsible?: boolean;
}

// ---------------------------------------------------------------------------
// Navigation data
// ---------------------------------------------------------------------------

const S18 = "w-[18px] h-[18px]";
const S20 = "w-5 h-5";

const primaryItems: NavItem[] = [
  { id: "overview", label: "Overview", icon: <RiDashboardFill className={S20} />, href: "/dashboard", isPrimary: true },
  { id: "ai-coach", label: "AI Coach", icon: <RiRobotFill className={S20} />, href: "/ai-coach", badge: "AI", isPrimary: true },
  { id: "workouts", label: "Workouts", icon: <RiBoxingFill className={S20} />, href: "/workouts", badge: "AI", isPrimary: true },
];

const sections: NavSection[] = [
  {
    id: "health-fitness",
    label: "Health & Fitness",
    items: [
      { id: "nutrition", label: "Nutrition", icon: <RiRestaurantFill className={S18} />, href: "/nutrition", badge: "AI" },
      { id: "exercises", label: "Exercises", icon: <RiBookOpenFill className={S18} />, href: "/exercises", badge: "1.5K" },
      { id: "progress", label: "Progress", icon: <RiLineChartFill className={S18} />, href: "/progress" },
      { id: "activity", label: "Activity", icon: <RiPulseFill className={S18} />, href: "/activity" },
      { id: "activity-status", label: "Activity Status", icon: <RiCalendarCheckFill className={S18} />, href: "/activity-status" },
      { id: "whoop", label: "Whoop", icon: <RiHeartPulseFill className={S18} />, href: "/whoop" },
      { id: "achievements", label: "Achievements", icon: <RiTrophyFill className={S18} />, href: "/achievements" },
    ],
  },
  {
    id: "wellness",
    label: "Wellness",
    items: [
      { id: "wellbeing", label: "Wellbeing", icon: <RiFlowerFill className={S18} />, href: "/wellbeing" },
      { id: "journal", label: "Journal", icon: <RiBookReadFill className={S18} />, href: "/wellbeing/journal" },
      { id: "mood", label: "Mood", icon: <RiEmotionHappyFill className={S18} />, href: "/wellbeing/mood" },
      { id: "insights", label: "Insights", icon: <RiLightbulbFill className={S18} />, href: "/wellbeing/insights" },
      { id: "yoga", label: "Yoga", icon: <RiLeafFill className={S18} />, href: "/yoga" },
      { id: "soundscape", label: "Pulse", icon: <RiHeadphoneFill className={S18} />, href: "/soundscape" },
    ],
  },
  {
    id: "social",
    label: "Social & Goals",
    items: [
      { id: "goals", label: "Goals", icon: <RiCrosshairFill className={S18} />, href: "/goals" },
      { id: "life-areas", label: "Life Areas", icon: <RiCompassFill className={S18} />, href: "/life-areas" },
      { id: "leaderboard", label: "Leaderboard", icon: <RiMedalFill className={S18} />, href: "/leaderboard" },
      { id: "competitions", label: "Competitions", icon: <RiTeamFill className={S18} />, href: "/competitions" },
      { id: "knowledge-graph", label: "Knowledge Graph", icon: <RiMindMap className={S18} />, href: "/knowledge-graph" },
    ],
  },
  {
    id: "communicate",
    label: "Communicate",
    collapsible: true,
    items: [
      { id: "chat", label: "Chat", icon: <RiChat3Fill className={S18} />, href: "/chat" },
      { id: "voice-assistant", label: "Voice Assistant", icon: <RiMicFill className={S18} />, href: "/voice-assistant" },
      { id: "voice-call", label: "Call Coach", icon: <RiPhoneFill className={S18} />, href: "/voice-call" },
      { id: "notifications", label: "Notifications", icon: <RiNotification3Fill className={S18} />, href: "/notifications" },
    ],
  },
  {
    id: "finance",
    label: "Finance",
    collapsible: true,
    items: [
      { id: "money-map", label: "Money Map", icon: <RiBankFill className={S18} />, href: "/money-map", badge: "NEW" },
    ],
  },
];

const utilityItems: NavItem[] = [
  { id: "profile", label: "Profile", icon: <RiUserFill className={S18} />, href: "/profile" },
  { id: "preferences", label: "Preferences", icon: <RiEqualizerFill className={S18} />, href: "/preferences" },
  { id: "settings", label: "Settings", icon: <RiSettings4Fill className={S18} />, href: "/settings" },
  { id: "help", label: "Help", icon: <RiQuestionAnswerFill className={S18} />, href: "/help" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getBadgeStyle(badge: string) {
  if (badge === "AI") return "bg-violet-500/15 text-violet-400 border border-violet-500/20";
  return "bg-white/[0.06] text-slate-400 border border-white/[0.06]";
}

/** Flatten all navigable items for search filtering. */
function getAllItems(isAdmin: boolean): NavItem[] {
  const all = [
    ...primaryItems,
    ...sections.flatMap((s) => s.items),
    ...utilityItems,
  ];
  if (isAdmin) {
    all.push({ id: "admin-panel", label: "Admin Panel", icon: <RiShieldCheckFill className={S18} />, href: "/admin" });
  }
  return all;
}

function resolveActiveId(pathname: string): string | null {
  if (pathname === "/dashboard") {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      return params.get("tab") || "overview";
    }
    return "overview";
  }
  // Order matters: more-specific paths first
  if (pathname.startsWith("/knowledge-graph")) return "knowledge-graph";
  if (pathname.startsWith("/workouts")) return "workouts";
  if (pathname.startsWith("/nutrition")) return "nutrition";
  if (pathname.startsWith("/progress")) return "progress";
  if (pathname.startsWith("/ai-coach")) return "ai-coach";
  if (pathname.startsWith("/chat-history")) return "chat-history";
  if (pathname.startsWith("/chat")) return "chat";
  if (pathname.startsWith("/voice-call")) return "voice-call";
  if (pathname.startsWith("/voice-assistant")) return "voice-assistant";
  if (pathname.startsWith("/activity-status")) return "activity-status";
  if (pathname.startsWith("/activity")) return "activity";
  if (pathname.startsWith("/achievements")) return "achievements";
  if (pathname.startsWith("/wellbeing/journal")) return "journal";
  if (pathname.startsWith("/wellbeing/mood")) return "mood";
  if (pathname.startsWith("/wellbeing")) return "wellbeing";
  if (pathname.startsWith("/yoga")) return "yoga";
  if (pathname.startsWith("/notifications")) return "notifications";
  if (pathname.startsWith("/settings")) return "settings";
  if (pathname.startsWith("/help")) return "help";
  if (pathname.startsWith("/competitions")) return "competitions";
  if (pathname.startsWith("/leaderboard")) return "leaderboard";
  if (pathname.startsWith("/wellbeing/insights")) return "insights";
  if (pathname.startsWith("/exercises")) return "exercises";
  if (pathname.startsWith("/whoop")) return "whoop";
  if (pathname.startsWith("/soundscape")) return "soundscape";
  if (pathname.startsWith("/money-map")) return "money-map";
  if (pathname.startsWith("/goals")) return "goals";
  if (pathname.startsWith("/profile")) return "profile";
  if (pathname.startsWith("/preferences")) return "preferences";
  if (pathname.startsWith("/admin")) return "admin-panel";
  return null;
}

// ---------------------------------------------------------------------------
// Shared collapsed-sections persistence
// ---------------------------------------------------------------------------

const COLLAPSED_KEY = "sidebar-collapsed-sections";
const DEFAULT_COLLAPSED = new Set(["communicate"]);

function loadCollapsed(): Set<string> {
  if (typeof window === "undefined") return new Set(DEFAULT_COLLAPSED);
  try {
    const raw = localStorage.getItem(COLLAPSED_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set(DEFAULT_COLLAPSED);
  } catch {
    return new Set(DEFAULT_COLLAPSED);
  }
}

function saveCollapsed(s: Set<string>) {
  try {
    localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...s]));
  } catch {
    // silent
  }
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface DashboardSidebarProps {
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  onCollapsedChange?: (collapsed: boolean) => void;
  disabled?: boolean;
}

// ===========================================================================
// Desktop Sidebar
// ===========================================================================

export function DashboardSidebar({
  activeTab,
  onTabChange,
  onCollapsedChange,
  disabled: _disabled,
}: DashboardSidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(loadCollapsed);
  const searchRef = useRef<HTMLInputElement>(null);
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { unreadCount: chatUnreadCount } = useUnreadCount();

  const isSearching = searchQuery.trim().length > 0;
  const isAdmin = user?.role?.toLowerCase() === "admin";
  const activeId = activeTab || resolveActiveId(pathname);

  // Cmd+K / Ctrl+K to focus search
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (isCollapsed) {
          setIsCollapsed(false);
          onCollapsedChange?.(false);
        }
        searchRef.current?.focus();
      }
      if (e.key === "Escape") {
        setSearchQuery("");
        searchRef.current?.blur();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isCollapsed, onCollapsedChange]);

  // Persist collapsed sections
  useEffect(() => {
    saveCollapsed(collapsedSections);
  }, [collapsedSections]);

  const toggleSection = (id: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const handleNavClick = (item: NavItem, e: React.MouseEvent) => {
    if (onTabChange && item.href.includes("?tab=")) {
      e.preventDefault();
      const tab = item.href.split("?tab=")[1];
      router.push(`/dashboard?tab=${tab}`);
      onTabChange(tab);
    }
  };

  // Enrich chat item with unread count
  const enrich = (item: NavItem): NavItem =>
    item.id === "chat" ? { ...item, unreadCount: chatUnreadCount } : item;

  // Filter items by search
  const matchesSearch = (item: NavItem) =>
    !isSearching || item.label.toLowerCase().includes(searchQuery.toLowerCase());

  // ---- Render helpers ----

  const renderItem = (item: NavItem) => {
    const enriched = enrich(item);
    const isActive = activeId === enriched.id;
    const h = enriched.isPrimary ? "h-9" : "h-8";

    return (
      <Link
        key={enriched.id}
        href={enriched.href}
        onClick={(e) => handleNavClick(enriched, e)}
        data-tour={enriched.id}
        className={cn(
          "relative flex items-center gap-2.5 px-3 rounded-[10px] text-[13px] font-medium",
          "transition-colors duration-150 cursor-pointer group",
          h,
          isActive
            ? "bg-sky-600/[0.08] text-white"
            : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]"
        )}
      >
        {/* Active indicator bar */}
        {isActive && (
          <motion.div
            layoutId="sidebarActiveIndicator"
            className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-sky-600"
            transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
          />
        )}

        {/* Icon */}
        <span className={cn("flex-shrink-0 flex items-center justify-center", enriched.isPrimary ? "w-5 h-5" : "w-[18px] h-[18px]")}>
          {enriched.icon}
        </span>

        {/* Label */}
        {!isCollapsed && <span className="truncate flex-1 text-left">{enriched.label}</span>}

        {/* Badge */}
        {!isCollapsed && enriched.badge && (
          <span className={cn("px-1.5 py-px text-[9px] font-semibold rounded-[4px] leading-tight", getBadgeStyle(enriched.badge))}>
            {enriched.badge}
          </span>
        )}

        {/* Unread count */}
        {enriched.unreadCount !== undefined && enriched.unreadCount > 0 && (
          <span className={cn(
            "min-w-[16px] h-[16px] px-1 flex items-center justify-center text-[9px] font-bold rounded-full bg-red-500 text-white",
            isCollapsed && "absolute -top-0.5 -right-0.5"
          )}>
            {enriched.unreadCount > 99 ? "99+" : enriched.unreadCount}
          </span>
        )}

        {/* Tooltip (collapsed) */}
        {isCollapsed && (
          <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-[#1a1a2e] border border-white/[0.08] text-white text-xs font-medium rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50 shadow-xl flex items-center gap-2">
            {enriched.label}
            {enriched.badge && (
              <span className={cn("px-1 py-px text-[9px] font-semibold rounded-[3px]", getBadgeStyle(enriched.badge))}>
                {enriched.badge}
              </span>
            )}
          </div>
        )}
      </Link>
    );
  };

  const renderSectionHeader = (section: NavSection) => {
    if (isCollapsed) return <div className="mx-auto my-1.5 w-6 h-px bg-white/[0.06] rounded-full" />;
    const isSectionCollapsed = collapsedSections.has(section.id);
    return (
      <button
        type="button"
        onClick={section.collapsible ? () => toggleSection(section.id) : undefined}
        className={cn(
          "w-full flex items-center justify-between pl-3 pr-2 pt-1 pb-1.5",
          section.collapsible && "cursor-pointer hover:text-slate-400"
        )}
      >
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600 select-none">
          {section.label}
        </span>
        {section.collapsible && (
          <motion.span animate={{ rotate: isSectionCollapsed ? -90 : 0 }} transition={{ duration: 0.15 }}>
            <RiArrowDownSLine className="w-3.5 h-3.5 text-slate-600" />
          </motion.span>
        )}
      </button>
    );
  };

  // When searching, show flat filtered list
  if (isSearching && !isCollapsed) {
    const filtered = getAllItems(isAdmin).filter(matchesSearch).map(enrich);
    return (
      <motion.aside
        initial={false}
        animate={{ width: 260 }}
        className="fixed left-0 top-0 h-screen bg-[#0a0a14] border-r border-white/[0.04] flex flex-col z-40"
      >
        {renderHeader(false, setIsCollapsed, onCollapsedChange)}
        {renderSearchInput(searchQuery, setSearchQuery, searchRef, false)}
        <nav className="flex-1 overflow-y-auto py-2 px-2.5 space-y-0.5 scrollbar-thin scrollbar-thumb-white/[0.06] scrollbar-track-transparent">
          {filtered.length > 0 ? filtered.map(renderItem) : (
            <p className="px-3 py-6 text-xs text-slate-600 text-center">No results</p>
          )}
        </nav>
        {renderFooter(user, isCollapsed, handleLogout)}
      </motion.aside>
    );
  }

  return (
    <motion.aside
      initial={false}
      animate={{ width: isCollapsed ? 64 : 260 }}
      transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
      className="fixed left-0 top-0 h-screen bg-[#0a0a14] border-r border-white/[0.04] flex flex-col z-40"
    >
      {renderHeader(isCollapsed, setIsCollapsed, onCollapsedChange)}

      {/* Search (expanded only) */}
      {!isCollapsed && (
        <div className="flex-shrink-0 px-3 pt-2.5 pb-1">
          <div className="relative">
            <RiSearchLine className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600" />
            <input
              ref={searchRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search...  ⌘K"
              className="w-full h-8 pl-8 pr-3 rounded-lg text-[12px] font-medium bg-white/[0.03] border border-white/[0.06] text-slate-300 placeholder-slate-600 focus:outline-none focus:border-sky-600/30 focus:bg-white/[0.05] transition-colors"
            />
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2 px-2.5 space-y-3 scrollbar-thin scrollbar-thumb-white/[0.06] scrollbar-track-transparent">
        {/* Primary items */}
        <div className="space-y-0.5">
          {primaryItems.filter(matchesSearch).map(renderItem)}
        </div>

        {/* Sections */}
        {sections.map((section) => {
          const visibleItems = section.items.filter(matchesSearch);
          if (visibleItems.length === 0 && !isCollapsed) return null;
          const isSectionCollapsed = section.collapsible && collapsedSections.has(section.id) && !isSearching;

          return (
            <div key={section.id} className="space-y-0.5">
              {renderSectionHeader(section)}
              <AnimatePresence initial={false}>
                {!isSectionCollapsed && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: "easeInOut" }}
                    className="overflow-hidden space-y-0.5"
                  >
                    {(isCollapsed ? section.items : visibleItems).map(renderItem)}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}

        {/* Utility (subtle) */}
        {!isCollapsed && <div className="mx-2 h-px bg-white/[0.04]" />}
        {isCollapsed && <div className="mx-auto my-1.5 w-6 h-px bg-white/[0.06] rounded-full" />}
        <div className="space-y-0.5">
          {utilityItems.filter(matchesSearch).map((item) => renderItem({ ...item }))}
        </div>

        {/* Admin */}
        {isAdmin && (
          <div className="space-y-0.5">
            {!isCollapsed && (
              <span className="block pl-3 pt-1 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600">
                Admin
              </span>
            )}
            {isCollapsed && <div className="mx-auto my-1.5 w-6 h-px bg-white/[0.06] rounded-full" />}
            {renderItem({ id: "admin-panel", label: "Admin Panel", icon: <RiShieldCheckFill className={S18} />, href: "/admin" })}
          </div>
        )}
      </nav>

      {renderFooter(user, isCollapsed, handleLogout)}
    </motion.aside>
  );
}

// ---------------------------------------------------------------------------
// Shared sub-components (used by sidebar)
// ---------------------------------------------------------------------------

function renderHeader(
  isCollapsed: boolean,
  setIsCollapsed: React.Dispatch<React.SetStateAction<boolean>>,
  onCollapsedChange?: (c: boolean) => void,
) {
  return (
    <div className={cn(
      "flex items-center h-14 border-b border-white/[0.04] flex-shrink-0",
      isCollapsed ? "justify-center px-2" : "justify-between px-4"
    )}>
      <Link href="/dashboard?tab=overview" className="flex items-center gap-2.5 min-w-0">
        <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
          <Image src="/logo1.png" alt="Balencia" width={28} height={28} className="object-contain" />
        </div>
        {!isCollapsed && (
          <span className="text-lg font-bold bg-gradient-to-r capitalize from-emerald-400 to-cyan-400 bg-clip-text text-transparent truncate">
            Balencia
          </span>
        )}
      </Link>
      {!isCollapsed && (
        <button
          onClick={() => { setIsCollapsed(true); onCollapsedChange?.(true); }}
          className="p-1.5 rounded-md text-slate-500 hover:text-slate-300 hover:bg-white/[0.04] transition-colors"
          aria-label="Collapse sidebar"
        >
          <RiArrowLeftSLine className="w-4 h-4" />
        </button>
      )}
      {isCollapsed && (
        <button
          onClick={() => { setIsCollapsed(false); onCollapsedChange?.(false); }}
          className="absolute -right-3 top-[18px] w-6 h-6 rounded-full bg-[#0a0a14] border border-white/[0.08] flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/[0.06] transition-colors shadow-lg"
          aria-label="Expand sidebar"
        >
          <RiArrowRightSLine className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

function renderSearchInput(
  searchQuery: string,
  setSearchQuery: (v: string) => void,
  searchRef: React.RefObject<HTMLInputElement | null>,
  isMobile: boolean,
) {
  return (
    <div className={cn("flex-shrink-0", isMobile ? "px-4 pt-2 pb-1" : "px-3 pt-2.5 pb-1")}>
      <div className="relative">
        <RiSearchLine className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600" />
        <input
          ref={searchRef}
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={isMobile ? "Search..." : "Search...  \u2318K"}
          className={cn(
            "w-full h-8 pl-8 pr-3 rounded-lg text-[12px] font-medium",
            "bg-white/[0.03] border border-white/[0.06] text-slate-300 placeholder-slate-600",
            "focus:outline-none focus:border-sky-600/30 focus:bg-white/[0.05] transition-colors"
          )}
        />
      </div>
    </div>
  );
}

function renderFooter(
  user: ReturnType<typeof useAuth>["user"],
  isCollapsed: boolean,
  handleLogout: () => void,
) {
  return (
    <div className="flex-shrink-0 px-2.5 py-2.5 border-t border-white/[0.04] space-y-2">
      {/* Avatar + name */}
      <Link
        href="/profile"
        className={cn(
          "flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-colors",
          "bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06]"
        )}
      >
        {user?.avatarUrl ? (
          <div className="relative w-8 h-8 rounded-full overflow-hidden shrink-0 ring-1 ring-white/15 shadow-lg shadow-emerald-500/20">
            <Image src={user.avatarUrl} alt={`${user?.firstName || "User"} avatar`} fill sizes="32px" className="object-cover" unoptimized />
          </div>
        ) : (
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-600 to-sky-600 flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-lg shadow-emerald-500/20">
            {user?.firstName?.[0]?.toUpperCase() || "U"}{user?.lastName?.[0]?.toUpperCase() || ""}
          </div>
        )}
        {!isCollapsed && (
          <div className="min-w-0">
            <p className="text-[12px] font-semibold text-white truncate leading-tight">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="text-[10px] text-slate-500 truncate leading-tight">{user?.email}</p>
          </div>
        )}
      </Link>

      {/* Sign Out */}
      <button
        onClick={handleLogout}
        aria-label="Sign out"
        className={cn(
          "group relative w-full flex items-center h-10 rounded-xl text-[13px] font-semibold cursor-pointer",
          isCollapsed ? "justify-center px-2" : "justify-between px-2.5",
          "border border-red-400/[0.14] bg-gradient-to-r from-red-500/[0.06] via-rose-500/[0.04] to-red-500/[0.06]",
          "text-red-200/80 hover:text-red-100 hover:border-red-400/[0.28] hover:from-red-500/[0.12] hover:via-rose-500/[0.09] hover:to-red-500/[0.12]",
          "shadow-[0_8px_24px_rgba(0,0,0,0.35)] hover:shadow-[0_12px_28px_rgba(239,68,68,0.22)]",
          "transition-all duration-200 ease-out active:scale-[0.985]"
        )}
      >
        {!isCollapsed && <span className="tracking-[0.01em]">Sign Out</span>}
        <span className={cn(
          "inline-flex items-center justify-center rounded-lg border border-red-300/[0.22] bg-red-500/[0.08]",
          "group-hover:bg-red-500/[0.14] group-hover:border-red-300/[0.34] transition-colors",
          isCollapsed ? "w-8 h-8" : "w-7 h-7"
        )}>
          <RiLogoutCircleRLine className="w-[17px] h-[17px] flex-shrink-0" />
        </span>
      </button>
    </div>
  );
}

// ===========================================================================
// Mobile Bottom Navigation
// ===========================================================================

const mobileNavItems: NavItem[] = [
  { id: "overview", label: "Overview", icon: <RiDashboardFill className={S20} />, href: "/dashboard" },
  { id: "workouts", label: "Workouts", icon: <RiBoxingFill className={S20} />, href: "/workouts" },
  { id: "ai-coach", label: "AI Coach", icon: <RiRobotFill className={S20} />, href: "/ai-coach" },
  { id: "chat", label: "Chat", icon: <RiChat3Fill className={S20} />, href: "/chat" },
];

// Groups shown in drawer
const drawerSections: NavSection[] = [
  { id: "primary", label: "Primary", items: primaryItems },
  ...sections,
  { id: "utility", label: "Utility", items: utilityItems },
];

// ---------------------------------------------------------------------------
// Mobile Drawer
// ---------------------------------------------------------------------------

function MobileNavDrawer({
  onClose,
  activeId,
  onNavClick,
  chatUnreadCount,
}: {
  onClose: () => void;
  activeId: string | null;
  onNavClick: (item: NavItem, e: React.MouseEvent) => void;
  chatUnreadCount: number;
}) {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const isAdmin = user?.role?.toLowerCase() === "admin";
  const isSearching = searchQuery.trim().length > 0;

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const matchesSearch = (item: NavItem) =>
    !isSearching || item.label.toLowerCase().includes(searchQuery.toLowerCase());

  const enrich = (item: NavItem): NavItem =>
    item.id === "chat" ? { ...item, unreadCount: chatUnreadCount } : item;

  const renderDrawerItem = (item: NavItem) => {
    const enriched = enrich(item);
    const isActive = activeId === enriched.id;

    return (
      <Link
        key={enriched.id}
        href={enriched.href}
        onClick={(e) => { onNavClick(enriched, e); onClose(); }}
        className={cn(
          "relative flex items-center gap-2.5 h-10 px-2.5 rounded-lg text-[13px] font-medium transition-colors",
          isActive ? "bg-sky-600/[0.08] text-sky-500" : "text-slate-300 hover:bg-white/[0.04]"
        )}
      >
        {isActive && <div className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-sky-600" />}
        <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center">{enriched.icon}</span>
        <span className="flex-1 truncate">{enriched.label}</span>
        {enriched.badge && (
          <span className={cn("px-1.5 py-px text-[9px] font-semibold rounded-[4px] leading-tight", getBadgeStyle(enriched.badge))}>
            {enriched.badge}
          </span>
        )}
        {enriched.unreadCount !== undefined && enriched.unreadCount > 0 && (
          <span className="min-w-[16px] h-[16px] px-1 flex items-center justify-center text-[9px] font-bold rounded-full bg-red-500 text-white">
            {enriched.unreadCount > 99 ? "99+" : enriched.unreadCount}
          </span>
        )}
      </Link>
    );
  };

  // Flat search results
  if (isSearching) {
    const filtered = getAllItems(isAdmin).filter(matchesSearch).map(enrich);
    return (
      <>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={onClose} />
        <motion.div
          initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 30, stiffness: 300 }}
          drag="y" dragConstraints={{ top: 0 }} dragElastic={0.2}
          onDragEnd={(_, info) => { if (info.offset.y > 100 || info.velocity.y > 500) onClose(); }}
          className="fixed bottom-0 left-0 right-0 max-h-[85vh] z-50 rounded-t-2xl bg-[#0a0a14] border-t border-white/[0.08] shadow-2xl flex flex-col"
        >
          <div className="flex justify-center pt-3 pb-1"><div className="w-9 h-1 rounded-full bg-white/15" /></div>
          <div className="flex items-center justify-between px-5 pb-2 pt-1">
            <h2 className="text-base font-bold text-white">Menu</h2>
            <button onClick={onClose} className="p-2 rounded-lg bg-white/[0.04] border border-white/[0.06] text-slate-400 hover:text-white transition-colors">
              <RiCloseFill className="w-4 h-4" />
            </button>
          </div>
          {renderSearchInput(searchQuery, setSearchQuery, searchRef, true)}
          <div className="flex-1 overflow-y-auto px-4 pb-8 pt-2 space-y-0.5 overscroll-contain">
            {filtered.length > 0 ? filtered.map(renderDrawerItem) : (
              <p className="px-3 py-6 text-xs text-slate-600 text-center">No results</p>
            )}
          </div>
        </motion.div>
      </>
    );
  }

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={onClose} />
      <motion.div
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        drag="y" dragConstraints={{ top: 0 }} dragElastic={0.2}
        onDragEnd={(_, info) => { if (info.offset.y > 100 || info.velocity.y > 500) onClose(); }}
        className="fixed bottom-0 left-0 right-0 max-h-[85vh] z-50 rounded-t-2xl bg-[#0a0a14] border-t border-white/[0.08] shadow-2xl flex flex-col"
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1"><div className="w-9 h-1 rounded-full bg-white/15" /></div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pb-2 pt-1">
          <h2 className="text-base font-bold text-white">Menu</h2>
          <button onClick={onClose} className="p-2 rounded-lg bg-white/[0.04] border border-white/[0.06] text-slate-400 hover:text-white transition-colors">
            <RiCloseFill className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        {renderSearchInput(searchQuery, setSearchQuery, searchRef, true)}

        {/* Sections */}
        <div className="flex-1 overflow-y-auto px-4 pb-8 pt-2 space-y-4 overscroll-contain">
          {drawerSections.map((group) => (
            <div key={group.id}>
              <p className="text-[10px] uppercase tracking-[0.12em] text-slate-600 font-semibold px-2 mb-1.5">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map(renderDrawerItem)}
              </div>
            </div>
          ))}

          {/* Admin */}
          {isAdmin && (
            <div>
              <p className="text-[10px] uppercase tracking-[0.12em] text-slate-600 font-semibold px-2 mb-1.5">Admin</p>
              {renderDrawerItem({ id: "admin-panel", label: "Admin Panel", icon: <RiShieldCheckFill className={S18} />, href: "/admin" })}
            </div>
          )}
        </div>
      </motion.div>
    </>
  );
}

// ===========================================================================
// MobileBottomNav (exported)
// ===========================================================================

export function MobileBottomNav({
  activeTab,
  onTabChange,
  disabled: _disabled,
}: DashboardSidebarProps) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { unreadCount: chatUnreadCount } = useUnreadCount();

  useEffect(() => { setIsDrawerOpen(false); }, [pathname]);

  const activeId = activeTab || resolveActiveId(pathname);

  const handleNavClick = useCallback(
    (item: NavItem, e: React.MouseEvent) => {
      if (onTabChange && item.href.includes("?tab=")) {
        e.preventDefault();
        const tab = item.href.split("?tab=")[1];
        router.push(`/dashboard?tab=${tab}`);
        onTabChange(tab);
      }
    },
    [onTabChange, router]
  );

  const isOnNonCoreRoute =
    activeId !== null && !mobileNavItems.some((item) => item.id === activeId);

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 bg-[#0a0a14]/95 backdrop-blur-xl border-t border-white/[0.06] z-40 md:hidden pb-safe">
        <div className="flex items-center justify-around py-1.5 px-1">
          {mobileNavItems.map((item) => {
            const isActive = activeId === item.id;
            const showDot = item.id === "chat" && chatUnreadCount > 0;
            return (
              <Link
                key={item.id}
                href={item.href}
                onClick={(e) => handleNavClick(item, e)}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 min-w-[56px] py-1.5 px-2 rounded-xl transition-colors",
                  isActive ? "bg-sky-600/[0.08] text-sky-500" : "text-slate-500 hover:text-slate-400"
                )}
              >
                <span className="w-5 h-5 relative">
                  {item.icon}
                  {showDot && <span className="absolute -top-1 -right-1.5 w-2 h-2 rounded-full bg-red-500" />}
                </span>
                <span className="text-[10px] font-medium leading-tight whitespace-nowrap">{item.label}</span>
              </Link>
            );
          })}

          {/* More button */}
          <button
            onClick={() => setIsDrawerOpen(true)}
            className={cn(
              "flex flex-col items-center justify-center gap-0.5 min-w-[56px] py-1.5 px-2 rounded-xl transition-colors relative",
              isOnNonCoreRoute ? "bg-white/[0.06] text-white" : "text-slate-500 hover:text-slate-400"
            )}
          >
            <span className="w-5 h-5 relative">
              <RiMore2Fill className="w-5 h-5" />
              {chatUnreadCount > 0 && <span className="absolute -top-1 -right-1.5 w-2 h-2 rounded-full bg-red-500" />}
            </span>
            <span className="text-[10px] font-medium leading-tight whitespace-nowrap">More</span>
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {isDrawerOpen && (
          <MobileNavDrawer
            onClose={() => setIsDrawerOpen(false)}
            activeId={activeId}
            onNavClick={handleNavClick}
            chatUnreadCount={chatUnreadCount}
          />
        )}
      </AnimatePresence>
    </>
  );
}

"use client";

import { useState, useEffect, startTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  BarChart3,
  Users,
  Shield,
  Settings,
  FileText,
  Workflow,
  Bot,
  Zap,
  FileBarChart,
  History,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Menu,
  X,
  MessageSquare,
  HelpCircle,
  MessageCircle,
  Video,
  CreditCard,
  Dumbbell,
  Star,
} from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { useAuth } from "@/app/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";

interface SidebarSection {
  id: string;
  label: string;
  items: SidebarItem[];
  role?: "admin" | "user" | "analyst" | "all";
}

interface SidebarItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  badge?: string | number;
  disabled?: boolean;
  role?: "admin" | "user" | "analyst" | "all";
}

const sidebarSections: SidebarSection[] = [
  {
    id: "dashboard",
    label: "DASHBOARD",
    role: "all",
    items: [
      {
        id: "overview",
        label: "Overview",
        icon: LayoutDashboard,
        href: "/admin",
      },
      {
        id: "analytics",
        label: "Analytics",
        icon: BarChart3,
        href: "/admin/analytics",
        role: "analyst",
      },
    ],
  },
  {
    id: "management",
    label: "MANAGEMENT",
    role: "admin",
    items: [
      {
        id: "users",
        label: "Users",
        icon: Users,
        href: "/admin/users",
      },
      {
        id: "roles",
        label: "Roles & Permissions",
        icon: Shield,
        href: "/admin/roles",
      },
      {
        id: "content",
        label: "Content",
        icon: FileText,
        href: "/admin/blogs",
        badge: "AI",
      },
      {
        id: "contacts",
        label: "Contacts",
        icon: MessageSquare,
        href: "/admin/contacts",
      },
      {
        id: "help",
        label: "Help Center",
        icon: HelpCircle,
        href: "/admin/help",
      },
      {
        id: "community",
        label: "Community",
        icon: MessageCircle,
        href: "/admin/community",
      },
      {
        id: "webinars",
        label: "Webinars",
        icon: Video,
        href: "/admin/webinars",
      },
      {
        id: "subscriptions",
        label: "Subscriptions",
        icon: CreditCard,
        href: "/admin/subscriptions",
      },
      {
        id: "exercises",
        label: "Exercises",
        icon: Dumbbell,
        href: "/admin/exercises",
      },
      {
        id: "testimonials",
        label: "Reviews",
        icon: Star,
        href: "/admin/testimonials",
      },
    ],
  },
  {
    id: "operations",
    label: "OPERATIONS",
    role: "admin",
    items: [
      {
        id: "tasks",
        label: "Tasks",
        icon: Workflow,
        href: "/admin/tasks",
      },
      {
        id: "workflows",
        label: "Workflows",
        icon: Zap,
        href: "/admin/workflows",
        badge: "AI",
      },
      {
        id: "logs",
        label: "System Logs",
        icon: History,
        href: "/admin/logs",
      },
    ],
  },
  {
    id: "ai",
    label: "AI & AUTOMATION",
    role: "admin",
    items: [
      {
        id: "models",
        label: "AI Models",
        icon: Bot,
        href: "/admin/ai/models",
        badge: "AI",
      },
      {
        id: "jobs",
        label: "Automation Jobs",
        icon: Zap,
        href: "/admin/ai/jobs",
        badge: "AI",
      },
      {
        id: "monitoring",
        label: "Monitoring",
        icon: BarChart3,
        href: "/admin/ai/monitoring",
      },
    ],
  },
  {
    id: "reports",
    label: "REPORTS",
    role: "all",
    items: [
      {
        id: "exports",
        label: "Exports",
        icon: FileBarChart,
        href: "/reports/exports",
      },
      {
        id: "insights",
        label: "Insights",
        icon: BarChart3,
        href: "/reports/insights",
      },
    ],
  },
  {
    id: "settings",
    label: "SETTINGS",
    role: "all",
    items: [
      {
        id: "general",
        label: "General",
        icon: Settings,
        href: "/settings",
      },
      {
        id: "security",
        label: "Security",
        icon: Shield,
        href: "/settings/security",
        role: "admin",
      },
    ],
  },
];

interface SidebarItemProps {
  item: SidebarItem;
  isActive: boolean;
  isCollapsed: boolean;
  onClick?: () => void;
}

function SidebarItemComponent({
  item,
  isActive,
  isCollapsed,
  onClick,
}: SidebarItemProps) {
  const Icon = item.icon;

  const content = (
    <Link
      href={item.disabled ? "#" : item.href}
      onClick={(e) => {
        if (item.disabled) {
          e.preventDefault();
          return;
        }
        onClick?.();
      }}
      className={cn(
        "group relative flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-300",
        "hover:bg-white/5",
        isActive
          ? "bg-gradient-to-r from-cyan-500 via-teal-500 to-sky-500 text-white font-medium shadow-lg shadow-cyan-500/20"
          : "text-slate-300 hover:text-white",
        item.disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      <div
        className={cn(
          "flex items-center justify-center w-5 h-5 shrink-0 transition-colors",
          isActive ? "text-white" : "text-slate-400 group-hover:text-slate-200"
        )}
      >
        <Icon className="w-5 h-5" />
      </div>
      {!isCollapsed && (
        <>
          <span className="flex-1 text-sm font-medium">{item.label}</span>
          {item.badge && (
            <Badge
              className={cn(
                "text-[10px] h-5 px-2 font-semibold rounded-md",
                isActive
                  ? "bg-white/20 text-white border-white/30"
                  : "bg-cyan-500/20 text-cyan-300 border-cyan-500/30"
              )}
              variant="outline"
            >
              {item.badge}
            </Badge>
          )}
        </>
      )}
      {isActive && (
        <motion.div
          layoutId="activeIndicator"
          className="absolute inset-0 bg-gradient-to-r from-cyan-500 via-teal-500 to-sky-500 rounded-lg -z-10"
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
        />
      )}
    </Link>
  );

  if (isCollapsed) {
    return (
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>{content}</TooltipTrigger>
          <TooltipContent side="right" className="ml-2 bg-slate-800 border-slate-700 text-white">
            <p className="font-medium">{item.label}</p>
            {item.badge && (
              <p className="text-xs text-cyan-300 mt-0.5">{item.badge}</p>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return content;
}

interface DashboardSidebarProps {
  onToggle?: (collapsed: boolean) => void;
}

export function DashboardSidebar({
  onToggle,
}: DashboardSidebarProps) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const { logout, hasRole } = useAuth();

  const isAdmin = hasRole("admin");
  const isAnalyst = hasRole("analyst") || isAdmin;

  // Filter sections based on role
  const visibleSections = sidebarSections.filter((section) => {
    if (section.role === "all") return true;
    if (section.role === "admin" && isAdmin) return true;
    if (section.role === "analyst" && isAnalyst) return true;
    return false;
  });

  // Filter items based on role
  const getVisibleItems = (items: SidebarItem[]) => {
    return items.filter((item) => {
      if (!item.role || item.role === "all") return true;
      if (item.role === "admin" && isAdmin) return true;
      if (item.role === "analyst" && isAnalyst) return true;
      return false;
    });
  };

  const isActive = (href: string) => {
    if (href === "/dashboard" || href === "/admin") {
      return pathname === href;
    }
    return pathname.startsWith(href);
  };

  const handleToggle = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    onToggle?.(newState);
  };

  // Close mobile menu on route change
  useEffect(() => {
    startTransition(() => {
      setIsMobileOpen(false);
    });
  }, [pathname]);

  // Handle responsive behavior
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setIsCollapsed(false);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const sidebarContent = (
    <div className="flex flex-col h-full min-h-0 overflow-hidden bg-slate-900/95 backdrop-blur-xl">
      {/* Header with Logo */}
      <div className="flex items-center justify-between p-4 border-b border-slate-800/50 shrink-0">
        {!isCollapsed && (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
            className="flex items-center gap-2.5"
          >
            <Image src="/logo1.png" alt="Balencia" width={28} height={28} className="object-contain" />
            <span className="text-lg font-bold bg-gradient-to-r from-cyan-400 via-teal-400 to-sky-400 bg-clip-text text-transparent">
              Balencia
            </span>
          </motion.div>
        )}
        {isCollapsed && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            className="flex justify-center w-full"
          >
            <Image src="/logo1.png" alt="Balencia" width={28} height={28} className="object-contain" />
          </motion.div>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={handleToggle}
          className="ml-auto h-8 w-8 shrink-0 text-slate-400 hover:text-white hover:bg-white/10 rounded-full transition-all"
        >
          {isCollapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </Button>
      </div>

      {/* User Profile Section */}
      {/* {!isCollapsed && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="p-4 border-b border-slate-800/50"
        >
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 ring-2 ring-cyan-500/30">
              <AvatarImage src={user?.avatarUrl || '/avatar.jpg'} />
              <AvatarFallback className="bg-gradient-to-br from-cyan-500 via-teal-500 to-sky-500 text-white text-sm font-semibold">
                {getInitials()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">
                {getDisplayName()}
              </p>
              <p className="text-xs text-slate-400 truncate">{user?.email}</p>
            </div>
          </div>
        </motion.div>
      )} */}

      {/* Navigation */}
      <ScrollArea className="flex-1 min-h-0 overflow-hidden">
        <nav className="p-3 space-y-6">
          <TooltipProvider delayDuration={0}>
            {visibleSections.map((section, sectionIndex) => {
              const visibleItems = getVisibleItems(section.items);
              if (visibleItems.length === 0) return null;

              return (
                <motion.div
                  key={section.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: sectionIndex * 0.05 }}
                  className="space-y-2"
                >
                  {!isCollapsed && (
                    <div className="px-4 py-2">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                        {section.label}
                      </p>
                    </div>
                  )}
                  <div className="space-y-1">
                    {visibleItems.map((item) => (
                      <SidebarItemComponent
                        key={item.id}
                        item={item}
                        isActive={isActive(item.href)}
                        isCollapsed={isCollapsed}
                        onClick={() => setIsMobileOpen(false)}
                      />
                    ))}
                  </div>
                </motion.div>
              );
            })}
          </TooltipProvider>
        </nav>
      </ScrollArea>

      {/* Sign Out Section */}
      <div className="p-4 border-t border-slate-800/50 shrink-0 mt-auto">
        <Button
          variant="ghost"
          onClick={logout}
          className={cn(
            "w-full justify-start text-slate-300 hover:text-white hover:bg-white/5 transition-all duration-200",
            isCollapsed && "justify-center px-0"
          )}
        >
          <LogOut className="w-4 h-4" />
          {!isCollapsed && <span className="ml-3 text-sm font-medium">Sign Out</span>}
        </Button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Menu Button */}
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden fixed top-4 left-4 z-50 h-10 w-10 bg-slate-900/90 backdrop-blur border border-slate-800 text-white hover:bg-slate-800"
        onClick={() => setIsMobileOpen(!isMobileOpen)}
      >
        {isMobileOpen ? (
          <X className="w-5 h-5" />
        ) : (
          <Menu className="w-5 h-5" />
        )}
      </Button>

      {/* Mobile Overlay */}
      <AnimatePresence>
        {isMobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            onClick={() => setIsMobileOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{
          width: isCollapsed ? "80px" : "280px",
        }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className={cn(
          "fixed left-0 top-0 h-screen z-40",
          "flex flex-col shadow-2xl",
          "lg:translate-x-0",
          isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {sidebarContent}
      </motion.aside>
    </>
  );
}

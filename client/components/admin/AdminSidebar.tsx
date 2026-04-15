"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  FileText,
  Users,
  Settings,
  BarChart3,
  Shield,
  ChevronLeft,
  ChevronRight,
  LogOut,
  HelpCircle,
  MessageCircle,
  Video,
  Mail,
  Send,
  Star,
} from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { useAuth } from "@/app/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  href: string;
  badge?: string;
}

const navItems: NavItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: <LayoutDashboard className="w-5 h-5" />,
    href: "/admin",
  },
  {
    id: "blogs",
    label: "Blogs",
    icon: <FileText className="w-5 h-5" />,
    href: "/admin/blogs",
  },
  {
    id: "help",
    label: "Help Center",
    icon: <HelpCircle className="w-5 h-5" />,
    href: "/admin/help",
  },
  {
    id: "community",
    label: "Community",
    icon: <MessageCircle className="w-5 h-5" />,
    href: "/admin/community",
  },
  {
    id: "webinars",
    label: "Webinars",
    icon: <Video className="w-5 h-5" />,
    href: "/admin/webinars",
  },
  {
    id: "testimonials",
    label: "Reviews",
    icon: <Star className="w-5 h-5" />,
    href: "/admin/testimonials",
  },
  {
    id: "contacts",
    label: "Contacts",
    icon: <Mail className="w-5 h-5" />,
    href: "/admin/contacts",
  },
  {
    id: "newsletter",
    label: "Newsletter",
    icon: <Send className="w-5 h-5" />,
    href: "/admin/newsletter",
  },
  {
    id: "users",
    label: "Users",
    icon: <Users className="w-5 h-5" />,
    href: "/admin/users",
  },
  {
    id: "roles",
    label: "Roles",
    icon: <Shield className="w-5 h-5" />,
    href: "/admin/roles",
  },
  {
    id: "analytics",
    label: "Analytics",
    icon: <BarChart3 className="w-5 h-5" />,
    href: "/admin/analytics",
  },
  {
    id: "settings",
    label: "Settings",
    icon: <Settings className="w-5 h-5" />,
    href: "/admin/settings",
  },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { user, logout, getInitials, getDisplayName } = useAuth();

  const isActive = (href: string) => {
    if (href === "/admin") {
      return pathname === "/admin";
    }
    return pathname.startsWith(href);
  };

  return (
    <motion.aside
      initial={false}
      animate={{
        width: isCollapsed ? "80px" : "280px",
      }}
      className={cn(
        "fixed left-0 top-0 h-screen bg-background border-r border-border z-40 transition-all duration-300",
        "flex flex-col"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        {!isCollapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-2"
          >
            <Image src="/logo1.png" alt="Balencia" width={32} height={32} className="object-contain" />
            <div>
              <h2 className="text-sm font-semibold">Admin Panel</h2>
              <p className="text-xs text-muted-foreground">Control Center</p>
            </div>
          </motion.div>
        )}
        {isCollapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mx-auto"
          >
            <Image src="/logo1.png" alt="Balencia" width={32} height={32} className="object-contain" />
          </motion.div>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="ml-auto"
        >
          {isCollapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-4 space-y-1">
        <TooltipProvider delayDuration={0}>
          {navItems.map((item) => {
            const active = isActive(item.href);
            const content = (
              <Link
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all group relative",
                  "hover:bg-accent hover:text-accent-foreground",
                  active && "bg-primary/10 text-primary font-medium"
                )}
              >
                <div
                  className={cn(
                    "flex items-center justify-center w-5 h-5",
                    active && "text-primary"
                  )}
                >
                  {item.icon}
                </div>
                {!isCollapsed && (
                  <>
                    <span className="flex-1">{item.label}</span>
                    {item.badge && (
                      <span className="px-2 py-0.5 text-xs bg-muted text-muted-foreground rounded-full">
                        {item.badge}
                      </span>
                    )}
                  </>
                )}
                {active && (
                  <motion.div
                    layoutId="activeIndicator"
                    className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-r-full"
                  />
                )}
              </Link>
            );

            if (isCollapsed) {
              return (
                <Tooltip key={item.id}>
                  <TooltipTrigger asChild>{content}</TooltipTrigger>
                  <TooltipContent side="right">
                    <p>{item.label}</p>
                  </TooltipContent>
                </Tooltip>
              );
            }

            return <div key={item.id}>{content}</div>;
          })}
        </TooltipProvider>
      </nav>

      {/* User Section */}
      <div className="p-4 border-t border-border">
        {!isCollapsed ? (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <Avatar className="h-10 w-10">
              <AvatarImage src={user?.avatarUrl || '/avatar.jpg'} />
              <AvatarFallback className="bg-gradient-to-br from-emerald-500 to-sky-500 text-white">
                {getInitials()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{getDisplayName()}</p>
              <p className="text-xs text-muted-foreground truncate">
                {user?.email}
              </p>
            </div>
          </div>
        ) : (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex justify-center">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={user?.avatarUrl || '/avatar.jpg'} />
                    <AvatarFallback className="bg-gradient-to-br from-emerald-500 to-sky-500 text-white">
                      {getInitials()}
                    </AvatarFallback>
                  </Avatar>
                </div>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>{getDisplayName()}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        <Button
          variant="ghost"
          onClick={logout}
          className={cn(
            "w-full mt-2 justify-start text-muted-foreground hover:text-destructive",
            isCollapsed && "justify-center"
          )}
        >
          <LogOut className="w-4 h-4" />
          {!isCollapsed && <span className="ml-2">Sign Out</span>}
        </Button>
      </div>
    </motion.aside>
  );
}


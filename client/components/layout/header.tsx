"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Menu,
  X,
  Sparkles,

  User,
  Settings,
  LogOut,
  LayoutDashboard,
  ChevronDown,
  Rocket,
  Target,
  Calendar,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,

  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Logo } from "@/components/common/logo";
import { useAuth } from "@/app/context/AuthContext";
import { StatusIndicator } from "@/app/components/activity/StatusIndicator";
import { NotificationDropdown } from "@/components/notifications/NotificationDropdown";
import { cn } from "@/lib/utils";

const navLinks = [
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How it Works" },
  { href: "#testimonials", label: "Testimonials" },
  { href: "/plans", label: "Pricing" },
  { href: "/faq", label: "FAQ" },
];

export function Header() {
  const {
    user,
    isAuthenticated,
    isLoading,
    logout,
    getInitials,
    getDisplayName,
    hasRole,
  } = useAuth();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<string>("");
  const lastScrollY = useRef(0);
  const scrollThreshold = 100;

  // Track active section via IntersectionObserver
  useEffect(() => {
    const sectionIds = navLinks
      .filter((l) => l.href.startsWith("#"))
      .map((l) => l.href.slice(1));

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        }
      },
      { rootMargin: "-30% 0px -60% 0px", threshold: 0 }
    );

    sectionIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  const handleLogout = async () => {
    await logout();
  };

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      // Update scrolled state for styling
      setIsScrolled(currentScrollY > 20);

      // Only start hide/show behavior after threshold
      if (currentScrollY > scrollThreshold) {
        // Scrolling down - hide header
        if (currentScrollY > lastScrollY.current && currentScrollY > 100) {
          setIsVisible(false);
        }
        // Scrolling up - show header
        else if (currentScrollY < lastScrollY.current) {
          setIsVisible(true);
        }
      } else {
        // Always show header at top of page
        setIsVisible(true);
      }

      lastScrollY.current = currentScrollY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: isVisible ? 0 : -100 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        isScrolled
          ? "glass border-b border-white/10 shadow-lg shadow-primary/5"
          : "bg-white dark:bg-background"
      )}
    >
      {/* Gradient line at top when scrolled */}
      {isScrolled && (
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent"
        />
      )}

      <div className="container mx-auto px-4">
        <nav className="flex items-center justify-between h-16 md:h-20">
          {/* Logo */}
          <Logo size="md" />

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center gap-1">
            {navLinks.map((link, index) => {
              const isActive = link.href.startsWith("#") && activeSection === link.href.slice(1);
              return (
                <motion.div
                  key={link.href}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + index * 0.05 }}
                >
                  <Link
                    href={link.href}
                    className={cn(
                      "relative px-4 py-2 text-sm font-medium transition-colors group",
                      isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {link.label}
                    {/* Hover effect */}
                    <span className="absolute inset-0 rounded-full bg-primary/0 group-hover:bg-primary/10 transition-colors" />
                    {/* Active gradient underline */}
                    {isActive ? (
                      <motion.span
                        layoutId="activeNavIndicator"
                        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1/2 h-0.5 bg-gradient-to-r from-primary to-purple-500 rounded-full"
                        transition={{ type: "spring", stiffness: 350, damping: 30 }}
                      />
                    ) : (
                      <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0 h-0.5 bg-gradient-to-r from-primary to-purple-500 transition-all group-hover:w-1/2 rounded-full" />
                    )}
                  </Link>
                </motion.div>
              );
            })}
          </div>

          {/* Right Side Actions */}
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-3">
              {isLoading ? (
                <div className="w-24 h-10 glass rounded-full animate-pulse" />
              ) : isAuthenticated && user ? (
                <>
                  {/* Activity Status Indicator */}
                  <div className="flex items-center">
                    <StatusIndicator />
                  </div>

                  {/* Notification Bell with Dropdown */}
                  <NotificationDropdown />

                  <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className="relative h-auto p-1.5 pl-3 pr-2 rounded-full glass hover:border-primary/30 hover:bg-primary/5 transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <Avatar className="h-9 w-9 ring-2 ring-primary/20 group-hover:ring-primary/40 transition-all">
                            <AvatarImage
                              src={user.avatarUrl || '/avatar.jpg'}
                              alt={getDisplayName()}
                            />
                            <AvatarFallback className="bg-gradient-to-br from-primary to-purple-500 text-white font-semibold text-sm">
                              {getInitials()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full ring-2 ring-background" />
                        </div>
                        <ChevronDown className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                      </div>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    sideOffset={8}
                    className="w-64 overflow-hidden rounded-2xl border border-white/10 bg-background/95 backdrop-blur-xl shadow-2xl shadow-black/20 p-0"
                  >
                    {/* User Header with Gradient Background */}
                    <div className="relative overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-purple-500/10 to-transparent" />
                      <div className="absolute top-0 right-0 w-20 h-20 bg-primary/10 rounded-full blur-2xl" />
                      <div className="relative px-4 py-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-12 w-12 ring-2 ring-primary/30 shadow-lg">
                            <AvatarImage
                              src={user.avatarUrl || '/avatar.jpg'}
                              alt={getDisplayName()}
                            />
                            <AvatarFallback className="bg-gradient-to-br from-primary to-purple-500 text-white font-bold text-base">
                              {getInitials()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">
                              {getDisplayName()}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {user.email}
                            </p>
                            <div className="flex items-center gap-1.5 mt-1">
                              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                              <span className="text-[10px] text-green-500 font-medium">
                                Online
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <DropdownMenuSeparator className="bg-white/5 m-0" />

                    {/* Navigation Links */}
                    <div className="p-2 space-y-1">
                      <DropdownMenuItem
                        asChild
                        className="cursor-pointer rounded-xl px-3 py-2.5 focus:bg-primary/10 hover:bg-primary/10 transition-colors group"
                      >
                        <Link
                          href="/dashboard"
                          className="flex items-center gap-3"
                        >
                          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                            <LayoutDashboard className="w-4 h-4 text-primary" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">Dashboard</p>
                            <p className="text-[10px] text-muted-foreground">
                              View your overview
                            </p>
                          </div>
                        </Link>
                      </DropdownMenuItem>

                      {/* <DropdownMenuItem
                        asChild
                        className="cursor-pointer rounded-xl px-3 py-2.5 focus:bg-emerald-500/10 hover:bg-emerald-500/10 transition-colors group"
                      >
                        <Link
                          href="/onboarding"
                          className="flex items-center gap-3"
                        >
                          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center group-hover:bg-emerald-500/20 transition-colors">
                            <Rocket className="w-4 h-4 text-emerald-500" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">Onboarding</p>
                            <p className="text-[10px] text-muted-foreground">
                              Setup your health plan
                            </p>
                          </div>
                        </Link>
                      </DropdownMenuItem> */}

                      <DropdownMenuItem
                        asChild
                        className="cursor-pointer rounded-xl px-3 py-2.5 focus:bg-purple-500/10 hover:bg-purple-500/10 transition-colors group"
                      >
                        <Link
                          href={`/profile`}
                          className="flex items-center gap-3"
                        >
                          <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center group-hover:bg-purple-500/20 transition-colors">
                            <User className="w-4 h-4 text-purple-500" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">Profile</p>
                            <p className="text-[10px] text-muted-foreground">
                              Manage your account
                            </p>
                          </div>
                        </Link>
                      </DropdownMenuItem>

                      {/* <DropdownMenuItem
                        asChild
                        className="cursor-pointer rounded-xl px-3 py-2.5 focus:bg-cyan-500/10 hover:bg-cyan-500/10 transition-colors group"
                      >
                        <Link href="/goals" className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center group-hover:bg-cyan-500/20 transition-colors">
                            <Target className="w-4 h-4 text-cyan-500" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">My Goals</p>
                            <p className="text-[10px] text-muted-foreground">
                              Track your progress
                            </p>
                          </div>
                        </Link>
                      </DropdownMenuItem> */}

                      <DropdownMenuItem
                        asChild
                        className="cursor-pointer rounded-xl px-3 py-2.5 focus:bg-blue-500/10 hover:bg-blue-500/10 transition-colors group"
                      >
                        <Link href="/activity-status" className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
                            <Calendar className="w-4 h-4 text-blue-500" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">Activity Status</p>
                            <p className="text-[10px] text-muted-foreground">
                              Track daily status
                            </p>
                          </div>
                        </Link>
                      </DropdownMenuItem>

                      <DropdownMenuItem
                        asChild
                        className="cursor-pointer rounded-xl px-3 py-2.5 focus:bg-amber-500/10 hover:bg-amber-500/10 transition-colors group"
                      >
                        <Link
                          href="/settings"
                          className="flex items-center gap-3"
                        >
                          <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center group-hover:bg-amber-500/20 transition-colors">
                            <Settings className="w-4 h-4 text-amber-500" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">Settings</p>
                            <p className="text-[10px] text-muted-foreground">
                              Preferences & privacy
                            </p>
                          </div>
                        </Link>
                      </DropdownMenuItem>

                      {/* Admin Dashboard Link - Only for admins */}
                      {hasRole("admin") && (
                        <>
                          <DropdownMenuSeparator className="bg-white/5 m-0" />
                          <DropdownMenuItem
                            asChild
                            className="cursor-pointer rounded-xl px-3 py-2.5 focus:bg-purple-500/10 hover:bg-purple-500/10 transition-colors group"
                          >
                            <Link
                              href="/admin"
                              className="flex items-center gap-3"
                            >
                              <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center group-hover:bg-purple-500/20 transition-colors">
                                <Shield className="w-4 h-4 text-purple-500" />
                              </div>
                              <div>
                                <p className="text-sm font-medium">Admin Dashboard</p>
                                <p className="text-[10px] text-muted-foreground">
                                  Manage system
                                </p>
                              </div>
                            </Link>
                          </DropdownMenuItem>
                        </>
                      )}
                    </div>

                    <DropdownMenuSeparator className="bg-white/5 m-0" />

                    {/* Sign Out Button */}
                    <div className="p-2">
                      <DropdownMenuItem
                        onClick={handleLogout}
                        className="cursor-pointer rounded-xl px-3 py-2.5 focus:bg-red-500/10 hover:bg-red-500/10 transition-colors group"
                      >
                        <div className="flex items-center gap-3 w-full">
                          <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center group-hover:bg-red-500/20 transition-colors">
                            <LogOut className="w-4 h-4 text-red-500" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-red-500">
                              Sign Out
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              See you soon!
                            </p>
                          </div>
                        </div>
                      </DropdownMenuItem>
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
                </>
              ) : (
                <>
                  <Button
                    variant="ghost"
                    asChild
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <Link href="/auth/signin">Sign In</Link>
                  </Button>
                  <Button
                    asChild
                    className="bg-gradient-to-r from-primary to-purple-500 hover:from-primary/90 hover:to-purple-500/90 rounded-full px-6 glow-cyan"
                  >
                    <Link
                      href="/auth/signup"
                      className="flex items-center gap-2"
                    >
                      <Sparkles className="w-4 h-4" />
                      Get Started
                    </Link>
                  </Button>
                </>
              )}
            </div>

            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden relative"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              <motion.div
                animate={{ rotate: isMobileMenuOpen ? 180 : 0 }}
                transition={{ duration: 0.3 }}
              >
                {isMobileMenuOpen ? (
                  <X className="h-5 w-5" />
                ) : (
                  <Menu className="h-5 w-5" />
                )}
              </motion.div>
            </Button>
          </div>
        </nav>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="lg:hidden glass border-t border-white/10"
          >
            <div className="container mx-auto px-4 py-6">
              <div className="flex flex-col gap-2">
                {navLinks.map((link, index) => {
                  const isActive = link.href.startsWith("#") && activeSection === link.href.slice(1);
                  return (
                    <motion.div
                      key={link.href}
                      initial={{ opacity: 0, x: -30 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.05 + index * 0.07, type: "spring", stiffness: 300, damping: 25 }}
                    >
                      <Link
                        href={link.href}
                        className={cn(
                          "block py-3 px-4 text-lg font-medium rounded-xl transition-all",
                          isActive
                            ? "text-foreground bg-primary/10 border-l-2 border-primary"
                            : "text-muted-foreground hover:text-foreground hover:bg-primary/10"
                        )}
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        {link.label}
                      </Link>
                    </motion.div>
                  );
                })}

                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="flex flex-col gap-3 pt-4 mt-4 border-t border-white/10"
                >
                  {isAuthenticated && user ? (
                    <>
                      {/* User Info */}
                      <div className="flex items-center gap-3 p-3 glass rounded-xl border border-white/10">
                        <Avatar className="h-12 w-12 ring-2 ring-primary/20">
                          <AvatarImage
                            src={user.avatarUrl || '/avatar.jpg'}
                            alt={getDisplayName()}
                          />
                          <AvatarFallback className="bg-gradient-to-br from-primary to-purple-500 text-white font-semibold">
                            {getInitials()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {getDisplayName()}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {user.email}
                          </p>
                        </div>
                        <span className="w-2.5 h-2.5 bg-green-500 rounded-full" />
                      </div>

                      {/* Navigation Links */}
                      <Link
                        href="/dashboard"
                        className="flex items-center gap-3 py-3 px-4 text-muted-foreground hover:text-foreground hover:bg-primary/10 rounded-xl transition-all"
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        <LayoutDashboard className="w-5 h-5" />
                        Dashboard
                      </Link>
                      <Link
                        href="/onboarding"
                        className="flex items-center gap-3 py-3 px-4 text-muted-foreground hover:text-foreground hover:bg-emerald-500/10 rounded-xl transition-all"
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        <Rocket className="w-5 h-5 text-emerald-500" />
                        <span>Onboarding</span>
                        <span className="ml-auto px-2 py-0.5 text-[10px] font-medium bg-emerald-500/20 text-emerald-400 rounded-full">
                          New
                        </span>
                      </Link>
                      <Link
                        href="/goals"
                        className="flex items-center gap-3 py-3 px-4 text-muted-foreground hover:text-foreground hover:bg-cyan-500/10 rounded-xl transition-all"
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        <Target className="w-5 h-5 text-cyan-500" />
                        My Goals
                      </Link>
                      <Link
                        href={`/profile`}
                        className="flex items-center gap-3 py-3 px-4 text-muted-foreground hover:text-foreground hover:bg-primary/10 rounded-xl transition-all"
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        <User className="w-5 h-5" />
                        Profile
                      </Link>
                      <Link
                        href="/settings"
                        className="flex items-center gap-3 py-3 px-4 text-muted-foreground hover:text-foreground hover:bg-primary/10 rounded-xl transition-all"
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        <Settings className="w-5 h-5" />
                        Settings
                      </Link>

                      {/* Sign Out Button */}
                      <Button
                        onClick={() => {
                          handleLogout();
                          setIsMobileMenuOpen(false);
                        }}
                        variant="outline"
                        className="w-full mt-2 border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                      >
                        <LogOut className="w-4 h-4 mr-2" />
                        Sign Out
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        variant="outline"
                        asChild
                        className="w-full glass border-white/10"
                      >
                        <Link href="/auth/signin">Sign In</Link>
                      </Button>
                      <Button
                        asChild
                        className="w-full bg-gradient-to-r from-primary to-purple-500 glow-cyan"
                      >
                        <Link
                          href="/auth/signup"
                          className="flex items-center justify-center gap-2"
                        >
                          <Sparkles className="w-4 h-4" />
                          Get Started Free
                        </Link>
                      </Button>
                    </>
                  )}
                </motion.div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}

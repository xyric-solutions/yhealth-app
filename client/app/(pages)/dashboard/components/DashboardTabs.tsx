'use client';

import { useRef } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';
import {
  LayoutDashboard,
  Target,
  Settings,
  Sliders,
  Activity,
  Trophy,
  User,
  Bell,
  ClipboardList,
  MessageSquare,
  TrendingUp,
  Heart,
  Dumbbell,
  Utensils,
  Brain,
  Wallet,
  Shield,
  Users,
} from 'lucide-react';

export type TabId = 'overview' | 'intelligence' | 'goals' | 'plans' | 'progress' | 'activity' | 'achievements' | 'notifications' | 'chat-history' | 'preferences' | 'settings' | 'profile' | 'wellbeing' | 'workouts' | 'nutrition' | 'finance' | 'accountability' | 'social';

interface Tab {
  id: TabId;
  label: string;
  icon: React.ReactNode;
  gradient: string;
  glowColor: string;
}

const tabs: Tab[] = [
  {
    id: 'overview',
    label: 'Overview',
    icon: <LayoutDashboard className="w-4 h-4" />,
    gradient: 'from-blue-500 to-purple-500',
    glowColor: 'shadow-blue-500/30',
  },
  {
    id: 'intelligence',
    label: 'Intelligence',
    icon: <Brain className="w-4 h-4" />,
    gradient: 'from-indigo-500 to-violet-500',
    glowColor: 'shadow-indigo-500/30',
  },
  {
    id: 'goals',
    label: 'Goals',
    icon: <Target className="w-4 h-4" />,
    gradient: 'from-cyan-500 to-blue-500',
    glowColor: 'shadow-cyan-500/30',
  },
  {
    id: 'plans',
    label: 'Plans',
    icon: <ClipboardList className="w-4 h-4" />,
    gradient: 'from-violet-500 to-purple-500',
    glowColor: 'shadow-violet-500/30',
  },
  {
    id: 'workouts',
    label: 'Workouts',
    icon: <Dumbbell className="w-4 h-4" />,
    gradient: 'from-orange-500 to-amber-500',
    glowColor: 'shadow-orange-500/30',
  },
  {
    id: 'nutrition',
    label: 'Nutrition',
    icon: <Utensils className="w-4 h-4" />,
    gradient: 'from-green-500 to-emerald-500',
    glowColor: 'shadow-green-500/30',
  },
  {
    id: 'progress',
    label: 'Progress',
    icon: <TrendingUp className="w-4 h-4" />,
    gradient: 'from-emerald-500 to-teal-500',
    glowColor: 'shadow-emerald-500/30',
  },
  {
    id: 'activity',
    label: 'Activity',
    icon: <Activity className="w-4 h-4" />,
    gradient: 'from-green-500 to-emerald-500',
    glowColor: 'shadow-green-500/30',
  },
  {
    id: 'achievements',
    label: 'Achievements',
    icon: <Trophy className="w-4 h-4" />,
    gradient: 'from-amber-500 to-orange-500',
    glowColor: 'shadow-amber-500/30',
  },
  {
    id: 'notifications',
    label: 'Notifications',
    icon: <Bell className="w-4 h-4" />,
    gradient: 'from-indigo-500 to-purple-500',
    glowColor: 'shadow-indigo-500/30',
  },
  {
    id: 'chat-history',
    label: 'Chat History',
    icon: <MessageSquare className="w-4 h-4" />,
    gradient: 'from-violet-500 to-fuchsia-500',
    glowColor: 'shadow-violet-500/30',
  },
  {
    id: 'profile',
    label: 'Profile',
    icon: <User className="w-4 h-4" />,
    gradient: 'from-purple-500 to-pink-500',
    glowColor: 'shadow-purple-500/30',
  },
  {
    id: 'preferences',
    label: 'Preferences',
    icon: <Sliders className="w-4 h-4" />,
    gradient: 'from-pink-500 to-rose-500',
    glowColor: 'shadow-pink-500/30',
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: <Settings className="w-4 h-4" />,
    gradient: 'from-slate-500 to-slate-600',
    glowColor: 'shadow-slate-500/30',
  },
  {
    id: 'wellbeing',
    label: 'Wellbeing',
    icon: <Heart className="w-4 h-4" />,
    gradient: 'from-pink-500 to-rose-500',
    glowColor: 'shadow-pink-500/30',
  },
  {
    id: 'finance',
    label: 'Finance',
    icon: <Wallet className="w-4 h-4" />,
    gradient: 'from-emerald-500 to-teal-500',
    glowColor: 'shadow-emerald-500/30',
  },
  {
    id: 'accountability',
    label: 'Contracts',
    icon: <Shield className="w-4 h-4" />,
    gradient: 'from-cyan-500 to-emerald-500',
    glowColor: 'shadow-cyan-500/30',
  },
  {
    id: 'social',
    label: 'Social',
    icon: <Users className="w-4 h-4" />,
    gradient: 'from-indigo-500 to-violet-500',
    glowColor: 'shadow-indigo-500/30',
  },
];

interface DashboardTabsProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

// Magnetic Tab Button Component
function MagneticTabButton({
  tab,
  isActive,
  onClick,
  index,
}: {
  tab: Tab;
  isActive: boolean;
  onClick: () => void;
  index: number;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const springConfig = { stiffness: 300, damping: 20 };
  const springX = useSpring(x, springConfig);
  const springY = useSpring(y, springConfig);

  const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const distanceX = e.clientX - centerX;
    const distanceY = e.clientY - centerY;
    
    // Magnetic effect - move towards cursor
    x.set(distanceX * 0.2);
    y.set(distanceY * 0.2);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.button
      ref={ref}
      onClick={onClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        x: springX,
        y: springY,
      }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03, duration: 0.3 }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className={`
        relative flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm
        transition-colors duration-200 whitespace-nowrap
        ${isActive ? 'text-white' : 'text-slate-400 hover:text-white'}
      `}
    >
      {/* Active background with sliding animation */}
      {isActive && (
        <motion.div
          layoutId="activeDashboardTab"
          className={`absolute inset-0 rounded-xl bg-gradient-to-r ${tab.gradient}`}
          initial={false}
          transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
          style={{
            boxShadow: `0 0 25px ${tab.glowColor.replace('shadow-', '').replace('/30', '40')}, 0 4px 15px rgba(0,0,0,0.3)`,
          }}
        />
      )}

      {/* Hover glow effect */}
      {!isActive && (
        <motion.div
          className="absolute inset-0 rounded-xl bg-white/5 opacity-0 hover:opacity-100 transition-opacity"
        />
      )}

      {/* Icon with animation */}
      <motion.span 
        className="relative z-10"
        animate={isActive ? { scale: [1, 1.2, 1] } : {}}
        transition={{ duration: 0.3 }}
      >
        {tab.icon}
      </motion.span>

      {/* Label */}
      <span className="relative z-10">{tab.label}</span>

      {/* Active indicator dot */}
      {isActive && (
        <motion.span
          className="absolute -top-1 -right-1 w-2 h-2 bg-white rounded-full"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2 }}
          style={{
            boxShadow: '0 0 10px rgba(255, 255, 255, 0.8)',
          }}
        />
      )}
    </motion.button>
  );
}

// Mobile Tab Button
function MobileTabButton({
  tab,
  isActive,
  onClick,
}: {
  tab: Tab;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      onClick={onClick}
      whileTap={{ scale: 0.95 }}
      className={`
        relative flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm
        transition-all duration-200 whitespace-nowrap flex-shrink-0
        ${isActive
          ? `bg-gradient-to-r ${tab.gradient} text-white shadow-lg ${tab.glowColor}`
          : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10 hover:text-white'
        }
      `}
    >
      {tab.icon}
      <span>{tab.label}</span>
      
      {/* Active pulse */}
      {isActive && (
        <motion.span
          className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-white rounded-full"
          animate={{ scale: [1, 1.3, 1], opacity: [1, 0.7, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      )}
    </motion.button>
  );
}

export function DashboardTabs({ activeTab, onTabChange }: DashboardTabsProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  return (
    <motion.div 
      className="mb-4 sm:mb-8"
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Desktop Tabs with Magnetic Effect */}
      <div className="hidden md:block">
        <div 
          className="
            flex items-center gap-1 p-1.5 rounded-2xl
            bg-white/5 border border-white/10 backdrop-blur-xl
            overflow-x-auto scrollbar-hide
            shadow-inner shadow-black/20
          "
        >
          {tabs.map((tab, index) => (
            <MagneticTabButton
              key={tab.id}
              tab={tab}
              isActive={activeTab === tab.id}
              onClick={() => onTabChange(tab.id)}
              index={index}
            />
          ))}
        </div>
      </div>

      {/* Mobile Tabs - Scrollable with snap */}
      <div className="md:hidden">
        <div 
          ref={scrollContainerRef}
          className="
            flex items-center gap-2 overflow-x-auto pb-2 px-1
            scrollbar-hide snap-x snap-mandatory
            -mx-4 px-4
          "
        >
          {tabs.map((tab) => (
            <div key={tab.id} className="snap-start">
              <MobileTabButton
                tab={tab}
                isActive={activeTab === tab.id}
                onClick={() => onTabChange(tab.id)}
              />
            </div>
          ))}
        </div>
        
        {/* Mobile scroll indicator */}
        <div className="flex items-center justify-center gap-1 mt-2">
          {tabs.slice(0, Math.min(tabs.length, 6)).map((tab) => (
            <motion.div
              key={tab.id}
              className={`h-1 rounded-full transition-all duration-300 ${
                activeTab === tab.id ? 'w-4 bg-emerald-500' : 'w-1 bg-slate-700'
              }`}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
}

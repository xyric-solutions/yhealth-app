'use client';

import { MoreVertical, Info, Search, Menu, ArrowLeft, Pencil, X, Trash2, LogOut, LayoutDashboard, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface ChatHeaderProps {
  title?: string;
  subtitle?: string;
  avatar?: string;
  onInfo?: () => void;
  onSearch?: () => void;
  onMore?: () => void;
  onMenuClick?: () => void;
  onBack?: () => void;
  showBackButton?: boolean;
  isGroupChat?: boolean;
  onGroupMenuClick?: () => void;
  onEdit?: () => void;
  onClose?: () => void;
  onLeaveGroup?: () => void;
  onDelete?: () => void;
  onUserClick?: (userId: string, userName: string, userAvatar?: string | null) => void;
  otherUserId?: string;
  otherUserName?: string;
  className?: string;
}

const HEADER_CSS = `
  @keyframes ch-glow { 0%,100%{opacity:.3} 50%{opacity:.7} }
  @keyframes ch-ring { 0%,100%{box-shadow:0 0 0 0 rgba(16,185,129,.3)} 50%{box-shadow:0 0 0 4px rgba(16,185,129,.08)} }
`;

export function ChatHeader({
  title = 'Chat',
  subtitle,
  avatar,
  onInfo,
  onSearch,
  onMore,
  onMenuClick,
  onBack,
  showBackButton = false,
  isGroupChat = false,
  onGroupMenuClick,
  onEdit,
  onClose,
  onLeaveGroup,
  onDelete,
  onUserClick,
  otherUserId,
  otherUserName,
  className,
}: ChatHeaderProps) {
  const router = useRouter();
  const isAICoach = title === 'AI Coach' || title === 'Aurea';

  const iconBtnClass = "h-9 w-9 rounded-xl text-slate-500 hover:text-white hover:bg-white/[0.06] border border-transparent hover:border-white/[0.08] transition-all duration-200";

  return (
    <>
      <style>{HEADER_CSS}</style>
      <div
        className={cn(
          'relative flex items-center justify-between px-4 sm:px-5 py-3 flex-shrink-0 overflow-hidden',
          className
        )}
        style={{
          background: 'linear-gradient(180deg, rgba(8,10,18,0.95) 0%, rgba(6,8,14,0.92) 100%)',
          borderBottom: '1px solid rgba(255,255,255,0.04)',
          backdropFilter: 'blur(20px)',
        }}
      >
        {/* Ambient top line */}
        <div className="absolute top-0 left-0 right-0 h-[1px]" style={{ background: 'linear-gradient(90deg, transparent, rgba(16,185,129,0.15), transparent)' }} />

        {/* Content */}
        <div className="flex items-center gap-3 min-w-0 flex-1 relative z-10">
          {/* Mobile back button */}
          {showBackButton && onBack && (
            <Button variant="ghost" size="icon" className={cn("lg:hidden shrink-0", iconBtnClass)} onClick={onBack}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          {/* Mobile menu button */}
          {!showBackButton && onMenuClick && (
            <Button variant="ghost" size="icon" className={cn("lg:hidden shrink-0", iconBtnClass)} onClick={onMenuClick}>
              <Menu className="h-5 w-5" />
            </Button>
          )}

          {/* Avatar */}
          {avatar ? (
            <button
              onClick={() => {
                if (!isGroupChat && onUserClick && otherUserId && otherUserName) {
                  onUserClick(otherUserId, otherUserName, avatar);
                }
              }}
              className={cn(
                "relative h-10 w-10 rounded-full shrink-0 overflow-hidden",
                !isGroupChat && onUserClick && otherUserId && "cursor-pointer group"
              )}
              style={{
                boxShadow: isAICoach ? '0 0 12px rgba(16,185,129,0.2), 0 0 0 2px rgba(16,185,129,0.15)' : '0 0 0 2px rgba(255,255,255,0.08)',
                animation: isAICoach ? 'ch-ring 3s ease-in-out infinite' : 'none',
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={avatar} alt={title} className="h-full w-full object-cover transition-transform group-hover:scale-110" />
              {/* Online indicator */}
              {isAICoach && (
                <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-[#080a12]"
                  style={{ boxShadow: '0 0 6px rgba(16,185,129,0.5)' }} />
              )}
            </button>
          ) : isAICoach ? (
            <div
              className="relative h-10 w-10 rounded-full shrink-0 flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, rgba(16,185,129,0.2), rgba(6,182,212,0.15))',
                border: '1.5px solid rgba(16,185,129,0.25)',
                boxShadow: '0 0 16px rgba(16,185,129,0.15)',
                animation: 'ch-ring 3s ease-in-out infinite',
              }}
            >
              <Sparkles className="w-5 h-5 text-emerald-400" />
              <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-[#080a12]"
                style={{ boxShadow: '0 0 6px rgba(16,185,129,0.5)' }} />
            </div>
          ) : null}

          {/* Title & Subtitle */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-[15px] font-semibold text-white truncate">{title}</h2>
              {isAICoach && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/15 uppercase tracking-wider">
                  AI
                </span>
              )}
            </div>
            {subtitle && (
              <p className="text-[11px] text-emerald-400/70 truncate font-medium mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1 shrink-0 relative z-10">
          <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard')} title="Dashboard" className={iconBtnClass}>
            <LayoutDashboard className="h-[18px] w-[18px]" />
          </Button>
          {onSearch && (
            <Button variant="ghost" size="icon" onClick={onSearch} className={iconBtnClass}>
              <Search className="h-[18px] w-[18px]" />
            </Button>
          )}
          {onInfo && (
            <Button variant="ghost" size="icon" onClick={onInfo} className={iconBtnClass}>
              <Info className="h-[18px] w-[18px]" />
            </Button>
          )}
          {/* Group menu */}
          {isGroupChat && onGroupMenuClick && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className={iconBtnClass}>
                  <MoreVertical className="h-[18px] w-[18px]" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-xl border-white/[0.08] bg-[#0f1120]/95 backdrop-blur-xl shadow-2xl shadow-black/50">
                <DropdownMenuItem onClick={onGroupMenuClick} className="text-slate-300 hover:text-white focus:text-white focus:bg-white/[0.06]">
                  <Info className="mr-2 h-4 w-4" /> Group Info
                </DropdownMenuItem>
                {onEdit && <DropdownMenuItem onClick={onEdit} className="text-slate-300 hover:text-white focus:text-white focus:bg-white/[0.06]"><Pencil className="mr-2 h-4 w-4" /> Edit Group</DropdownMenuItem>}
                {onSearch && <DropdownMenuItem onClick={onSearch} className="text-slate-300 hover:text-white focus:text-white focus:bg-white/[0.06]"><Search className="mr-2 h-4 w-4" /> Search</DropdownMenuItem>}
                <DropdownMenuSeparator className="bg-white/[0.06]" />
                {onClose && <DropdownMenuItem onClick={onClose} className="text-slate-300 hover:text-white focus:text-white focus:bg-white/[0.06]"><X className="mr-2 h-4 w-4" /> Close Chat</DropdownMenuItem>}
                {onLeaveGroup && <DropdownMenuItem onClick={onLeaveGroup} className="text-slate-300 hover:text-white focus:text-white focus:bg-white/[0.06]"><LogOut className="mr-2 h-4 w-4" /> Leave Group</DropdownMenuItem>}
                {onDelete && <DropdownMenuItem onClick={onDelete} className="text-red-400 focus:text-red-400 focus:bg-red-500/10"><Trash2 className="mr-2 h-4 w-4" /> Delete Group</DropdownMenuItem>}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {/* Regular menu */}
          {(!isGroupChat || !onGroupMenuClick) && (onMore || onInfo || onSearch || onEdit || onClose || onDelete) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className={iconBtnClass}>
                  <MoreVertical className="h-[18px] w-[18px]" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-xl border-white/[0.08] bg-[#0f1120]/95 backdrop-blur-xl shadow-2xl shadow-black/50">
                {onSearch && <DropdownMenuItem onClick={onSearch} className="text-slate-300 hover:text-white focus:text-white focus:bg-white/[0.06]"><Search className="mr-2 h-4 w-4" /> Search</DropdownMenuItem>}
                {onInfo && <DropdownMenuItem onClick={onInfo} className="text-slate-300 hover:text-white focus:text-white focus:bg-white/[0.06]"><Info className="mr-2 h-4 w-4" /> Info</DropdownMenuItem>}
                {onEdit && <DropdownMenuItem onClick={onEdit} className="text-slate-300 hover:text-white focus:text-white focus:bg-white/[0.06]"><Pencil className="mr-2 h-4 w-4" /> Edit Chat</DropdownMenuItem>}
                <DropdownMenuSeparator className="bg-white/[0.06]" />
                {onClose && <DropdownMenuItem onClick={onClose} className="text-slate-300 hover:text-white focus:text-white focus:bg-white/[0.06]"><X className="mr-2 h-4 w-4" /> Close Chat</DropdownMenuItem>}
                {onDelete && <DropdownMenuItem onClick={onDelete} className="text-red-400 focus:text-red-400 focus:bg-red-500/10"><Trash2 className="mr-2 h-4 w-4" /> Delete Chat</DropdownMenuItem>}
                {onMore && (<><DropdownMenuSeparator className="bg-white/[0.06]" /><DropdownMenuItem onClick={onMore} className="text-slate-300 hover:text-white focus:text-white focus:bg-white/[0.06]">More options</DropdownMenuItem></>)}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </>
  );
}

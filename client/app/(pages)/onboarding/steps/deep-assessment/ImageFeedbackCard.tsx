'use client';

import { motion } from 'framer-motion';
import { 
  TrendingUp, 
  CheckCircle2, 
  Lightbulb, 
  Heart,
  Camera,
  Apple,
  Activity,
  FileText
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ImageFeedback } from './types';

interface ImageFeedbackCardProps {
  feedback: ImageFeedback;
  imageUrl?: string;
}

export function ImageFeedbackCard({ feedback, imageUrl }: ImageFeedbackCardProps) {
  const categoryConfig = {
    body: { 
      icon: Camera, 
      label: 'Body Analysis',
      gradient: 'from-blue-500/20 to-cyan-500/20',
      border: 'border-blue-500/30',
      iconColor: 'text-blue-400'
    },
    food: { 
      icon: Apple, 
      label: 'Nutrition Analysis',
      gradient: 'from-green-500/20 to-emerald-500/20',
      border: 'border-green-500/30',
      iconColor: 'text-green-400'
    },
    progress: { 
      icon: Activity, 
      label: 'Progress Review',
      gradient: 'from-violet-500/20 to-purple-500/20',
      border: 'border-violet-500/30',
      iconColor: 'text-violet-400'
    },
    medical: { 
      icon: FileText, 
      label: 'Health Document',
      gradient: 'from-rose-500/20 to-pink-500/20',
      border: 'border-rose-500/30',
      iconColor: 'text-rose-400'
    },
  };

  const config = categoryConfig[feedback.category];
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-2xl overflow-hidden border backdrop-blur-sm',
        `bg-gradient-to-br ${config.gradient}`,
        config.border
      )}
    >
      {/* Header with Image Preview */}
      <div className="flex items-start gap-4 p-4 border-b border-white/10">
        {imageUrl && (
          <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt="Analyzed" className="w-full h-full object-cover" />
          </div>
        )}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Icon className={cn('w-4 h-4', config.iconColor)} />
            <span className={cn('text-xs font-medium uppercase tracking-wider', config.iconColor)}>
              {config.label}
            </span>
          </div>
          <p className="text-sm text-slate-300">{feedback.currentState}</p>
        </div>
      </div>

      {/* Improvements Section */}
      {feedback.improvements.length > 0 && (
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-amber-400" />
            <h4 className="text-sm font-semibold text-white">Areas to Improve</h4>
          </div>
          <ul className="space-y-2">
            {feedback.improvements.map((item, i) => (
              <motion.li
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className="flex items-start gap-2 text-sm text-slate-300"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 flex-shrink-0" />
                {item}
              </motion.li>
            ))}
          </ul>
        </div>
      )}

      {/* Action Items Section */}
      {feedback.actionItems.length > 0 && (
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="w-4 h-4 text-emerald-400" />
            <h4 className="text-sm font-semibold text-white">Action Items</h4>
          </div>
          <ul className="space-y-2">
            {feedback.actionItems.map((item, i) => (
              <motion.li
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 + 0.2 }}
                className="flex items-start gap-2 text-sm text-slate-300"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                {item}
              </motion.li>
            ))}
          </ul>
        </div>
      )}

      {/* Encouragement */}
      {feedback.encouragement && (
        <div className="p-4 bg-white/5">
          <div className="flex items-start gap-3">
            <Heart className="w-5 h-5 text-pink-400 flex-shrink-0" />
            <p className="text-sm text-slate-300 italic">{feedback.encouragement}</p>
          </div>
        </div>
      )}
    </motion.div>
  );
}

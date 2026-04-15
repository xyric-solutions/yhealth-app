'use client';

/**
 * @file Deep Assessment Utilities
 */

import { Brain, Target, Shield, Sparkles, Heart } from 'lucide-react';
import type { Message, DisplayInsight, ExtractedInsight } from './types';
import type { ChatMessage } from '@/src/shared/services';

export function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export function mapInsightToDisplay(insight: ExtractedInsight, index: number): DisplayInsight {
  const iconMap: Record<string, React.ReactNode> = {
    motivation: <Target className="w-3.5 h-3.5" />,
    barrier: <Shield className="w-3.5 h-3.5" />,
    preference: <Sparkles className="w-3.5 h-3.5" />,
    lifestyle: <Heart className="w-3.5 h-3.5" />,
    goal: <Target className="w-3.5 h-3.5" />,
    health_status: <Heart className="w-3.5 h-3.5" />,
  };

  return {
    id: `insight_${index}_${insight.category}`,
    category: insight.category,
    text: insight.text,
    confidence: insight.confidence,
    icon: iconMap[insight.category] || <Brain className="w-3.5 h-3.5" />,
  };
}

export function messagesToChatHistory(messages: Message[]): ChatMessage[] {
  return messages.map((m) => ({
    role: m.sender === 'ai' ? 'assistant' : 'user',
    content: m.text,
  }));
}

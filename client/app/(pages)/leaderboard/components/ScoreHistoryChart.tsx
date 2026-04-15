'use client';

import { useState, useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Download, Calendar } from 'lucide-react';
import { motion } from 'framer-motion';
import type { DailyScore } from '@/src/shared/services/leaderboard.service';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { format, subDays } from 'date-fns';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface ScoreHistoryChartProps {
  scores: DailyScore[];
  isLoading?: boolean;
}

type TimePeriod = '7d' | '30d' | '90d' | 'all';

export function ScoreHistoryChart({ scores, isLoading }: ScoreHistoryChartProps) {
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('30d');
  const [selectedComponent, setSelectedComponent] = useState<'total' | 'workout' | 'nutrition' | 'wellbeing' | 'biometrics' | 'engagement' | 'consistency'>('total');

  // Filter scores based on time period
  const filteredScores = useMemo(() => {
    if (!scores || scores.length === 0) return [];
    
    const now = new Date();
    let cutoffDate: Date;

    switch (timePeriod) {
      case '7d':
        cutoffDate = subDays(now, 7);
        break;
      case '30d':
        cutoffDate = subDays(now, 30);
        break;
      case '90d':
        cutoffDate = subDays(now, 90);
        break;
      default:
        return scores;
    }

    return scores.filter((score) => {
      const scoreDate = new Date(score.date);
      return scoreDate >= cutoffDate;
    }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [scores, timePeriod]);

  // Prepare chart data
  const chartData = useMemo(() => {
    const labels = filteredScores.map((score) => format(new Date(score.date), 'MMM dd'));
    
    let data: number[];
    let label: string;
    let color: string;

    switch (selectedComponent) {
      case 'workout':
        data = filteredScores.map((s) => s.component_scores.workout);
        label = 'Workout Score';
        color = 'rgb(59, 130, 246)'; // blue
        break;
      case 'nutrition':
        data = filteredScores.map((s) => s.component_scores.nutrition);
        label = 'Nutrition Score';
        color = 'rgb(34, 197, 94)'; // green
        break;
      case 'wellbeing':
        data = filteredScores.map((s) => s.component_scores.wellbeing);
        label = 'Wellbeing Score';
        color = 'rgb(168, 85, 247)'; // purple
        break;
      case 'biometrics':
        data = filteredScores.map((s) => s.component_scores.biometrics);
        label = 'Biometrics Score';
        color = 'rgb(236, 72, 153)'; // pink
        break;
      case 'engagement':
        data = filteredScores.map((s) => s.component_scores.engagement);
        label = 'Engagement Score';
        color = 'rgb(99, 102, 241)'; // indigo
        break;
      case 'consistency':
        data = filteredScores.map((s) => s.component_scores.consistency);
        label = 'Consistency Score';
        color = 'rgb(245, 158, 11)'; // amber
        break;
      default:
        data = filteredScores.map((s) => s.total_score);
        label = 'Total Score';
        color = 'rgb(251, 191, 36)'; // yellow
    }

    return {
      labels,
      datasets: [
        {
          label,
          data,
          borderColor: color,
          backgroundColor: color.replace('rgb', 'rgba').replace(')', ', 0.1)'),
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: color,
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
        },
      ],
    };
  }, [filteredScores, selectedComponent]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        padding: 12,
        titleFont: {
          size: 14,
          weight: 'bold' as const,
        },
        bodyFont: {
          size: 13,
        },
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        callbacks: {
          label: (context: { parsed: { y: number } }) => {
            return `${selectedComponent === 'total' ? 'Total' : selectedComponent}: ${context.parsed.y.toFixed(1)}`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: {
          color: 'rgba(255, 255, 255, 0.05)',
        },
        ticks: {
          color: 'rgba(255, 255, 255, 0.6)',
          maxRotation: 45,
          minRotation: 0,
        },
      },
      y: {
        grid: {
          color: 'rgba(255, 255, 255, 0.05)',
        },
        ticks: {
          color: 'rgba(255, 255, 255, 0.6)',
        },
        min: 0,
        max: 100,
      },
    },
  };

  const handleExport = () => {
    // Create a canvas element to render the chart
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 600;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return;

    // For now, just copy data to clipboard
    const csv = [
      ['Date', 'Total Score', 'Workout', 'Nutrition', 'Wellbeing', 'Biometrics', 'Engagement', 'Consistency'],
      ...filteredScores.map((score) => [
        score.date,
        Number(score.total_score).toFixed(1),
        Number(score.component_scores.workout).toFixed(1),
        Number(score.component_scores.nutrition).toFixed(1),
        Number(score.component_scores.wellbeing).toFixed(1),
        Number(score.component_scores.biometrics).toFixed(1),
        Number(score.component_scores.engagement).toFixed(1),
        Number(score.component_scores.consistency).toFixed(1),
      ]),
    ].map((row) => row.join(',')).join('\n');

    navigator.clipboard.writeText(csv);
    // In a real implementation, you could use html2canvas or similar to export as image
  };

  if (isLoading) {
    return (
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
        <div className="h-64 flex items-center justify-center text-gray-400">
          Loading chart data...
        </div>
      </div>
    );
  }

  if (!scores || scores.length === 0) {
    return (
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 text-center">
        <p className="text-gray-400">No score history available</p>
        <p className="text-gray-500 text-sm mt-2">Start logging activities to see your progress!</p>
      </div>
    );
  }

  return (
    <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-white flex items-center gap-2">
          <Calendar className="w-5 h-5 text-purple-400" />
          Score History
        </h3>
        <Button
          onClick={handleExport}
          variant="outline"
          size="sm"
          className="border-purple-500/50 text-purple-300 hover:bg-purple-500/10"
        >
          <Download className="w-4 h-4 mr-2" />
          Export
        </Button>
      </div>

      {/* Time Period Filters */}
      <div className="flex gap-2">
        {(['7d', '30d', '90d', 'all'] as TimePeriod[]).map((period) => (
          <motion.button
            key={period}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setTimePeriod(period)}
            className={cn(
              'px-4 py-2 rounded-full text-sm font-medium transition-all',
              timePeriod === period
                ? 'bg-purple-500/80 text-white'
                : 'bg-white/10 text-gray-300 hover:bg-white/20'
            )}
          >
            {period === 'all' ? 'All Time' : period.toUpperCase()}
          </motion.button>
        ))}
      </div>

      {/* Component Selector */}
      <div className="flex gap-2 flex-wrap">
        {(['total', 'workout', 'nutrition', 'wellbeing', 'biometrics', 'engagement', 'consistency'] as const).map((component) => (
          <motion.button
            key={component}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setSelectedComponent(component)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize',
              selectedComponent === component
                ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                : 'bg-white/10 text-gray-300 hover:bg-white/20'
            )}
          >
            {component}
          </motion.button>
        ))}
      </div>

      {/* Chart */}
      <div className="h-64">
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <Line data={chartData} options={chartOptions as any} />
      </div>

      {/* Stats Summary */}
      {filteredScores.length > 0 && (
        <div className="grid grid-cols-3 gap-4 pt-4 border-t border-white/10">
          <div className="text-center">
            <div className="text-gray-400 text-xs mb-1">Average</div>
            <div className="text-white font-bold text-lg">
              {(
                filteredScores.reduce((sum, s) => sum + (selectedComponent === 'total' ? s.total_score : s.component_scores[selectedComponent]), 0) /
                filteredScores.length
              ).toFixed(1)}
            </div>
          </div>
          <div className="text-center">
            <div className="text-gray-400 text-xs mb-1">Highest</div>
            <div className="text-white font-bold text-lg">
              {Math.max(
                ...filteredScores.map((s) =>
                  selectedComponent === 'total' ? s.total_score : s.component_scores[selectedComponent]
                )
              ).toFixed(1)}
            </div>
          </div>
          <div className="text-center">
            <div className="text-gray-400 text-xs mb-1">Trend</div>
            <div className="text-white font-bold text-lg">
              {filteredScores.length >= 2
                ? (
                    (selectedComponent === 'total'
                      ? filteredScores[filteredScores.length - 1].total_score
                      : filteredScores[filteredScores.length - 1].component_scores[selectedComponent]) -
                    (selectedComponent === 'total'
                      ? filteredScores[0].total_score
                      : filteredScores[0].component_scores[selectedComponent])
                  ).toFixed(1)
                : '0.0'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


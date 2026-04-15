'use client';

import { motion } from 'framer-motion';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
  ComposedChart,
  Bar,
} from 'recharts';
import { Heart, Activity, TrendingUp, Thermometer, Flame, Zap } from 'lucide-react';

// Brand colors - Emerald 600 as primary
const BRAND_COLORS = {
  primary: '#059669', // emerald-600
  secondary: '#00BCD4', // cyan/teal
  success: '#10b981', // emerald-500
  fitness: '#f97316', // orange-500
  recovery: '#ef4444', // red-500
  sleep: '#3b82f6', // blue-500
  strain: '#8b5cf6', // violet-500
  hrv: '#10b981', // emerald-500
  rhr: '#ef4444', // red-500
  temp: '#f97316', // orange-500
  spo2: '#3b82f6', // blue-500
};

interface RecoveryTrend {
  date: string;
  recovery_score: number;
  hrv_rmssd_ms: number;
  resting_heart_rate_bpm: number;
  skin_temp_celsius?: number;
  spo2_percent?: number;
}

interface SleepTrend {
  date: string;
  duration_minutes: number;
  sleep_quality_score: number;
  sleep_efficiency_percent: number;
  rem_minutes: number;
  deep_minutes: number;
}

interface StrainTrend {
  date: string;
  strain_score: number;
  strain_score_normalized: number;
  avg_heart_rate_bpm: number;
  calories_kcal: number;
}

interface WhoopDailyChartsProps {
  recoveryTrends: RecoveryTrend[];
  sleepTrends: SleepTrend[];
  strainTrends: StrainTrend[];
}

export function WhoopDailyCharts({
  recoveryTrends,
  sleepTrends,
  strainTrends,
}: WhoopDailyChartsProps) {
  // Prepare combined chart data
  const chartData = recoveryTrends.map((recovery) => {
    const date = new Date(recovery.date);
    const dateKey = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    const sleep = sleepTrends.find(
      (s) => new Date(s.date).toDateString() === date.toDateString()
    );
    const strain = strainTrends.find(
      (s) => new Date(s.date).toDateString() === date.toDateString()
    );

    return {
      date: dateKey,
      fullDate: recovery.date,
      Recovery: recovery.recovery_score,
      Sleep: sleep ? Math.round(sleep.duration_minutes / 60 * 10) / 10 : 0,
      Strain: strain ? strain.strain_score : 0,
      HRV: recovery.hrv_rmssd_ms,
      RHR: recovery.resting_heart_rate_bpm,
      HeartRate: strain ? strain.avg_heart_rate_bpm : null,
    };
  });

  // Prepare HRV/RHR chart data
  const vitalData = recoveryTrends.map((recovery) => {
    const date = new Date(recovery.date);
    return {
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      HRV: recovery.hrv_rmssd_ms,
      RHR: recovery.resting_heart_rate_bpm,
      Temperature: recovery.skin_temp_celsius || null,
      SPO2: recovery.spo2_percent || null,
    };
  });

  // Prepare heart rate and calories data from strain - ensure we always have data
  const heartRateData = strainTrends.map((strain) => {
    const date = new Date(strain.date);
    return {
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      'Avg Heart Rate': strain.avg_heart_rate_bpm || 0,
      Calories: Math.round(strain.calories_kcal) || 0,
    };
  });

  // If no strain data, try to get heart rate from recovery data
  const hasHeartRateData = heartRateData.length > 0 && heartRateData.some(d => d['Avg Heart Rate'] > 0 || d.Calories > 0);

  return (
    <div className="space-y-6">
      {/* Main Trends Chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ y: -2 }}
        className="bg-slate-900/50 backdrop-blur-xl rounded-2xl p-6 border border-white/10 hover:border-emerald-500/30 transition-colors"
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <TrendingUp className="w-5 h-5 text-emerald-400" />
              </div>
              Trends
            </h3>
            <p className="text-sm text-slate-400 mt-1">Historical performance metrics</p>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <span className="text-slate-400">Recovery</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-blue-500"></div>
              <span className="text-slate-400">Sleep</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-violet-500"></div>
              <span className="text-slate-400">Strain</span>
            </div>
          </div>
        </div>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <defs>
                <linearGradient id="recoveryGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={BRAND_COLORS.recovery} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={BRAND_COLORS.recovery} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
              <XAxis
                dataKey="date"
                stroke="#9ca3af"
                tick={{ fill: '#9ca3af', fontSize: 12 }}
                tickLine={{ stroke: '#4b5563' }}
              />
              <YAxis
                domain={[0, 100]}
                stroke="#9ca3af"
                tick={{ fill: '#9ca3af', fontSize: 12 }}
                tickLine={{ stroke: '#4b5563' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1f2937',
                  border: '1px solid #374151',
                  borderRadius: '12px',
                  padding: '12px',
                  boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
                }}
                labelStyle={{ color: '#fff', marginBottom: '8px', fontWeight: 600 }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="Recovery"
                stroke={BRAND_COLORS.recovery}
                strokeWidth={3}
                dot={{ fill: BRAND_COLORS.recovery, r: 4, strokeWidth: 2, stroke: '#1f2937' }}
                activeDot={{ r: 6, stroke: '#fff', strokeWidth: 2 }}
                name="Recovery"
              />
              <Line
                type="monotone"
                dataKey="Sleep"
                stroke={BRAND_COLORS.sleep}
                strokeWidth={3}
                dot={{ fill: BRAND_COLORS.sleep, r: 4, strokeWidth: 2, stroke: '#1f2937' }}
                activeDot={{ r: 6, stroke: '#fff', strokeWidth: 2 }}
                name="Sleep (hrs)"
              />
              <Line
                type="monotone"
                dataKey="Strain"
                stroke={BRAND_COLORS.strain}
                strokeWidth={3}
                dot={{ fill: BRAND_COLORS.strain, r: 4, strokeWidth: 2, stroke: '#1f2937' }}
                activeDot={{ r: 6, stroke: '#fff', strokeWidth: 2 }}
                name="Strain"
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-[300px] text-slate-400">
            <div className="text-center">
              <TrendingUp className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No trend data available</p>
            </div>
          </div>
        )}
      </motion.div>

      {/* HRV & RHR Chart */}
      {vitalData.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          whileHover={{ y: -2 }}
          className="bg-slate-900/50 backdrop-blur-xl rounded-2xl p-6 border border-white/10 hover:border-red-500/30 transition-colors"
        >
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <div className="p-2 rounded-lg bg-red-500/10">
              <Heart className="w-5 h-5 text-red-400" />
            </div>
            Heart Rate Variability & Resting Heart Rate
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={vitalData}>
              <defs>
                <linearGradient id="hrvGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={BRAND_COLORS.hrv} stopOpacity={0.8} />
                  <stop offset="95%" stopColor={BRAND_COLORS.hrv} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="rhrGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={BRAND_COLORS.rhr} stopOpacity={0.8} />
                  <stop offset="95%" stopColor={BRAND_COLORS.rhr} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
              <XAxis
                dataKey="date"
                stroke="#9ca3af"
                tick={{ fill: '#9ca3af', fontSize: 12 }}
              />
              <YAxis stroke="#9ca3af" tick={{ fill: '#9ca3af', fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1f2937',
                  border: '1px solid #374151',
                  borderRadius: '12px',
                  padding: '12px',
                  boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
                }}
                labelStyle={{ color: '#fff' }}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="HRV"
                stroke={BRAND_COLORS.hrv}
                strokeWidth={2}
                fill="url(#hrvGradient)"
                name="HRV (ms)"
              />
              <Area
                type="monotone"
                dataKey="RHR"
                stroke={BRAND_COLORS.rhr}
                strokeWidth={2}
                fill="url(#rhrGradient)"
                name="RHR (bpm)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>
      )}

      {/* Temperature & SPO2 Chart */}
      {vitalData.length > 0 && vitalData.some((d) => d.Temperature !== null || d.SPO2 !== null) && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          whileHover={{ y: -2 }}
          className="bg-slate-900/50 backdrop-blur-xl rounded-2xl p-6 border border-white/10 hover:border-orange-500/30 transition-colors"
        >
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <div className="p-2 rounded-lg bg-orange-500/10">
              <Thermometer className="w-5 h-5 text-orange-400" />
            </div>
            Temperature & Blood Oxygen
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={vitalData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
              <XAxis
                dataKey="date"
                stroke="#9ca3af"
                tick={{ fill: '#9ca3af', fontSize: 12 }}
              />
              <YAxis yAxisId="left" stroke="#9ca3af" tick={{ fill: '#9ca3af', fontSize: 12 }} />
              <YAxis
                yAxisId="right"
                orientation="right"
                stroke="#9ca3af"
                tick={{ fill: '#9ca3af', fontSize: 12 }}
                domain={[90, 100]}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1f2937',
                  border: '1px solid #374151',
                  borderRadius: '12px',
                  padding: '12px',
                  boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
                }}
                labelStyle={{ color: '#fff' }}
              />
              <Legend />
              {vitalData.some((d) => d.Temperature !== null) && (
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="Temperature"
                  stroke={BRAND_COLORS.temp}
                  strokeWidth={3}
                  dot={{ fill: BRAND_COLORS.temp, r: 4, strokeWidth: 2, stroke: '#1f2937' }}
                  activeDot={{ r: 6, stroke: '#fff', strokeWidth: 2 }}
                  name="Temperature (°C)"
                  connectNulls
                />
              )}
              {vitalData.some((d) => d.SPO2 !== null) && (
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="SPO2"
                  stroke={BRAND_COLORS.spo2}
                  strokeWidth={3}
                  dot={{ fill: BRAND_COLORS.spo2, r: 4, strokeWidth: 2, stroke: '#1f2937' }}
                  activeDot={{ r: 6, stroke: '#fff', strokeWidth: 2 }}
                  name="SPO2 (%)"
                  connectNulls
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </motion.div>
      )}

      {/* Heart Rate & Calories Chart - Always show if we have strain data */}
      {(hasHeartRateData || strainTrends.length > 0) && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          whileHover={{ y: -2 }}
          className="bg-slate-900/50 backdrop-blur-xl rounded-2xl p-6 border border-white/10 hover:border-violet-500/30 transition-colors"
        >
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <div className="p-2 rounded-lg bg-violet-500/10">
              <Activity className="w-5 h-5 text-violet-400" />
            </div>
            Heart Rate & Calories
          </h3>
          {heartRateData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <ComposedChart data={heartRateData}>
                <defs>
                  <linearGradient id="caloriesGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={BRAND_COLORS.fitness} stopOpacity={0.8} />
                    <stop offset="95%" stopColor={BRAND_COLORS.fitness} stopOpacity={0.1} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                <XAxis
                  dataKey="date"
                  stroke="#9ca3af"
                  tick={{ fill: '#9ca3af', fontSize: 12 }}
                />
                <YAxis
                  yAxisId="left"
                  stroke="#9ca3af"
                  tick={{ fill: '#9ca3af', fontSize: 12 }}
                  domain={[0, 'auto']}
                  label={{ value: 'BPM', angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 10 }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  stroke="#9ca3af"
                  tick={{ fill: '#9ca3af', fontSize: 12 }}
                  domain={[0, 'auto']}
                  label={{ value: 'kcal', angle: 90, position: 'insideRight', fill: '#9ca3af', fontSize: 10 }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1f2937',
                    border: '1px solid #374151',
                    borderRadius: '12px',
                    padding: '12px',
                    boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
                  }}
                  labelStyle={{ color: '#fff', fontWeight: 600, marginBottom: '8px' }}
                  formatter={(value, name) => {
                    const numValue = (value ?? 0) as number;
                    const label = (name ?? '') as string;
                    if (label === 'Avg Heart Rate') return [`${numValue} bpm`, 'Avg Heart Rate'];
                    if (label === 'Calories') return [`${numValue} kcal`, 'Calories Burned'];
                    return [numValue, label];
                  }}
                />
                <Legend />
                <Bar
                  yAxisId="right"
                  dataKey="Calories"
                  fill="url(#caloriesGradient)"
                  radius={[4, 4, 0, 0]}
                  name="Calories"
                  animationDuration={1500}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="Avg Heart Rate"
                  stroke={BRAND_COLORS.strain}
                  strokeWidth={3}
                  dot={{ fill: BRAND_COLORS.strain, r: 5, strokeWidth: 2, stroke: '#1f2937' }}
                  activeDot={{ r: 7, stroke: '#fff', strokeWidth: 2 }}
                  name="Avg Heart Rate"
                  animationDuration={1500}
                />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[250px] text-slate-400">
              <div className="text-center">
                <Activity className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No heart rate or calories data available</p>
                <p className="text-xs text-slate-500 mt-1">Data will appear when strain data is synced</p>
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* Summary Stats */}
      {(recoveryTrends.length > 0 || strainTrends.length > 0) && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4"
        >
          {/* Avg HRV */}
          {recoveryTrends.length > 0 && (
            <div className="bg-slate-900/50 backdrop-blur-xl rounded-xl p-4 border border-white/10">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 rounded-lg bg-emerald-500/10">
                  <Zap className="w-4 h-4 text-emerald-400" />
                </div>
                <span className="text-xs text-slate-400">Avg HRV</span>
              </div>
              <p className="text-2xl font-bold text-white">
                {Math.round(recoveryTrends.reduce((sum, r) => sum + r.hrv_rmssd_ms, 0) / recoveryTrends.length)}
                <span className="text-sm text-slate-400 ml-1">ms</span>
              </p>
            </div>
          )}

          {/* Avg RHR */}
          {recoveryTrends.length > 0 && (
            <div className="bg-slate-900/50 backdrop-blur-xl rounded-xl p-4 border border-white/10">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 rounded-lg bg-red-500/10">
                  <Heart className="w-4 h-4 text-red-400" />
                </div>
                <span className="text-xs text-slate-400">Avg RHR</span>
              </div>
              <p className="text-2xl font-bold text-white">
                {Math.round(recoveryTrends.reduce((sum, r) => sum + r.resting_heart_rate_bpm, 0) / recoveryTrends.length)}
                <span className="text-sm text-slate-400 ml-1">bpm</span>
              </p>
            </div>
          )}

          {/* Total Calories */}
          {strainTrends.length > 0 && (
            <div className="bg-slate-900/50 backdrop-blur-xl rounded-xl p-4 border border-white/10">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 rounded-lg bg-orange-500/10">
                  <Flame className="w-4 h-4 text-orange-400" />
                </div>
                <span className="text-xs text-slate-400">Total Calories</span>
              </div>
              <p className="text-2xl font-bold text-white">
                {Math.round(strainTrends.reduce((sum, s) => sum + s.calories_kcal, 0)).toLocaleString()}
                <span className="text-sm text-slate-400 ml-1">kcal</span>
              </p>
            </div>
          )}

          {/* Avg Strain */}
          {strainTrends.length > 0 && (
            <div className="bg-slate-900/50 backdrop-blur-xl rounded-xl p-4 border border-white/10">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 rounded-lg bg-violet-500/10">
                  <Activity className="w-4 h-4 text-violet-400" />
                </div>
                <span className="text-xs text-slate-400">Avg Strain</span>
              </div>
              <p className="text-2xl font-bold text-white">
                {(strainTrends.reduce((sum, s) => sum + s.strain_score, 0) / strainTrends.length).toFixed(1)}
                <span className="text-sm text-slate-400 ml-1">/21</span>
              </p>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}

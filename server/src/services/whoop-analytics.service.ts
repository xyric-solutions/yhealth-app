/**
 * @file WHOOP Analytics Service
 * @description Aggregates and analyzes WHOOP data for insights and trends
 */

import { query } from '../database/pg.js';
import { logger } from './logger.service.js';

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

interface WhoopOverview {
  currentRecovery: {
    score: number;
    hrv: number;
    rhr: number;
    timestamp: string;
  } | null;
  currentSleep: {
    duration: number;
    quality: number;
    efficiency: number;
    timestamp: string;
  } | null;
  todayStrain: {
    score: number;
    normalized: number;
    timestamp: string;
  } | null;
  trends: {
    recovery7d: number[];
    sleep7d: number[];
    strain7d: number[];
  };
}

/**
 * Get WHOOP overview analytics
 * @param userId - User ID
 * @param startDate - Optional start date for date range filtering
 * @param endDate - Optional end date for date range filtering
 */
export async function getWhoopOverview(
  userId: string,
  startDate?: Date,
  endDate?: Date
): Promise<WhoopOverview> {
  // Validate date range if provided
  if (startDate && endDate) {
    if (endDate < startDate) {
      throw new Error('End date must be after start date');
    }
    const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff > 90) {
      throw new Error('Date range cannot exceed 90 days');
    }
  }

  // Use date range or default to last 7 days
  const effectiveStartDate = startDate || (() => {
    const date = new Date();
    date.setDate(date.getDate() - 7);
    return date;
  })();
  const effectiveEndDate = endDate || new Date();

  // Get latest recovery
  const latestRecovery = await query<{
    value: any;
    recorded_at: Date;
  }>(
    `SELECT value, recorded_at FROM health_data_records
     WHERE user_id = $1 AND provider = 'whoop' AND data_type = 'recovery'
     ORDER BY recorded_at DESC LIMIT 1`,
    [userId]
  );

  // Get latest sleep
  const latestSleep = await query<{
    value: any;
    recorded_at: Date;
  }>(
    `SELECT value, recorded_at FROM health_data_records
     WHERE user_id = $1 AND provider = 'whoop' AND data_type = 'sleep'
     ORDER BY recorded_at DESC LIMIT 1`,
    [userId]
  );

  // Get today's strain/workouts
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStrain = await query<{
    value: any;
    recorded_at: Date;
  }>(
    `SELECT value, recorded_at FROM health_data_records
     WHERE user_id = $1 AND provider = 'whoop' AND data_type = 'strain'
     AND recorded_at >= $2
     ORDER BY recorded_at DESC LIMIT 1`,
    [userId, today]
  );

  // Get trends for date range
  const recoveryTrend = await query<{
    value: any;
    recorded_at: Date;
  }>(
    `SELECT value, recorded_at FROM health_data_records
     WHERE user_id = $1 AND provider = 'whoop' AND data_type = 'recovery'
     AND recorded_at >= $2 AND recorded_at <= $3
     ORDER BY recorded_at ASC`,
    [userId, effectiveStartDate, effectiveEndDate]
  );

  const sleepTrend = await query<{
    value: any;
    recorded_at: Date;
  }>(
    `SELECT value, recorded_at FROM health_data_records
     WHERE user_id = $1 AND provider = 'whoop' AND data_type = 'sleep'
     AND recorded_at >= $2 AND recorded_at <= $3
     ORDER BY recorded_at ASC`,
    [userId, effectiveStartDate, effectiveEndDate]
  );

  const strainTrend = await query<{
    value: any;
    recorded_at: Date;
  }>(
    `SELECT value, recorded_at FROM health_data_records
     WHERE user_id = $1 AND provider = 'whoop' AND data_type = 'strain'
     AND recorded_at >= $2 AND recorded_at <= $3
     ORDER BY recorded_at ASC`,
    [userId, effectiveStartDate, effectiveEndDate]
  );

  const currentRecovery = latestRecovery.rows[0]
    ? {
        score: latestRecovery.rows[0].value.recovery_score || 0,
        hrv: latestRecovery.rows[0].value.hrv_rmssd_milli || latestRecovery.rows[0].value.hrv_rmssd_ms || 0,
        rhr: latestRecovery.rows[0].value.resting_heart_rate_bpm || latestRecovery.rows[0].value.resting_heart_rate || 0,
        spo2: latestRecovery.rows[0].value.spo2_percentage || latestRecovery.rows[0].value.spo2_percent || undefined,
        skinTemp: latestRecovery.rows[0].value.skin_temp_celsius || undefined,
        timestamp: latestRecovery.rows[0].recorded_at.toISOString(),
      }
    : null;

  const currentSleep = latestSleep.rows[0]
    ? {
        // Try multiple field paths for duration (different WHOOP API versions/data formats)
        duration: latestSleep.rows[0].value.duration_minutes
          || latestSleep.rows[0].value.duration
          // Calculate from stages if direct duration not available
          || ((latestSleep.rows[0].value.stages?.light_minutes || 0)
            + (latestSleep.rows[0].value.stages?.deep_minutes || 0)
            + (latestSleep.rows[0].value.stages?.rem_minutes || 0))
          || 0,
        quality: latestSleep.rows[0].value.sleep_quality_score
          || latestSleep.rows[0].value.sleep_performance_percentage
          || 0,
        efficiency: latestSleep.rows[0].value.sleep_efficiency_percent
          || latestSleep.rows[0].value.sleep_efficiency_percentage
          || 0,
        timestamp: latestSleep.rows[0].recorded_at.toISOString(),
      }
    : null;

  const todayStrainData = todayStrain.rows[0]
    ? {
        score: todayStrain.rows[0].value.strain_score || 0,
        normalized: todayStrain.rows[0].value.strain_score_normalized || 0,
        avgHeartRate: todayStrain.rows[0].value.avg_heart_rate_bpm || todayStrain.rows[0].value.average_heart_rate || undefined,
        maxHeartRate: todayStrain.rows[0].value.max_heart_rate_bpm || todayStrain.rows[0].value.max_heart_rate || undefined,
        calories: todayStrain.rows[0].value.calories_kcal || (todayStrain.rows[0].value.kilojoule ? Math.round((todayStrain.rows[0].value.kilojoule || 0) / 4.184) : undefined),
        timestamp: todayStrain.rows[0].recorded_at.toISOString(),
      }
    : null;

  // Map trends to number arrays for proper chart display
  const recovery7d = recoveryTrend.rows.map((r) => r.value?.recovery_score || 0);
  const sleep7d = sleepTrend.rows.map((r) => {
    const v = r.value;
    return v?.duration_minutes
      || v?.duration
      || ((v?.stages?.light_minutes || 0) + (v?.stages?.deep_minutes || 0) + (v?.stages?.rem_minutes || 0))
      || 0;
  });
  const strain7d = strainTrend.rows.map((r) => r.value?.strain_score || 0);

  const result = {
    currentRecovery,
    currentSleep,
    todayStrain: todayStrainData,
    trends: {
      recovery7d,
      sleep7d,
      strain7d,
    },
  };

  return result;
}

/**
 * Get recovery trends
 * @param userId - User ID
 * @param days - Number of days (used if startDate/endDate not provided)
 * @param startDate - Optional start date for date range filtering
 * @param endDate - Optional end date for date range filtering
 */
export async function getRecoveryTrends(
  userId: string,
  days: number = 30,
  startDate?: Date,
  endDate?: Date
): Promise<RecoveryTrend[]> {
  // Use date range or calculate from days
  let effectiveStartDate: Date;
  let effectiveEndDate: Date;

  if (startDate && endDate) {
    if (endDate < startDate) {
      throw new Error('End date must be after start date');
    }
    const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff > 90) {
      throw new Error('Date range cannot exceed 90 days');
    }
    effectiveStartDate = startDate;
    effectiveEndDate = endDate;
  } else {
    // Calculate from days parameter
    effectiveEndDate = new Date();
    effectiveEndDate.setHours(23, 59, 59, 999);
    effectiveStartDate = new Date();
    effectiveStartDate.setDate(effectiveStartDate.getDate() - days);
    effectiveStartDate.setHours(0, 0, 0, 0);
    
    // Validate calculated range doesn't exceed 90 days
    const calculatedDaysDiff = Math.ceil((effectiveEndDate.getTime() - effectiveStartDate.getTime()) / (1000 * 60 * 60 * 24));
    if (calculatedDaysDiff > 90) {
      throw new Error('Date range cannot exceed 90 days');
    }
  }

  const result = await query<{
    value: any;
    recorded_at: Date;
  }>(
    `SELECT value, recorded_at FROM health_data_records
     WHERE user_id = $1 AND provider = 'whoop' AND data_type = 'recovery'
     AND recorded_at >= $2 AND recorded_at <= $3
     ORDER BY recorded_at ASC`,
    [userId, effectiveStartDate, effectiveEndDate]
  );

  const trends = result.rows.map((row) => ({
    date: row.recorded_at.toISOString(),
    recovery_score: row.value.recovery_score || 0,
    hrv_rmssd_ms: row.value.hrv_rmssd_ms || 0,
    resting_heart_rate_bpm: row.value.resting_heart_rate_bpm || 0,
    skin_temp_celsius: row.value.skin_temp_celsius || undefined,
    spo2_percent: row.value.spo2_percent || undefined,
  }));

  return trends;
}

/**
 * Get sleep trends
 * @param userId - User ID
 * @param days - Number of days (used if startDate/endDate not provided)
 * @param startDate - Optional start date for date range filtering
 * @param endDate - Optional end date for date range filtering
 */
export async function getSleepTrends(
  userId: string,
  days: number = 30,
  startDate?: Date,
  endDate?: Date
): Promise<SleepTrend[]> {
  // Use date range or calculate from days
  let effectiveStartDate: Date;
  let effectiveEndDate: Date;

  if (startDate && endDate) {
    if (endDate < startDate) {
      throw new Error('End date must be after start date');
    }
    const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff > 90) {
      throw new Error('Date range cannot exceed 90 days');
    }
    effectiveStartDate = startDate;
    effectiveEndDate = endDate;
  } else {
    // Calculate from days parameter
    effectiveEndDate = new Date();
    effectiveEndDate.setHours(23, 59, 59, 999);
    effectiveStartDate = new Date();
    effectiveStartDate.setDate(effectiveStartDate.getDate() - days);
    effectiveStartDate.setHours(0, 0, 0, 0);
    
    // Validate calculated range doesn't exceed 90 days
    const calculatedDaysDiff = Math.ceil((effectiveEndDate.getTime() - effectiveStartDate.getTime()) / (1000 * 60 * 60 * 24));
    if (calculatedDaysDiff > 90) {
      throw new Error('Date range cannot exceed 90 days');
    }
  }

  const result = await query<{
    value: any;
    recorded_at: Date;
  }>(
    `SELECT value, recorded_at FROM health_data_records
     WHERE user_id = $1 AND provider = 'whoop' AND data_type = 'sleep'
     AND recorded_at >= $2 AND recorded_at <= $3
     ORDER BY recorded_at ASC`,
    [userId, effectiveStartDate, effectiveEndDate]
  );

  const trends = result.rows.map((row) => {
    const v = row.value;
    const durationMinutes = v.duration_minutes
      || v.duration
      || ((v.stages?.light_minutes || 0) + (v.stages?.deep_minutes || 0) + (v.stages?.rem_minutes || 0))
      || 0;
    return {
      date: row.recorded_at.toISOString(),
      duration_minutes: durationMinutes,
      sleep_quality_score: v.sleep_quality_score || v.sleep_performance_percentage || 0,
      sleep_efficiency_percent: v.sleep_efficiency_percent || v.sleep_efficiency_percentage || 0,
      rem_minutes: v.stages?.rem_minutes || 0,
      deep_minutes: v.stages?.deep_minutes || 0,
    };
  });

  return trends;
}

/**
 * Get strain trends
 * @param userId - User ID
 * @param days - Number of days (used if startDate/endDate not provided)
 * @param startDate - Optional start date for date range filtering
 * @param endDate - Optional end date for date range filtering
 */
export async function getStrainTrends(
  userId: string,
  days: number = 30,
  startDate?: Date,
  endDate?: Date
): Promise<StrainTrend[]> {
  // Use date range or calculate from days
  let effectiveStartDate: Date;
  let effectiveEndDate: Date;

  if (startDate && endDate) {
    if (endDate < startDate) {
      throw new Error('End date must be after start date');
    }
    const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff > 90) {
      throw new Error('Date range cannot exceed 90 days');
    }
    effectiveStartDate = startDate;
    effectiveEndDate = endDate;
  } else {
    // Calculate from days parameter
    effectiveEndDate = new Date();
    effectiveEndDate.setHours(23, 59, 59, 999);
    effectiveStartDate = new Date();
    effectiveStartDate.setDate(effectiveStartDate.getDate() - days);
    effectiveStartDate.setHours(0, 0, 0, 0);
    
    // Validate calculated range doesn't exceed 90 days
    const calculatedDaysDiff = Math.ceil((effectiveEndDate.getTime() - effectiveStartDate.getTime()) / (1000 * 60 * 60 * 24));
    if (calculatedDaysDiff > 90) {
      throw new Error('Date range cannot exceed 90 days');
    }
  }

  const result = await query<{
    value: any;
    recorded_at: Date;
  }>(
    `SELECT value, recorded_at FROM health_data_records
     WHERE user_id = $1 AND provider = 'whoop' AND data_type = 'strain'
     AND recorded_at >= $2 AND recorded_at <= $3
     ORDER BY recorded_at ASC`,
    [userId, effectiveStartDate, effectiveEndDate]
  );

  const trends = result.rows.map((row) => ({
    date: row.recorded_at.toISOString(),
    strain_score: row.value.strain_score || 0,
    strain_score_normalized: row.value.strain_score_normalized || 0,
    avg_heart_rate_bpm: row.value.avg_heart_rate_bpm || 0,
    calories_kcal: row.value.calories_kcal || 0,
  }));

  return trends;
}

/**
 * Get cycle analysis (24-hour physiological cycles)
 * @param userId - User ID
 * @param days - Number of days (used if startDate/endDate not provided)
 * @param startDate - Optional start date for date range filtering
 * @param endDate - Optional end date for date range filtering
 */
export async function getCycleAnalysis(
  userId: string,
  days: number = 7,
  startDate?: Date,
  endDate?: Date
): Promise<any[]> {
  // Use date range or calculate from days
  let effectiveStartDate: Date;
  let effectiveEndDate: Date;

  if (startDate && endDate) {
    if (endDate < startDate) {
      throw new Error('End date must be after start date');
    }
    const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff > 90) {
      // Auto-adjust: keep end date and move start date back 90 days
      const adjustedStartDate = new Date(endDate);
      adjustedStartDate.setDate(adjustedStartDate.getDate() - 90);
      adjustedStartDate.setHours(0, 0, 0, 0);
      effectiveStartDate = adjustedStartDate;
      effectiveEndDate = endDate;
      logger.warn('[WHOOP Analytics] Date range exceeded 90 days, auto-adjusted', {
        userId,
        originalStartDate: startDate.toISOString(),
        originalEndDate: endDate.toISOString(),
        originalDays: daysDiff,
        adjustedStartDate: effectiveStartDate.toISOString(),
        adjustedDays: 90,
      });
    } else {
      effectiveStartDate = startDate;
      effectiveEndDate = endDate;
    }
  } else {
    effectiveEndDate = new Date();
    effectiveStartDate = new Date();
    effectiveStartDate.setDate(effectiveStartDate.getDate() - days);
  }

  // Import getWhoopAccessToken dynamically to avoid circular dependency
  const { getWhoopAccessToken } = await import('./whoop.service.js');
  
  try {
    // Get access token
    const accessToken = await getWhoopAccessToken(userId);
    if (!accessToken) {
      return [];
    }

    // Fetch cycles from WHOOP API with pagination support
    const whoopApiBase = 'https://api.prod.whoop.com/developer/v2';
    const allCycles: Array<{
      id: number;
      user_id: number;
      created_at: string;
      updated_at: string;
      start: string;
      end: string;
      timezone_offset: string;
      score_state: string;
      score?: {
        strain?: number;
        kilojoule?: number;
        average_heart_rate?: number;
        max_heart_rate?: number;
      };
    }> = [];

    let nextToken: string | undefined = undefined;
    let hasMore = true;

    // Fetch all cycles using pagination
    while (hasMore) {
      const params = new URLSearchParams({
        start: effectiveStartDate.toISOString(),
        end: effectiveEndDate.toISOString(),
        limit: '25', // Max limit per WHOOP API
      });

      if (nextToken) {
        params.append('nextToken', nextToken);
      }

      const cyclesResponse = await fetch(`${whoopApiBase}/cycle?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!cyclesResponse.ok) {
        if (cyclesResponse.status === 401) {
          // Token expired, return what we have
          break;
        }
        throw new Error(`WHOOP API error: ${cyclesResponse.status}`);
      }

      const cyclesData = await cyclesResponse.json() as {
        records: Array<{
          id: number;
          user_id: number;
          created_at: string;
          updated_at: string;
          start: string;
          end: string;
          timezone_offset: string;
          score_state: string;
          score?: {
            strain?: number;
            kilojoule?: number;
            average_heart_rate?: number;
            max_heart_rate?: number;
          };
        }>;
        next_token?: string;
      };

      allCycles.push(...cyclesData.records);
      nextToken = cyclesData.next_token;
      hasMore = !!nextToken && cyclesData.records.length > 0;
    }

    const cyclesData = { records: allCycles };

    // Fetch sleep and workout data for each cycle
    const cyclesWithDetails = await Promise.all(
      cyclesData.records.map(async (cycle) => {
        try {
          // Fetch sleep for this cycle
          let sleepData = null;
          try {
            const sleepResponse = await fetch(`${whoopApiBase}/cycle/${cycle.id}/sleep`, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
            });
            if (sleepResponse.ok) {
              sleepData = await sleepResponse.json();
              // Log sleep data structure for debugging
              if (sleepData && typeof sleepData === 'object' && !(sleepData as any).score?.stage_summary && !(sleepData as any).stage_summary) {
                logger.debug('[WHOOP Analytics] Sleep data missing stage_summary', {
                  cycleId: cycle.id,
                  hasSleep: !!sleepData,
                  hasScore: !!(sleepData as any)?.score,
                  scoreKeys: (sleepData as any)?.score ? Object.keys((sleepData as any).score) : [],
                });
              }
            } else {
              logger.debug('[WHOOP Analytics] Sleep fetch failed', {
                cycleId: cycle.id,
                status: sleepResponse.status,
                statusText: sleepResponse.statusText,
              });
            }
          } catch (_sleepError) {
            // Ignore sleep fetch errors
          }

          // Fetch recovery for this cycle
          let recoveryData = null;
          try {
            const recoveryResponse = await fetch(`${whoopApiBase}/cycle/${cycle.id}/recovery`, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
            });
            if (recoveryResponse.ok) {
              recoveryData = await recoveryResponse.json();
              // Log recovery data structure for debugging
              if (recoveryData && typeof recoveryData === 'object' && !(recoveryData as any).score?.spo2_percentage && !(recoveryData as any).score?.spo2_percent) {
                logger.debug('[WHOOP Analytics] Recovery data missing SPO2', {
                  cycleId: cycle.id,
                  hasRecovery: !!recoveryData,
                  hasScore: !!(recoveryData as any)?.score,
                  scoreKeys: (recoveryData as any)?.score ? Object.keys((recoveryData as any).score) : [],
                });
              }
            } else {
              logger.debug('[WHOOP Analytics] Recovery fetch failed', {
                cycleId: cycle.id,
                status: recoveryResponse.status,
                statusText: recoveryResponse.statusText,
              });
            }
          } catch (_recoveryError) {
            // Ignore recovery fetch errors
          }

          // Fetch workouts for this cycle period
          let workoutsData = null;
          try {
            const workoutsParams = new URLSearchParams({
              start: cycle.start,
              end: cycle.end,
              limit: '25',
            });
            const workoutsResponse = await fetch(`${whoopApiBase}/activity/workout?${workoutsParams.toString()}`, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
            });
            if (workoutsResponse.ok) {
              workoutsData = await workoutsResponse.json() as {
                records: Array<{
                  id: string;
                  sport_name?: string;
                  score?: {
                    strain?: number;
                    average_heart_rate?: number;
                    max_heart_rate?: number;
                    kilojoule?: number;
                    distance_meter?: number;
                    altitude_gain_meter?: number;
                  };
                }>;
              };
            }
          } catch (_workoutError) {
            // Ignore workout fetch errors
          }

          return {
            id: cycle.id,
            user_id: cycle.user_id,
            created_at: cycle.created_at,
            updated_at: cycle.updated_at,
            start: cycle.start,
            end: cycle.end,
            timezone_offset: cycle.timezone_offset,
            score_state: cycle.score_state,
            score: cycle.score,
            sleep: sleepData,
            recovery: recoveryData,
            workouts: workoutsData?.records || [],
          };
        } catch (error) {
          // Return cycle without details if fetch fails
          return {
            id: cycle.id,
            user_id: cycle.user_id,
            created_at: cycle.created_at,
            updated_at: cycle.updated_at,
            start: cycle.start,
            end: cycle.end,
            timezone_offset: cycle.timezone_offset,
            score_state: cycle.score_state,
            score: cycle.score,
            sleep: null,
            recovery: null,
            workouts: [],
          };
        }
      })
    );

    return cyclesWithDetails;
  } catch (error) {
    // Return empty array on error
    return [];
  }
}

/**
 * Get user health profile (daily metrics)
 * @param userId - User ID
 * @param startDate - Start date (defaults to today)
 * @param endDate - End date (defaults to today)
 */
export async function getUserHealthProfile(
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<{
  currentRecovery: {
    score: number;
    hrv: number;
    rhr: number;
    spo2?: number;
    skinTemp?: number;
    timestamp: string;
  } | null;
  currentSleep: {
    duration: number;
    quality: number;
    efficiency: number;
    timestamp: string;
  } | null;
  todayStrain: {
    score: number;
    normalized: number;
    avgHeartRate?: number;
    maxHeartRate?: number;
    calories?: number;
    timestamp: string;
  } | null;
  waterIntake: {
    mlConsumed: number;
    targetMl: number;
    percentage: number;
    timestamp: string;
  } | null;
  stress: {
    level: number;
    timestamp: string;
  } | null;
  _meta?: {
    hasIntegration: boolean;
    integrationStatus: string | null;
    lastSyncAt: Date | null;
    hasAnyData: boolean;
    dataTypes: string[];
  };
}> {
  // First, check if WHOOP integration exists and is connected
  const integrationCheck = await query<{ id: string; status: string; last_sync_at: Date | null }>(
    `SELECT id, status, last_sync_at FROM user_integrations
     WHERE user_id = $1 AND provider = 'whoop' AND (status = 'active' OR status = 'pending')`,
    [userId]
  );

  const hasIntegration = integrationCheck.rows.length > 0;

  // Only check for WHOOP data if user has an integration
  let hasAnyData = false;
  let dataTypes: string[] = [];

  if (hasIntegration) {
    const anyDataCheck = await query<{ count: string; data_types: string[] }>(
      `SELECT
         COUNT(*) as count,
         ARRAY_AGG(DISTINCT data_type) as data_types
       FROM health_data_records
       WHERE user_id = $1 AND provider = 'whoop'`,
      [userId]
    );
    hasAnyData = parseInt(anyDataCheck.rows[0]?.count || '0') > 0;
    dataTypes = anyDataCheck.rows[0]?.data_types || [];
  }

  // Only log WHOOP status when user actually has an integration (reduces noise)
  if (hasIntegration) {
    logger.debug('[getUserHealthProfile] WHOOP status', { userId, hasAnyData });
  }

  // If WHOOP is connected but no data exists, log a warning
  if (hasIntegration && !hasAnyData) {
    logger.warn('[getUserHealthProfile] WHOOP connected but no data synced', {
      userId,
      integrationId: integrationCheck.rows[0].id,
      lastSyncAt: integrationCheck.rows[0].last_sync_at,
    });
  }

  // Water intake + HRV are fetched regardless of WHOOP status
  const dateStr = startDate.toISOString().split('T')[0];
  const [waterIntakeResult, stressResult] = await Promise.all([
    query<{ ml_consumed: number; target_ml: number; updated_at: Date }>(
      `SELECT ml_consumed, target_ml, updated_at FROM water_intake_logs
       WHERE user_id = $1 AND log_date = $2
       LIMIT 1`,
      [userId, dateStr]
    ),
    query<{ value: any; recorded_at: Date }>(
      `SELECT value, recorded_at FROM health_data_records
       WHERE user_id = $1 AND data_type = 'hrv'
       AND recorded_at >= $2 AND recorded_at <= $3
       ORDER BY recorded_at DESC LIMIT 1`,
      [userId, startDate, endDate]
    ),
  ]);

  // Skip WHOOP-specific queries if no integration and no data
  let latestRecovery: { rows: Array<{ value: any; recorded_at: Date }> } = { rows: [] };
  let latestSleep: { rows: Array<{ value: any; recorded_at: Date }> } = { rows: [] };
  let todayStrain: { rows: Array<{ value: any; recorded_at: Date }> } = { rows: [] };

  if (hasAnyData) {
    // Fetch all WHOOP data types in parallel
    const [recoveryResult, sleepResult, strainResult] = await Promise.all([
      query<{ value: any; recorded_at: Date }>(
        `SELECT value, recorded_at FROM health_data_records
         WHERE user_id = $1 AND provider = 'whoop' AND data_type = 'recovery'
         AND recorded_at >= $2 AND recorded_at <= $3
         ORDER BY recorded_at DESC LIMIT 1`,
        [userId, startDate, endDate]
      ),
      query<{ value: any; recorded_at: Date }>(
        `SELECT value, recorded_at FROM health_data_records
         WHERE user_id = $1 AND provider = 'whoop' AND data_type = 'sleep'
         AND recorded_at >= $2 AND recorded_at <= $3
         ORDER BY recorded_at DESC LIMIT 1`,
        [userId, startDate, endDate]
      ),
      query<{ value: any; recorded_at: Date }>(
        `SELECT value, recorded_at FROM health_data_records
         WHERE user_id = $1 AND provider = 'whoop' AND data_type = 'strain'
         AND recorded_at >= $2 AND recorded_at <= $3
         ORDER BY recorded_at DESC LIMIT 1`,
        [userId, startDate, endDate]
      ),
    ]);

    // Fallback to latest available if no data in date range
    const [recoveryFallback, sleepFallback, strainFallback] = await Promise.all([
      recoveryResult.rows.length === 0
        ? query<{ value: any; recorded_at: Date }>(
            `SELECT value, recorded_at FROM health_data_records
             WHERE user_id = $1 AND provider = 'whoop' AND data_type = 'recovery'
             ORDER BY recorded_at DESC LIMIT 1`,
            [userId]
          )
        : recoveryResult,
      sleepResult.rows.length === 0
        ? query<{ value: any; recorded_at: Date }>(
            `SELECT value, recorded_at FROM health_data_records
             WHERE user_id = $1 AND provider = 'whoop' AND data_type = 'sleep'
             ORDER BY recorded_at DESC LIMIT 1`,
            [userId]
          )
        : sleepResult,
      strainResult.rows.length === 0
        ? query<{ value: any; recorded_at: Date }>(
            `SELECT value, recorded_at FROM health_data_records
             WHERE user_id = $1 AND provider = 'whoop' AND data_type = 'strain'
             ORDER BY recorded_at DESC LIMIT 1`,
            [userId]
          )
        : strainResult,
    ]);

    latestRecovery = recoveryFallback;
    latestSleep = sleepFallback;
    todayStrain = strainFallback;
  }

  // Format recovery data from WHOOP health_data_records
  let currentRecovery = latestRecovery.rows[0]
    ? {
        score: latestRecovery.rows[0].value?.recovery_score || 0,
        hrv: latestRecovery.rows[0].value?.hrv_rmssd_milli || latestRecovery.rows[0].value?.hrv_rmssd_ms || 0,
        rhr: latestRecovery.rows[0].value?.resting_heart_rate_bpm || latestRecovery.rows[0].value?.resting_heart_rate || 0,
        spo2: latestRecovery.rows[0].value?.spo2_percentage || latestRecovery.rows[0].value?.spo2_percent || undefined,
        skinTemp: latestRecovery.rows[0].value?.skin_temp_celsius || undefined,
        timestamp: latestRecovery.rows[0].recorded_at.toISOString(),
      }
    : null;

  // Format sleep data - try multiple field paths (different WHOOP API versions/data formats)
  let currentSleep = latestSleep.rows[0]
    ? {
        // Try multiple field paths for duration (different WHOOP API versions/data formats)
        duration: latestSleep.rows[0].value?.duration_minutes
          || latestSleep.rows[0].value?.duration
          // Calculate from stages if direct duration not available
          || ((latestSleep.rows[0].value?.stages?.light_minutes || 0)
            + (latestSleep.rows[0].value?.stages?.deep_minutes || 0)
            + (latestSleep.rows[0].value?.stages?.rem_minutes || 0))
          || 0,
        quality: latestSleep.rows[0].value?.sleep_quality_score
          || latestSleep.rows[0].value?.sleep_performance_percentage
          || 0,
        efficiency: latestSleep.rows[0].value?.sleep_efficiency_percent
          || latestSleep.rows[0].value?.sleep_efficiency_percentage
          || 0,
        timestamp: latestSleep.rows[0].recorded_at.toISOString(),
      }
    : null;

  // Format strain data
  let todayStrainData = todayStrain.rows[0]
    ? {
        score: todayStrain.rows[0].value?.strain_score || 0,
        normalized: todayStrain.rows[0].value?.strain_score_normalized || 0,
        avgHeartRate: todayStrain.rows[0].value?.avg_heart_rate_bpm || todayStrain.rows[0].value?.average_heart_rate || undefined,
        maxHeartRate: todayStrain.rows[0].value?.max_heart_rate_bpm || todayStrain.rows[0].value?.max_heart_rate || undefined,
        calories: todayStrain.rows[0].value?.calories_kcal || (todayStrain.rows[0].value?.kilojoule ? Math.round((todayStrain.rows[0].value.kilojoule || 0) / 4.184) : undefined),
        timestamp: todayStrain.rows[0].recorded_at.toISOString(),
      }
    : null;

  // Fallback: If no WHOOP health_data_records, try daily_health_metrics and users table
  if (!currentRecovery && !currentSleep && !todayStrainData) {
    // Most users won't have WHOOP — don't log at debug level to reduce noise

    // Try daily_health_metrics table first (historical records)
    const dailyMetrics = await query<{
      sleep_hours: number | null;
      recovery_score: number | null;
      strain_score: number | null;
      metric_date: Date;
      updated_at: Date;
    }>(
      `SELECT sleep_hours, recovery_score, strain_score, metric_date, updated_at
       FROM daily_health_metrics
       WHERE user_id = $1
       ORDER BY metric_date DESC LIMIT 1`,
      [userId]
    );

    // If no daily_health_metrics, try users table snapshot
    const userSnapshot = dailyMetrics.rows.length === 0
      ? await query<{
          daily_sleep_hours: number | null;
          daily_recovery_score: number | null;
          daily_strain_score: number | null;
          daily_health_updated_at: Date | null;
        }>(
          `SELECT daily_sleep_hours, daily_recovery_score, daily_strain_score, daily_health_updated_at
           FROM users WHERE id = $1`,
          [userId]
        )
      : null;

    const fallbackRow = dailyMetrics.rows[0];
    const userRow = userSnapshot?.rows[0];

    const fallbackSleep = fallbackRow?.sleep_hours ?? userRow?.daily_sleep_hours;
    const fallbackRecovery = fallbackRow?.recovery_score ?? userRow?.daily_recovery_score;
    const fallbackStrain = fallbackRow?.strain_score ?? userRow?.daily_strain_score;
    const fallbackTimestamp = fallbackRow?.updated_at?.toISOString()
      || userRow?.daily_health_updated_at?.toISOString()
      || new Date().toISOString();

    if (fallbackRecovery !== null && fallbackRecovery !== undefined) {
      currentRecovery = {
        score: fallbackRecovery,
        hrv: 0,
        rhr: 0,
        spo2: undefined,
        skinTemp: undefined,
        timestamp: fallbackTimestamp,
      };
    }

    if (fallbackSleep !== null && fallbackSleep !== undefined) {
      const sleepMinutes = Math.round(fallbackSleep * 60);
      currentSleep = {
        duration: sleepMinutes,
        quality: Math.min(100, Math.round((fallbackSleep / 8) * 100)),
        efficiency: 0,
        timestamp: fallbackTimestamp,
      };
    }

    if (fallbackStrain !== null && fallbackStrain !== undefined) {
      todayStrainData = {
        score: fallbackStrain,
        normalized: Math.min(100, Math.round((fallbackStrain / 21) * 100)),
        avgHeartRate: undefined,
        maxHeartRate: undefined,
        calories: undefined,
        timestamp: fallbackTimestamp,
      };
    }

    if (fallbackRecovery || fallbackSleep || fallbackStrain) {
      logger.debug('[getUserHealthProfile] Found fallback data', {
        userId,
        source: fallbackRow ? 'daily_health_metrics' : 'users_snapshot',
        recovery: fallbackRecovery,
        sleep: fallbackSleep,
        strain: fallbackStrain,
      });
    }

    // Final fallback: try daily_user_scores (AI-calculated health scores)
    if (!currentRecovery && !currentSleep && !todayStrainData) {
      const dailyScores = await query<{
        total_score: number;
        component_scores: { biometrics?: number; workout?: number; wellbeing?: number };
        date: Date;
      }>(
        `SELECT total_score, component_scores, date
         FROM daily_user_scores
         WHERE user_id = $1
         ORDER BY date DESC LIMIT 1`,
        [userId]
      );

      if (dailyScores.rows[0]) {
        const scoreRow = dailyScores.rows[0];
        const components = scoreRow.component_scores;
        const scoreTimestamp = scoreRow.date instanceof Date
          ? scoreRow.date.toISOString()
          : new Date().toISOString();

        // Map biometrics component to recovery score
        if (components?.biometrics) {
          currentRecovery = {
            score: Math.round(components.biometrics),
            hrv: 0,
            rhr: 0,
            spo2: undefined,
            skinTemp: undefined,
            timestamp: scoreTimestamp,
          };
        }

        logger.debug('[getUserHealthProfile] Found daily_user_scores fallback', {
          userId,
          totalScore: scoreRow.total_score,
          biometrics: components?.biometrics,
        });
      }
    }
  }

  // Format water intake data
  const waterIntake = waterIntakeResult.rows[0]
    ? {
        mlConsumed: waterIntakeResult.rows[0].ml_consumed || 0,
        targetMl: waterIntakeResult.rows[0].target_ml || 2000,
        percentage: waterIntakeResult.rows[0].target_ml > 0
          ? Math.min(100, Math.round((waterIntakeResult.rows[0].ml_consumed / waterIntakeResult.rows[0].target_ml) * 100))
          : 0,
        timestamp: waterIntakeResult.rows[0].updated_at.toISOString(),
      }
    : null;

  // Format stress data - calculate from recovery score if stress not available
  // Lower recovery = higher stress (inverse relationship)
  let stressLevel = null;
  if (stressResult.rows[0]) {
    const stressValue = stressResult.rows[0].value;
    if (stressValue?.stress_level !== undefined) {
      stressLevel = stressValue.stress_level;
    } else if (stressValue?.stress_score !== undefined) {
      stressLevel = stressValue.stress_score;
    }
  }

  // If no direct stress data, calculate from recovery score (inverse: low recovery = high stress)
  if (stressLevel === null && currentRecovery) {
    // Convert recovery (0-100) to stress (0-100) where 0 recovery = 100 stress
    stressLevel = Math.max(0, Math.min(100, 100 - currentRecovery.score));
  }

  const stress = stressLevel !== null
    ? {
        level: stressLevel,
        timestamp: stressResult.rows[0]?.recorded_at?.toISOString() || currentRecovery?.timestamp || new Date().toISOString(),
      }
    : null;

  // Determine if user has any data source (WHOOP integration OR fallback data)
  const hasAnBalenciaData = hasAnyData || !!(currentRecovery || currentSleep || todayStrainData);

  // Return health profile with integration status info
  return {
    currentRecovery,
    currentSleep,
    todayStrain: todayStrainData,
    waterIntake,
    stress,
    // Include integration status for better UX
    _meta: {
      hasIntegration: hasIntegration || hasAnBalenciaData,
      integrationStatus: integrationCheck.rows[0]?.status || (hasAnBalenciaData ? 'active' : null),
      lastSyncAt: integrationCheck.rows[0]?.last_sync_at || null,
      hasAnyData: hasAnBalenciaData,
      dataTypes,
    },
  };
}

export const whoopAnalyticsService = {
  getWhoopOverview,
  getRecoveryTrends,
  getSleepTrends,
  getStrainTrends,
  getCycleAnalysis,
  getUserHealthProfile,
};


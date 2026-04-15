/**
 * Medical Safety Validation Service
 *
 * Validates user health data before plan generation to ensure safety.
 * Identifies medical conditions or health metrics that require
 * professional consultation before proceeding.
 */

import { logger } from './logger.service.js';

// Risk level categories
export type RiskLevel = 'none' | 'low' | 'moderate' | 'high' | 'critical';

// Medical conditions that require caution
export type MedicalCondition =
  | 'heart_disease'
  | 'diabetes'
  | 'hypertension'
  | 'thyroid_disorder'
  | 'eating_disorder'
  | 'pregnancy'
  | 'recent_surgery'
  | 'chronic_pain'
  | 'respiratory_condition'
  | 'kidney_disease'
  | 'liver_disease'
  | 'autoimmune_disease'
  | 'cancer'
  | 'mental_health'
  | 'other';

export interface UserHealthData {
  age: number;
  gender: 'male' | 'female' | 'non_binary' | 'prefer_not_to_say';
  weightKg: number;
  heightCm: number;
  bodyFatPercentage?: number;
  medicalConditions?: MedicalCondition[];
  medications?: string[];
  allergies?: string[];
  injuries?: string[];
  pregnantOrNursing?: boolean;
  bloodPressure?: {
    systolic: number;
    diastolic: number;
  };
  restingHeartRate?: number;
  hasRecentSurgery?: boolean;
  surgerySince?: Date;
}

export interface GoalSafetyCheck {
  goalType: string;
  targetWeightKg?: number;
  weeklyWeightChangeKg?: number;
  activityLevel?: string;
  exerciseIntensity?: string;
}

export interface SafetyValidationResult {
  isApproved: boolean;
  riskLevel: RiskLevel;
  requiresDoctorConsult: boolean;
  warnings: SafetyWarning[];
  restrictions: string[];
  recommendations: string[];
  disclaimers: string[];
}

export interface SafetyWarning {
  code: string;
  severity: RiskLevel;
  message: string;
  recommendation: string;
  requiresConsent: boolean;
}

// BMI categories (WHO standards)
interface BMICategory {
  min: number;
  max: number;
  category: string;
  riskLevel: RiskLevel;
}

const BMI_CATEGORIES: BMICategory[] = [
  { min: 0, max: 16, category: 'Severe underweight', riskLevel: 'critical' },
  { min: 16, max: 17, category: 'Moderate underweight', riskLevel: 'high' },
  { min: 17, max: 18.5, category: 'Mild underweight', riskLevel: 'moderate' },
  { min: 18.5, max: 25, category: 'Normal', riskLevel: 'none' },
  { min: 25, max: 30, category: 'Overweight', riskLevel: 'low' },
  { min: 30, max: 35, category: 'Obese Class I', riskLevel: 'moderate' },
  { min: 35, max: 40, category: 'Obese Class II', riskLevel: 'high' },
  { min: 40, max: 100, category: 'Obese Class III', riskLevel: 'critical' },
];

// Age thresholds
const AGE_THRESHOLDS = {
  minAge: 16,
  seniorAge: 65,
  elderlyAge: 80,
};

// Safe weight change limits (kg per week)
const WEIGHT_CHANGE_LIMITS = {
  maxLoss: 0.9,       // ~2 lbs/week
  maxGain: 0.45,      // ~1 lb/week for lean gain
  aggressiveLoss: 0.68, // ~1.5 lbs/week (needs monitoring)
};

// Note: Minimum calorie thresholds are defined in nutrition.service.ts
// male: 1500, female: 1200, absolute minimum: 1000

class SafetyService {
  /**
   * Calculate BMI from weight and height
   */
  calculateBMI(weightKg: number, heightCm: number): number {
    const heightM = heightCm / 100;
    return Math.round((weightKg / (heightM * heightM)) * 10) / 10;
  }

  /**
   * Get BMI category and risk level
   */
  getBMICategory(bmi: number): BMICategory {
    const category = BMI_CATEGORIES.find(c => bmi >= c.min && bmi < c.max);
    return category || BMI_CATEGORIES[BMI_CATEGORIES.length - 1];
  }

  /**
   * Validate user health data for plan generation
   */
  validateForPlanGeneration(
    healthData: UserHealthData,
    goalCheck: GoalSafetyCheck
  ): SafetyValidationResult {
    const warnings: SafetyWarning[] = [];
    const restrictions: string[] = [];
    const recommendations: string[] = [];
    const disclaimers: string[] = [];

    let overallRiskLevel: RiskLevel = 'none';
    let requiresDoctorConsult = false;

    // Standard disclaimers
    disclaimers.push(
      'This plan is for informational purposes only and is not medical advice.',
      'Consult with a healthcare professional before starting any new diet or exercise program.',
      'Stop any activity immediately if you experience pain, dizziness, or shortness of breath.'
    );

    // Age validation
    const ageWarnings = this.validateAge(healthData.age);
    warnings.push(...ageWarnings);
    if (ageWarnings.some(w => w.severity === 'high' || w.severity === 'critical')) {
      requiresDoctorConsult = true;
    }

    // BMI validation
    const bmi = this.calculateBMI(healthData.weightKg, healthData.heightCm);
    const bmiWarnings = this.validateBMI(bmi);
    warnings.push(...bmiWarnings);
    if (bmiWarnings.some(w => w.requiresConsent)) {
      requiresDoctorConsult = true;
    }

    // Weight loss goal validation
    if (goalCheck.targetWeightKg && goalCheck.targetWeightKg < healthData.weightKg) {
      const weightLossWarnings = this.validateWeightLoss(
        healthData,
        goalCheck.targetWeightKg,
        goalCheck.weeklyWeightChangeKg
      );
      warnings.push(...weightLossWarnings);
    }

    // Weight gain goal validation
    if (goalCheck.targetWeightKg && goalCheck.targetWeightKg > healthData.weightKg) {
      const weightGainWarnings = this.validateWeightGain(
        healthData,
        goalCheck.targetWeightKg,
        goalCheck.weeklyWeightChangeKg
      );
      warnings.push(...weightGainWarnings);
    }

    // Check weekly weight change rate even without target weight
    if (goalCheck.weeklyWeightChangeKg && !goalCheck.targetWeightKg) {
      const rateWarnings = this.validateWeightChangeRate(goalCheck.weeklyWeightChangeKg);
      warnings.push(...rateWarnings);
    }

    // Medical conditions validation
    if (healthData.medicalConditions && healthData.medicalConditions.length > 0) {
      const conditionWarnings = this.validateMedicalConditions(
        healthData.medicalConditions,
        goalCheck
      );
      warnings.push(...conditionWarnings);
      if (conditionWarnings.length > 0) {
        requiresDoctorConsult = true;
      }
    }

    // Pregnancy check
    if (healthData.pregnantOrNursing) {
      warnings.push({
        code: 'PREGNANCY_NURSING',
        severity: 'critical',
        message: 'You indicated you are pregnant or nursing.',
        recommendation: 'Weight loss programs are not recommended during pregnancy or nursing. Please consult your healthcare provider.',
        requiresConsent: true,
      });
      restrictions.push('Weight loss diets');
      restrictions.push('High-intensity exercise');
      requiresDoctorConsult = true;
    }

    // Recent surgery check
    if (healthData.hasRecentSurgery) {
      warnings.push({
        code: 'RECENT_SURGERY',
        severity: 'high',
        message: 'You indicated you have had recent surgery.',
        recommendation: 'Please get clearance from your surgeon before starting an exercise program.',
        requiresConsent: true,
      });
      requiresDoctorConsult = true;
    }

    // Generate recommendations based on warnings
    recommendations.push(...this.generateRecommendations(warnings, healthData, goalCheck));

    // Calculate overall risk level
    overallRiskLevel = this.calculateOverallRisk(warnings);

    // Determine if plan can proceed
    const isApproved = overallRiskLevel !== 'critical' || warnings.every(w => !w.requiresConsent);

    logger.info('[Safety] Validation complete', {
      bmi,
      age: healthData.age,
      riskLevel: overallRiskLevel,
      warningsCount: warnings.length,
      requiresDoctorConsult,
      isApproved,
    });

    return {
      isApproved,
      riskLevel: overallRiskLevel,
      requiresDoctorConsult,
      warnings,
      restrictions,
      recommendations,
      disclaimers,
    };
  }

  /**
   * Validate age-related risks
   */
  private validateAge(age: number): SafetyWarning[] {
    const warnings: SafetyWarning[] = [];

    if (age < AGE_THRESHOLDS.minAge) {
      warnings.push({
        code: 'AGE_UNDERAGE',
        severity: 'critical',
        message: `You are under ${AGE_THRESHOLDS.minAge} years old.`,
        recommendation: 'This program is designed for adults. Please consult a pediatrician or parent/guardian.',
        requiresConsent: true,
      });
    }

    if (age >= AGE_THRESHOLDS.elderlyAge) {
      warnings.push({
        code: 'AGE_ELDERLY',
        severity: 'moderate',
        message: 'Users over 80 may need modified exercise recommendations.',
        recommendation: 'Consider consulting with a geriatric specialist or physical therapist.',
        requiresConsent: false,
      });
    } else if (age >= AGE_THRESHOLDS.seniorAge) {
      warnings.push({
        code: 'AGE_SENIOR',
        severity: 'low',
        message: 'Users over 65 should take extra care with high-intensity exercise.',
        recommendation: 'Start slowly and focus on form. Consider strength training for bone health.',
        requiresConsent: false,
      });
    }

    return warnings;
  }

  /**
   * Validate BMI-related risks
   */
  private validateBMI(bmi: number): SafetyWarning[] {
    const warnings: SafetyWarning[] = [];
    const category = this.getBMICategory(bmi);

    if (category.riskLevel === 'critical') {
      warnings.push({
        code: 'BMI_CRITICAL',
        severity: 'critical',
        message: `Your BMI of ${bmi} indicates ${category.category}.`,
        recommendation: 'Please consult a healthcare provider before starting any diet or exercise program.',
        requiresConsent: true,
      });
    } else if (category.riskLevel === 'high') {
      warnings.push({
        code: 'BMI_HIGH_RISK',
        severity: 'high',
        message: `Your BMI of ${bmi} indicates ${category.category}.`,
        recommendation: 'We recommend consulting with a healthcare provider. A gradual approach is safest.',
        requiresConsent: true,
      });
    } else if (category.riskLevel === 'moderate') {
      warnings.push({
        code: 'BMI_MODERATE_RISK',
        severity: 'moderate',
        message: `Your BMI of ${bmi} indicates ${category.category}.`,
        recommendation: 'A moderate, sustainable approach is recommended.',
        requiresConsent: false,
      });
    }

    return warnings;
  }

  /**
   * Validate weight loss goals
   */
  private validateWeightLoss(
    healthData: UserHealthData,
    targetWeightKg: number,
    weeklyChangeKg?: number
  ): SafetyWarning[] {
    const warnings: SafetyWarning[] = [];
    const totalLoss = healthData.weightKg - targetWeightKg;
    const lossPercentage = (totalLoss / healthData.weightKg) * 100;

    // Check if target weight is too low
    const targetBMI = this.calculateBMI(targetWeightKg, healthData.heightCm);
    if (targetBMI < 18.5) {
      warnings.push({
        code: 'TARGET_UNDERWEIGHT',
        severity: 'high',
        message: 'Your target weight would result in an underweight BMI.',
        recommendation: 'Consider adjusting your target to maintain a healthy BMI of at least 18.5.',
        requiresConsent: true,
      });
    }

    // Check if loss percentage is too aggressive
    if (lossPercentage > 20) {
      warnings.push({
        code: 'AGGRESSIVE_LOSS_GOAL',
        severity: 'moderate',
        message: `Your goal involves losing ${lossPercentage.toFixed(1)}% of your body weight.`,
        recommendation: 'Consider breaking this into smaller milestones of 5-10% at a time.',
        requiresConsent: false,
      });
    }

    // Check weekly rate
    if (weeklyChangeKg && Math.abs(weeklyChangeKg) > WEIGHT_CHANGE_LIMITS.maxLoss) {
      warnings.push({
        code: 'RAPID_WEIGHT_LOSS',
        severity: 'high',
        message: `Losing ${Math.abs(weeklyChangeKg).toFixed(2)}kg per week is faster than recommended.`,
        recommendation: 'A safe rate is 0.5-0.9kg (1-2 lbs) per week to preserve muscle mass.',
        requiresConsent: true,
      });
    }

    return warnings;
  }

  /**
   * Validate weight gain goals
   */
  private validateWeightGain(
    healthData: UserHealthData,
    targetWeightKg: number,
    weeklyChangeKg?: number
  ): SafetyWarning[] {
    const warnings: SafetyWarning[] = [];

    // Check if target weight is too high
    const targetBMI = this.calculateBMI(targetWeightKg, healthData.heightCm);
    if (targetBMI >= 30) {
      warnings.push({
        code: 'TARGET_OBESE',
        severity: 'moderate',
        message: 'Your target weight would result in an obese BMI classification.',
        recommendation: 'Consider a more moderate weight gain target for optimal health.',
        requiresConsent: false,
      });
    }

    // Check weekly rate for muscle building
    if (weeklyChangeKg && weeklyChangeKg > WEIGHT_CHANGE_LIMITS.maxGain) {
      warnings.push({
        code: 'RAPID_WEIGHT_GAIN',
        severity: 'low',
        message: `Gaining ${weeklyChangeKg.toFixed(2)}kg per week may result in excess fat gain.`,
        recommendation: 'For lean muscle gains, aim for 0.25-0.45kg (0.5-1 lb) per week.',
        requiresConsent: false,
      });
    }

    return warnings;
  }

  /**
   * Validate weekly weight change rate (used when no target weight specified)
   */
  private validateWeightChangeRate(weeklyChangeKg: number): SafetyWarning[] {
    const warnings: SafetyWarning[] = [];

    // Check for rapid weight loss
    if (weeklyChangeKg < 0 && Math.abs(weeklyChangeKg) > WEIGHT_CHANGE_LIMITS.maxLoss) {
      warnings.push({
        code: 'RAPID_WEIGHT_LOSS',
        severity: 'high',
        message: `Losing ${Math.abs(weeklyChangeKg).toFixed(2)}kg per week is faster than recommended.`,
        recommendation: 'A safe rate is 0.5-0.9kg (1-2 lbs) per week to preserve muscle mass.',
        requiresConsent: true,
      });
    }

    // Check for rapid weight gain
    if (weeklyChangeKg > 0 && weeklyChangeKg > WEIGHT_CHANGE_LIMITS.maxGain) {
      warnings.push({
        code: 'RAPID_WEIGHT_GAIN',
        severity: 'low',
        message: `Gaining ${weeklyChangeKg.toFixed(2)}kg per week may result in excess fat gain.`,
        recommendation: 'For lean muscle gains, aim for 0.25-0.45kg (0.5-1 lb) per week.',
        requiresConsent: false,
      });
    }

    return warnings;
  }

  /**
   * Validate medical conditions
   */
  private validateMedicalConditions(
    conditions: MedicalCondition[],
    _goalCheck: GoalSafetyCheck
  ): SafetyWarning[] {
    const warnings: SafetyWarning[] = [];

    const conditionMessages: Record<MedicalCondition, { message: string; severity: RiskLevel }> = {
      heart_disease: {
        message: 'Cardiovascular conditions require medical supervision for exercise.',
        severity: 'critical',
      },
      diabetes: {
        message: 'Dietary changes can affect blood sugar levels.',
        severity: 'high',
      },
      hypertension: {
        message: 'Blood pressure should be monitored during exercise.',
        severity: 'moderate',
      },
      thyroid_disorder: {
        message: 'Thyroid conditions can affect metabolism and weight management.',
        severity: 'moderate',
      },
      eating_disorder: {
        message: 'Diet tracking may not be appropriate for those with eating disorders.',
        severity: 'critical',
      },
      pregnancy: {
        message: 'Dietary restrictions are not recommended during pregnancy.',
        severity: 'critical',
      },
      recent_surgery: {
        message: 'Post-surgical recovery requires exercise modifications.',
        severity: 'high',
      },
      chronic_pain: {
        message: 'Exercise selection should accommodate pain conditions.',
        severity: 'moderate',
      },
      respiratory_condition: {
        message: 'Breathing conditions require exercise intensity modifications.',
        severity: 'moderate',
      },
      kidney_disease: {
        message: 'Protein intake recommendations may need adjustment.',
        severity: 'high',
      },
      liver_disease: {
        message: 'Nutritional recommendations may need medical review.',
        severity: 'high',
      },
      autoimmune_disease: {
        message: 'Exercise and nutrition may affect autoimmune conditions.',
        severity: 'moderate',
      },
      cancer: {
        message: 'Cancer treatment may require specialized nutrition guidance.',
        severity: 'critical',
      },
      mental_health: {
        message: 'Exercise can be beneficial but calorie tracking may not be suitable.',
        severity: 'low',
      },
      other: {
        message: 'Medical conditions require professional consultation.',
        severity: 'moderate',
      },
    };

    for (const condition of conditions) {
      const info = conditionMessages[condition];
      if (info) {
        warnings.push({
          code: `CONDITION_${condition.toUpperCase()}`,
          severity: info.severity,
          message: info.message,
          recommendation: 'Please consult your healthcare provider before proceeding.',
          requiresConsent: info.severity === 'critical' || info.severity === 'high',
        });
      }
    }

    return warnings;
  }

  /**
   * Generate recommendations based on warnings
   */
  private generateRecommendations(
    warnings: SafetyWarning[],
    healthData: UserHealthData,
    goalCheck: GoalSafetyCheck
  ): string[] {
    const recommendations: string[] = [];

    // Age-based recommendations
    if (healthData.age >= 50) {
      recommendations.push('Include balance and flexibility exercises to maintain mobility.');
      recommendations.push('Consider having a bone density check if not done recently.');
    }

    // BMI-based recommendations
    const bmi = this.calculateBMI(healthData.weightKg, healthData.heightCm);
    if (bmi >= 30) {
      recommendations.push('Start with low-impact exercises to protect joints.');
      recommendations.push('Consider working with a registered dietitian for personalized guidance.');
    }

    // General safety recommendations
    if (warnings.some(w => w.severity === 'high' || w.severity === 'critical')) {
      recommendations.push('Get a check-up before starting this program.');
      recommendations.push('Start at 50% intensity and gradually increase over 4-6 weeks.');
    }

    // Goal-specific recommendations
    if (goalCheck.goalType === 'weight_loss' || goalCheck.goalType === 'aggressive_weight_loss') {
      recommendations.push('Include resistance training to preserve muscle mass during weight loss.');
      recommendations.push('Get adequate protein (1.6-2.0g per kg of body weight).');
    }

    if (goalCheck.goalType === 'muscle_building') {
      recommendations.push('Focus on progressive overload with proper form.');
      recommendations.push('Ensure adequate sleep (7-9 hours) for muscle recovery.');
    }

    return recommendations;
  }

  /**
   * Calculate overall risk level from warnings
   */
  private calculateOverallRisk(warnings: SafetyWarning[]): RiskLevel {
    if (warnings.some(w => w.severity === 'critical')) return 'critical';
    if (warnings.some(w => w.severity === 'high')) return 'high';
    if (warnings.some(w => w.severity === 'moderate')) return 'moderate';
    if (warnings.some(w => w.severity === 'low')) return 'low';
    return 'none';
  }

  /**
   * Check if user has acknowledged medical disclaimer
   */
  async checkMedicalDisclaimer(_userId: string): Promise<boolean> {
    // This would typically check the database for consent records
    // For now, return false to require consent
    return false;
  }

  /**
   * Get required consent types based on warnings
   */
  getRequiredConsents(warnings: SafetyWarning[]): string[] {
    const consents: string[] = ['medical_disclaimer'];

    if (warnings.some(w => w.code.includes('CONDITION'))) {
      consents.push('medical_condition_acknowledgment');
    }

    if (warnings.some(w => w.code.includes('WEIGHT'))) {
      consents.push('weight_change_acknowledgment');
    }

    if (warnings.some(w => w.code === 'PREGNANCY_NURSING')) {
      consents.push('pregnancy_acknowledgment');
    }

    return consents;
  }
}

export const safetyService = new SafetyService();

/**
 * Safety Service Unit Tests
 *
 * Tests for medical safety validation
 */

import { safetyService } from '../../../src/services/safety.service.js';
import type {
  UserHealthData,
} from '../../../src/services/safety.service.js';

describe('SafetyService', () => {
  describe('calculateBMI', () => {
    it('should calculate BMI correctly', () => {
      // 80kg, 180cm -> BMI = 80 / (1.8 * 1.8) = 24.7
      const bmi = safetyService.calculateBMI(80, 180);
      expect(bmi).toBe(24.7);
    });

    it('should calculate BMI for underweight person', () => {
      // 50kg, 175cm -> BMI = 50 / (1.75 * 1.75) = 16.3
      const bmi = safetyService.calculateBMI(50, 175);
      expect(bmi).toBe(16.3);
    });

    it('should calculate BMI for obese person', () => {
      // 120kg, 170cm -> BMI = 120 / (1.7 * 1.7) = 41.5
      const bmi = safetyService.calculateBMI(120, 170);
      expect(bmi).toBe(41.5);
    });
  });

  describe('getBMICategory', () => {
    it('should identify severe underweight', () => {
      const category = safetyService.getBMICategory(15);
      expect(category.category).toBe('Severe underweight');
      expect(category.riskLevel).toBe('critical');
    });

    it('should identify normal weight', () => {
      const category = safetyService.getBMICategory(22);
      expect(category.category).toBe('Normal');
      expect(category.riskLevel).toBe('none');
    });

    it('should identify overweight', () => {
      const category = safetyService.getBMICategory(27);
      expect(category.category).toBe('Overweight');
      expect(category.riskLevel).toBe('low');
    });

    it('should identify obesity class III', () => {
      const category = safetyService.getBMICategory(42);
      expect(category.category).toBe('Obese Class III');
      expect(category.riskLevel).toBe('critical');
    });
  });

  describe('validateForPlanGeneration', () => {
    describe('Age validation', () => {
      it('should flag users under 16 as critical', () => {
        const healthData: UserHealthData = {
          age: 14,
          gender: 'male',
          weightKg: 60,
          heightCm: 165,
        };

        const result = safetyService.validateForPlanGeneration(healthData, { goalType: 'maintenance' });

        expect(result.riskLevel).toBe('critical');
        expect(result.warnings.some(w => w.code === 'AGE_UNDERAGE')).toBe(true);
        expect(result.requiresDoctorConsult).toBe(true);
      });

      it('should flag users over 80 as moderate risk', () => {
        const healthData: UserHealthData = {
          age: 85,
          gender: 'female',
          weightKg: 65,
          heightCm: 160,
        };

        const result = safetyService.validateForPlanGeneration(healthData, { goalType: 'maintenance' });

        expect(result.warnings.some(w => w.code === 'AGE_ELDERLY')).toBe(true);
      });

      it('should flag users over 65 as low risk', () => {
        const healthData: UserHealthData = {
          age: 70,
          gender: 'male',
          weightKg: 75,
          heightCm: 175,
        };

        const result = safetyService.validateForPlanGeneration(healthData, { goalType: 'maintenance' });

        expect(result.warnings.some(w => w.code === 'AGE_SENIOR')).toBe(true);
      });

      it('should not flag healthy adult age', () => {
        const healthData: UserHealthData = {
          age: 30,
          gender: 'male',
          weightKg: 75,
          heightCm: 180,
        };

        const result = safetyService.validateForPlanGeneration(healthData, { goalType: 'maintenance' });

        expect(result.warnings.filter(w => w.code.includes('AGE')).length).toBe(0);
      });
    });

    describe('BMI validation', () => {
      it('should flag severely underweight as critical', () => {
        const healthData: UserHealthData = {
          age: 25,
          gender: 'female',
          weightKg: 40,
          heightCm: 170, // BMI ~13.8
        };

        const result = safetyService.validateForPlanGeneration(healthData, { goalType: 'maintenance' });

        expect(result.riskLevel).toBe('critical');
        expect(result.warnings.some(w => w.code === 'BMI_CRITICAL')).toBe(true);
      });

      it('should flag obese class III as critical', () => {
        const healthData: UserHealthData = {
          age: 35,
          gender: 'male',
          weightKg: 140,
          heightCm: 175, // BMI ~45.7
        };

        const result = safetyService.validateForPlanGeneration(healthData, { goalType: 'weight_loss' });

        expect(result.riskLevel).toBe('critical');
        expect(result.warnings.some(w => w.code === 'BMI_CRITICAL')).toBe(true);
        expect(result.requiresDoctorConsult).toBe(true);
      });

      it('should flag moderate obesity as moderate risk', () => {
        const healthData: UserHealthData = {
          age: 40,
          gender: 'male',
          weightKg: 100,
          heightCm: 175, // BMI ~32.7
        };

        const result = safetyService.validateForPlanGeneration(healthData, { goalType: 'weight_loss' });

        expect(result.warnings.some(w => w.code === 'BMI_MODERATE_RISK')).toBe(true);
      });

      it('should not flag normal BMI', () => {
        const healthData: UserHealthData = {
          age: 28,
          gender: 'female',
          weightKg: 60,
          heightCm: 165, // BMI ~22
        };

        const result = safetyService.validateForPlanGeneration(healthData, { goalType: 'maintenance' });

        expect(result.warnings.filter(w => w.code.includes('BMI')).length).toBe(0);
      });
    });

    describe('Weight loss goal validation', () => {
      it('should flag target weight resulting in underweight BMI', () => {
        const healthData: UserHealthData = {
          age: 30,
          gender: 'female',
          weightKg: 65,
          heightCm: 170,
        };

        const result = safetyService.validateForPlanGeneration(healthData, {
          goalType: 'weight_loss',
          targetWeightKg: 45, // Would result in BMI < 16
        });

        expect(result.warnings.some(w => w.code === 'TARGET_UNDERWEIGHT')).toBe(true);
      });

      it('should flag aggressive weight loss goal (>20% body weight)', () => {
        const healthData: UserHealthData = {
          age: 35,
          gender: 'male',
          weightKg: 100,
          heightCm: 180,
        };

        const result = safetyService.validateForPlanGeneration(healthData, {
          goalType: 'weight_loss',
          targetWeightKg: 70, // 30% loss
        });

        expect(result.warnings.some(w => w.code === 'AGGRESSIVE_LOSS_GOAL')).toBe(true);
      });

      it('should flag rapid weekly weight loss', () => {
        const healthData: UserHealthData = {
          age: 28,
          gender: 'female',
          weightKg: 75,
          heightCm: 165,
        };

        const result = safetyService.validateForPlanGeneration(healthData, {
          goalType: 'weight_loss',
          weeklyWeightChangeKg: -1.2, // More than 0.9 kg/week
        });

        expect(result.warnings.some(w => w.code === 'RAPID_WEIGHT_LOSS')).toBe(true);
      });
    });

    describe('Weight gain goal validation', () => {
      it('should flag target weight resulting in obese BMI', () => {
        const healthData: UserHealthData = {
          age: 25,
          gender: 'male',
          weightKg: 75,
          heightCm: 175,
        };

        const result = safetyService.validateForPlanGeneration(healthData, {
          goalType: 'muscle_building',
          targetWeightKg: 95, // Would result in BMI > 30
        });

        expect(result.warnings.some(w => w.code === 'TARGET_OBESE')).toBe(true);
      });

      it('should flag rapid weight gain', () => {
        const healthData: UserHealthData = {
          age: 22,
          gender: 'male',
          weightKg: 70,
          heightCm: 180,
        };

        const result = safetyService.validateForPlanGeneration(healthData, {
          goalType: 'muscle_building',
          targetWeightKg: 80,
          weeklyWeightChangeKg: 0.8, // More than 0.45 kg/week
        });

        expect(result.warnings.some(w => w.code === 'RAPID_WEIGHT_GAIN')).toBe(true);
      });
    });

    describe('Medical conditions validation', () => {
      it('should flag heart disease as critical', () => {
        const healthData: UserHealthData = {
          age: 50,
          gender: 'male',
          weightKg: 85,
          heightCm: 178,
          medicalConditions: ['heart_disease'],
        };

        const result = safetyService.validateForPlanGeneration(healthData, { goalType: 'weight_loss' });

        expect(result.requiresDoctorConsult).toBe(true);
        expect(result.warnings.some(w => w.code === 'CONDITION_HEART_DISEASE')).toBe(true);
      });

      it('should flag eating disorder as critical', () => {
        const healthData: UserHealthData = {
          age: 22,
          gender: 'female',
          weightKg: 55,
          heightCm: 165,
          medicalConditions: ['eating_disorder'],
        };

        const result = safetyService.validateForPlanGeneration(healthData, { goalType: 'weight_loss' });

        expect(result.riskLevel).toBe('critical');
        expect(result.warnings.some(w => w.code === 'CONDITION_EATING_DISORDER')).toBe(true);
      });

      it('should flag diabetes as high risk', () => {
        const healthData: UserHealthData = {
          age: 45,
          gender: 'female',
          weightKg: 80,
          heightCm: 165,
          medicalConditions: ['diabetes'],
        };

        const result = safetyService.validateForPlanGeneration(healthData, { goalType: 'weight_loss' });

        expect(result.requiresDoctorConsult).toBe(true);
        expect(result.warnings.some(w => w.code === 'CONDITION_DIABETES')).toBe(true);
      });

      it('should handle multiple conditions', () => {
        const healthData: UserHealthData = {
          age: 55,
          gender: 'male',
          weightKg: 95,
          heightCm: 175,
          medicalConditions: ['hypertension', 'diabetes', 'chronic_pain'],
        };

        const result = safetyService.validateForPlanGeneration(healthData, { goalType: 'weight_loss' });

        expect(result.warnings.filter(w => w.code.includes('CONDITION')).length).toBe(3);
      });
    });

    describe('Pregnancy and nursing', () => {
      it('should flag pregnancy as critical', () => {
        const healthData: UserHealthData = {
          age: 28,
          gender: 'female',
          weightKg: 70,
          heightCm: 165,
          pregnantOrNursing: true,
        };

        const result = safetyService.validateForPlanGeneration(healthData, { goalType: 'weight_loss' });

        expect(result.riskLevel).toBe('critical');
        expect(result.warnings.some(w => w.code === 'PREGNANCY_NURSING')).toBe(true);
        expect(result.restrictions).toContain('Weight loss diets');
        expect(result.restrictions).toContain('High-intensity exercise');
      });
    });

    describe('Recent surgery', () => {
      it('should flag recent surgery as high risk', () => {
        const healthData: UserHealthData = {
          age: 35,
          gender: 'male',
          weightKg: 80,
          heightCm: 180,
          hasRecentSurgery: true,
        };

        const result = safetyService.validateForPlanGeneration(healthData, { goalType: 'maintenance' });

        expect(result.requiresDoctorConsult).toBe(true);
        expect(result.warnings.some(w => w.code === 'RECENT_SURGERY')).toBe(true);
      });
    });

    describe('Recommendations generation', () => {
      it('should include age-specific recommendations for 50+', () => {
        const healthData: UserHealthData = {
          age: 55,
          gender: 'female',
          weightKg: 68,
          heightCm: 165,
        };

        const result = safetyService.validateForPlanGeneration(healthData, { goalType: 'maintenance' });

        expect(result.recommendations.some(r => r.includes('balance') || r.includes('flexibility'))).toBe(true);
      });

      it('should include BMI-specific recommendations for obese users', () => {
        const healthData: UserHealthData = {
          age: 40,
          gender: 'male',
          weightKg: 110,
          heightCm: 175, // BMI ~36
        };

        const result = safetyService.validateForPlanGeneration(healthData, { goalType: 'weight_loss' });

        expect(result.recommendations.some(r => r.includes('low-impact') || r.includes('dietitian'))).toBe(true);
      });

      it('should include goal-specific recommendations for weight loss', () => {
        const healthData: UserHealthData = {
          age: 30,
          gender: 'male',
          weightKg: 90,
          heightCm: 180,
        };

        const result = safetyService.validateForPlanGeneration(healthData, { goalType: 'weight_loss' });

        expect(result.recommendations.some(r => r.includes('resistance training') || r.includes('protein'))).toBe(true);
      });

      it('should include muscle building recommendations', () => {
        const healthData: UserHealthData = {
          age: 25,
          gender: 'male',
          weightKg: 70,
          heightCm: 178,
        };

        const result = safetyService.validateForPlanGeneration(healthData, { goalType: 'muscle_building' });

        expect(result.recommendations.some(r => r.includes('progressive overload') || r.includes('sleep'))).toBe(true);
      });
    });

    describe('Disclaimers', () => {
      it('should always include standard disclaimers', () => {
        const healthData: UserHealthData = {
          age: 30,
          gender: 'male',
          weightKg: 75,
          heightCm: 180,
        };

        const result = safetyService.validateForPlanGeneration(healthData, { goalType: 'maintenance' });

        expect(result.disclaimers.length).toBeGreaterThanOrEqual(3);
        expect(result.disclaimers.some(d => d.includes('informational purposes'))).toBe(true);
        expect(result.disclaimers.some(d => d.includes('healthcare professional'))).toBe(true);
      });
    });

    describe('Overall approval', () => {
      it('should approve healthy user with no risk factors', () => {
        const healthData: UserHealthData = {
          age: 28,
          gender: 'female',
          weightKg: 62,
          heightCm: 168,
        };

        const result = safetyService.validateForPlanGeneration(healthData, { goalType: 'maintenance' });

        expect(result.isApproved).toBe(true);
        expect(result.riskLevel).toBe('none');
        expect(result.requiresDoctorConsult).toBe(false);
      });

      it('should not auto-approve critical risk users', () => {
        const healthData: UserHealthData = {
          age: 14,
          gender: 'male',
          weightKg: 60,
          heightCm: 165,
        };

        const result = safetyService.validateForPlanGeneration(healthData, { goalType: 'maintenance' });

        expect(result.isApproved).toBe(false);
        expect(result.riskLevel).toBe('critical');
      });
    });
  });

  describe('getRequiredConsents', () => {
    it('should always require medical disclaimer', () => {
      const consents = safetyService.getRequiredConsents([]);
      expect(consents).toContain('medical_disclaimer');
    });

    it('should require medical condition acknowledgment for condition warnings', () => {
      const warnings = [
        {
          code: 'CONDITION_DIABETES',
          severity: 'high' as const,
          message: 'Test',
          recommendation: 'Test',
          requiresConsent: true,
        },
      ];

      const consents = safetyService.getRequiredConsents(warnings);
      expect(consents).toContain('medical_condition_acknowledgment');
    });

    it('should require weight change acknowledgment for weight warnings', () => {
      const warnings = [
        {
          code: 'RAPID_WEIGHT_LOSS',
          severity: 'high' as const,
          message: 'Test',
          recommendation: 'Test',
          requiresConsent: true,
        },
      ];

      const consents = safetyService.getRequiredConsents(warnings);
      expect(consents).toContain('weight_change_acknowledgment');
    });

    it('should require pregnancy acknowledgment', () => {
      const warnings = [
        {
          code: 'PREGNANCY_NURSING',
          severity: 'critical' as const,
          message: 'Test',
          recommendation: 'Test',
          requiresConsent: true,
        },
      ];

      const consents = safetyService.getRequiredConsents(warnings);
      expect(consents).toContain('pregnancy_acknowledgment');
    });
  });

  describe('checkMedicalDisclaimer', () => {
    it('should return false for now (placeholder)', async () => {
      const result = await safetyService.checkMedicalDisclaimer('user-123');
      expect(result).toBe(false);
    });
  });
});

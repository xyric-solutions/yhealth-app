/**
 * @file Exercise Library Seed Script
 * Seeds the exercises table with a comprehensive library of exercises
 */

import { pool } from './pg.js';

interface ExerciseData {
  name: string;
  slug: string;
  description: string;
  category: 'strength' | 'cardio' | 'flexibility' | 'balance' | 'plyometric';
  primary_muscle_group: string;
  secondary_muscle_groups: string[];
  equipment_required: string[];
  difficulty_level: 'beginner' | 'intermediate' | 'advanced';
  instructions: string[];
  tips: string[];
  default_sets: number;
  default_reps: number;
  default_duration_seconds?: number;
  default_rest_seconds: number;
  calories_per_minute: number;
  tags: string[];
}

const EXERCISES: ExerciseData[] = [
  // ============================================
  // STRENGTH - CHEST
  // ============================================
  {
    name: 'Push-Up',
    slug: 'push-up',
    description: 'Classic bodyweight exercise targeting chest, shoulders, and triceps',
    category: 'strength',
    primary_muscle_group: 'chest',
    secondary_muscle_groups: ['shoulders', 'triceps', 'core'],
    equipment_required: [],
    difficulty_level: 'beginner',
    instructions: [
      'Start in a plank position with hands slightly wider than shoulders',
      'Keep your body in a straight line from head to heels',
      'Lower your chest toward the floor by bending your elbows',
      'Push back up to the starting position',
    ],
    tips: [
      'Keep your core engaged throughout',
      'Don\'t let your hips sag or pike up',
      'Breathe out as you push up',
    ],
    default_sets: 3,
    default_reps: 10,
    default_rest_seconds: 60,
    calories_per_minute: 7,
    tags: ['bodyweight', 'compound', 'upper-body', 'home'],
  },
  {
    name: 'Dumbbell Bench Press',
    slug: 'dumbbell-bench-press',
    description: 'Chest press using dumbbells for greater range of motion',
    category: 'strength',
    primary_muscle_group: 'chest',
    secondary_muscle_groups: ['shoulders', 'triceps'],
    equipment_required: ['dumbbells', 'bench'],
    difficulty_level: 'beginner',
    instructions: [
      'Lie on a flat bench with a dumbbell in each hand',
      'Press the dumbbells up until arms are extended',
      'Lower the dumbbells with control to chest level',
      'Press back up to starting position',
    ],
    tips: [
      'Keep your feet flat on the floor',
      'Maintain a slight arch in your lower back',
      'Control the weight throughout the movement',
    ],
    default_sets: 3,
    default_reps: 10,
    default_rest_seconds: 90,
    calories_per_minute: 5,
    tags: ['dumbbells', 'compound', 'upper-body', 'gym'],
  },
  {
    name: 'Incline Dumbbell Press',
    slug: 'incline-dumbbell-press',
    description: 'Upper chest focused press on an inclined bench',
    category: 'strength',
    primary_muscle_group: 'chest',
    secondary_muscle_groups: ['shoulders', 'triceps'],
    equipment_required: ['dumbbells', 'incline-bench'],
    difficulty_level: 'intermediate',
    instructions: [
      'Set bench to 30-45 degree angle',
      'Lie back with dumbbells at chest level',
      'Press dumbbells up and together',
      'Lower with control',
    ],
    tips: [
      'Don\'t set the incline too high',
      'Keep shoulders back and down',
    ],
    default_sets: 3,
    default_reps: 10,
    default_rest_seconds: 90,
    calories_per_minute: 5,
    tags: ['dumbbells', 'compound', 'upper-body', 'gym'],
  },

  // ============================================
  // STRENGTH - BACK
  // ============================================
  {
    name: 'Pull-Up',
    slug: 'pull-up',
    description: 'Compound pulling exercise for back and biceps',
    category: 'strength',
    primary_muscle_group: 'back',
    secondary_muscle_groups: ['biceps', 'forearms', 'core'],
    equipment_required: ['pull-up-bar'],
    difficulty_level: 'intermediate',
    instructions: [
      'Hang from bar with hands wider than shoulders',
      'Pull yourself up until chin clears the bar',
      'Lower with control to full hang',
      'Repeat without swinging',
    ],
    tips: [
      'Engage your lats before pulling',
      'Avoid kipping or swinging',
      'Use assisted band if needed',
    ],
    default_sets: 3,
    default_reps: 8,
    default_rest_seconds: 90,
    calories_per_minute: 8,
    tags: ['bodyweight', 'compound', 'upper-body', 'home', 'gym'],
  },
  {
    name: 'Bent Over Row',
    slug: 'bent-over-row',
    description: 'Rowing movement for back thickness',
    category: 'strength',
    primary_muscle_group: 'back',
    secondary_muscle_groups: ['biceps', 'rear-delts'],
    equipment_required: ['barbell'],
    difficulty_level: 'intermediate',
    instructions: [
      'Hinge at hips with slight knee bend',
      'Keep back flat and core tight',
      'Row bar to lower chest',
      'Lower with control',
    ],
    tips: [
      'Don\'t round your lower back',
      'Squeeze shoulder blades at top',
      'Keep elbows close to body',
    ],
    default_sets: 3,
    default_reps: 10,
    default_rest_seconds: 90,
    calories_per_minute: 6,
    tags: ['barbell', 'compound', 'upper-body', 'gym'],
  },
  {
    name: 'Dumbbell Row',
    slug: 'dumbbell-row',
    description: 'Single arm rowing for back development',
    category: 'strength',
    primary_muscle_group: 'back',
    secondary_muscle_groups: ['biceps', 'rear-delts'],
    equipment_required: ['dumbbell', 'bench'],
    difficulty_level: 'beginner',
    instructions: [
      'Place one knee and hand on bench',
      'Keep back flat and parallel to ground',
      'Row dumbbell to hip',
      'Lower with control',
    ],
    tips: [
      'Keep your core engaged',
      'Don\'t rotate your torso',
      'Pull with your elbow, not your hand',
    ],
    default_sets: 3,
    default_reps: 10,
    default_rest_seconds: 60,
    calories_per_minute: 5,
    tags: ['dumbbell', 'unilateral', 'upper-body', 'gym'],
  },

  // ============================================
  // STRENGTH - LEGS
  // ============================================
  {
    name: 'Squat',
    slug: 'squat',
    description: 'Fundamental lower body compound movement',
    category: 'strength',
    primary_muscle_group: 'legs',
    secondary_muscle_groups: ['glutes', 'core', 'lower-back'],
    equipment_required: [],
    difficulty_level: 'beginner',
    instructions: [
      'Stand with feet shoulder-width apart',
      'Push hips back and bend knees',
      'Lower until thighs are parallel to floor',
      'Drive through heels to stand',
    ],
    tips: [
      'Keep chest up and back straight',
      'Don\'t let knees cave inward',
      'Go as deep as mobility allows',
    ],
    default_sets: 3,
    default_reps: 12,
    default_rest_seconds: 90,
    calories_per_minute: 8,
    tags: ['bodyweight', 'compound', 'lower-body', 'home'],
  },
  {
    name: 'Barbell Back Squat',
    slug: 'barbell-back-squat',
    description: 'King of lower body exercises with barbell',
    category: 'strength',
    primary_muscle_group: 'legs',
    secondary_muscle_groups: ['glutes', 'core', 'lower-back'],
    equipment_required: ['barbell', 'squat-rack'],
    difficulty_level: 'intermediate',
    instructions: [
      'Position bar on upper back/traps',
      'Unrack and step back',
      'Squat down with control',
      'Drive up through heels',
    ],
    tips: [
      'Brace your core before descending',
      'Keep the bar path vertical',
      'Use safety bars',
    ],
    default_sets: 4,
    default_reps: 8,
    default_rest_seconds: 120,
    calories_per_minute: 9,
    tags: ['barbell', 'compound', 'lower-body', 'gym'],
  },
  {
    name: 'Romanian Deadlift',
    slug: 'romanian-deadlift',
    description: 'Hip hinge movement targeting hamstrings and glutes',
    category: 'strength',
    primary_muscle_group: 'legs',
    secondary_muscle_groups: ['glutes', 'lower-back'],
    equipment_required: ['barbell'],
    difficulty_level: 'intermediate',
    instructions: [
      'Hold barbell at hip height',
      'Push hips back, slight knee bend',
      'Lower bar along legs until hamstring stretch',
      'Drive hips forward to stand',
    ],
    tips: [
      'Keep bar close to your body',
      'Don\'t round your back',
      'Feel the stretch in your hamstrings',
    ],
    default_sets: 3,
    default_reps: 10,
    default_rest_seconds: 90,
    calories_per_minute: 7,
    tags: ['barbell', 'compound', 'lower-body', 'gym'],
  },
  {
    name: 'Lunges',
    slug: 'lunges',
    description: 'Unilateral leg exercise for balance and strength',
    category: 'strength',
    primary_muscle_group: 'legs',
    secondary_muscle_groups: ['glutes', 'core'],
    equipment_required: [],
    difficulty_level: 'beginner',
    instructions: [
      'Stand with feet hip-width apart',
      'Step forward into a lunge',
      'Lower back knee toward floor',
      'Push through front heel to return',
    ],
    tips: [
      'Keep torso upright',
      'Front knee over ankle, not past toes',
      'Alternate legs each rep',
    ],
    default_sets: 3,
    default_reps: 12,
    default_rest_seconds: 60,
    calories_per_minute: 6,
    tags: ['bodyweight', 'unilateral', 'lower-body', 'home'],
  },
  {
    name: 'Leg Press',
    slug: 'leg-press',
    description: 'Machine-based quad dominant movement',
    category: 'strength',
    primary_muscle_group: 'legs',
    secondary_muscle_groups: ['glutes'],
    equipment_required: ['leg-press-machine'],
    difficulty_level: 'beginner',
    instructions: [
      'Sit in machine with feet shoulder-width on platform',
      'Release safety and lower weight',
      'Lower until 90 degrees at knee',
      'Press through heels to extend',
    ],
    tips: [
      'Don\'t lock out knees at top',
      'Keep lower back pressed into seat',
      'Vary foot position for different emphasis',
    ],
    default_sets: 3,
    default_reps: 12,
    default_rest_seconds: 90,
    calories_per_minute: 6,
    tags: ['machine', 'compound', 'lower-body', 'gym'],
  },

  // ============================================
  // STRENGTH - SHOULDERS
  // ============================================
  {
    name: 'Overhead Press',
    slug: 'overhead-press',
    description: 'Vertical pressing for shoulder development',
    category: 'strength',
    primary_muscle_group: 'shoulders',
    secondary_muscle_groups: ['triceps', 'core'],
    equipment_required: ['barbell'],
    difficulty_level: 'intermediate',
    instructions: [
      'Hold barbell at shoulder height',
      'Press bar straight overhead',
      'Lock out arms at top',
      'Lower with control to shoulders',
    ],
    tips: [
      'Keep core tight to protect lower back',
      'Don\'t lean back excessively',
      'Push head through at top',
    ],
    default_sets: 3,
    default_reps: 8,
    default_rest_seconds: 90,
    calories_per_minute: 6,
    tags: ['barbell', 'compound', 'upper-body', 'gym'],
  },
  {
    name: 'Lateral Raise',
    slug: 'lateral-raise',
    description: 'Isolation exercise for side deltoids',
    category: 'strength',
    primary_muscle_group: 'shoulders',
    secondary_muscle_groups: [],
    equipment_required: ['dumbbells'],
    difficulty_level: 'beginner',
    instructions: [
      'Hold dumbbells at sides',
      'Raise arms out to sides until shoulder height',
      'Slight bend in elbows',
      'Lower with control',
    ],
    tips: [
      'Don\'t swing or use momentum',
      'Lead with elbows, not hands',
      'Use lighter weight with good form',
    ],
    default_sets: 3,
    default_reps: 12,
    default_rest_seconds: 60,
    calories_per_minute: 4,
    tags: ['dumbbells', 'isolation', 'upper-body', 'gym', 'home'],
  },

  // ============================================
  // STRENGTH - ARMS
  // ============================================
  {
    name: 'Bicep Curl',
    slug: 'bicep-curl',
    description: 'Classic bicep isolation exercise',
    category: 'strength',
    primary_muscle_group: 'arms',
    secondary_muscle_groups: ['forearms'],
    equipment_required: ['dumbbells'],
    difficulty_level: 'beginner',
    instructions: [
      'Stand with dumbbells at sides, palms forward',
      'Curl weights to shoulders',
      'Keep elbows stationary at sides',
      'Lower with control',
    ],
    tips: [
      'Don\'t swing your body',
      'Squeeze biceps at top',
      'Full range of motion',
    ],
    default_sets: 3,
    default_reps: 12,
    default_rest_seconds: 60,
    calories_per_minute: 4,
    tags: ['dumbbells', 'isolation', 'upper-body', 'gym', 'home'],
  },
  {
    name: 'Tricep Dips',
    slug: 'tricep-dips',
    description: 'Bodyweight tricep exercise',
    category: 'strength',
    primary_muscle_group: 'arms',
    secondary_muscle_groups: ['chest', 'shoulders'],
    equipment_required: ['bench'],
    difficulty_level: 'beginner',
    instructions: [
      'Place hands on bench behind you',
      'Extend legs in front',
      'Lower body by bending elbows',
      'Push back up to start',
    ],
    tips: [
      'Keep elbows pointing back, not out',
      'Don\'t go too deep if shoulders hurt',
      'Keep body close to bench',
    ],
    default_sets: 3,
    default_reps: 12,
    default_rest_seconds: 60,
    calories_per_minute: 5,
    tags: ['bodyweight', 'compound', 'upper-body', 'home'],
  },
  {
    name: 'Tricep Pushdown',
    slug: 'tricep-pushdown',
    description: 'Cable exercise for tricep isolation',
    category: 'strength',
    primary_muscle_group: 'arms',
    secondary_muscle_groups: [],
    equipment_required: ['cable-machine'],
    difficulty_level: 'beginner',
    instructions: [
      'Stand facing cable machine',
      'Grip bar/rope at chest height',
      'Push down until arms straight',
      'Return with control',
    ],
    tips: [
      'Keep elbows pinned to sides',
      'Only forearms should move',
      'Squeeze triceps at bottom',
    ],
    default_sets: 3,
    default_reps: 12,
    default_rest_seconds: 60,
    calories_per_minute: 4,
    tags: ['cable', 'isolation', 'upper-body', 'gym'],
  },

  // ============================================
  // STRENGTH - CORE
  // ============================================
  {
    name: 'Plank',
    slug: 'plank',
    description: 'Isometric core strengthening exercise',
    category: 'strength',
    primary_muscle_group: 'core',
    secondary_muscle_groups: ['shoulders', 'glutes'],
    equipment_required: [],
    difficulty_level: 'beginner',
    instructions: [
      'Start in push-up position on forearms',
      'Keep body in straight line',
      'Engage core and hold position',
      'Breathe normally throughout',
    ],
    tips: [
      'Don\'t let hips sag or pike up',
      'Look at floor to keep neck neutral',
      'Start with shorter holds and build up',
    ],
    default_sets: 3,
    default_reps: 1,
    default_duration_seconds: 30,
    default_rest_seconds: 60,
    calories_per_minute: 4,
    tags: ['bodyweight', 'isometric', 'core', 'home'],
  },
  {
    name: 'Crunches',
    slug: 'crunches',
    description: 'Basic abdominal exercise',
    category: 'strength',
    primary_muscle_group: 'core',
    secondary_muscle_groups: [],
    equipment_required: [],
    difficulty_level: 'beginner',
    instructions: [
      'Lie on back with knees bent',
      'Hands behind head or across chest',
      'Curl shoulders toward hips',
      'Lower with control',
    ],
    tips: [
      'Don\'t pull on your neck',
      'Focus on contracting abs',
      'Small, controlled movement',
    ],
    default_sets: 3,
    default_reps: 15,
    default_rest_seconds: 45,
    calories_per_minute: 5,
    tags: ['bodyweight', 'isolation', 'core', 'home'],
  },
  {
    name: 'Russian Twist',
    slug: 'russian-twist',
    description: 'Rotational core exercise',
    category: 'strength',
    primary_muscle_group: 'core',
    secondary_muscle_groups: [],
    equipment_required: [],
    difficulty_level: 'beginner',
    instructions: [
      'Sit with knees bent, lean back slightly',
      'Lift feet off floor (optional)',
      'Rotate torso side to side',
      'Touch floor on each side',
    ],
    tips: [
      'Keep chest up',
      'Move from the torso, not just arms',
      'Add weight for more challenge',
    ],
    default_sets: 3,
    default_reps: 20,
    default_rest_seconds: 45,
    calories_per_minute: 5,
    tags: ['bodyweight', 'rotation', 'core', 'home'],
  },
  {
    name: 'Dead Bug',
    slug: 'dead-bug',
    description: 'Core stability exercise',
    category: 'strength',
    primary_muscle_group: 'core',
    secondary_muscle_groups: [],
    equipment_required: [],
    difficulty_level: 'beginner',
    instructions: [
      'Lie on back, arms up, knees at 90 degrees',
      'Lower opposite arm and leg toward floor',
      'Keep lower back pressed into floor',
      'Return and switch sides',
    ],
    tips: [
      'Move slowly and controlled',
      'Don\'t let your back arch',
      'Exhale as you extend',
    ],
    default_sets: 3,
    default_reps: 10,
    default_rest_seconds: 45,
    calories_per_minute: 4,
    tags: ['bodyweight', 'stability', 'core', 'home', 'rehab'],
  },

  // ============================================
  // CARDIO
  // ============================================
  {
    name: 'Jumping Jacks',
    slug: 'jumping-jacks',
    description: 'Full body cardio exercise',
    category: 'cardio',
    primary_muscle_group: 'full-body',
    secondary_muscle_groups: [],
    equipment_required: [],
    difficulty_level: 'beginner',
    instructions: [
      'Start with feet together, arms at sides',
      'Jump feet out while raising arms overhead',
      'Jump back to starting position',
      'Repeat at a steady pace',
    ],
    tips: [
      'Land softly on balls of feet',
      'Keep core engaged',
      'Maintain consistent rhythm',
    ],
    default_sets: 3,
    default_reps: 30,
    default_rest_seconds: 30,
    calories_per_minute: 10,
    tags: ['bodyweight', 'cardio', 'full-body', 'home', 'warmup'],
  },
  {
    name: 'High Knees',
    slug: 'high-knees',
    description: 'Running in place with high knee raises',
    category: 'cardio',
    primary_muscle_group: 'legs',
    secondary_muscle_groups: ['core'],
    equipment_required: [],
    difficulty_level: 'beginner',
    instructions: [
      'Stand tall with feet hip-width',
      'Run in place, bringing knees to waist height',
      'Pump arms in running motion',
      'Land on balls of feet',
    ],
    tips: [
      'Stay light on your feet',
      'Keep chest up',
      'Drive knees up, not feet back',
    ],
    default_sets: 3,
    default_reps: 1,
    default_duration_seconds: 30,
    default_rest_seconds: 30,
    calories_per_minute: 10,
    tags: ['bodyweight', 'cardio', 'lower-body', 'home', 'warmup'],
  },
  {
    name: 'Burpees',
    slug: 'burpees',
    description: 'Full body cardio and strength exercise',
    category: 'cardio',
    primary_muscle_group: 'full-body',
    secondary_muscle_groups: ['chest', 'legs', 'core'],
    equipment_required: [],
    difficulty_level: 'intermediate',
    instructions: [
      'Start standing, drop into squat',
      'Jump feet back to plank',
      'Do a push-up (optional)',
      'Jump feet forward and explode up',
    ],
    tips: [
      'Maintain good form over speed',
      'Land softly from jumps',
      'Modify by stepping instead of jumping',
    ],
    default_sets: 3,
    default_reps: 10,
    default_rest_seconds: 60,
    calories_per_minute: 12,
    tags: ['bodyweight', 'cardio', 'full-body', 'home', 'hiit'],
  },
  {
    name: 'Mountain Climbers',
    slug: 'mountain-climbers',
    description: 'Dynamic plank with running motion',
    category: 'cardio',
    primary_muscle_group: 'core',
    secondary_muscle_groups: ['shoulders', 'legs'],
    equipment_required: [],
    difficulty_level: 'beginner',
    instructions: [
      'Start in push-up position',
      'Drive one knee toward chest',
      'Quickly switch legs',
      'Maintain plank position throughout',
    ],
    tips: [
      'Keep hips level',
      'Shoulders over wrists',
      'Start slow, build speed',
    ],
    default_sets: 3,
    default_reps: 1,
    default_duration_seconds: 30,
    default_rest_seconds: 30,
    calories_per_minute: 11,
    tags: ['bodyweight', 'cardio', 'core', 'home', 'hiit'],
  },
  {
    name: 'Jump Rope',
    slug: 'jump-rope',
    description: 'Classic cardio exercise with rope',
    category: 'cardio',
    primary_muscle_group: 'full-body',
    secondary_muscle_groups: ['calves', 'shoulders'],
    equipment_required: ['jump-rope'],
    difficulty_level: 'beginner',
    instructions: [
      'Hold handles at hip height',
      'Swing rope overhead',
      'Jump with both feet',
      'Land softly on balls of feet',
    ],
    tips: [
      'Use wrist rotation, not arms',
      'Small jumps, just enough to clear rope',
      'Keep elbows close to sides',
    ],
    default_sets: 3,
    default_reps: 1,
    default_duration_seconds: 60,
    default_rest_seconds: 30,
    calories_per_minute: 12,
    tags: ['equipment', 'cardio', 'full-body', 'home'],
  },

  // ============================================
  // FLEXIBILITY
  // ============================================
  {
    name: 'Standing Hamstring Stretch',
    slug: 'standing-hamstring-stretch',
    description: 'Stretch for hamstring flexibility',
    category: 'flexibility',
    primary_muscle_group: 'legs',
    secondary_muscle_groups: [],
    equipment_required: [],
    difficulty_level: 'beginner',
    instructions: [
      'Stand and place one heel on low surface',
      'Keep leg straight',
      'Hinge forward at hips',
      'Hold stretch, then switch legs',
    ],
    tips: [
      'Keep back straight',
      'Don\'t bounce',
      'Breathe deeply into the stretch',
    ],
    default_sets: 2,
    default_reps: 1,
    default_duration_seconds: 30,
    default_rest_seconds: 15,
    calories_per_minute: 2,
    tags: ['stretch', 'flexibility', 'lower-body', 'home', 'cooldown'],
  },
  {
    name: 'Cat-Cow Stretch',
    slug: 'cat-cow-stretch',
    description: 'Spinal mobility exercise',
    category: 'flexibility',
    primary_muscle_group: 'back',
    secondary_muscle_groups: ['core'],
    equipment_required: [],
    difficulty_level: 'beginner',
    instructions: [
      'Start on hands and knees',
      'Arch back up (cat), tuck chin',
      'Drop belly down (cow), look up',
      'Flow between positions',
    ],
    tips: [
      'Move with your breath',
      'Move slowly and controlled',
      'Feel each vertebra move',
    ],
    default_sets: 2,
    default_reps: 10,
    default_rest_seconds: 30,
    calories_per_minute: 2,
    tags: ['stretch', 'flexibility', 'back', 'home', 'warmup', 'cooldown'],
  },
  {
    name: 'Child\'s Pose',
    slug: 'childs-pose',
    description: 'Restorative stretch for back and hips',
    category: 'flexibility',
    primary_muscle_group: 'back',
    secondary_muscle_groups: ['hips', 'shoulders'],
    equipment_required: [],
    difficulty_level: 'beginner',
    instructions: [
      'Kneel and sit back on heels',
      'Fold forward, arms extended or at sides',
      'Rest forehead on floor',
      'Breathe deeply and relax',
    ],
    tips: [
      'Widen knees if needed for comfort',
      'Focus on relaxing completely',
      'Hold as long as comfortable',
    ],
    default_sets: 2,
    default_reps: 1,
    default_duration_seconds: 45,
    default_rest_seconds: 15,
    calories_per_minute: 1,
    tags: ['stretch', 'flexibility', 'back', 'home', 'cooldown', 'yoga'],
  },
  {
    name: 'Hip Flexor Stretch',
    slug: 'hip-flexor-stretch',
    description: 'Stretch for tight hip flexors',
    category: 'flexibility',
    primary_muscle_group: 'hips',
    secondary_muscle_groups: ['legs'],
    equipment_required: [],
    difficulty_level: 'beginner',
    instructions: [
      'Kneel on one knee, other foot forward',
      'Push hips forward gently',
      'Keep torso upright',
      'Hold, then switch sides',
    ],
    tips: [
      'Tuck pelvis under slightly',
      'Don\'t lean forward',
      'Squeeze glute of back leg',
    ],
    default_sets: 2,
    default_reps: 1,
    default_duration_seconds: 30,
    default_rest_seconds: 15,
    calories_per_minute: 2,
    tags: ['stretch', 'flexibility', 'hips', 'home', 'cooldown'],
  },
  {
    name: 'Downward Dog',
    slug: 'downward-dog',
    description: 'Yoga pose for full body stretch',
    category: 'flexibility',
    primary_muscle_group: 'full-body',
    secondary_muscle_groups: ['hamstrings', 'shoulders', 'calves'],
    equipment_required: [],
    difficulty_level: 'beginner',
    instructions: [
      'Start on hands and knees',
      'Lift hips up and back',
      'Straighten legs as much as possible',
      'Push hands into floor, relax head',
    ],
    tips: [
      'Bend knees if hamstrings are tight',
      'Spread fingers wide',
      'Work toward getting heels to floor',
    ],
    default_sets: 2,
    default_reps: 1,
    default_duration_seconds: 30,
    default_rest_seconds: 15,
    calories_per_minute: 3,
    tags: ['stretch', 'flexibility', 'full-body', 'home', 'yoga'],
  },

  // ============================================
  // PLYOMETRIC
  // ============================================
  {
    name: 'Box Jump',
    slug: 'box-jump',
    description: 'Explosive lower body power exercise',
    category: 'plyometric',
    primary_muscle_group: 'legs',
    secondary_muscle_groups: ['glutes', 'core'],
    equipment_required: ['plyo-box'],
    difficulty_level: 'intermediate',
    instructions: [
      'Stand facing box, feet hip-width',
      'Swing arms and jump onto box',
      'Land softly with knees slightly bent',
      'Step down (don\'t jump) and repeat',
    ],
    tips: [
      'Start with lower box height',
      'Land with full foot on box',
      'Focus on soft, quiet landings',
    ],
    default_sets: 3,
    default_reps: 8,
    default_rest_seconds: 90,
    calories_per_minute: 10,
    tags: ['plyometric', 'power', 'lower-body', 'gym'],
  },
  {
    name: 'Jump Squat',
    slug: 'jump-squat',
    description: 'Squat with explosive jump',
    category: 'plyometric',
    primary_muscle_group: 'legs',
    secondary_muscle_groups: ['glutes', 'core'],
    equipment_required: [],
    difficulty_level: 'intermediate',
    instructions: [
      'Squat down with good form',
      'Explode up into a jump',
      'Land softly and immediately squat again',
      'Repeat with continuous movement',
    ],
    tips: [
      'Land toe-to-heel',
      'Keep chest up',
      'Absorb landing in the squat',
    ],
    default_sets: 3,
    default_reps: 10,
    default_rest_seconds: 60,
    calories_per_minute: 11,
    tags: ['bodyweight', 'plyometric', 'lower-body', 'home', 'hiit'],
  },
];

async function seedExercises(): Promise<void> {
  console.log('Starting exercise library seed...');

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Clear existing exercises (optional - comment out if you want to preserve custom exercises)
    // await client.query('DELETE FROM exercises WHERE is_system = true');

    for (const exercise of EXERCISES) {
      const query = `
        INSERT INTO exercises (
          name, slug, description, category, primary_muscle_group,
          secondary_muscle_groups, equipment_required, difficulty_level,
          instructions, tips, default_sets, default_reps,
          default_duration_seconds, default_rest_seconds, calories_per_minute,
          tags, is_system, is_active
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8,
          $9, $10, $11, $12,
          $13, $14, $15,
          $16, true, true
        )
        ON CONFLICT (slug) DO UPDATE SET
          name = EXCLUDED.name,
          description = EXCLUDED.description,
          category = EXCLUDED.category,
          primary_muscle_group = EXCLUDED.primary_muscle_group,
          secondary_muscle_groups = EXCLUDED.secondary_muscle_groups,
          equipment_required = EXCLUDED.equipment_required,
          difficulty_level = EXCLUDED.difficulty_level,
          instructions = EXCLUDED.instructions,
          tips = EXCLUDED.tips,
          default_sets = EXCLUDED.default_sets,
          default_reps = EXCLUDED.default_reps,
          default_duration_seconds = EXCLUDED.default_duration_seconds,
          default_rest_seconds = EXCLUDED.default_rest_seconds,
          calories_per_minute = EXCLUDED.calories_per_minute,
          tags = EXCLUDED.tags,
          updated_at = CURRENT_TIMESTAMP
      `;

      await client.query(query, [
        exercise.name,
        exercise.slug,
        exercise.description,
        exercise.category,
        exercise.primary_muscle_group,
        exercise.secondary_muscle_groups,
        exercise.equipment_required,
        exercise.difficulty_level,
        JSON.stringify(exercise.instructions),
        JSON.stringify(exercise.tips),
        exercise.default_sets,
        exercise.default_reps,
        exercise.default_duration_seconds || null,
        exercise.default_rest_seconds,
        exercise.calories_per_minute,
        exercise.tags,
      ]);
    }

    await client.query('COMMIT');
    console.log(`Successfully seeded ${EXERCISES.length} exercises`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Failed to seed exercises:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run if called directly
if (process.argv[1]?.includes('seed-exercises')) {
  seedExercises()
    .then(() => {
      console.log('Seed complete');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Seed failed:', err);
      process.exit(1);
    });
}

export { seedExercises, EXERCISES };

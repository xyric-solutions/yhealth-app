"use client";

/**
 * @file PlanView
 * The "My Plan" sub-tab: a draggable card grid of all workout plans
 * with DnD reordering, edit/delete actions, and "Create New" button.
 */

import { motion } from "framer-motion";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Clock,
  Repeat,
  Timer,
  Plus,
  Trash2,
  GripVertical,
  Edit3,
} from "lucide-react";
import type { WorkoutPlan } from "../types";

// ---------------------------------------------------------------------------
// SortableWorkoutCard (internal to PlanView)
// ---------------------------------------------------------------------------

interface SortableWorkoutCardProps {
  workout: WorkoutPlan;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  onEdit: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
}

function SortableWorkoutCard({
  workout,
  index,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
}: SortableWorkoutCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: workout.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: isDragging ? 0.5 : 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={`rounded-2xl border p-5 transition-all transform duration-300 ease-in-out cursor-pointer group relative ${
        isSelected
          ? "bg-gradient-to-br from-sky-500/20 cr to-sky-500/10 hover:to-sky-500 transition duration-300 ease-in-out scale-105 border-sky-500/20 shadow-sky-500/20"
          : "bg-slate-800/50 border-slate-700/50 hover:border-orange-500/50"
      } ${isDragging ? "z-50 shadow-2xl" : ""}`}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between mb-3">
        {/* Drag Handle */}
        <div
          {...attributes}
          {...listeners}
          className="p-1.5 rounded-lg bg-white/5 text-slate-500 hover:text-orange-400 opacity-0 group-hover:opacity-100 transition-all cursor-grab active:cursor-grabbing -ml-1.5 -mt-1.5"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="w-4 h-4" />
        </div>
        <div className="flex items-center gap-2">
          {workout.isCustom && (
            <span className="px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-400 text-[10px] font-bold">
              CUSTOM
            </span>
          )}
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
              workout.difficulty === "beginner"
                ? "bg-emerald-500/20 text-emerald-400"
                : workout.difficulty === "intermediate"
                  ? "bg-amber-500/20 text-amber-400"
                  : "bg-red-500/20 text-red-400"
            }`}
          >
            {workout.difficulty.toUpperCase()}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onEdit}
            className="p-1.5 rounded-lg bg-white/10 text-slate-200 hover:text-emerald-400 opacity-0 group-hover:opacity-100 transition-all"
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 rounded-lg bg-white/10 text-slate-200 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <h4 className="font-semibold text-white mb-2">{workout.name}</h4>
      <div className="flex flex-wrap gap-1 mb-3">
        {workout.muscleGroups.map((group) => (
          <span
            key={group}
            className="text-[10px] text-slate-400 bg-slate-700/50 px-1.5 py-0.5 rounded"
          >
            {group}
          </span>
        ))}
      </div>
      <div className="flex items-center gap-3 text-xs text-slate-400">
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {workout.duration} min
        </span>
        <span className="flex items-center gap-1">
          <Repeat className="w-3 h-3" />
          {workout.exercises.length} exercises
        </span>
        {workout.scheduledTime && (
          <span className="flex items-center gap-1">
            <Timer className="w-3 h-3" />
            {workout.scheduledTime}
          </span>
        )}
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// PlanView
// ---------------------------------------------------------------------------

interface PlanViewProps {
  workouts: WorkoutPlan[];
  selectedWorkoutId: string;
  onSelectWorkout: (id: string) => void;
  onEditWorkout: (workout: WorkoutPlan) => void;
  onDeleteWorkout: (id: string) => void;
  onCreateNew: () => void;
  onReorder: (event: DragEndEvent) => void;
}

export function PlanView({
  workouts,
  selectedWorkoutId,
  onSelectWorkout,
  onEditWorkout,
  onDeleteWorkout,
  onCreateNew,
  onReorder,
}: PlanViewProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  return (
    <motion.div
      key="plan"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-4"
    >
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onReorder}
      >
        <SortableContext
          items={workouts.map((w) => w.id)}
          strategy={rectSortingStrategy}
        >
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {workouts.map((workout, index) => (
              <SortableWorkoutCard
                key={workout.id}
                workout={workout}
                index={index}
                isSelected={selectedWorkoutId === workout.id}
                onSelect={() => onSelectWorkout(workout.id)}
                onEdit={(e) => {
                  e.stopPropagation();
                  onEditWorkout(workout);
                }}
                onDelete={(e) => {
                  e.stopPropagation();
                  onDeleteWorkout(workout.id);
                }}
              />
            ))}

            {/* Add New Workout Card */}
            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: workouts.length * 0.05 }}
              onClick={onCreateNew}
              className="rounded-2xl border-2 border-dashed border-slate-700 hover:border-orange-500/50 p-5 flex flex-col items-center justify-center gap-3 text-slate-500 hover:text-orange-400 transition-colors min-h-[180px]"
            >
              <div className="w-12 h-12 rounded-xl bg-slate-800/50 flex items-center justify-center">
                <Plus className="w-6 h-6" />
              </div>
              <span className="font-medium">Create New Workout</span>
            </motion.button>
          </div>
        </SortableContext>
      </DndContext>
    </motion.div>
  );
}

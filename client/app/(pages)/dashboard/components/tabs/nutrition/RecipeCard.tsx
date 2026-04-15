"use client";

import { motion } from "framer-motion";
import { Heart, Edit3, Trash2, Check, Flame, Timer, Utensils, Salad } from "lucide-react";
import { Recipe } from "@/src/shared/services";

interface RecipeCardProps {
  recipe: Recipe;
  index: number;
  isSelected: boolean;
  onToggleSelection: () => void;
  onToggleFavorite: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onView?: () => void;
}

export function RecipeCard({
  recipe,
  index,
  isSelected,
  onToggleSelection,
  onToggleFavorite,
  onEdit,
  onDelete,
  onView,
}: RecipeCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={`rounded-2xl border p-5 transition-all group cursor-pointer ${
        isSelected
          ? "bg-red-500/5 border-red-500/30"
          : "bg-slate-800/50 border-slate-700/50 hover:border-emerald-500/50"
      }`}
      onClick={(e) => {
        // Don't trigger view if clicking on action buttons
        if (
          (e.target as HTMLElement).closest('button') ||
          (e.target as HTMLElement).closest('[role="button"]')
        ) {
          return;
        }
        onView?.();
      }}
    >
      {/* Selection checkbox */}
      <div className="flex items-start justify-between mb-3">
        <button
          onClick={onToggleSelection}
          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
            isSelected
              ? "border-red-500 bg-red-500"
              : "border-slate-600 hover:border-slate-500"
          }`}
        >
          {isSelected && <Check className="w-3 h-3 text-white" />}
        </button>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onToggleFavorite}
            className={`p-1.5 rounded-lg transition-colors ${
              recipe.isFavorite
                ? "text-pink-400 hover:bg-pink-500/20"
                : "text-slate-500 hover:text-pink-400 hover:bg-white/5"
            }`}
          >
            <Heart className={`w-4 h-4 ${recipe.isFavorite ? "fill-current" : ""}`} />
          </button>
          <button
            onClick={onEdit}
            className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 transition-colors"
          >
            <Edit3 className="w-4 h-4" />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Recipe Image Placeholder */}
      <div className="w-full h-32 rounded-xl bg-gradient-to-br from-emerald-500/20 to-green-500/10 mb-4 flex items-center justify-center relative overflow-hidden">
        {recipe.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={recipe.imageUrl}
            alt={recipe.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <Salad className="w-12 h-12 text-emerald-400/50" />
        )}
        {recipe.isFavorite && (
          <div className="absolute top-2 right-2 p-1.5 rounded-full bg-pink-500/90">
            <Heart className="w-3 h-3 text-white fill-current" />
          </div>
        )}
        {recipe.difficulty && (
          <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-full bg-black/50 backdrop-blur-sm">
            <span className={`text-[13px] font-medium ${
              recipe.difficulty === 'easy' ? 'text-green-400' :
              recipe.difficulty === 'hard' ? 'text-red-400' : 'text-amber-400'
            }`}>
              {recipe.difficulty.charAt(0).toUpperCase() + recipe.difficulty.slice(1)}
            </span>
          </div>
        )}
      </div>

      {/* Recipe Info */}
      <h4 className="font-semibold text-white mb-1 line-clamp-1">{recipe.name}</h4>
      {recipe.description && (
        <p className="text-xs text-slate-400 mb-2 line-clamp-2">{recipe.description}</p>
      )}

      {/* Stats */}
      <div className="flex items-center gap-3 text-xs text-slate-400 mb-3">
        {recipe.caloriesPerServing && (
          <span className="flex items-center gap-1">
            <Flame className="w-3 h-3 text-orange-400" />
            {recipe.caloriesPerServing} kcal
          </span>
        )}
        {(recipe.prepTimeMinutes || recipe.cookTimeMinutes) && (
          <span className="flex items-center gap-1">
            <Timer className="w-3 h-3" />
            {(recipe.prepTimeMinutes || 0) + (recipe.cookTimeMinutes || 0)} min
          </span>
        )}
        {recipe.servings && (
          <span className="flex items-center gap-1">
            <Utensils className="w-3 h-3" />
            {recipe.servings} serv
          </span>
        )}
      </div>

      {/* Tags */}
      {recipe.tags && recipe.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {recipe.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[13px] font-medium"
            >
              {tag}
            </span>
          ))}
          {recipe.tags.length > 3 && (
            <span className="px-2 py-0.5 rounded-full bg-slate-700/50 text-slate-400 text-[13px] font-medium">
              +{recipe.tags.length - 3}
            </span>
          )}
        </div>
      )}
    </motion.div>
  );
}

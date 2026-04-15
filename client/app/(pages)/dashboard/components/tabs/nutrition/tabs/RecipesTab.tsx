"use client";

import { motion } from "framer-motion";
import {
  Plus,
  Trash2,
  Edit3,
  Heart,
  ChefHat,
  Check,
  Flame,
  Timer,
  Utensils,
} from "lucide-react";
import type { Recipe } from "@/src/shared/services";
import { RecipeSkeleton } from "../Skeletons";

interface RecipesTabProps {
  recipes: Recipe[];
  recipesLoading: boolean;
  selectedRecipeIds: Set<string>;
  recipeFilterCategory: string | null;
  showFavoritesOnly: boolean;
  onRecipeSelect: (recipeId: string) => void;
  onRecipesDelete: () => void;
  onRecipeFavorite: (recipeId: string) => void;
  onRecipeEdit: (recipe: Recipe) => void;
  onRecipeDelete: (recipeId: string) => void;
  onRecipeView: (recipe: Recipe) => void;
  onRecipeCreate: () => void;
  onFilterCategoryChange: (category: string | null) => void;
  onFavoritesToggle: () => void;
}

export function RecipesTab({
  recipes,
  recipesLoading,
  selectedRecipeIds,
  recipeFilterCategory,
  showFavoritesOnly,
  onRecipeSelect,
  onRecipesDelete,
  onRecipeFavorite,
  onRecipeEdit,
  onRecipeDelete,
  onRecipeView,
  onRecipeCreate,
  onFilterCategoryChange,
  onFavoritesToggle,
}: RecipesTabProps) {
  const categories = [
    { id: null, label: "All" },
    { id: "breakfast", label: "Breakfast" },
    { id: "lunch", label: "Lunch" },
    { id: "dinner", label: "Dinner" },
    { id: "snack", label: "Snack" },
    { id: "dessert", label: "Dessert" },
  ];

  const filteredRecipes = recipes.filter((r) => {
    if (recipeFilterCategory && r.category !== recipeFilterCategory) return false;
    if (showFavoritesOnly && !r.isFavorite) return false;
    return true;
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-4 sm:space-y-6"
    >
      {/* Header with actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-[16px] sm:text-[18px] font-bold text-white tracking-tight">My Recipes</h3>
            <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 text-[10px] font-bold uppercase tracking-wider">
              {recipes.length}
            </span>
          </div>
          <p className="text-[11px] sm:text-[12px] text-slate-400 mt-0.5">Your personal cookbook</p>
        </div>
        <div className="flex items-center gap-2">
          {selectedRecipeIds.size > 0 && (
            <motion.button
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={onRecipesDelete}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 font-semibold text-[13px] hover:bg-red-500/25 transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete ({selectedRecipeIds.size})
            </motion.button>
          )}
          <button
            onClick={onFavoritesToggle}
            className={`p-2 rounded-xl border transition-all ${
              showFavoritesOnly
                ? "bg-pink-500/15 border-pink-500/30 text-pink-300"
                : "bg-white/[0.03] border-white/[0.08] text-slate-400 hover:bg-white/[0.06] hover:text-white"
            }`}
            title={showFavoritesOnly ? "Show all" : "Show favorites only"}
          >
            <Heart className={`w-4 h-4 ${showFavoritesOnly ? "fill-current" : ""}`} />
          </button>
          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            onClick={onRecipeCreate}
            className="flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[13px] shadow-lg shadow-emerald-600/25 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Recipe
          </motion.button>
        </div>
      </div>

      {/* Category Filter */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide p-1 rounded-xl bg-white/[0.03] border border-white/[0.06] w-fit max-w-full">
        {categories.map((cat) => (
          <button
            key={cat.id || "all"}
            onClick={() => onFilterCategoryChange(cat.id)}
            className={`px-3 sm:px-4 py-1.5 rounded-lg text-[12px] sm:text-[13px] font-semibold whitespace-nowrap transition-all ${
              recipeFilterCategory === cat.id
                ? "bg-emerald-600 text-white shadow shadow-emerald-600/25"
                : "text-slate-400 hover:text-white hover:bg-white/[0.04]"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Recipe Grid */}
      {recipesLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <RecipeSkeleton key={i} />
          ))}
        </div>
      ) : filteredRecipes.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.06] bg-[linear-gradient(145deg,#0f1219_0%,#0a0d14_100%)] p-8 sm:p-12 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 mb-4">
            <ChefHat className="w-6 h-6 text-emerald-300" />
          </div>
          <h4 className="text-white font-semibold mb-1 text-base">No recipes yet</h4>
          <p className="text-slate-400 text-[13px] mb-5">
            {showFavoritesOnly
              ? "No favorite recipes. Mark recipes as favorites to see them here."
              : "Create your first recipe to build your personal cookbook."}
          </p>
          {!showFavoritesOnly && (
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={onRecipeCreate}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[13px] shadow-lg shadow-emerald-600/25 transition-all"
            >
              Create Your First Recipe
            </motion.button>
          )}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {filteredRecipes.map((recipe, index) => {
            const isSelected = selectedRecipeIds.has(recipe.id);
            return (
              <motion.div
                key={recipe.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.04, 0.4) }}
                className={`group relative overflow-hidden rounded-2xl border p-3 sm:p-4 cursor-pointer transition-all ${
                  isSelected
                    ? "border-red-500/50 bg-[linear-gradient(145deg,rgba(239,68,68,0.08)_0%,#0f1219_60%,#0a0d14_100%)]"
                    : "border-white/[0.06] bg-[linear-gradient(145deg,#0f1219_0%,#0a0d14_100%)] hover:border-white/[0.14] hover:shadow-lg hover:shadow-emerald-500/5"
                }`}
                onClick={(e) => {
                  if (
                    (e.target as HTMLElement).closest("button") ||
                    (e.target as HTMLElement).closest('[role="button"]')
                  ) {
                    return;
                  }
                  onRecipeView(recipe);
                }}
              >
                {/* Recipe Image with badges */}
                <div className="relative w-full h-32 sm:h-36 rounded-xl overflow-hidden mb-3 bg-[linear-gradient(135deg,rgba(16,185,129,0.18)_0%,rgba(6,182,212,0.08)_100%)]">
                  {recipe.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={recipe.imageUrl}
                      alt={recipe.name}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ChefHat className="w-12 h-12 text-emerald-300/40" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                  {/* Top overlay: checkbox + action bar */}
                  <div className="absolute top-2 left-2 right-2 flex items-start justify-between">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRecipeSelect(recipe.id);
                      }}
                      className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all backdrop-blur-sm ${
                        isSelected
                          ? "border-red-500 bg-red-500"
                          : "border-white/30 bg-black/40 hover:border-white/60"
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3 text-white" />}
                    </button>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRecipeFavorite(recipe.id);
                        }}
                        className={`p-1.5 rounded-lg backdrop-blur-sm transition-colors ${
                          recipe.isFavorite
                            ? "bg-pink-500/80 text-white"
                            : "bg-black/40 text-white/70 hover:text-pink-300 hover:bg-black/60"
                        }`}
                      >
                        <Heart className={`w-3.5 h-3.5 ${recipe.isFavorite ? "fill-current" : ""}`} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRecipeEdit(recipe);
                        }}
                        className="p-1.5 rounded-lg bg-black/40 backdrop-blur-sm text-white/70 hover:text-white hover:bg-black/60 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRecipeDelete(recipe.id);
                        }}
                        className="p-1.5 rounded-lg bg-black/40 backdrop-blur-sm text-white/70 hover:text-red-400 hover:bg-red-500/40 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Bottom overlay: difficulty */}
                  {recipe.difficulty && (
                    <div className="absolute bottom-2 left-2">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider backdrop-blur-md border ${
                          recipe.difficulty === "easy"
                            ? "bg-emerald-500/25 border-emerald-500/40 text-emerald-200"
                            : recipe.difficulty === "hard"
                            ? "bg-red-500/25 border-red-500/40 text-red-200"
                            : "bg-amber-500/25 border-amber-500/40 text-amber-200"
                        }`}
                      >
                        {recipe.difficulty}
                      </span>
                    </div>
                  )}
                </div>

                {/* Recipe Info */}
                <h4 className="font-bold text-white mb-1 line-clamp-1 text-[14px] sm:text-[15px] tracking-tight">{recipe.name}</h4>
                {recipe.description && (
                  <p className="text-[11px] sm:text-[12px] text-slate-400 mb-2 line-clamp-2 leading-relaxed">{recipe.description}</p>
                )}

                {/* Stats chips */}
                <div className="flex flex-wrap items-center gap-1.5 mb-3">
                  {recipe.caloriesPerServing && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-orange-500/10 text-orange-200 text-[10px] font-medium">
                      <Flame className="w-3 h-3" />
                      {recipe.caloriesPerServing}
                    </span>
                  )}
                  {(recipe.prepTimeMinutes || recipe.cookTimeMinutes) && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-sky-500/10 text-sky-200 text-[10px] font-medium">
                      <Timer className="w-3 h-3" />
                      {(recipe.prepTimeMinutes || 0) + (recipe.cookTimeMinutes || 0)}m
                    </span>
                  )}
                  {recipe.servings && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-white/[0.04] text-slate-300 text-[10px] font-medium">
                      <Utensils className="w-3 h-3" />
                      {recipe.servings}
                    </span>
                  )}
                </div>

                {/* Tags */}
                {recipe.tags && recipe.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {recipe.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[10px] font-semibold"
                      >
                        {tag}
                      </span>
                    ))}
                    {recipe.tags.length > 3 && (
                      <span className="px-2 py-0.5 rounded-full bg-white/[0.04] text-slate-400 text-[10px] font-medium">
                        +{recipe.tags.length - 3}
                      </span>
                    )}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}


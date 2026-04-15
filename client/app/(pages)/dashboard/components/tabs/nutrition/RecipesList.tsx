"use client";

import { motion } from "framer-motion";
import { Plus, Trash2, Heart, ChefHat } from "lucide-react";
import { Recipe } from "@/src/shared/services";
import { RecipeSkeleton } from "./Skeletons";
import { RecipeCard } from "./RecipeCard";

interface RecipesListProps {
  recipes: Recipe[];
  isLoading: boolean;
  selectedIds: Set<string>;
  filterCategory: string | null;
  showFavoritesOnly: boolean;
  onCreateRecipe: () => void;
  onToggleFavoritesFilter: () => void;
  onSetFilterCategory: (category: string | null) => void;
  onToggleSelection: (recipeId: string) => void;
  onDeleteSelected: () => void;
  onToggleFavorite: (recipeId: string) => void;
  onEditRecipe: (recipe: Recipe) => void;
  onDeleteRecipe: (recipeId: string) => void;
  onViewRecipe?: (recipe: Recipe) => void;
}

const RECIPE_FILTER_CATEGORIES = [
  { id: null, label: "All" },
  { id: "breakfast", label: "Breakfast" },
  { id: "lunch", label: "Lunch" },
  { id: "dinner", label: "Dinner" },
  { id: "snack", label: "Snack" },
  { id: "dessert", label: "Dessert" },
];

export function RecipesList({
  recipes,
  isLoading,
  selectedIds,
  filterCategory,
  showFavoritesOnly,
  onCreateRecipe,
  onToggleFavoritesFilter,
  onSetFilterCategory,
  onToggleSelection,
  onDeleteSelected,
  onToggleFavorite,
  onEditRecipe,
  onDeleteRecipe,
  onViewRecipe,
}: RecipesListProps) {
  const filteredRecipes = recipes
    .filter((r) => !filterCategory || r.category === filterCategory)
    .filter((r) => !showFavoritesOnly || r.isFavorite);

  return (
    <motion.div
      key="recipes"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      {/* Header with actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-white">My Recipes</h3>
          <span className="text-sm text-slate-500">({recipes.length})</span>
        </div>
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <motion.button
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onDeleteSelected}
              className="px-3 py-2 rounded-xl bg-red-500/20 text-red-400 text-sm font-medium flex items-center gap-2 hover:bg-red-500/30 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Delete ({selectedIds.size})
            </motion.button>
          )}
          <button
            onClick={onToggleFavoritesFilter}
            className={`p-2 rounded-xl transition-colors ${
              showFavoritesOnly
                ? "bg-pink-500/20 text-pink-400"
                : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white"
            }`}
            title={showFavoritesOnly ? "Show all" : "Show favorites only"}
          >
            <Heart className={`w-5 h-5 ${showFavoritesOnly ? "fill-current" : ""}`} />
          </button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onCreateRecipe}
            className="px-4 py-2 rounded-xl bg-emerald-500 text-white font-medium text-sm flex items-center gap-2 hover:bg-emerald-600 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Recipe
          </motion.button>
        </div>
      </div>

      {/* Category Filter */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {RECIPE_FILTER_CATEGORIES.map((cat) => (
          <button
            key={cat.id || "all"}
            onClick={() => onSetFilterCategory(cat.id)}
            className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${
              filterCategory === cat.id
                ? "bg-emerald-500 text-white"
                : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Recipe Grid */}
      {isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <RecipeSkeleton key={i} />
          ))}
        </div>
      ) : filteredRecipes.length === 0 ? (
        <div className="rounded-2xl bg-slate-800/50 border border-slate-700/50 p-8 text-center">
          <ChefHat className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h4 className="text-white font-medium mb-2">No recipes yet</h4>
          <p className="text-slate-400 text-sm mb-4">
            {showFavoritesOnly
              ? "No favorite recipes. Mark recipes as favorites to see them here."
              : "Create your first recipe to build your personal cookbook."}
          </p>
          {!showFavoritesOnly && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onCreateRecipe}
              className="px-4 py-2 rounded-xl bg-emerald-500 text-white font-medium text-sm hover:bg-emerald-600 transition-colors"
            >
              Create Your First Recipe
            </motion.button>
          )}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRecipes.map((recipe, index) => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              index={index}
              isSelected={selectedIds.has(recipe.id)}
              onToggleSelection={() => onToggleSelection(recipe.id)}
              onToggleFavorite={() => onToggleFavorite(recipe.id)}
              onEdit={() => onEditRecipe(recipe)}
              onDelete={() => onDeleteRecipe(recipe.id)}
              onView={() => onViewRecipe?.(recipe)}
            />
          ))}
        </div>
      )}
    </motion.div>
  );
}

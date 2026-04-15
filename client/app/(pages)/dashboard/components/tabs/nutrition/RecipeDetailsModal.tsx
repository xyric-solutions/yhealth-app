"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Flame,
  Timer,
  Utensils,
  Heart,
  Edit3,
  Salad,
  ChefHat,
  Clock,
  Tag,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { Recipe } from "@/src/shared/services";

interface RecipeDetailsModalProps {
  recipe: Recipe | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (recipe: Recipe) => void;
  onToggleFavorite?: (recipeId: string) => void;
}

export function RecipeDetailsModal({
  recipe,
  isOpen,
  onClose,
  onEdit,
  onToggleFavorite,
}: RecipeDetailsModalProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  if (!recipe) return null;

  const totalTime = (recipe.prepTimeMinutes || 0) + (recipe.cookTimeMinutes || 0);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={`max-h-[90vh] overflow-y-auto bg-slate-900 border-slate-700 transition-all duration-300 ${
        isFullscreen ? "max-w-full w-[calc(100vw-2rem)] h-[calc(100vh-2rem)]" : "w-full sm:max-w-3xl"
      }`}>
        <DialogHeader>
          <div className="flex items-start justify-between">
            <DialogTitle className="text-lg font-bold text-white pr-8">
              {recipe.name}
            </DialogTitle>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsFullscreen((f) => !f)}
                className="p-2 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 transition-colors"
                title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
              >
                {isFullscreen ? (
                  <Minimize2 className="w-5 h-5" />
                ) : (
                  <Maximize2 className="w-5 h-5" />
                )}
              </button>
              {onToggleFavorite && (
                <button
                  onClick={() => onToggleFavorite(recipe.id)}
                  className={`p-2 rounded-lg transition-colors ${
                    recipe.isFavorite
                      ? "text-pink-400 hover:bg-pink-500/20"
                      : "text-slate-500 hover:text-pink-400 hover:bg-white/5"
                  }`}
                >
                  <Heart className={`w-5 h-5 ${recipe.isFavorite ? "fill-current" : ""}`} />
                </button>
              )}
              {onEdit && (
                <button
                  onClick={() => {
                    onEdit(recipe);
                    onClose();
                  }}
                  className="p-2 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 transition-colors"
                >
                  <Edit3 className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 sm:space-y-6">
          {/* Recipe Image */}
          <div className="w-full h-48 sm:h-64 rounded-xl bg-gradient-to-br from-emerald-500/20 to-green-500/10 flex items-center justify-center relative overflow-hidden">
            {recipe.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={recipe.imageUrl}
                alt={recipe.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <Salad className="w-24 h-24 text-emerald-400/50" />
            )}
            {recipe.difficulty && (
              <div className="absolute bottom-4 left-4 px-3 py-1 rounded-full bg-black/70 backdrop-blur-sm">
                <span className={`text-sm font-medium ${
                  recipe.difficulty === 'easy' ? 'text-green-400' :
                  recipe.difficulty === 'hard' ? 'text-red-400' : 'text-amber-400'
                }`}>
                  {recipe.difficulty.charAt(0).toUpperCase() + recipe.difficulty.slice(1)}
                </span>
              </div>
            )}
          </div>

          {/* Description */}
          {recipe.description && (
            <p className="text-slate-300 leading-relaxed">{recipe.description}</p>
          )}

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
            {recipe.caloriesPerServing && (
              <div className="flex flex-col items-center p-3 sm:p-4 rounded-xl bg-slate-800/50 border border-slate-700">
                <Flame className="w-5 h-5 sm:w-6 sm:h-6 text-orange-400 mb-1.5 sm:mb-2" />
                <span className="text-[15px] sm:text-lg font-bold text-white">{recipe.caloriesPerServing}</span>
                <span className="text-[11px] sm:text-xs text-slate-400">Calories</span>
              </div>
            )}
            {totalTime > 0 && (
              <div className="flex flex-col items-center p-3 sm:p-4 rounded-xl bg-slate-800/50 border border-slate-700">
                <Timer className="w-5 h-5 sm:w-6 sm:h-6 text-blue-400 mb-1.5 sm:mb-2" />
                <span className="text-[15px] sm:text-lg font-bold text-white">{totalTime}</span>
                <span className="text-[11px] sm:text-xs text-slate-400">Minutes</span>
              </div>
            )}
            {recipe.servings && (
              <div className="flex flex-col items-center p-3 sm:p-4 rounded-xl bg-slate-800/50 border border-slate-700">
                <Utensils className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-400 mb-1.5 sm:mb-2" />
                <span className="text-[15px] sm:text-lg font-bold text-white">{recipe.servings}</span>
                <span className="text-[11px] sm:text-xs text-slate-400">Servings</span>
              </div>
            )}
            {recipe.prepTimeMinutes && recipe.cookTimeMinutes && (
              <div className="flex flex-col items-center p-3 sm:p-4 rounded-xl bg-slate-800/50 border border-slate-700">
                <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-purple-400 mb-1.5 sm:mb-2" />
                <span className="text-[15px] sm:text-lg font-bold text-white">
                  {recipe.prepTimeMinutes}/{recipe.cookTimeMinutes}
                </span>
                <span className="text-[11px] sm:text-xs text-slate-400">Prep/Cook</span>
              </div>
            )}
          </div>

          {/* Nutrition Info */}
          {(recipe.proteinGrams || recipe.carbsGrams || recipe.fatGrams) && (
            <div className="p-3 sm:p-4 rounded-xl bg-slate-800/50 border border-slate-700">
              <h3 className="text-[15px] sm:text-lg font-semibold text-white mb-2 sm:mb-3">Nutrition (per serving)</h3>
              <div className="grid grid-cols-3 gap-3 sm:gap-4">
                {recipe.proteinGrams && (
                  <div>
                    <span className="text-[13px] sm:text-sm text-slate-400">Protein</span>
                    <p className="text-[14px] sm:text-base font-bold text-white">{recipe.proteinGrams}g</p>
                  </div>
                )}
                {recipe.carbsGrams && (
                  <div>
                    <span className="text-[13px] sm:text-sm text-slate-400">Carbs</span>
                    <p className="text-[14px] sm:text-base font-bold text-white">{recipe.carbsGrams}g</p>
                  </div>
                )}
                {recipe.fatGrams && (
                  <div>
                    <span className="text-[13px] sm:text-sm text-slate-400">Fat</span>
                    <p className="text-[14px] sm:text-base font-bold text-white">{recipe.fatGrams}g</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Ingredients */}
          {recipe.ingredients && recipe.ingredients.length > 0 && (
            <div>
              <h3 className="text-[15px] sm:text-lg font-semibold text-white mb-2 sm:mb-3 flex items-center gap-2">
                <ChefHat className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />
                Ingredients
              </h3>
              <div className="space-y-2">
                {recipe.ingredients.map((ingredient, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-lg bg-slate-800/50 border border-slate-700"
                  >
                    <span className="text-emerald-400 font-semibold min-w-[24px]">
                      {index + 1}.
                    </span>
                    <div className="flex-1">
                      <span className="text-white font-medium">{ingredient.name}</span>
                      {(ingredient.quantity || ingredient.unit) && (
                        <span className="text-slate-400 ml-2">
                          {ingredient.quantity} {ingredient.unit}
                        </span>
                      )}
                      {ingredient.notes && (
                        <p className="text-xs text-slate-500 mt-1">{ingredient.notes}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Instructions */}
          {recipe.instructions && recipe.instructions.length > 0 && (
            <div>
              <h3 className="text-[15px] sm:text-lg font-semibold text-white mb-2 sm:mb-3 flex items-center gap-2">
                <Timer className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />
                Instructions
              </h3>
              <div className="space-y-3">
                {recipe.instructions
                  .sort((a, b) => a.step - b.step)
                  .map((instruction) => (
                    <div
                      key={instruction.step}
                      className="flex items-start gap-2 sm:gap-3 p-3 sm:p-4 rounded-lg bg-slate-800/50 border border-slate-700"
                    >
                      <span className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 font-semibold text-sm flex-shrink-0">
                        {instruction.step}
                      </span>
                      <p className="text-slate-300 leading-relaxed flex-1">
                        {instruction.description}
                      </p>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Tags and Dietary Flags */}
          {(recipe.tags.length > 0 || recipe.dietaryFlags.length > 0) && (
            <div className="space-y-3">
              {recipe.tags.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-slate-400 mb-2 flex items-center gap-2">
                    <Tag className="w-4 h-4" />
                    Tags
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {recipe.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-sm font-medium"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {recipe.dietaryFlags.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-slate-400 mb-2">Dietary</h4>
                  <div className="flex flex-wrap gap-2">
                    {recipe.dietaryFlags.map((flag) => (
                      <span
                        key={flag}
                        className="px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 text-sm font-medium"
                      >
                        {flag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Additional Info */}
          <div className="flex flex-wrap gap-4 text-sm text-slate-400 pt-4 border-t border-slate-700">
            {recipe.category && (
              <span>
                <span className="text-slate-500">Category:</span>{" "}
                <span className="text-white capitalize">{recipe.category}</span>
              </span>
            )}
            {recipe.cuisine && (
              <span>
                <span className="text-slate-500">Cuisine:</span>{" "}
                <span className="text-white capitalize">{recipe.cuisine}</span>
              </span>
            )}
            {recipe.timesMade > 0 && (
              <span>
                <span className="text-slate-500">Made:</span>{" "}
                <span className="text-white">{recipe.timesMade} times</span>
              </span>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}


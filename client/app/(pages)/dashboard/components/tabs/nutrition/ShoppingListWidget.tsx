"use client";

import { useMemo } from "react";
import { ShoppingCart, Wand2, Plus, Circle, Edit3, Trash2, Check, Loader2, Flame } from "lucide-react";
import { ShoppingItem } from "./types";

interface ShoppingListWidgetProps {
  items: ShoppingItem[];
  isLoading: boolean;
  onAddItem: () => void;
  onGenerateWithAI: () => void;
  onViewAll: () => void;
  onToggleItem: (itemId: string) => void;
  onEditItem: (item: ShoppingItem) => void;
  onDeleteItem: (itemId: string) => void;
  onClearPurchased: () => void;
}

export function ShoppingListWidget({
  items,
  isLoading,
  onAddItem,
  onGenerateWithAI,
  onViewAll,
  onToggleItem,
  onEditItem,
  onDeleteItem,
  onClearPurchased,
}: ShoppingListWidgetProps) {
  const pendingItems = useMemo(() => items.filter((item) => !item.isPurchased), [items]);
  const purchasedItems = useMemo(() => items.filter((item) => item.isPurchased), [items]);
  
  // Calculate total calories for pending items
  const totalCalories = useMemo(() => {
    return pendingItems.reduce((total, item) => {
      return total + (item.calories || 0);
    }, 0);
  }, [pendingItems]);

  return (
    <div className="rounded-2xl bg-slate-800/50 border border-slate-700/50 p-4 sm:p-5 overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <div className="flex-1 min-w-0">
          <h4 className="text-white font-semibold flex items-center gap-2 min-w-0">
            <ShoppingCart className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="truncate">Shopping List</span>
          </h4>
          {totalCalories > 0 && (
            <p className="text-xs text-orange-400 flex items-center gap-1 mt-1 ml-6">
              <Flame className="w-3 h-3" />
              {totalCalories} kcal
            </p>
          )}
        </div>
        <div className="flex gap-1">
          <button
            onClick={onGenerateWithAI}
            className="p-1.5 rounded-lg bg-violet-500/20 hover:bg-violet-500/30 text-violet-400 transition-colors"
            title="Generate with AI"
          >
            <Wand2 className="w-4 h-4" />
          </button>
          <button
            onClick={onAddItem}
            className="p-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 transition-colors"
            title="Add item"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-4">
          <ShoppingCart className="w-8 h-8 text-slate-600 mx-auto mb-2" />
          <p className="text-sm text-slate-400 mb-3">Your shopping list is empty</p>
          <div className="flex gap-2 justify-center">
            <button
              onClick={onAddItem}
              className="text-xs text-emerald-400 hover:text-emerald-300"
            >
              Add manually
            </button>
            <span className="text-slate-600">or</span>
            <button
              onClick={onGenerateWithAI}
              className="text-xs text-violet-400 hover:text-violet-300"
            >
              Generate with AI
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {pendingItems.slice(0, 8).map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 text-sm group p-2 rounded-lg hover:bg-white/5 transition-colors"
              >
                <button
                  onClick={() => onToggleItem(item.id)}
                  className="text-slate-600 hover:text-emerald-400 transition-colors"
                >
                  <Circle className="w-4 h-4" />
                </button>
                <div className="flex-1 min-w-0">
                  <span className="text-slate-300 truncate block">{item.name}</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    {item.quantity && <span className="text-xs text-slate-500">{item.quantity}</span>}
                    {item.calories && item.calories > 0 && (
                      <span className="text-xs text-orange-400 flex items-center gap-0.5">
                        <Flame className="w-3 h-3" />
                        {item.calories} kcal
                      </span>
                    )}
                  </div>
                </div>
                <div className="opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity">
                  <button
                    onClick={() => onEditItem(item)}
                    className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white"
                  >
                    <Edit3 className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => onDeleteItem(item.id)}
                    className="p-1 rounded hover:bg-red-500/20 text-slate-400 hover:text-red-400"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}

            {purchasedItems.length > 0 && (
              <div className="border-t border-slate-700/50 pt-2 mt-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-slate-500">Purchased ({purchasedItems.length})</span>
                  <button
                    onClick={onClearPurchased}
                    className="text-xs text-slate-500 hover:text-red-400 transition-colors"
                  >
                    Clear all
                  </button>
                </div>
                <div className="overflow-y-auto max-h-40">
                  {purchasedItems.slice(0, 3).map((item) => (
                    <div key={item.id} className="flex items-center gap-3 text-sm p-2 rounded-lg opacity-50">
                      <button
                        onClick={() => onToggleItem(item.id)}
                        className="text-emerald-400"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <div className="flex-1 min-w-0">
                        <span className="text-slate-400 line-through truncate block">{item.name}</span>
                        {item.calories && item.calories > 0 && (
                          <span className="text-xs text-orange-400/70 flex items-center gap-0.5 mt-0.5">
                            <Flame className="w-3 h-3" />
                            {item.calories} kcal
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={onViewAll}
            className="w-full mt-3 py-2 text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            View All ({items.length} items)
          </button>
        </>
      )}
    </div>
  );
}

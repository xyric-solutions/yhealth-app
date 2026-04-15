"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface BlogPaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  onItemsPerPageChange?: (itemsPerPage: number) => void;
  className?: string;
}

export function BlogPagination({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
  onItemsPerPageChange,
  className,
}: BlogPaginationProps) {
  const [jumpToPage, setJumpToPage] = useState("");

  const handleJumpToPage = () => {
    const page = parseInt(jumpToPage);
    if (page >= 1 && page <= totalPages) {
      onPageChange(page);
      setJumpToPage("");
    }
  };

  const getPageNumbers = () => {
    const pages: (number | "ellipsis")[] = [];
    const maxVisible = 7;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 5; i++) {
          pages.push(i);
        }
        pages.push("ellipsis");
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push("ellipsis");
        for (let i = totalPages - 4; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        pages.push(1);
        pages.push("ellipsis");
        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
          pages.push(i);
        }
        pages.push("ellipsis");
        pages.push(totalPages);
      }
    }

    return pages;
  };

  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "flex flex-col gap-4 rounded-2xl bg-slate-900/40 border border-slate-800/60 backdrop-blur-sm p-5",
        className
      )}
    >
      {/* Info and Page Size */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="text-sm text-slate-400">
          Showing{" "}
          <span className="text-emerald-300 font-semibold">{startItem}</span> to{" "}
          <span className="text-emerald-300 font-semibold">{endItem}</span> of{" "}
          <span className="text-white font-semibold">{totalItems}</span> blogs
        </div>

        {onItemsPerPageChange && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 uppercase tracking-wider font-medium">Per page</span>
            <Select
              value={itemsPerPage.toString()}
              onValueChange={(value) => onItemsPerPageChange(parseInt(value))}
            >
              <SelectTrigger className="w-20 h-9 bg-slate-800/60 border-slate-700/50 rounded-lg text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-700/60 rounded-xl shadow-xl">
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        {/* Previous Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="bg-slate-800/60 border-slate-700/50 hover:bg-slate-700/60 disabled:opacity-40 rounded-xl h-10 px-4"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Previous
        </Button>

        {/* Page Numbers */}
        <div className="flex items-center gap-1.5">
          <AnimatePresence mode="wait">
            {getPageNumbers().map((page, index) => {
              if (page === "ellipsis") {
                return (
                  <div
                    key={`ellipsis-${index}`}
                    className="px-1.5 py-1 text-slate-600"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </div>
                );
              }

              const isActive = page === currentPage;

              return (
                <motion.button
                  key={page}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  onClick={() => onPageChange(page)}
                  className={cn(
                    "min-w-10 h-10 px-3 rounded-xl text-sm font-medium transition-all duration-200",
                    isActive
                      ? "bg-linear-to-r from-emerald-500 to-sky-500 text-white shadow-lg shadow-emerald-500/25"
                      : "bg-slate-800/40 text-slate-400 hover:bg-slate-700/60 hover:text-white border border-slate-700/30"
                  )}
                >
                  {page}
                </motion.button>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Next Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="bg-slate-800/60 border-slate-700/50 hover:bg-slate-700/60 disabled:opacity-40 rounded-xl h-10 px-4"
        >
          Next
          <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>

      {/* Jump to Page */}
      {totalPages > 10 && (
        <div className="flex items-center gap-2 justify-center pt-2 border-t border-slate-800/40">
          <span className="text-xs text-slate-500 uppercase tracking-wider font-medium">Jump to</span>
          <Input
            type="number"
            min={1}
            max={totalPages}
            value={jumpToPage}
            onChange={(e) => setJumpToPage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleJumpToPage();
              }
            }}
            placeholder="#"
            className="w-16 h-9 bg-slate-800/60 border-slate-700/50 rounded-lg text-center text-sm"
          />
          <Button
            size="sm"
            onClick={handleJumpToPage}
            disabled={!jumpToPage}
            className="bg-linear-to-r from-emerald-500 to-sky-500 hover:from-emerald-600 hover:to-sky-600 text-white h-9 rounded-lg shadow-md shadow-emerald-500/20"
          >
            Go
          </Button>
        </div>
      )}
    </motion.div>
  );
}


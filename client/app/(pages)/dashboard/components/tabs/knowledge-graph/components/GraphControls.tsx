'use client';

import { ZoomIn, ZoomOut, Maximize2, RotateCcw } from 'lucide-react';
import { useSigma } from '@react-sigma/core';

export function GraphControls() {
  const sigma = useSigma();

  const handleZoomIn = () => {
    const camera = sigma.getCamera();
    camera.animatedZoom({ duration: 300 });
  };

  const handleZoomOut = () => {
    const camera = sigma.getCamera();
    camera.animatedUnzoom({ duration: 300 });
  };

  const handleFitView = () => {
    const camera = sigma.getCamera();
    camera.animatedReset({ duration: 400 });
  };

  const handleReset = () => {
    const camera = sigma.getCamera();
    camera.animatedReset({ duration: 400 });
  };

  return (
    <div className="absolute bottom-4 left-4 z-10 flex flex-col gap-1.5 bg-slate-800/90 border border-white/10 rounded-lg p-1 backdrop-blur-sm">
      <button
        onClick={handleZoomIn}
        className="p-2 rounded-md hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
        title="Zoom in"
      >
        <ZoomIn className="w-4 h-4" />
      </button>
      <button
        onClick={handleZoomOut}
        className="p-2 rounded-md hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
        title="Zoom out"
      >
        <ZoomOut className="w-4 h-4" />
      </button>
      <div className="w-full h-px bg-white/10" />
      <button
        onClick={handleFitView}
        className="p-2 rounded-md hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
        title="Fit to view"
      >
        <Maximize2 className="w-4 h-4" />
      </button>
      <button
        onClick={handleReset}
        className="p-2 rounded-md hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
        title="Reset view"
      >
        <RotateCcw className="w-4 h-4" />
      </button>
    </div>
  );
}

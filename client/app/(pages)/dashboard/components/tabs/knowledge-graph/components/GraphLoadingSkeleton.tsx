'use client';

export function GraphLoadingSkeleton() {
  return (
    <div className="w-full h-full min-h-[500px] rounded-xl bg-slate-900/50 border border-white/5 flex items-center justify-center">
      <div className="text-center">
        {/* Animated dots representing graph nodes */}
        <div className="relative w-32 h-32 mx-auto mb-4">
          {[
            { x: 50, y: 20, size: 12, delay: 0, color: '#EF4444' },
            { x: 85, y: 45, size: 8, delay: 0.2, color: '#22C55E' },
            { x: 70, y: 80, size: 10, delay: 0.4, color: '#A855F7' },
            { x: 25, y: 65, size: 9, delay: 0.6, color: '#3B82F6' },
            { x: 15, y: 30, size: 7, delay: 0.8, color: '#0EA5E9' },
            { x: 50, y: 50, size: 16, delay: 0.1, color: '#FCD34D' },
          ].map((dot, i) => (
            <div
              key={i}
              className="absolute rounded-full animate-pulse"
              style={{
                left: `${dot.x}%`,
                top: `${dot.y}%`,
                width: dot.size,
                height: dot.size,
                backgroundColor: dot.color,
                opacity: 0.6,
                animationDelay: `${dot.delay}s`,
                transform: 'translate(-50%, -50%)',
              }}
            />
          ))}
          {/* Connecting lines */}
          <svg className="absolute inset-0 w-full h-full opacity-20">
            <line x1="50%" y1="50%" x2="50%" y2="20%" stroke="#94A3B8" strokeWidth="1" />
            <line x1="50%" y1="50%" x2="85%" y2="45%" stroke="#94A3B8" strokeWidth="1" />
            <line x1="50%" y1="50%" x2="70%" y2="80%" stroke="#94A3B8" strokeWidth="1" />
            <line x1="50%" y1="50%" x2="25%" y2="65%" stroke="#94A3B8" strokeWidth="1" />
            <line x1="50%" y1="50%" x2="15%" y2="30%" stroke="#94A3B8" strokeWidth="1" />
          </svg>
        </div>

        <p className="text-sm text-slate-400 animate-pulse">Building your knowledge graph...</p>
      </div>
    </div>
  );
}

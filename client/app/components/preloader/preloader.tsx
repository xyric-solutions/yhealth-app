"use client"

import { useEffect, useState, useMemo } from "react"

export function AILoader({ text = "Generating" }: { text?: string }) {
  const [dots, setDots] = useState("")
  const [progress, setProgress] = useState(0)
  const [dataStream, setDataStream] = useState<string[]>([])

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? "" : prev + "."))
    }, 500)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => (prev >= 100 ? 0 : prev + 0.5))
    }, 50)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const chars = "01アイウエオカキクケコ■□▪▫●○◆◇"
    const interval = setInterval(() => {
      const newStream = Array.from({ length: 8 }, () =>
        Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join(""),
      )
      setDataStream(newStream)
    }, 100)
    return () => clearInterval(interval)
  }, [])

  // Round to 4 decimal places to avoid SSR/client floating-point hydration mismatches
  const r4 = (n: number) => Math.round(n * 10000) / 10000

  const floatingParticles = useMemo(
    () =>
      [...Array(40)].map((_, i) => {
        const angle = (i / 40) * Math.PI * 2
        // Deterministic pseudo-random via Knuth multiplicative hash (avoids SSR/client mismatch)
        const seed = ((i * 2654435761) >>> 0) / 4294967296
        const radius = 200 + seed * 150
        return {
          id: i,
          angle,
          radius,
          duration: 3 + (i % 4),
          delay: r4((i * 0.15) % 3),
          size: 1 + (i % 4),
        }
      }),
    [],
  )

  const hexNodes = useMemo(
    () =>
      [...Array(12)].map((_, i) => {
        const angle = (i / 12) * Math.PI * 2
        const radius = 160
        return {
          id: i,
          x: r4(200 + radius * Math.cos(angle)),
          y: r4(200 + radius * Math.sin(angle)),
          delay: i * 0.15,
        }
      }),
    [],
  )

  const circuitPaths = useMemo(
    () =>
      [...Array(6)].map((_, i) => {
        const angle = (i / 6) * Math.PI * 2
        return {
          id: i,
          startAngle: r4(angle),
          endAngle: r4(angle + Math.PI / 3),
          radius: 140 + (i % 2) * 30,
        }
      }),
    [],
  )

  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen bg-black overflow-hidden">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1200px] h-[1200px] bg-emerald-950/20 rounded-full blur-[250px]" />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-teal-900/30 rounded-full blur-[180px] animate-pulse"
          style={{ animationDuration: "4s" }}
        />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-emerald-600/20 rounded-full blur-[120px] animate-pulse"
          style={{ animationDuration: "3s", animationDelay: "1s" }}
        />
      </div>

      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='49' viewBox='0 0 28 49'%3E%3Cg fillRule='evenodd'%3E%3Cg fill='%2310b981' fillOpacity='1'%3E%3Cpath d='M13.99 9.25l13 7.5v15l-13 7.5L1 31.75v-15l12.99-7.5zM3 17.9v12.7l10.99 6.34 11-6.35V17.9l-11-6.34L3 17.9zM0 15l12.98-7.5V0h-2v6.35L0 12.69v2.3zm0 18.5L12.98 41v8h-2v-6.85L0 35.81v-2.3zM15 0v7.5L27.99 15H28v-2.31h-.01L17 6.35V0h-2zm0 49v-8l12.99-7.5H28v2.31h-.01L17 42.15V49h-2z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />

      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent animate-scan-slow" />
        <div
          className="absolute top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-emerald-500/20 to-transparent animate-scan-horizontal"
          style={{ left: "50%" }}
        />
      </div>

      <div className="absolute left-8 top-1/2 -translate-y-1/2 flex flex-col gap-1 opacity-30 font-mono text-[10px] text-emerald-400">
        {dataStream.map((line, i) => (
          <div key={i} className="animate-pulse" style={{ animationDelay: `${i * 0.1}s` }}>
            {line}
          </div>
        ))}
      </div>
      <div className="absolute right-8 top-1/2 -translate-y-1/2 flex flex-col gap-1 opacity-30 font-mono text-[10px] text-emerald-400 text-right">
        {dataStream
          .slice()
          .reverse()
          .map((line, i) => (
            <div key={i} className="animate-pulse" style={{ animationDelay: `${i * 0.1}s` }}>
              {line}
            </div>
          ))}
      </div>

      <div className="relative w-[13rem] h-[13rem] lg:w-[15rem] lg:h-[15rem]">
        {/* SVG Layer for advanced effects */}
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 400">
          <defs>
            <filter id="glow" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="6" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            <filter id="glowStrong" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="10" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            <linearGradient id="emeraldGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#6ee7b7" stopOpacity="0.9" />
              <stop offset="50%" stopColor="#10b981" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#047857" stopOpacity="0.3" />
            </linearGradient>

            <linearGradient id="circuitGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#6ee7b7" stopOpacity="0" />
              <stop offset="50%" stopColor="#10b981" stopOpacity="1" />
              <stop offset="100%" stopColor="#6ee7b7" stopOpacity="0" />
            </linearGradient>

            <radialGradient id="coreGradient" cx="35%" cy="35%">
              <stop offset="0%" stopColor="#d1fae5" />
              <stop offset="20%" stopColor="#a7f3d0" />
              <stop offset="40%" stopColor="#6ee7b7" />
              <stop offset="60%" stopColor="#10b981" />
              <stop offset="80%" stopColor="#059669" />
              <stop offset="100%" stopColor="#064e3b" />
            </radialGradient>
          </defs>

          <g className="animate-spin" style={{ transformOrigin: "200px 200px", animationDuration: "30s" }}>
            <circle
              cx="200"
              cy="200"
              r="195"
              fill="none"
              stroke="#10b981"
              strokeWidth="0.5"
              strokeDasharray="4 8 1 8"
              opacity="0.3"
            />
          </g>

          <g
            className="animate-spin"
            style={{ transformOrigin: "200px 200px", animationDuration: "25s", animationDirection: "reverse" }}
          >
            <circle
              cx="200"
              cy="200"
              r="185"
              fill="none"
              stroke="#34d399"
              strokeWidth="1"
              strokeDasharray="1 15 8 15"
              opacity="0.4"
            />
          </g>

          {hexNodes.map((node) => (
            <g key={node.id}>
              <line
                x1="200"
                y1="200"
                x2={node.x}
                y2={node.y}
                stroke="#10b981"
                strokeWidth="0.5"
                opacity="0.2"
                strokeDasharray="2 4"
              />
              {/* Hexagon node */}
              <polygon
                points={`${node.x},${node.y - 6} ${node.x + 5},${node.y - 3} ${node.x + 5},${node.y + 3} ${node.x},${node.y + 6} ${node.x - 5},${node.y + 3} ${node.x - 5},${node.y - 3}`}
                fill="none"
                stroke="#6ee7b7"
                strokeWidth="1"
                opacity="0.6"
                className="animate-pulse"
                style={{ animationDelay: `${node.delay}s` }}
                filter="url(#glow)"
              />
              <circle
                cx={node.x}
                cy={node.y}
                r="2"
                fill="#6ee7b7"
                className="animate-pulse"
                style={{ animationDelay: `${node.delay}s` }}
              />
            </g>
          ))}

          <g className="animate-spin" style={{ transformOrigin: "200px 200px", animationDuration: "8s" }}>
            {circuitPaths.map((path) => (
              <path
                key={path.id}
                d={`M ${r4(200 + path.radius * Math.cos(path.startAngle))} ${r4(200 + path.radius * Math.sin(path.startAngle))} A ${path.radius} ${path.radius} 0 0 1 ${r4(200 + path.radius * Math.cos(path.endAngle))} ${r4(200 + path.radius * Math.sin(path.endAngle))}`}
                fill="none"
                stroke="url(#circuitGrad)"
                strokeWidth="2"
                strokeLinecap="round"
                filter="url(#glow)"
              />
            ))}
          </g>

          <g className="animate-spin" style={{ transformOrigin: "200px 200px", animationDuration: "6s" }}>
            <ellipse
              cx="200"
              cy="200"
              rx="130"
              ry="50"
              fill="none"
              stroke="#6ee7b7"
              strokeWidth="1.5"
              opacity="0.5"
              filter="url(#glow)"
            />
            <circle cx="330" cy="200" r="5" fill="#a7f3d0" filter="url(#glowStrong)" />
          </g>

          <g
            className="animate-spin"
            style={{ transformOrigin: "200px 200px", animationDuration: "6s", animationDelay: "-2s" }}
          >
            <ellipse
              cx="200"
              cy="200"
              rx="130"
              ry="50"
              fill="none"
              stroke="#6ee7b7"
              strokeWidth="1.5"
              opacity="0.5"
              transform="rotate(60 200 200)"
              filter="url(#glow)"
            />
            <circle cx="265" cy="312.5" r="5" fill="#a7f3d0" filter="url(#glowStrong)" />
          </g>

          <g
            className="animate-spin"
            style={{ transformOrigin: "200px 200px", animationDuration: "6s", animationDelay: "-4s" }}
          >
            <ellipse
              cx="200"
              cy="200"
              rx="130"
              ry="50"
              fill="none"
              stroke="#6ee7b7"
              strokeWidth="1.5"
              opacity="0.5"
              transform="rotate(120 200 200)"
              filter="url(#glow)"
            />
            <circle cx="135" cy="312.5" r="5" fill="#a7f3d0" filter="url(#glowStrong)" />
          </g>

          <g
            className="animate-spin"
            style={{ transformOrigin: "200px 200px", animationDuration: "15s", animationDirection: "reverse" }}
          >
            {[...Array(8)].map((_, i) => {
              const angle = (i / 8) * Math.PI * 2
              const nextAngle = ((i + 0.4) / 8) * Math.PI * 2
              return (
                <path
                  key={i}
                  d={`M ${200 + 170 * Math.cos(angle)} ${200 + 170 * Math.sin(angle)} A 170 170 0 0 1 ${200 + 170 * Math.cos(nextAngle)} ${200 + 170 * Math.sin(nextAngle)}`}
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="3"
                  strokeLinecap="round"
                  opacity="0.6"
                />
              )
            })}
          </g>
        </svg>

        <div
          className="absolute inset-[-10px] rounded-full border-2 border-emerald-500/20"
          style={{
            background: "radial-gradient(circle, transparent 60%, rgba(16, 185, 129, 0.05) 100%)",
          }}
        />

        {/* Main glowing orb */}
        <div className="absolute inset-[25%] rounded-full overflow-hidden">
          {/* Base sphere gradient */}
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background:
                "radial-gradient(circle at 35% 35%, #d1fae5 0%, #a7f3d0 15%, #6ee7b7 30%, #34d399 45%, #10b981 60%, #059669 75%, #047857 90%, #064e3b 100%)",
            }}
          />

          {/* Internal energy waves */}
          <div className="absolute inset-0 overflow-hidden rounded-full">
            <div
              className="absolute w-[200%] h-[200%] -left-1/2 animate-wave"
              style={{
                background:
                  "linear-gradient(180deg, transparent 30%, rgba(20, 184, 166, 0.4) 45%, rgba(6, 182, 212, 0.5) 55%, rgba(6, 95, 70, 0.3) 70%, transparent 80%)",
                animationDuration: "3s",
              }}
            />
            <div
              className="absolute w-[200%] h-[200%] -left-1/2 animate-wave-reverse"
              style={{
                background:
                  "linear-gradient(180deg, transparent 35%, rgba(167, 243, 208, 0.3) 50%, rgba(110, 231, 183, 0.4) 60%, transparent 75%)",
                animationDuration: "4s",
                animationDelay: "-1.5s",
              }}
            />
          </div>

          {/* Highlight reflection */}
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: `
                radial-gradient(ellipse 60% 35% at 30% 25%, rgba(255, 255, 255, 0.7) 0%, rgba(255, 255, 255, 0.3) 30%, transparent 60%),
                radial-gradient(ellipse 25% 15% at 70% 80%, rgba(255, 255, 255, 0.2) 0%, transparent 50%)
              `,
            }}
          />

          {/* Inner glow */}
          <div
            className="absolute inset-0 rounded-full animate-pulse"
            style={{
              boxShadow: `
                inset 0 0 60px rgba(16, 185, 129, 0.6),
                inset 0 0 100px rgba(5, 150, 105, 0.4),
                inset 0 -20px 50px rgba(6, 78, 59, 0.5)
              `,
              animationDuration: "2s",
            }}
          />
        </div>

        {/* Outer glow effect */}
        <div
          className="absolute inset-[20%] rounded-full animate-pulse pointer-events-none"
          style={{
            boxShadow: `
              0 0 80px rgba(16, 185, 129, 0.6),
              0 0 120px rgba(16, 185, 129, 0.4),
              0 0 180px rgba(5, 150, 105, 0.3),
              0 0 250px rgba(6, 78, 59, 0.2)
            `,
            animationDuration: "2s",
          }}
        />

        {/* Progress ring */}
        <svg className="absolute inset-[15%] w-[70%] h-[70%]" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="48" fill="none" stroke="rgba(16, 185, 129, 0.15)" strokeWidth="0.5" />
          <circle
            cx="50"
            cy="50"
            r="48"
            fill="none"
            stroke="url(#progressGrad)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray={`${progress * 3.01} 301`}
            transform="rotate(-90 50 50)"
            filter="url(#glow)"
          />
          <defs>
            <linearGradient id="progressGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#a7f3d0" />
              <stop offset="50%" stopColor="#10b981" />
              <stop offset="100%" stopColor="#047857" />
            </linearGradient>
          </defs>
        </svg>

        <div className="absolute -top-4 -left-4 w-8 h-8 border-t-2 border-l-2 border-emerald-500/40" />
        <div className="absolute -top-4 -right-4 w-8 h-8 border-t-2 border-r-2 border-emerald-500/40" />
        <div className="absolute -bottom-4 -left-4 w-8 h-8 border-b-2 border-l-2 border-emerald-500/40" />
        <div className="absolute -bottom-4 -right-4 w-8 h-8 border-b-2 border-r-2 border-emerald-500/40" />
      </div>

      {/* Status text */}
      <div className="mt-20 text-center">
        <p className="text-emerald-100/90 text-xl lg:text-2xl font-light tracking-[0.35em] uppercase">
          {text}
          <span className="inline-block w-8 text-left text-emerald-400">{dots}</span>
        </p>
        <p className="mt-4 text-emerald-500/60 text-sm tracking-widest font-mono">{Math.round(progress)}% complete</p>

        <div className="mt-6 flex items-center justify-center gap-3">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-emerald-600/50 text-xs tracking-wider font-mono uppercase">
            Neural Processing Active
          </span>
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" style={{ animationDelay: "0.5s" }} />
        </div>
      </div>

      {floatingParticles.map((particle) => {
        const x = r4(50 + (particle.radius / 10) * Math.cos(particle.angle))
        const y = r4(50 + (particle.radius / 10) * Math.sin(particle.angle))
        return (
          <div
            key={particle.id}
            className="absolute rounded-full animate-float-centered"
            style={{
              left: `${x}%`,
              top: `${y}%`,
              width: particle.size,
              height: particle.size,
              background: `radial-gradient(circle, rgba(167, 243, 208, 0.9) 0%, rgba(16, 185, 129, 0.5) 50%, transparent 100%)`,
              boxShadow: `0 0 ${particle.size * 4}px rgba(110, 231, 183, 0.5)`,
              animationDuration: `${particle.duration}s`,
              animationDelay: `${particle.delay}s`,
            }}
          />
        )
      })}

      <div
        className="absolute left-0 right-0 h-[1px] animate-scan pointer-events-none"
        style={{
          background:
            "linear-gradient(90deg, transparent 10%, rgba(110, 231, 183, 0.4) 30%, rgba(16, 185, 129, 0.8) 50%, rgba(110, 231, 183, 0.4) 70%, transparent 90%)",
          boxShadow: "0 0 30px rgba(16, 185, 129, 0.6), 0 0 60px rgba(16, 185, 129, 0.4)",
        }}
      />
    </div>
  )
}

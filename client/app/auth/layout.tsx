"use client";

import { motion } from "framer-motion";
import { Logo } from "@/components/common/logo";
import { ThemeToggleSimple } from "@/components/common/theme-toggle";
import { Activity, Heart, Brain, Sparkles } from "lucide-react";

// Animated neural network background
function NeuralBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <svg className="absolute w-full h-full opacity-20" viewBox="0 0 600 800">
        {/* Neural connections */}
        <motion.g stroke="url(#neuralGradient)" strokeWidth="1" fill="none">
          {[
            { x1: 80, y1: 100, x2: 200, y2: 200 },
            { x1: 200, y1: 200, x2: 350, y2: 150 },
            { x1: 350, y1: 150, x2: 500, y2: 250 },
            { x1: 100, y1: 300, x2: 250, y2: 350 },
            { x1: 250, y1: 350, x2: 400, y2: 300 },
            { x1: 400, y1: 300, x2: 520, y2: 400 },
            { x1: 150, y1: 450, x2: 300, y2: 500 },
            { x1: 300, y1: 500, x2: 450, y2: 450 },
            { x1: 450, y1: 450, x2: 550, y2: 550 },
            { x1: 100, y1: 600, x2: 250, y2: 650 },
            { x1: 250, y1: 650, x2: 400, y2: 600 },
            { x1: 400, y1: 600, x2: 520, y2: 700 },
          ].map((line, i) => (
            <motion.line
              key={i}
              x1={line.x1}
              y1={line.y1}
              x2={line.x2}
              y2={line.y2}
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 0.5 }}
              transition={{
                duration: 2,
                delay: i * 0.15,
                repeat: Infinity,
                repeatType: "reverse",
                repeatDelay: 4,
              }}
            />
          ))}
        </motion.g>

        {/* Neural nodes */}
        {[
          { cx: 80, cy: 100 },
          { cx: 200, cy: 200 },
          { cx: 350, cy: 150 },
          { cx: 500, cy: 250 },
          { cx: 100, cy: 300 },
          { cx: 250, cy: 350 },
          { cx: 400, cy: 300 },
          { cx: 520, cy: 400 },
          { cx: 150, cy: 450 },
          { cx: 300, cy: 500 },
          { cx: 450, cy: 450 },
          { cx: 550, cy: 550 },
          { cx: 100, cy: 600 },
          { cx: 250, cy: 650 },
          { cx: 400, cy: 600 },
          { cx: 520, cy: 700 },
        ].map((node, i) => (
          <motion.circle
            key={i}
            cx={node.cx}
            cy={node.cy}
            r="4"
            fill="url(#neuralGradient)"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
            transition={{
              duration: 2,
              delay: i * 0.1,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        ))}

        <defs>
          <linearGradient id="neuralGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00BCD4" />
            <stop offset="100%" stopColor="#7C3AED" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

// AI Core visualization
function AICore() {
  return (
    <div className="relative w-48 h-48 mx-auto">
      {/* Outer ring */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        className="absolute inset-0 rounded-full border border-primary/30"
      >
        {[0, 90, 180, 270].map((angle, i) => (
          <motion.div
            key={i}
            className="absolute w-2 h-2 rounded-full bg-primary"
            style={{
              top: "50%",
              left: "50%",
              transform: `rotate(${angle}deg) translateX(96px) translateY(-50%)`,
            }}
            animate={{ scale: [1, 1.5, 1] }}
            transition={{ duration: 2, repeat: Infinity, delay: i * 0.5 }}
          />
        ))}
      </motion.div>

      {/* Middle ring */}
      <motion.div
        animate={{ rotate: -360 }}
        transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
        className="absolute inset-6 rounded-full border border-purple-500/30"
      />

      {/* Inner ring */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
        className="absolute inset-12 rounded-full border border-pink-500/30"
      />

      {/* Core */}
      <motion.div
        animate={{ scale: [1, 1.1, 1] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        className="absolute inset-16 rounded-full bg-gradient-to-br from-primary via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-primary/30"
      >
        <Brain className="w-8 h-8 text-white" />

        {/* Pulse rings */}
        <motion.div
          className="absolute inset-0 rounded-full border-2 border-primary/50"
          animate={{ scale: [1, 2], opacity: [0.5, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
        />
      </motion.div>
    </div>
  );
}

// Pillar badges
const pillars = [
  { icon: Activity, label: "Fitness", color: "from-[#FF9800] to-[#F57C00]" },
  { icon: Heart, label: "Nutrition", color: "from-[#4CAF50] to-[#388E3C]" },
  { icon: Brain, label: "Wellbeing", color: "from-[#5C9CE6] to-[#3B82F6]" },
];

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Branding */}
      <motion.div
        initial={{ opacity: 0, x: -50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6 }}
        className="hidden lg:flex lg:w-1/2 xl:w-2/5 relative overflow-hidden"
      >
        {/* Gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-background via-primary/5 to-purple-500/5" />

        {/* Cyber grid */}
        <div className="absolute inset-0 cyber-grid opacity-30" />

        {/* Neural network background */}
        <NeuralBackground />

        {/* Glowing orbs */}
        <div className="absolute top-20 left-20 w-72 h-72 bg-primary/20 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-primary/15 rounded-full blur-2xl" />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between w-full p-8 lg:p-12">
          <Logo size="lg" />

          <div className="space-y-8">
            {/* AI Core Visualization */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3, duration: 0.6 }}
            >
              <AICore />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="text-center"
            >
              <h1 className="text-3xl xl:text-4xl font-bold leading-tight mb-4">
                Your Personal <br />
                <span className="gradient-text-animated">AI Health Coach</span>
              </h1>
              <p className="text-muted-foreground max-w-md mx-auto">
                Experience the future of wellness with AI-powered insights across fitness, nutrition, and wellbeing.
              </p>
            </motion.div>

            {/* Pillar badges */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="flex justify-center gap-3"
            >
              {pillars.map((pillar, i) => (
                <motion.div
                  key={pillar.label}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.6 + i * 0.1 }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r ${pillar.color} bg-opacity-10 border border-white/10`}
                >
                  <pillar.icon className="w-4 h-4 text-white" />
                  <span className="text-sm font-medium text-white">{pillar.label}</span>
                </motion.div>
              ))}
            </motion.div>

            {/* Stats */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              className="flex items-center justify-center gap-8"
            >
              {[
                { value: "50K+", label: "Active Users" },
                { value: "4.9", label: "App Rating" },
                { value: "98%", label: "Satisfaction" },
              ].map((stat, _index) => (
                <div key={stat.label} className="text-center">
                  <div className="text-2xl font-bold gradient-text">{stat.value}</div>
                  <div className="text-xs text-muted-foreground">{stat.label}</div>
                </div>
              ))}
            </motion.div>
          </div>

          {/* Floating Elements */}
          <motion.div
            animate={{
              y: [0, -10, 0],
              rotate: [0, 5, 0],
            }}
            transition={{
              duration: 6,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="absolute bottom-40 right-12 glass-card rounded-2xl p-4 shadow-lg border border-white/10"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FF9800] to-[#F57C00] flex items-center justify-center">
                <Activity className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium">Daily Goal</p>
                <p className="text-xs text-muted-foreground">8,500 steps</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            animate={{
              y: [0, 15, 0],
              rotate: [0, -5, 0],
            }}
            transition={{
              duration: 5,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 1,
            }}
            className="absolute top-40 right-24 glass-card rounded-xl p-3 shadow-lg border border-white/10"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              <span className="text-sm font-medium">AI Coach</span>
            </div>
          </motion.div>

          <motion.div
            animate={{
              y: [0, -12, 0],
              rotate: [0, 3, 0],
            }}
            transition={{
              duration: 7,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 2,
            }}
            className="absolute top-60 left-16 glass-card rounded-xl p-3 shadow-lg border border-white/10"
          >
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs text-muted-foreground">Online</span>
            </div>
          </motion.div>

          <div className="text-sm text-muted-foreground text-center">
            &copy; {new Date().getFullYear()} Balencia. All rights reserved.
          </div>
        </div>
      </motion.div>

      {/* Right Panel - Auth Form */}
      <div className="flex-1 flex flex-col relative">
        {/* Background for mobile */}
        <div className="absolute inset-0 cyber-grid opacity-10 lg:hidden" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl lg:hidden" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl lg:hidden" />

        {/* Top Bar */}
        <div className="relative z-10 flex items-center justify-between p-4 lg:p-6">
          <div className="lg:hidden">
            <Logo size="sm" />
          </div>
          <div className="flex items-center gap-4 ml-auto">
            <ThemeToggleSimple />
          </div>
        </div>

        {/* Form Container */}
        <div className="relative z-10 flex-1 flex items-center justify-center p-4 lg:p-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="w-full max-w-md"
          >
            {/* Glass card wrapper */}
            <div className="glass-card rounded-2xl p-6 sm:p-8 border border-white/10 shadow-xl">
              {children}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

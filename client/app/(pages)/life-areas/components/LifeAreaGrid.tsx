'use client';
import { motion } from 'framer-motion';
import { LifeAreaCard } from './LifeAreaCard';
import type { LifeArea } from '../types';

export function LifeAreaGrid({ areas, onSelect }: { areas: LifeArea[]; onSelect: (a: LifeArea) => void }) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        visible: { transition: { staggerChildren: 0.05 } },
        hidden: {},
      }}
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
    >
      {areas.map((a) => (
        <motion.div
          key={a.id}
          variants={{
            hidden: { opacity: 0, y: 12 },
            visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.4, 0, 0.2, 1] } },
          }}
        >
          <LifeAreaCard area={a} onClick={() => onSelect(a)} />
        </motion.div>
      ))}
    </motion.div>
  );
}

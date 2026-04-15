"use client";

import { useRef } from "react";
import { Star, Shield, Users, Sparkles, Layers } from "lucide-react";
import { useGSAP } from "@/hooks/use-gsap";
import { gsap } from "@/lib/gsap-init";
import { GSAPMarquee } from "./shared";

const trustItems = [
  { icon: Users, value: "150K+", label: "Lives Coached", counter: 150000, suffix: "+" },
  { icon: Star, value: "4.9/5", label: "User Rating", counter: 4.9, suffix: "/5", decimals: 1 },
  { icon: Shield, value: "SOC 2", label: "HIPAA Compliant" },
  { icon: Layers, value: "14+", label: "Life Domains", counter: 14, suffix: "+" },
  { icon: Sparkles, label: "AI-First Coaching" },
];

const pressLogos = ["TechCrunch", "Forbes Health", "Men's Health", "WIRED", "The Verge"];

function TrustItem({ item }: { item: (typeof trustItems)[number] }) {
  return (
    <div className="flex items-center gap-3 shrink-0 text-muted-foreground">
      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
        <item.icon className="w-5 h-5 text-primary" />
      </div>
      <div>
        {"value" in item && item.value && (
          <span
            className="font-bold text-foreground tabular-nums"
            {...(item.counter != null
              ? {
                  "data-counter": String(item.counter),
                  "data-suffix": item.suffix || "",
                  "data-decimals": String(item.decimals ?? 0),
                }
              : {})}
          >
            {item.value}
          </span>
        )}
        <span className="text-sm ml-1">{item.label}</span>
      </div>
    </div>
  );
}

export function TrustBarSection() {
  const containerRef = useRef<HTMLDivElement>(null);

  // GSAP counter animation for stat numbers
  useGSAP(
    () => {
      const counters = containerRef.current?.querySelectorAll("[data-counter]");
      counters?.forEach((el) => {
        const target = parseFloat(el.getAttribute("data-counter") || "0");
        const suffix = el.getAttribute("data-suffix") || "";
        const decimals = parseInt(el.getAttribute("data-decimals") || "0", 10);
        const counter = { val: 0 };
        gsap.to(counter, {
          val: target,
          duration: 2,
          ease: "power2.out",
          scrollTrigger: { trigger: el, start: "top 85%" },
          onUpdate: () => {
            const formatted =
              decimals > 0
                ? counter.val.toFixed(decimals)
                : Math.round(counter.val).toLocaleString();
            (el as HTMLElement).textContent = formatted + suffix;
          },
        });
      });
    },
    containerRef,
    []
  );

  return (
    <section ref={containerRef} className="relative py-10 overflow-hidden border-y border-white/10 bg-background/50">
      <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />

      <GSAPMarquee speed={60} pauseOnHover scrollSensitive>
        {trustItems.map((item, i) => (
          <TrustItem key={i} item={item} />
        ))}
        {pressLogos.map((name) => (
          <span
            key={name}
            className="text-sm font-medium text-muted-foreground opacity-80 shrink-0"
          >
            {name}
          </span>
        ))}
      </GSAPMarquee>
    </section>
  );
}

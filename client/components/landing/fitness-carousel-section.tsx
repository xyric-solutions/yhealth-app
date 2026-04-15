"use client";

import { useRef, useEffect, useState } from "react";
import Image from "next/image";
import { useGSAP } from "@/hooks/use-gsap";
import { gsap } from "@/lib/gsap-init";
import { AnimatedGradientMesh, GSAPScrollReveal } from "./shared";

const CAROUSEL_IMAGES = ["/c1.png", "/c2.png", "/c3.png", "/c4.png", "/c5.png"];
const CARD_GAP = 24;
const MIN_CARD_WIDTH = 360;
const MAX_CARD_WIDTH = 1200;
const CARD_ASPECT = 3 / 4;
const MAX_CARD_HEIGHT_VH = 85;

export function FitnessCarouselSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  const [cardWidth, setCardWidth] = useState(MAX_CARD_WIDTH);
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const update = () => {
      const w = el.offsetWidth;
      const next = Math.max(MIN_CARD_WIDTH, Math.min(MAX_CARD_WIDTH, (w - CARD_GAP * 2) / 2));
      setCardWidth(next);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const oneSetWidth = (cardWidth + CARD_GAP) * CAROUSEL_IMAGES.length;

  // GSAP: scroll-driven horizontal carousel with auto-scroll fallback
  useGSAP(
    () => {
      if (!trackRef.current || !sectionRef.current) return;

      // Auto-scrolling infinite loop
      const tween = gsap.to(trackRef.current, {
        x: -oneSetWidth,
        duration: 35,
        ease: "none",
        repeat: -1,
        modifiers: {
          x: gsap.utils.unitize((x: number) => {
            return parseFloat(x as unknown as string) % oneSetWidth;
          }),
        },
      });

      // Speed up/slow down based on scroll velocity
      gsap.timeline({
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top bottom",
          end: "bottom top",
          scrub: false,
          onUpdate: (self) => {
            const velocity = Math.abs(self.getVelocity());
            const speedFactor = 1 + velocity / 3000;
            gsap.to(tween, { timeScale: speedFactor, duration: 0.3 });
          },
          onLeave: () => gsap.to(tween, { timeScale: 1, duration: 0.5 }),
          onEnterBack: () => gsap.to(tween, { timeScale: 1, duration: 0.5 }),
        },
      });

      // Section entrance: scale + opacity
      gsap.fromTo(
        sectionRef.current,
        { opacity: 0, y: 40, scale: 0.95 },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          ease: "power3.out",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top 90%",
            end: "top 40%",
            scrub: 1,
          },
        }
      );
    },
    sectionRef,
    [oneSetWidth]
  );

  return (
    <section
      ref={sectionRef}
      className="relative py-10 md:py-14 overflow-hidden"
    >
      <div className="absolute inset-0 -z-10">
        <AnimatedGradientMesh intensity={0.1} blur={100} />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent" />
      </div>

      <div className="container mx-auto px-4 text-center mb-8 md:mb-10">
        <GSAPScrollReveal direction="up" distance={24} duration={0.6}>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
            Designed for Peak Performance
          </h2>
        </GSAPScrollReveal>
        <GSAPScrollReveal direction="up" distance={16} duration={0.6} delay={0.1}>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Every workout tracked, every metric analyzed. Wearable-synced insights that turn raw data into your competitive edge.
          </p>
        </GSAPScrollReveal>
      </div>

      <div className="relative w-full">
        <div
          ref={viewportRef}
          className="w-full overflow-hidden"
        >
          <div
            ref={trackRef}
            className="flex items-stretch will-change-transform"
            style={{ gap: CARD_GAP, width: "max-content" }}
          >
            {/* Duplicate set for seamless loop */}
            {[...CAROUSEL_IMAGES, ...CAROUSEL_IMAGES].map((src, i) => (
              <div
                key={`${src}-${i}`}
                className="shrink-0 rounded-2xl overflow-hidden border border-white/10 bg-white/5 shadow-2xl shadow-black/20"
                style={{
                  width: cardWidth,
                  maxHeight: `${MAX_CARD_HEIGHT_VH}vh`,
                  boxShadow: "0 0 0 1px rgba(255,255,255,0.06), 0 25px 50px -12px rgba(0,0,0,0.4)",
                }}
              >
                <div
                  className="relative w-full bg-muted/20"
                  style={{
                    aspectRatio: String(CARD_ASPECT),
                    maxHeight: `${MAX_CARD_HEIGHT_VH}vh`,
                  }}
                >
                  <Image
                    src={src}
                    alt=""
                    fill
                    className="object-cover object-center"
                    sizes={`(max-width: 640px) ${Math.round(cardWidth)}px, (max-width: 1024px) ${Math.round(cardWidth)}px, ${Math.round(cardWidth * 2)}px`}
                    quality={100}
                    priority={i < 3}
                    unoptimized={false}
                    draggable={false}
                  />
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      background: "linear-gradient(to top, rgba(0,0,0,0.35) 0%, transparent 45%)",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Balencia - AI-Powered Personal Health & Wellness Platform",
    short_name: "Balencia",
    description:
      "AI-driven fitness plans, smart nutrition tracking, mental wellness tools, and personalized coaching.",
    start_url: "/",
    display: "standalone",
    background_color: "#020617",
    theme_color: "#10b981",
    orientation: "portrait-primary",
    categories: ["health", "fitness", "lifestyle", "medical"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}

import { createMetadata } from "@/lib/seo";

export const metadata = createMetadata({
  title: "Exercise Library - 1,500+ Exercises with Animations & Instructions",
  description:
    "Browse our comprehensive exercise library with animated demonstrations, step-by-step instructions, muscle targeting, and equipment requirements. Filter by muscle group, difficulty, and equipment.",
  keywords: [
    "exercise library",
    "workout exercises",
    "exercise database",
    "exercise demonstrations",
    "muscle group exercises",
    "fitness exercises",
    "exercise instructions",
    "animated exercises",
  ],
  path: "/exercises",
  noIndex: true,
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

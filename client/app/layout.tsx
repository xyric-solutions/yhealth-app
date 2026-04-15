import type { Metadata } from "next";
import { Inter, Poppins, Cinzel, Nunito } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { VoiceAssistantModal } from "@/components/common/voice-assistant-modal";
import { AlarmProvider } from "./providers/AlarmProvider";
import { ConfirmDialogProvider } from "@/components/common/ConfirmDialog";
import { VisitorTracker } from "@/components/VisitorTracker";
import { PersistentPlayer } from "@/components/music/PersistentPlayer";
import { organizationJsonLd, webSiteJsonLd } from "@/lib/structured-data";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const poppins = Poppins({
  variable: "--font-poppins",
  weight: ["300", "400", "500", "600", "700", "800"],
  subsets: ["latin"],
});

const cinzel = Cinzel({
  variable: "--font-cinzel",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://balencia.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Balencia - AI Life Coach for Health, Growth & Personal Transformation",
    template: "%s | Balencia",
  },
  description:
    "Your AI-powered life coach for total self-improvement. Personalized fitness plans, nutrition guidance, mental wellness tools, life goal tracking, and daily coaching — all in one platform.",
  keywords: [
    "AI life coach",
    "personal improvement platform",
    "AI wellness coach",
    "life goal tracking",
    "personalized coaching app",
    "self-improvement platform",
    "mental wellness tools",
    "holistic life coaching",
    "mood tracking",
    "habit builder",
    "guided breathing",
    "AI-powered personal growth",
    "digital life coach",
    "coaching dashboard",
  ],
  authors: [{ name: "Balencia Team", url: SITE_URL }],
  creator: "Balencia",
  publisher: "Balencia",
  applicationName: "Balencia",
  category: "Life Coaching & Wellness",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    title: "Balencia - AI Life Coach for Health, Growth & Personal Transformation",
    description:
      "AI-powered life coaching with personalized fitness plans, nutrition guidance, mental wellness tools, and life goal tracking — all in one platform.",
    siteName: "Balencia",
  },
  twitter: {
    card: "summary_large_image",
    title: "Balencia - AI Life Coach for Health, Growth & Personal Transformation",
    description:
      "AI-powered life coaching with personalized fitness plans, nutrition guidance, mental wellness tools, and life goal tracking — all in one platform.",
    creator: "@balenciaapp",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    // Add these when available:
    // google: "google-verification-code",
    // yandex: "yandex-verification-code",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        {/* Google Fonts for landing page hero section */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,500;12..96,600;12..96,700;12..96,800&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500&display=swap"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd()) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(webSiteJsonLd()) }}
        />
      </head>
      <body
        className={`${inter.variable} ${poppins.variable} ${cinzel.variable} ${nunito.variable} font-sans antialiased`}
      >
        <Providers>
          <AlarmProvider>
            <ConfirmDialogProvider>
              <VisitorTracker />
              {children}
              <PersistentPlayer />
              {/* <FloatingVoiceAssistantWrapper /> */}
              <VoiceAssistantModal />
            </ConfirmDialogProvider>
          </AlarmProvider>
        </Providers>
      </body>
    </html>
  );
}

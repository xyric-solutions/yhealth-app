"use client";

import dynamic from "next/dynamic";
import { ThemeProvider } from "./theme-provider";
import { SessionProvider } from "./session-provider";
import { AuthProvider } from "@/app/context/AuthContext";
import { VoiceAssistantProvider } from "@/app/context/VoiceAssistantContext";
import { ProductTourProvider } from "@/app/context/ProductTourContext";
import { SocketInitializer } from "@/components/common/socket-initializer";
import { Toaster } from "react-hot-toast";
import { MusicPlayerProvider } from "./music-player-provider";

const ProductTour = dynamic(
  () =>
    import("@/components/common/product-tour/ProductTour").then(
      (m) => m.ProductTour
    ),
  { ssr: false }
);

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <SessionProvider>
      <AuthProvider>
        <SocketInitializer />
        <VoiceAssistantProvider>
          <ProductTourProvider>
            <ThemeProvider
              attribute="class"
              defaultTheme="dark"
              forcedTheme="dark"
              disableTransitionOnChange
            >
              <MusicPlayerProvider>
                {children}
              </MusicPlayerProvider>
              <ProductTour />
              <Toaster
                position="top-right"
                toastOptions={{
                  duration: 5000,
                  style: {
                    background: "hsl(var(--card))",
                    color: "hsl(var(--card-foreground))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "12px",
                    padding: "12px 16px",
                    boxShadow: "0 10px 40px -10px rgba(0, 0, 0, 0.3)",
                  },
                  success: {
                    iconTheme: {
                      primary: "hsl(var(--primary))",
                      secondary: "white",
                    },
                    style: {
                      borderLeft: "4px solid hsl(var(--primary))",
                    },
                  },
                  error: {
                    iconTheme: {
                      primary: "hsl(var(--destructive))",
                      secondary: "white",
                    },
                    style: {
                      borderLeft: "4px solid hsl(var(--destructive))",
                    },
                  },
                }}
              />
            </ThemeProvider>
          </ProductTourProvider>
        </VoiceAssistantProvider>
      </AuthProvider>
    </SessionProvider>
  );
}

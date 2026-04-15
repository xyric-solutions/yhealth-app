import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import type { NextAuthConfig } from "next-auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

export const authConfig: NextAuthConfig = {
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        try {
          const response = await fetch(`${API_URL}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: credentials.email,
              password: credentials.password,
            }),
          });

          const data = await response.json();

          // Debug: log the full response structure
          if (process.env.NODE_ENV === "development") {
            console.log("[NextAuth Authorize] Backend response:", JSON.stringify(data, null, 2));
          }

          if (!response.ok || !data.success) {
            throw new Error(data.error?.message || "Invalid credentials");
          }

          // Extract tokens - backend returns { user, tokens: { accessToken, refreshToken } }
          const responseData = data.data || data;
          const tokens = responseData.tokens || responseData;
          const accessToken = tokens.accessToken;
          const refreshToken = tokens.refreshToken;
          const user = responseData.user;

          if (process.env.NODE_ENV === "development") {
            console.log("[NextAuth Authorize] Extracted tokens:", {
              hasAccessToken: !!accessToken,
              hasRefreshToken: !!refreshToken,
              hasUser: !!user,
            });
          }

          const userResult = {
            id: user.id,
            email: user.email,
            name: user.firstName
              ? `${user.firstName} ${user.lastName || ""}`
              : user.email,
            image: user.avatarUrl,
            accessToken: accessToken,
            refreshToken: refreshToken,
            onboardingStatus: user.onboardingStatus,
            role: user.role || "user", // Include role from backend
          };

          if (process.env.NODE_ENV === "development") {
            console.log("[NextAuth Authorize] Returning user:", {
              id: userResult.id,
              email: userResult.email,
              hasAccessToken: !!userResult.accessToken,
              accessTokenPreview: userResult.accessToken
                ? `${userResult.accessToken.substring(0, 20)}...`
                : "none",
            });
          }

          return userResult;
        } catch (error) {
          console.error("Auth error:", error);
          return null;
        }
      },
    }),
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          Google({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            authorization: {
              params: {
                prompt: "consent",
                access_type: "offline",
                response_type: "code",
              },
            },
          }),
        ]
      : []),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      // Handle Google sign-in - register/login with backend
      if (account?.provider === "google" && profile?.email) {
        try {
          const response = await fetch(`${API_URL}/auth/social`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              provider: "google",
              idToken: account.id_token,
              accessToken: account.access_token,
              email: profile.email,
              name: profile.name,
              picture: (profile as { picture?: string }).picture,
            }),
          });

          const data = await response.json();

          if (!response.ok || !data.success) {
            // Return error message for error page
            const errorMessage = data.error?.message || "Social authentication failed";
            return `/auth/signin?error=${encodeURIComponent(errorMessage)}`;
          }

          // Store backend tokens in user object for jwt callback
          (user as unknown as Record<string, unknown>).backendData = data.data;
          return true;
        } catch (error) {
          console.error("Social auth error:", error);
          return `/auth/signin?error=${encodeURIComponent("Failed to connect to authentication server")}`;
        }
      }
      return true;
    },
    async jwt({ token, user, account, trigger }) {
      // Debug logging
      if (process.env.NODE_ENV === "development") {
        console.log("[NextAuth JWT] Callback:", {
          trigger,
          hasUser: !!user,
          hasAccount: !!account,
          provider: account?.provider,
          userAccessToken: user?.accessToken ? "present" : "missing",
          tokenAccessToken: token.accessToken ? "present" : "missing",
        });
      }

      // Initial sign in - user object contains data from authorize callback
      if (user) {
        // For credentials provider, user.accessToken comes from authorize()
        token.id = user.id;
        token.accessToken = user.accessToken || token.accessToken;
        token.refreshToken = user.refreshToken || token.refreshToken;
        token.onboardingStatus = user.onboardingStatus || token.onboardingStatus;
        token.role = (user as { role?: string }).role || token.role || "user"; // Store role in token

        if (process.env.NODE_ENV === "development") {
          console.log("[NextAuth JWT] Set from user:", {
            accessToken: token.accessToken ? `${String(token.accessToken).substring(0, 20)}...` : "none",
          });
        }

        // Handle Google sign-in - get tokens from backendData
        if (account?.provider === "google") {
          const backendData = (user as unknown as Record<string, unknown>).backendData as {
            user: { id: string; onboardingStatus: string; role?: string };
            tokens: { accessToken: string; refreshToken: string };
          } | undefined;

          if (backendData) {
            token.id = backendData.user.id;
            token.accessToken = backendData.tokens.accessToken;
            token.refreshToken = backendData.tokens.refreshToken;
            token.onboardingStatus = backendData.user.onboardingStatus;
            token.role = backendData.user.role || token.role || "user"; // Store role from backend

            if (process.env.NODE_ENV === "development") {
              console.log("[NextAuth JWT] Set from Google backendData:", {
                accessToken: token.accessToken ? `${String(token.accessToken).substring(0, 20)}...` : "none",
              });
            }
          }
        }
      }

      // Ensure accessToken persists between requests
      if (process.env.NODE_ENV === "development" && !user) {
        console.log("[NextAuth JWT] Returning existing token:", {
          hasAccessToken: !!token.accessToken,
          accessToken: token.accessToken ? `${String(token.accessToken).substring(0, 20)}...` : "none",
        });
      }

      return token;
    },
    async session({ session, token }) {
      // Debug logging
      if (process.env.NODE_ENV === "development") {
        console.log("[NextAuth Session] Callback:", {
          tokenId: token.id,
          tokenAccessToken: token.accessToken ? `${String(token.accessToken).substring(0, 20)}...` : "missing",
          tokenRefreshToken: token.refreshToken ? "present" : "missing",
          tokenOnboardingStatus: token.onboardingStatus,
        });
      }

      // Always copy token values to session
      session.user.id = token.id as string;
      session.accessToken = token.accessToken as string || "";
      session.refreshToken = token.refreshToken as string || "";
      session.onboardingStatus = token.onboardingStatus as string || "pending";
      // Include role in session user object
      (session.user as { role?: string }).role = (token.role as string) || "user";

      if (process.env.NODE_ENV === "development") {
        console.log("[NextAuth Session] Returning session:", {
          userId: session.user.id,
          hasAccessToken: !!session.accessToken,
          accessToken: session.accessToken ? `${session.accessToken.substring(0, 20)}...` : "none",
        });
      }

      return session;
    },
  },
  pages: {
    signIn: "/auth/signin",
    signOut: "/auth/signout",
    error: "/auth/signin",
    verifyRequest: "/auth/verify",
  },
  session: {
    strategy: "jwt",
    maxAge: 3 * 24 * 60 * 60, // 3 days - match JWT_EXPIRES_IN
  },
  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === "production"
        ? "__Secure-authjs.session-token"
        : "authjs.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
        maxAge: 3 * 24 * 60 * 60, // 3 days
      },
    },
  },
  trustHost: true,
  debug: process.env.NODE_ENV === "development",
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);

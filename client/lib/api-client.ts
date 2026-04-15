import axios, {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
} from "axios";

// Default to port 5000 if not specified (matches server configuration)
// To override, set NEXT_PUBLIC_API_URL in your .env.local file
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

// Log the API URL in development for debugging
if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  console.log("[API Client] Using API URL:", API_URL);
  if (process.env.NEXT_PUBLIC_API_URL) {
    console.log("[API Client] API URL set from NEXT_PUBLIC_API_URL environment variable");
  } else {
    console.log("[API Client] Using default API URL (http://localhost:5000/api). To change it, set NEXT_PUBLIC_API_URL in your .env.local file.");
  } 
}

// Cookie utilities
const COOKIE_NAME = "balencia_access_token";
const COOKIE_MAX_AGE = 3 * 24 * 60 * 60; // 3 days - match JWT_EXPIRES_IN

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    return parts.pop()?.split(";").shift() || null;
  }
  return null;
}

function setCookie(name: string, value: string, maxAge: number): void {
  if (typeof document === "undefined") return;
  // Don't use Secure flag in development (localhost uses HTTP)
  const isSecure =
    typeof window !== "undefined" && window.location.protocol === "https:";
  const secureFlag = isSecure ? "; Secure" : "";
  document.cookie = `${name}=${value}; path=/; max-age=${maxAge}; SameSite=Lax${secureFlag}`;
}

function deleteCookie(name: string): void {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; path=/; max-age=0`;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, string[]>;
  };
  meta?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

interface RequestConfig {
  params?: Record<string, string | number | boolean | undefined>;
  signal?: AbortSignal;
  headers?: Record<string, string>;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code: string,
    public details?: Record<string, string[]>
  ) {
    super(message);
    this.name = "ApiError";
  }
}

class ApiClient {
  private baseUrl: string;
  private accessToken: string | null = null;
  private initialized = false;
  private axios: AxiosInstance;
  // Request deduplication: track in-flight requests
  private pendingRequests = new Map<string, Promise<ApiResponse<unknown>>>();
  // Callback for handling token expiration (401 errors)
  private onTokenExpired: (() => void) | null = null;
  // Flag to prevent multiple simultaneous logout attempts
  private isLoggingOut = false;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    this.axios = axios.create({
      baseURL: this.baseUrl,
      withCredentials: false,
    });

    // Attach auth token automatically on every request
    this.axios.interceptors.request.use((config) => {
      const token = this.getToken();

      const headers = (config.headers =
        config.headers ?? this.axios.defaults.headers.common);

      // Ensure JSON by default unless caller overrides (uploads override this)
      const hasContentType =
        "Content-Type" in headers &&
        typeof headers["Content-Type"] !== "undefined";

      if (!(config.data instanceof FormData) && !hasContentType) {
        headers["Content-Type"] = "application/json";
      }

      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      // Prevent caching for WHOOP/integration GET requests - always fetch fresh data
      const url = config.url ?? "";
      const isWhoopOrIntegration =
        (config.method || "GET") === "GET" &&
        (url.includes("/integrations/") || url.includes("/whoop/"));
      if (isWhoopOrIntegration) {
        headers["Cache-Control"] = "no-cache, no-store, must-revalidate";
        headers["Pragma"] = "no-cache";
        // Add cache-busting param so each request is unique
        const sep = url.includes("?") ? "&" : "?";
        config.url = `${url}${sep}_t=${Date.now()}`;
      }

      if (process.env.NODE_ENV === "development") {
        console.debug(
          "[API Client] Request",
          config.method,
          config.url,
          "hasToken:",
          !!token
        );
      }

      return config;
    });

    // Normalize errors
    const capturedBaseUrl = this.baseUrl; // Capture for use in error handler
    this.axios.interceptors.response.use(
      (response) => response,
      (error: AxiosError<ApiResponse<unknown> & { message?: string; code?: string }>) => {
        // Check if request was canceled/aborted
        if (error.code === 'ERR_CANCELED' || error.message === 'canceled' || 
            (error.message && error.message.toLowerCase().includes('canceled'))) {
          // Create a special error for canceled requests
          throw new ApiError('Request was canceled', 0, 'CANCELED');
        }

        if (error.response) {
          const status = error.response.status;
          // Safely parse response data - handle both JSON and plain text
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- runtime type checks handle unknown error response shapes
          let payload: any;
          try {
            payload = error.response.data;
            // If data is a string that looks like an error message, try to parse it
            if (typeof payload === 'string' && payload.trim().startsWith('{')) {
              try {
                payload = JSON.parse(payload);
              } catch {
                // If parsing fails, wrap it in a standard error format
                payload = { error: { message: payload, code: 'PARSE_ERROR' } };
              }
            } else if (typeof payload === 'string') {
              // Plain text error response
              payload = { error: { message: payload, code: 'SERVER_ERROR' } };
            }
          } catch {
            // If we can't parse the response, create a default error structure
            payload = { 
              error: { 
                message: error.response.data?.toString() || 'An error occurred', 
                code: 'RESPONSE_PARSE_ERROR' 
              } 
            };
          }

          // Handle 401 Unauthorized - Token expired or invalid
          if (status === 401) {
            // Check if this is a token expiration error
            const errorMessage = 
              (typeof payload?.error === 'string' ? payload.error : null) ||
              payload?.error?.message || 
              payload?.message || 
              "Unauthorized";
            const errorCode = payload?.error?.code || payload?.code || "UNAUTHORIZED";
            
            // Check if error indicates token expiration
            const isTokenExpired = 
              errorCode === "UNAUTHORIZED" ||
              errorCode === "TOKEN_EXPIRED" ||
              errorMessage.toLowerCase().includes("token") ||
              errorMessage.toLowerCase().includes("expired") ||
              errorMessage.toLowerCase().includes("unauthorized");

            if (isTokenExpired && !this.isLoggingOut) {
              // Prevent multiple simultaneous logout attempts
              this.isLoggingOut = true;
              
              // Clear token immediately
              this.setAccessToken(null);
              
              // Log the token expiration
              if (process.env.NODE_ENV === "development") {
                console.warn("[API Client] Token expired or invalid. Logging out user.", {
                  errorCode,
                  errorMessage,
                  url: error.config?.url,
                });
              }

              // Trigger logout callback if set
              if (this.onTokenExpired) {
                // Use setTimeout to avoid blocking the error handling
                setTimeout(() => {
                  try {
                    this.onTokenExpired?.();
                  } catch (logoutError) {
                    console.error("[API Client] Error during logout callback:", logoutError);
                  } finally {
                    // Reset logout flag after a delay to allow retry if needed
                    setTimeout(() => {
                      this.isLoggingOut = false;
                    }, 1000);
                  }
                }, 0);
              } else {
                // If no callback is set, just reset the flag
                setTimeout(() => {
                  this.isLoggingOut = false;
                }, 1000);
              }
            }

            // Throw the error so calling code can handle it
            const errorDetails = payload?.error?.details;
            throw new ApiError(
              errorMessage,
              status,
              errorCode,
              errorDetails
            );
          }

          // Handle multiple error formats:
          // 1. { error: { code, message } } - standard format
          // 2. { error: "string" } - simple string error
          // 3. { code, message } - server format
          const errorMessage = 
            (typeof payload?.error === 'string' ? payload.error : null) ||
            payload?.error?.message || 
            payload?.message || 
            "Request failed";
          const errorCode = payload?.error?.code || payload?.code || "REQUEST_FAILED";
          const errorDetails = payload?.error?.details;

          throw new ApiError(
            errorMessage,
            status,
            errorCode,
            errorDetails
          );
        }

        if (error.request) {
          // Provide more context about the network error
          const url = error.config?.url || 'unknown';
          const fullUrl = `${capturedBaseUrl}${url}`;
          
          // Suppress repeated network errors - only log once per URL per session
          const errorKey = `network_error_${fullUrl}`;
          const lastErrorTime = sessionStorage.getItem(errorKey);
          const now = Date.now();
          
          // Only log to console if it's been more than 5 seconds since last error for this URL
          if (!lastErrorTime || (now - parseInt(lastErrorTime)) > 5000) {
            const actualApiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
            const baseUrl = actualApiUrl.replace('/api', '');
            
            if (process.env.NODE_ENV === 'development') {
              console.warn(
                `[API] ⚠️ Server unreachable at ${actualApiUrl}\n` +
                `   To fix this:\n` +
                `   1. Make sure the backend server is running\n` +
                `   2. Start it with: cd server && bun run dev\n` +
                `   3. Verify it's running at: ${baseUrl}\n` +
                `   4. Or set NEXT_PUBLIC_API_URL in .env.local if using a different URL`
              );
            } else {
              console.warn(
                `[API] Server unreachable at ${actualApiUrl}. ` +
                `Please check your network connection or contact support.`
              );
            }
            sessionStorage.setItem(errorKey, now.toString());
          }

          // Provide a more descriptive error message
          const errorMessage = process.env.NODE_ENV === 'development'
            ? `Backend server is not running. Please start it with: cd server && bun run dev`
            : "Network error: server unreachable";
          
          throw new ApiError(errorMessage, 0, "NETWORK_ERROR");
        }

        throw new ApiError(
          error.message || "Unexpected error",
          0,
          "UNKNOWN_ERROR"
        );
      }
    );
  }

  // Initialize token from cookie (call this on client side)
  initFromCookie(): void {
    if (this.initialized) return;
    const cookieToken = getCookie(COOKIE_NAME);
    if (cookieToken) {
      this.accessToken = cookieToken;
      if (process.env.NODE_ENV === "development") {
        console.log(
          "[API Client] Token loaded from cookie:",
          `${cookieToken.substring(0, 20)}...`
        );
      }
    }
    this.initialized = true;
  }

  setAccessToken(token: string | null) {
    this.accessToken = token;

    // Persist to cookie for global access
    if (token) {
      setCookie(COOKIE_NAME, token, COOKIE_MAX_AGE);
    } else {
      deleteCookie(COOKIE_NAME);
    }

    if (process.env.NODE_ENV === "development") {
      console.log(
        "[API Client] Token set:",
        token ? `${token.substring(0, 20)}...` : "null"
      );
    }
  }

  hasToken(): boolean {
    return !!this.getToken();
  }

  // Get current token, auto-initializing from cookie if needed
  private getToken(): string | null {
    // If we have an in-memory token, use it
    if (this.accessToken) {
      return this.accessToken;
    }

    // Try to read from cookie (even if initialized, token might have been set externally)
    const cookieToken = getCookie(COOKIE_NAME);
    if (cookieToken) {
      this.accessToken = cookieToken;
      if (process.env.NODE_ENV === "development") {
        console.log(
          "[API Client] Token recovered from cookie:",
          `${cookieToken.substring(0, 20)}...`
        );
      }
      return cookieToken;
    }

    return null;
  }

  private async request<T>(
    endpoint: string,
    config: AxiosRequestConfig & RequestConfig = {}
  ): Promise<ApiResponse<T>> {
    // Create request key for deduplication (only for GET requests)
    const isGet = (config.method || "GET") === "GET";
    const requestKey = isGet
      ? `${config.method || "GET"}:${endpoint}:${JSON.stringify(config.params || {})}`
      : null;

    // If this is a GET request and we have a pending identical request, return it
    if (requestKey && this.pendingRequests.has(requestKey)) {
      if (process.env.NODE_ENV === "development") {
        console.debug("[API Client] Deduplicating request:", requestKey);
      }
      return this.pendingRequests.get(requestKey)! as Promise<ApiResponse<T>>;
    }

    const axiosConfig: AxiosRequestConfig = {
      url: endpoint,
      method: config.method || "GET",
      params: config.params,
      data: config.data,
      signal: config.signal,
      headers: config.headers,
    };

    // Create the request promise
    const requestPromise = this.axios
      .request<ApiResponse<T>>(axiosConfig)
      .then((response) => {
        // Remove from pending when complete
        if (requestKey) {
          this.pendingRequests.delete(requestKey);
        }
        return response.data;
      })
      .catch((error) => {
        // Remove from pending on error
        if (requestKey) {
          this.pendingRequests.delete(requestKey);
        }
        throw error;
      });

    // Store pending GET requests for deduplication
    if (requestKey) {
      this.pendingRequests.set(requestKey, requestPromise);

      // When the request is aborted, synchronously remove from dedup map.
      // This prevents a race where a new request for the same key gets
      // deduplicated to an already-aborting promise (React 18 Strict Mode
      // double-effect or cross-page navigation with shared endpoints).
      if (config.signal) {
        config.signal.addEventListener('abort', () => {
          this.pendingRequests.delete(requestKey);
        }, { once: true });
      }
    }

    return requestPromise;
  }

  async get<T>(
    endpoint: string,
    config?: RequestConfig
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...config, method: "GET" });
  }

  async post<T>(
    endpoint: string,
    body?: unknown,
    config?: RequestConfig
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...config,
      method: "POST",
      data: body,
    });
  }

  async patch<T>(
    endpoint: string,
    body?: unknown,
    config?: RequestConfig
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...config,
      method: "PATCH",
      data: body,
    });
  }

  async put<T>(
    endpoint: string,
    body?: unknown,
    config?: RequestConfig
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...config,
      method: "PUT",
      data: body,
    });
  }

  async delete<T>(
    endpoint: string,
    body?: unknown,
    config?: RequestConfig
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...config, method: "DELETE", data: body });
  }

  // Upload method for multipart form data (don't set Content-Type - let browser set it with boundary)
  async upload<T>(
    endpoint: string,
    formData: FormData
  ): Promise<ApiResponse<T>> {
    const response: AxiosResponse<ApiResponse<T>> = await this.axios.post<
      ApiResponse<T>
    >(endpoint, formData);

    return response.data;
  }

  // Getter for access token (useful for external calls)
  getAccessToken(): string | null {
    return this.accessToken;
  }

  // Set callback for handling token expiration
  setOnTokenExpired(callback: (() => void) | null): void {
    this.onTokenExpired = callback;
  }
}

export const api = new ApiClient(API_URL);
export default api;

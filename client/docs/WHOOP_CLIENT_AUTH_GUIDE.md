# WHOOP Client-Side Authentication & Data Fetching Guide

This guide explains how to authenticate with WHOOP on the client side and fetch data after authentication.

## Overview

The WHOOP OAuth 2.0 flow follows these steps:
1. **Initiate OAuth**: Request authorization URL from server → redirect user to WHOOP
2. **Callback**: WHOOP redirects back with authorization code → exchange for tokens
3. **Fetch Data**: Use authenticated API endpoints to fetch WHOOP data

---

## Step 1: Initiate WHOOP OAuth

### Using the Settings Page (Existing Implementation)

The settings page already has a "Connect WHOOP" button that initiates the OAuth flow:

```typescript
// client/app/(pages)/settings/page.tsx (lines 1163-1189)

<button
  onClick={async () => {
    try {
      const response = await api.post<{
        authUrl: string;
        state: string;
      }>("/integrations/oauth/initiate", {
        provider: "whoop",
      });
      
      if (response.success && response.data?.authUrl) {
        // Redirect user to WHOOP authorization page
        window.location.href = response.data.authUrl;
      } else {
        toast.error("Failed to initiate WHOOP connection...");
      }
    } catch (err) {
      console.error("Failed to initiate OAuth:", err);
      toast.error("Failed to connect WHOOP...");
    }
  }}
>
  Connect WHOOP
</button>
```

### Custom Implementation

If you want to add WHOOP connection to any component:

```typescript
'use client';

import { useState } from 'react';
import { api } from '@/lib/api-client';
import { toast } from 'sonner';

export function ConnectWhoopButton() {
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnect = async () => {
    try {
      setIsConnecting(true);
      
      // Step 1: Request OAuth authorization URL from server
      const response = await api.post<{
        authUrl: string;
        state: string;
      }>("/integrations/oauth/initiate", {
        provider: "whoop",
        // Optional: specify redirect URI (defaults to /auth/whoop/callback)
        // redirectUri: "http://localhost:3000/auth/whoop/callback"
      });

      if (!response.success || !response.data?.authUrl) {
        throw new Error("Failed to get authorization URL");
      }

      // Step 2: Redirect user to WHOOP authorization page
      // The server generates PKCE verifier/challenge, stores state, and returns authUrl
      window.location.href = response.data.authUrl;
      
      // User will be redirected to WHOOP login page
      // After approval, WHOOP redirects to /auth/whoop/callback
      
    } catch (error) {
      console.error("WHOOP connection error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to connect WHOOP");
      setIsConnecting(false);
    }
  };

  return (
    <button
      onClick={handleConnect}
      disabled={isConnecting}
    >
      {isConnecting ? "Connecting..." : "Connect WHOOP"}
    </button>
  );
}
```

### What Happens on the Server

When you call `/integrations/oauth/initiate`:
1. Server generates PKCE `code_verifier` and `code_challenge`
2. Server generates random `state` for CSRF protection
3. Server stores `code_verifier` and `state` in database (status: 'pending')
4. Server returns authorization URL with:
   - `client_id`
   - `redirect_uri` (default: `http://localhost:3000/auth/whoop/callback`)
   - `response_type=code`
   - `scope` (all required WHOOP scopes + `offline` for refresh tokens)
   - `state`
   - `code_challenge` and `code_challenge_method=S256`

---

## Step 2: Handle OAuth Callback

### Callback Page (Already Implemented)

The callback page at `client/app/auth/whoop/callback/page.tsx` automatically handles the OAuth callback:

```typescript
'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useApiMutation } from '@/hooks/use-api-mutation';

export default function WhoopCallbackPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  // Extract query parameters from WHOOP redirect
  const code = searchParams.get('code');        // Authorization code from WHOOP
  const state = searchParams.get('state');      // State parameter for CSRF verification
  const errorParam = searchParams.get('error'); // Error from WHOOP (if any)

  const { mutate: completeOAuth, isLoading, isSuccess } = useApiMutation({
    onSuccess: () => {
      // Redirect to WHOOP dashboard after successful connection
      setTimeout(() => {
        router.push('/whoop');
      }, 2000);
    },
    onError: (err) => {
      setError(err.message || 'Failed to complete WHOOP connection');
    },
  });

  useEffect(() => {
    // Handle OAuth errors from WHOOP
    if (errorParam) {
      const errorMessage = searchParams.get('error_description') || errorParam;
      setError(errorMessage);
      return;
    }

    // Validate required parameters
    if (!code || !state) {
      setError('Authorization code or state parameter missing');
      return;
    }

    // Step 3: Exchange authorization code for access/refresh tokens
    completeOAuth('/integrations/oauth/complete', {
      provider: 'whoop',
      code,    // Authorization code from WHOOP
      state,   // State parameter for verification
    });
  }, [code, state, errorParam, completeOAuth]);

  // Render loading/success/error states...
}
```

### What Happens on the Server

When you call `/integrations/oauth/complete`:
1. Server retrieves stored `code_verifier` and `state` from database
2. Server verifies `state` matches (CSRF protection)
3. Server exchanges authorization `code` + `code_verifier` for tokens:
   ```typescript
   POST https://api.prod.whoop.com/oauth/oauth2/token
   {
     grant_type: 'authorization_code',
     code: '<authorization_code>',
     code_verifier: '<pkce_verifier>',
     redirect_uri: 'http://localhost:3000/auth/whoop/callback',
     client_id: '<client_id>',
     client_secret: '<client_secret>'
   }
   ```
4. Server receives `access_token`, `refresh_token`, `expires_in`
5. Server stores tokens in `user_integrations` table (status: 'active')
6. Server optionally fetches user profile from WHOOP API

---

## Step 3: Fetch WHOOP Data

### Check Connection Status

Before fetching data, check if WHOOP is connected:

```typescript
'use client';

import { useFetch } from '@/hooks/use-fetch';

interface WhoopStatus {
  isConnected: boolean;
  hasCredentials: boolean;
  status: string;
  connectedAt: string | null;
  lastSyncAt: string | null;
  email?: string;
}

export function WhoopStatusCheck() {
  const { data: status, isLoading, error } = useFetch<WhoopStatus>(
    '/integrations/whoop/status'
  );

  if (isLoading) return <div>Loading status...</div>;
  if (error) return <div>Error: {error.message}</div>;
  if (!status?.isConnected) return <div>WHOOP not connected</div>;

  return (
    <div>
      <p>Connected: {status.email}</p>
      <p>Last sync: {status.lastSyncAt}</p>
    </div>
  );
}
```

### Fetch WHOOP Analytics Overview

```typescript
'use client';

import { useFetch } from '@/hooks/use-fetch';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { toast } from 'sonner';

interface WhoopOverview {
  currentRecovery: number | null;
  currentSleep: number | null;
  todayStrain: number | null;
  trends: {
    recovery7d: number[];
    sleep7d: number[];
    strain7d: number[];
  };
}

export function WhoopOverview() {
  // Fetch overview data
  const { data, isLoading, error, refetch } = useFetch<WhoopOverview>(
    '/whoop/analytics/overview',
    { immediate: true }
  );

  // Trigger data sync
  const { mutate: triggerSync, isLoading: isSyncing } = useApiMutation({
    onSuccess: () => {
      toast.success('Sync started! Data will appear shortly...');
      // Refetch data after sync
      setTimeout(() => refetch(), 2000);
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to sync data');
    },
  });

  const handleSync = () => {
    triggerSync('/integrations/whoop/sync', {});
  };

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  if (!data) return <div>No data available</div>;

  return (
    <div>
      <h2>WHOOP Overview</h2>
      <p>Recovery: {data.currentRecovery}%</p>
      <p>Sleep: {data.currentSleep} hours</p>
      <p>Strain: {data.todayStrain}</p>
      
      <button onClick={handleSync} disabled={isSyncing}>
        {isSyncing ? 'Syncing...' : 'Sync Data'}
      </button>
      
      {/* Render trends chart */}
    </div>
  );
}
```

### Available WHOOP API Endpoints

After authentication, you can fetch data from these endpoints:

#### 1. Overview (7-day trends)
```typescript
GET /whoop/analytics/overview

Response: {
  currentRecovery: number | null;
  currentSleep: number | null;
  todayStrain: number | null;
  trends: {
    recovery7d: number[];
    sleep7d: number[];
    strain7d: number[];
  };
}
```

#### 2. Recovery Data
```typescript
GET /whoop/analytics/recovery

// Supports query parameters:
// ?start=2024-01-01T00:00:00Z
// &end=2024-01-31T23:59:59Z
// &limit=25
```

#### 3. Sleep Data
```typescript
GET /whoop/analytics/sleep

// Supports query parameters:
// ?start=2024-01-01T00:00:00Z
// &end=2024-01-31T23:59:59Z
// &limit=25
```

#### 4. Strain/Workout Data
```typescript
GET /whoop/analytics/strain

// Supports query parameters:
// ?start=2024-01-01T00:00:00Z
// &end=2024-01-31T23:59:59Z
// &limit=25
```

#### 5. Cycles Data
```typescript
GET /whoop/analytics/cycles

// Supports query parameters:
// ?start=2024-01-01T00:00:00Z
// &end=2024-01-31T23:59:59Z
// &limit=25
```

### Manual Data Sync

To trigger a manual sync of historical WHOOP data:

```typescript
const { mutate: syncData, isLoading: isSyncing } = useApiMutation({
  onSuccess: (response) => {
    toast.success(`Sync started! Processing ${response.data?.recordsProcessed || 0} records...`);
  },
  onError: (error) => {
    toast.error(error.message || 'Sync failed');
  },
});

const handleSync = () => {
  syncData('/integrations/whoop/sync', {
    // Optional: specify date range
    // start: '2024-01-01T00:00:00Z',
    // end: '2024-01-31T23:59:59Z'
  });
};
```

---

## Complete Example Component

Here's a complete example that combines all steps:

```typescript
'use client';

import { useState } from 'react';
import { useFetch } from '@/hooks/use-fetch';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { api } from '@/lib/api-client';
import { toast } from 'sonner';

interface WhoopStatus {
  isConnected: boolean;
  hasCredentials: boolean;
  email?: string;
  lastSyncAt?: string;
}

interface WhoopOverview {
  trends: {
    recovery7d: number[];
    sleep7d: number[];
    strain7d: number[];
  };
}

export function WhoopIntegration() {
  const [isConnecting, setIsConnecting] = useState(false);

  // Check connection status
  const { data: status, refetch: refetchStatus } = useFetch<WhoopStatus>(
    '/integrations/whoop/status'
  );

  // Fetch overview data (only if connected)
  const { data: overview, refetch: refetchOverview } = useFetch<WhoopOverview>(
    status?.isConnected ? '/whoop/analytics/overview' : null,
    { immediate: true }
  );

  // Sync mutation
  const { mutate: syncData, isLoading: isSyncing } = useApiMutation({
    onSuccess: () => {
      toast.success('Data sync started!');
      setTimeout(() => {
        refetchOverview();
        refetchStatus();
      }, 2000);
    },
    onError: (error) => {
      toast.error(error.message || 'Sync failed');
    },
  });

  // Step 1: Connect WHOOP
  const handleConnect = async () => {
    try {
      setIsConnecting(true);
      const response = await api.post<{ authUrl: string }>(
        '/integrations/oauth/initiate',
        { provider: 'whoop' }
      );
      
      if (response.success && response.data?.authUrl) {
        window.location.href = response.data.authUrl;
      } else {
        throw new Error('Failed to get authorization URL');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Connection failed');
      setIsConnecting(false);
    }
  };

  // Step 2: Sync data
  const handleSync = () => {
    syncData('/integrations/whoop/sync', {});
  };

  // Render UI
  if (!status) return <div>Loading...</div>;

  if (!status.hasCredentials) {
    return (
      <div>
        <p>WHOOP credentials not configured</p>
        <p>Please add Client ID and Secret in Settings</p>
      </div>
    );
  }

  if (!status.isConnected) {
    return (
      <div>
        <p>WHOOP not connected</p>
        <button onClick={handleConnect} disabled={isConnecting}>
          {isConnecting ? 'Connecting...' : 'Connect WHOOP'}
        </button>
      </div>
    );
  }

  return (
    <div>
      <div>
        <h2>WHOOP Connected</h2>
        {status.email && <p>Email: {status.email}</p>}
        {status.lastSyncAt && <p>Last sync: {new Date(status.lastSyncAt).toLocaleString()}</p>}
      </div>

      <button onClick={handleSync} disabled={isSyncing}>
        {isSyncing ? 'Syncing...' : 'Sync Data'}
      </button>

      {overview && (
        <div>
          <h3>7-Day Trends</h3>
          <p>Recovery data points: {overview.trends.recovery7d.length}</p>
          <p>Sleep data points: {overview.trends.sleep7d.length}</p>
          <p>Strain data points: {overview.trends.strain7d.length}</p>
        </div>
      )}
    </div>
  );
}
```

---

## Important Notes

1. **OAuth Flow**: The client never handles tokens directly. All token management (storage, refresh) happens on the server.

2. **PKCE**: WHOOP uses PKCE (Proof Key for Code Exchange) for security. The `code_verifier` is generated and stored on the server, never exposed to the client.

3. **Redirect URI**: Must match exactly what's registered in WHOOP Developer Dashboard. Default is `http://localhost:3000/auth/whoop/callback`.

4. **State Parameter**: Used for CSRF protection. Generated on server, verified during callback.

5. **Token Refresh**: Automatic on server when tokens expire. Client doesn't need to handle refresh manually.

6. **Data Sync**: Historical data sync happens on the server. Call `/integrations/whoop/sync` to trigger it.

7. **Error Handling**: Always check `isConnected` status before fetching data. Handle 401 errors (token expired) - server should auto-refresh.

---

## Troubleshooting

### "Failed to initiate WHOOP connection"
- Check if WHOOP credentials are configured (Client ID and Secret)
- Verify redirect URI matches WHOOP Developer Dashboard
- Check server logs for detailed error messages

### "No data available" after connection
- Data sync may take a few minutes
- Click "Sync Data" button to trigger manual sync
- Check server logs for sync errors

### "401 Unauthorized" errors
- Token may have expired (server should auto-refresh)
- Check if refresh token is valid
- Verify scopes are correctly requested

### Callback page shows error
- Verify `code` and `state` parameters are present in URL
- Check if state matches stored value (CSRF protection)
- Review server logs for token exchange errors


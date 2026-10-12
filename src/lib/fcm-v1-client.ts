/**
 * Google Firebase Cloud Messaging HTTP v1 Client
 * Generates OAuth2 Access Tokens directly using Web Crypto (RSASSA-PKCS1-v1_5 SHA-256)
 * and dispatches high-priority background push notifications to mobile and web devices.
 * 
 * Works 100% in browser with modern Google FCM V1 API without requiring Legacy Server Key!
 */

export interface FirebaseServiceAccount {
  type: string;
  project_id: string;
  private_key_id?: string;
  private_key: string;
  client_email: string;
  client_id?: string;
  auth_uri?: string;
  token_uri?: string;
}

// In-memory token cache to avoid regenerating on every push
let cachedAccessToken: string | null = null;
let tokenExpiryTimestamp = 0;

/**
 * Converts PEM formatted RSA private key to binary ArrayBuffer (PKCS#8)
 */
function pemToArrayBuffer(pem: string): ArrayBuffer {
  const cleanBase64 = pem
    .replace(/-----BEGIN[A-Z\s]+-----/g, '')
    .replace(/-----END[A-Z\s]+-----/g, '')
    .replace(/\s+/g, '');
  
  const binaryString = atob(cleanBase64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Base64URL encode a string or Uint8Array
 */
function base64UrlEncode(input: string | Uint8Array): string {
  let base64: string;
  if (typeof input === 'string') {
    base64 = btoa(unescape(encodeURIComponent(input)));
  } else {
    let binary = '';
    const bytes = input;
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    base64 = btoa(binary);
  }
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Generates a signed OAuth2 JWT and retrieves an Access Token from Google
 */
export async function getGoogleOAuthAccessToken(
  serviceAccount: FirebaseServiceAccount | string
): Promise<string> {
  const sa: FirebaseServiceAccount = typeof serviceAccount === 'string' 
    ? JSON.parse(serviceAccount) 
    : serviceAccount;

  // Return cached token if valid for at least 5 more minutes
  const now = Math.floor(Date.now() / 1000);
  if (cachedAccessToken && tokenExpiryTimestamp > now + 300) {
    return cachedAccessToken;
  }

  if (!sa.private_key || !sa.client_email) {
    throw new Error('Service Account JSON me "private_key" ya "client_email" missing hai.');
  }

  // 1. Prepare JWT Header and Payload
  const header = {
    alg: 'RS256',
    typ: 'JWT'
  };

  const payload = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const dataToSign = `${encodedHeader}.${encodedPayload}`;

  // 2. Import Private Key via Web Crypto (PKCS#8)
  const keyBuffer = pemToArrayBuffer(sa.private_key);
  const cryptoKey = await window.crypto.subtle.importKey(
    'pkcs8',
    keyBuffer,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256'
    },
    false,
    ['sign']
  );

  // 3. Sign the JWT
  const encoder = new TextEncoder();
  const signatureBuffer = await window.crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    encoder.encode(dataToSign)
  );

  const encodedSignature = base64UrlEncode(new Uint8Array(signatureBuffer));
  const signedJwt = `${dataToSign}.${encodedSignature}`;

  // 4. Exchange JWT for Google Access Token
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: signedJwt
    })
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    throw new Error(`Google OAuth Token Error (${tokenResponse.status}): ${errorText}`);
  }

  const tokenData = await tokenResponse.json();
  if (!tokenData.access_token) {
    throw new Error('Google OAuth ne access_token return nahi kiya.');
  }

  cachedAccessToken = tokenData.access_token;
  tokenExpiryTimestamp = now + (tokenData.expires_in || 3600);

  return cachedAccessToken;
}

/**
 * Dispatches a push notification via modern Firebase Cloud Messaging HTTP v1 API
 */
export async function sendFcmV1Push(params: {
  serviceAccount: FirebaseServiceAccount | string;
  token: string;
  title: string;
  body: string;
  url?: string;
  tag?: string;
  data?: Record<string, string>;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const sa: FirebaseServiceAccount = typeof params.serviceAccount === 'string'
      ? JSON.parse(params.serviceAccount)
      : params.serviceAccount;

    const projectId = sa.project_id || 'studio-4472007664-90b88';
    const accessToken = await getGoogleOAuthAccessToken(sa);

    const targetUrl = params.url || '/my-orders';
    const tag = params.tag || ('lumaro-' + Date.now());

    const messagePayload = {
      message: {
        token: params.token,
        notification: {
          title: params.title,
          body: params.body
        },
        data: {
          url: targetUrl,
          title: params.title,
          body: params.body,
          tag,
          ...(params.data || {})
        },
        webpush: {
          headers: {
            Urgency: 'high'
          },
          notification: {
            title: params.title,
            body: params.body,
            icon: '/favicon.ico',
            badge: '/favicon.ico',
            tag,
            renotify: true,
            requireInteraction: true,
            vibrate: [400, 200, 400, 200, 400],
            data: {
              url: targetUrl
            }
          },
          fcm_options: {
            link: targetUrl
          }
        },
        android: {
          priority: 'high',
          notification: {
            title: params.title,
            body: params.body,
            icon: 'notification_icon',
            color: '#10B981',
            sound: 'default',
            default_sound: true,
            default_vibrate_timings: true,
            click_action: targetUrl
          }
        }
      }
    };

    const response = await fetch(
      `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify(messagePayload)
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error('[FCM V1] Dispatch error:', response.status, errText);
      return { success: false, error: `FCM v1 Error ${response.status}: ${errText}` };
    }

    const resJson = await response.json();
    console.log('[FCM V1] Push dispatched successfully:', resJson);
    return { success: true };
  } catch (err: any) {
    console.error('[FCM V1] Error:', err);
    return { success: false, error: err?.message || String(err) };
  }
}

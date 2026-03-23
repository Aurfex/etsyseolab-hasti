import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';

const ACCESS_COOKIE = 'etsyseolab_access';
const ACCESS_TTL_SECONDS = 60 * 60 * 24 * 7;

function getCookieValue(cookieHeader: string | undefined, name: string) {
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(';').map((cookie) => cookie.trim());
  const match = cookies.find((cookie) => cookie.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.substring(name.length + 1)) : null;
}

function isLocalhost(host: string) {
  const normalized = host.toLowerCase();
  return normalized.includes('localhost') || normalized.startsWith('127.0.0.1');
}

function handleAccessGate(req: VercelRequest, res: VercelResponse) {
  const accessKey = (process.env.SITE_ACCESS_KEY ?? '').trim();

  if (!accessKey) {
    return res.status(200).json({ enabled: false, unlocked: true });
  }

  if (req.method === 'GET') {
    const unlocked = getCookieValue(req.headers.cookie, ACCESS_COOKIE) === '1';
    return res.status(200).json({ enabled: true, unlocked });
  }

  if (req.method === 'POST') {
    const code = String(req.body?.code ?? '').trim();

    if (code !== accessKey) {
      return res.status(401).json({ error: 'Invalid access code.' });
    }

    const host = String(req.headers.host || '');
    const secure = !isLocalhost(host);
    const cookieParts = [
      `${ACCESS_COOKIE}=1`,
      'Path=/',
      'HttpOnly',
      'SameSite=Lax',
      `Max-Age=${ACCESS_TTL_SECONDS}`,
    ];

    if (secure) {
      cookieParts.push('Secure');
    }

    res.setHeader('Set-Cookie', cookieParts.join('; '));
    return res.status(200).json({ unlocked: true });
  }

  if (req.method === 'DELETE') {
    const host = String(req.headers.host || '');
    const secure = !isLocalhost(host);
    const cookieParts = [
      `${ACCESS_COOKIE}=`,
      'Path=/',
      'HttpOnly',
      'SameSite=Lax',
      'Max-Age=0',
    ];

    if (secure) {
      cookieParts.push('Secure');
    }

    res.setHeader('Set-Cookie', cookieParts.join('; '));
    return res.status(200).json({ unlocked: false });
  }

  res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
  return res.status(405).json({ error: 'Method Not Allowed' });
}

function generateCodeVerifier() {
  return base64URLEncode(crypto.randomBytes(32));
}

function generateCodeChallenge(verifier: string) {
  return base64URLEncode(crypto.createHash('sha256').update(verifier).digest());
}

function base64URLEncode(buffer: Buffer) {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  const requestUrl = new URL(req.url || '/', `https://${req.headers.host || 'localhost'}`);

  if (requestUrl.searchParams.get('gate') === '1') {
    return handleAccessGate(req, res);
  }

  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  const state = crypto.randomBytes(16).toString('hex');

  const host = String(req.headers.host || '').toLowerCase();
  const isLocal = host.includes('localhost') || host.startsWith('127.0.0.1');
  const cookieAttrs = isLocal
    ? 'Path=/; HttpOnly; SameSite=Lax; Max-Age=3600'
    : 'Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=3600';

  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  res.setHeader('Set-Cookie', [
    `etsy_code_verifier=${codeVerifier}; ${cookieAttrs}`,
    `etsy_oauth_state=${state}; ${cookieAttrs}`,
  ]);

  const rawScopes = (process.env.ETSY_SCOPES ?? 'listings_r listings_w listings_d profile_r shops_r email_r').trim();
  const scopes = rawScopes.replace(/\s+/g, ' ').includes('transactions_r')
    ? rawScopes.replace(/\s+/g, ' ')
    : `${rawScopes.replace(/\s+/g, ' ')} transactions_r`;

  const redirectUri = (process.env.ETSY_REDIRECT_URI ?? '').trim();
  const clientId = (process.env.ETSY_CLIENT_ID ?? '').trim();

  if (!clientId || !redirectUri) {
    return res.status(500).json({
      error: 'Missing environment variables (ETSY_CLIENT_ID or ETSY_REDIRECT_URI)',
    });
  }

  const authUrl =
    `https://www.etsy.com/oauth/connect?response_type=code` +
    `&client_id=${encodeURIComponent(clientId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&scope=${encodeURIComponent(scopes)}` +
    `&code_challenge=${encodeURIComponent(codeChallenge)}` +
    `&code_challenge_method=S256` +
    `&state=${encodeURIComponent(state)}`;

  console.log('Redirecting to Etsy:', authUrl);
  return res.redirect(authUrl);
}

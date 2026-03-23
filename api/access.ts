import type { VercelRequest, VercelResponse } from '@vercel/node';

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

export default function handler(req: VercelRequest, res: VercelResponse) {
  const accessKey = process.env.SITE_ACCESS_KEY;

  if (!accessKey) {
    return res.status(200).json({ enabled: false, unlocked: true });
  }

  if (req.method === 'GET') {
    const unlocked = getCookieValue(req.headers.cookie, ACCESS_COOKIE) === '1';
    return res.status(200).json({ enabled: true, unlocked });
  }

  if (req.method === 'POST') {
    const code = String(req.body?.code ?? '').trim();

    if (code !== accessKey.trim()) {
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

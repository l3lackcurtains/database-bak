import { createHmac, timingSafeEqual } from 'crypto';
import type { Request, Response } from 'express';

import { isAuthConfiguredViaDb, setAuthConfiguredViaDb } from '../common/auth-config';

export const SESSION_COOKIE = 'crumet_session';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;

export type AuthUser = {
  id: string;
  username: string;
  role: string;
};

type SessionPayload = AuthUser & {
  exp: number;
};

function base64Url(input: string | Buffer) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function getSecret() {
  return process.env.AUTH_SECRET || process.env.DASHBOARD_PASSWORD || 'dev-session-secret';
}

function sign(payload: string) {
  return base64Url(createHmac('sha256', getSecret()).update(payload).digest());
}

function parseCookies(cookieHeader?: string) {
  const cookies = new Map<string, string>();
  cookieHeader?.split(';').forEach((cookie) => {
    const separator = cookie.indexOf('=');
    if (separator === -1) return;
    cookies.set(cookie.slice(0, separator).trim(), decodeURIComponent(cookie.slice(separator + 1).trim()));
  });
  return cookies;
}

export function authConfigured() {
  return isAuthConfiguredViaDb() || Boolean(process.env.DASHBOARD_USERNAME && process.env.DASHBOARD_PASSWORD);
}

export function createSessionToken(user: AuthUser) {
  const payload = base64Url(JSON.stringify({
    ...user,
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS,
  } satisfies SessionPayload));

  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token?: string): AuthUser | null {
  if (!token) return null;

  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;

  const expected = sign(payload);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (signatureBuffer.length !== expectedBuffer.length || !timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as SessionPayload;
    if (!session.username || !session.id || session.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return { id: session.id, username: session.username, role: session.role };
  } catch {
    return null;
  }
}

export function getUserFromRequest(req: Request) {
  return verifySessionToken(parseCookies(req.headers.cookie).get(SESSION_COOKIE));
}

export function setSessionCookie(res: Response, token: string) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS * 1000,
  });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  });
}

import { NextRequest, NextResponse } from 'next/server';

const SESSION_COOKIE = 'crumet_session';

function authConfigured() {
  return Boolean(process.env.DASHBOARD_USERNAME && process.env.DASHBOARD_PASSWORD);
}

function hasSession(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return false;

  const [payload] = token.split('.');
  if (!payload) return false;

  try {
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const session = JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='))) as {
      username?: string;
      role?: string;
      exp?: number;
    };

    return Boolean(session.exp && session.exp >= Math.floor(Date.now() / 1000));
  } catch {
    return false;
  }
}

function unauthorizedJson() {
  return NextResponse.json(
    { message: 'Authentication required', statusCode: 401, error: 'Unauthorized' },
    { status: 401 },
  );
}

export default async function middleware(request: NextRequest) {
  if (!authConfigured()) return NextResponse.next();

  const { pathname } = request.nextUrl;
  const isLoginPage = pathname === '/login';
  const isAuthApi = pathname === '/api/auth/login' || pathname === '/api/auth/logout';
  const isApi = pathname.startsWith('/api/');

  if (isAuthApi) return NextResponse.next();

  const authenticated = hasSession(request);

  if (isLoginPage && authenticated) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  if (!authenticated && !isLoginPage) {
    if (isApi) return unauthorizedJson();
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg).*)'],
};

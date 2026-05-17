import { NextRequest, NextResponse } from 'next/server';

function unauthorized() {
  return new NextResponse('Authentication required', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Crumet Sync", charset="UTF-8"',
    },
  });
}

function isAuthorized(request: NextRequest) {
  const username = process.env.DASHBOARD_USERNAME;
  const password = process.env.DASHBOARD_PASSWORD;

  if (!username || !password) return true;

  const header = request.headers.get('authorization');
  if (!header?.startsWith('Basic ')) return false;

  try {
    const credentials = atob(header.slice(6));
    const separator = credentials.indexOf(':');
    if (separator === -1) return false;

    const providedUsername = credentials.slice(0, separator);
    const providedPassword = credentials.slice(separator + 1);
    return providedUsername === username && providedPassword === password;
  } catch {
    return false;
  }
}

export function proxy(request: NextRequest) {
  if (!isAuthorized(request)) return unauthorized();
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg).*)'],
};

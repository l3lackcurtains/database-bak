import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}

export async function PUT(request: NextRequest) {
  return handle(request);
}

export async function PATCH(request: NextRequest) {
  return handle(request);
}

export async function DELETE(request: NextRequest) {
  return handle(request);
}

async function handle(request: NextRequest) {
  const apiUrl = process.env.API_URL || 'http://localhost:7301';
  const { pathname, search } = request.nextUrl;
  
  // Forward the request to the NestJS API
  const targetUrl = `${apiUrl}${pathname}${search}`;

  const headers = new Headers(request.headers);
  // Remove host to prevent proxy routing issues
  headers.delete('host');

  try {
    const res = await fetch(targetUrl, {
      method: request.method,
      headers,
      body: request.method !== 'GET' && request.method !== 'HEAD' ? await request.blob() : undefined,
      duplex: 'half', // Required in Node.js fetch for body streams
    } as any);

    const responseHeaders = new Headers(res.headers);
    
    return new NextResponse(res.body, {
      status: res.status,
      headers: responseHeaders,
    });
  } catch (error: any) {
    console.error('Proxy request failed:', error);
    return NextResponse.json(
      { message: error.message || 'Proxy failed', error: 'Bad Gateway' },
      { status: 502 }
    );
  }
}

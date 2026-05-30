const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

interface RequestInitWithTimeout extends RequestInit {
  timeout?: number;
}

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public error: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function fetchWithTimeout(
  url: string,
  options: RequestInitWithTimeout = {},
): Promise<Response> {
  const { timeout = 30000, ...fetchOptions } = options;
  
  // Use AbortSignal.timeout if available, or create our own
  let signal = fetchOptions.signal;
  let id: NodeJS.Timeout | undefined;
  
  if (!signal) {
    const controller = new AbortController();
    id = setTimeout(() => controller.abort(new Error('Request Timeout')), timeout);
    signal = controller.signal;
  }

  try {
    const response = await fetch(url, { ...fetchOptions, signal });
    return response;
  } finally {
    if (id) clearTimeout(id);
  }
}

async function request<T>(path: string, options: RequestInitWithTimeout = {}): Promise<T> {
  const url = `${API_URL}${path}`;
  const response = await fetchWithTimeout(url, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({
      message: response.statusText,
      statusCode: response.status,
      error: 'Unknown error',
    }));
    throw new ApiError(response.status, error.error || 'Error', error.message || 'Request failed');
  }
  if (response.status === 204) {
    return undefined as T;
  }
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export const api = {
  get: <T>(path: string, options?: RequestInitWithTimeout) =>
    request<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: RequestInitWithTimeout) =>
    request<T>(path, { ...options, method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown, options?: RequestInitWithTimeout) =>
    request<T>(path, { ...options, method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown, options?: RequestInitWithTimeout) =>
    request<T>(path, { ...options, method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string, options?: RequestInitWithTimeout) =>
    request<T>(path, { ...options, method: 'DELETE' }),
};

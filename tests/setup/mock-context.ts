interface MockUser {
  id: string;
  email: string;
  name: string;
  roles: string[];
}

interface MockContextOptions {
  db: D1Database;
  user?: MockUser | null;
  params?: Record<string, string>;
  body?: any;
  method?: string;
  url?: string;
  searchParams?: Record<string, string>;
  cookies?: Record<string, string>;
  headers?: Record<string, string>;
  env?: Record<string, any>;
}

export function createMockAPIContext(opts: MockContextOptions): any {
  const {
    db,
    user = null,
    params = {},
    body,
    method = 'GET',
    url: urlStr = 'http://localhost:4321/api/test',
    searchParams = {},
    cookies: cookieValues = {},
    headers: extraHeaders = {},
    env: envOverrides = {},
  } = opts;

  const url = new URL(urlStr);
  for (const [k, v] of Object.entries(searchParams)) {
    url.searchParams.set(k, v);
  }

  const reqHeaders = new Headers(extraHeaders);
  if (body) {
    reqHeaders.set('Content-Type', 'application/json');
  }

  let reqBody: BodyInit | undefined;
  if (body !== undefined) {
    reqBody = JSON.stringify(body);
  }

  const request = new Request(url.toString(), {
    method,
    headers: reqHeaders,
    body: method !== 'GET' && method !== 'HEAD' ? reqBody : undefined,
  });

  const cookieStore: Record<string, string> = { ...cookieValues };

  const cookieAPI = {
    get(name: string) {
      return cookieStore[name] ? { value: cookieStore[name] } : undefined;
    },
    set(name: string, value: string, _opts?: any) {
      cookieStore[name] = value;
    },
    delete(name: string, _opts?: any) {
      delete cookieStore[name];
    },
  };

  return {
    request,
    url,
    params,
    cookies: cookieAPI,
    locals: {
      user,
      runtime: {
        env: {
          DB: db,
          BOOTSTRAP_ADMIN_EMAIL: 'admin@test.com',
          BOOTSTRAP_ADMIN_PASSWORD: 'TestPassword123!',
          TURNSTILE_SECRET_KEY: '',
          GITHUB_TOKEN: 'test-github-token',
          ...envOverrides,
        },
      },
    },
    redirect(path: string) {
      return new Response(null, {
        status: 302,
        headers: { Location: path },
      });
    },
  };
}

export async function readJSON(res: Response) {
  return res.json();
}

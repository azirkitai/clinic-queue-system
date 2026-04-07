import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (res.status === 401 || res.status === 403) {
    const currentPath = window.location.pathname;
    const isPublicPage = currentPath === '/' || currentPath === '/login' || currentPath.startsWith('/tv/') || currentPath.startsWith('/qr-auth/');
    
    if (res.status === 403) {
      const body = await res.text();
      let errorMsg = 'Account not active';
      try {
        const parsed = JSON.parse(body);
        errorMsg = parsed.error || errorMsg;
      } catch {}
      
      if (!isPublicPage) {
        console.log('[AUTH] Account deactivated - redirecting to login');
        window.location.href = '/';
      }
      throw new Error(errorMsg);
    }
    
    if (!isPublicPage) {
      console.log('[AUTH] Session expired - redirecting to login');
      window.location.href = '/';
      throw new Error('Session expired');
    }
  }
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});

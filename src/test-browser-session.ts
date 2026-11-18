/** Explicit browser-session responses shared by HTTP fixtures. Domain APIs still run their original handlers. */
export function browserSessionResponse(url: string, init?: RequestInit): Response | undefined {
  if (url.endsWith('/accounts/me') && !new Headers(init?.headers).has('Authorization')) return new Response(null, { status: 401 })
  if (url.endsWith('/session') || url.endsWith('/session/logout')) return new Response(null, { status: 204 })
  return undefined
}

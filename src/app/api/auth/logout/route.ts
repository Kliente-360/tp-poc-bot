import { cookieApagado } from '@/lib/auth/config';
import { COOKIE_DE_SESSAO } from '@/lib/auth/sessao';

export const runtime = 'edge';

export async function GET(request: Request): Promise<Response> {
  const cabecalhos = new Headers({ Location: new URL('/login', new URL(request.url).origin).toString() });
  cabecalhos.append('Set-Cookie', cookieApagado(COOKIE_DE_SESSAO));
  return new Response(null, { status: 302, headers: cabecalhos });
}

import { NextResponse, type NextRequest } from 'next/server';
import { COOKIE_DE_SESSAO, lerSessao } from '@/lib/auth/sessao';

/**
 * Porteiro do site inteiro.
 *
 * Arquivo `proxy` e nao `middleware`: o Next 16 renomeou a convencao, e a
 * antiga ja avisa que esta deprecada.
 *
 * Tudo exige sessao, menos a tela de login e as proprias rotas de
 * autenticacao — sem essa excecao o login seria um circulo.
 *
 * Fecha por padrao: rota nova nasce protegida sem ninguem precisar lembrar de
 * inclui-la aqui. O contrario — lista do que proteger — deixa buraco no dia em
 * que alguem cria uma rota e esquece.
 */
export const config = {
  matcher: [
    // Tudo, exceto os arquivos estaticos do Next e os assets publicos.
    '/((?!_next/static|_next/image|favicon.ico|lets.jpg).*)',
  ],
};

const LIVRES = ['/login', '/api/auth/'];

export async function proxy(request: NextRequest) {
  const caminho = request.nextUrl.pathname;
  if (LIVRES.some((livre) => caminho === livre || caminho.startsWith(livre))) {
    return NextResponse.next();
  }

  const segredo = process.env.SESSION_SECRET;
  if (!segredo) {
    // Sem segredo nao ha como validar sessao nenhuma. Bloquear tudo e o unico
    // desfecho honesto: o contrario seria abrir o site por falta de config.
    return NextResponse.json(
      { erro: 'SESSION_SECRET não configurado — acesso bloqueado.' },
      { status: 503 },
    );
  }

  const sessao = await lerSessao(request.cookies.get(COOKIE_DE_SESSAO)?.value, segredo);
  if (sessao) return NextResponse.next();

  // Requisicao de API nao deve virar redirecionamento: o cliente espera JSON, e
  // um 302 para HTML apareceria no painel como erro de parse.
  if (caminho.startsWith('/api/')) {
    return NextResponse.json({ erro: 'não autenticado' }, { status: 401 });
  }

  const login = new URL('/login', request.url);
  login.searchParams.set('destino', caminho + request.nextUrl.search);
  return NextResponse.redirect(login);
}

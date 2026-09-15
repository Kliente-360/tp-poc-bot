import {
  COOKIE_DESTINO,
  COOKIE_STATE,
  COOKIE_VERIFICADOR,
  DURACAO_DA_SESSAO_S,
  configGoogle,
  cookieApagado,
  segredoDeSessao,
} from '@/lib/auth/config';
import { emailPermitido } from '@/lib/auth/dominios';
import { trocarCodigo } from '@/lib/auth/google';
import { COOKIE_DE_SESSAO, assinarSessao } from '@/lib/auth/sessao';

export const runtime = 'edge';

function lerCookie(request: Request, nome: string): string | undefined {
  return request.headers
    .get('cookie')
    ?.split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${nome}=`))
    ?.slice(nome.length + 1);
}

/**
 * Volta para o login com o motivo.
 *
 * `new Response` e nao `Response.redirect`: a resposta que o helper devolve tem
 * headers imutaveis, e o Next tenta acrescentar os dele depois — o resultado e
 * `TypeError: immutable` e um 500 em todos os caminhos desta rota, inclusive
 * nos que nem chegam a falar com o Google.
 */
function recusar(request: Request, motivo: string): Response {
  const url = new URL('/login', new URL(request.url).origin);
  url.searchParams.set('erro', motivo);
  return new Response(null, { status: 302, headers: { Location: url.toString() } });
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const codigo = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  // O usuario cancelou na tela do Google.
  if (url.searchParams.get('error')) return recusar(request, 'cancelado');
  if (!codigo || !state) return recusar(request, 'incompleto');

  // O state do cookie precisa bater com o que voltou na URL. E o que impede
  // alguem de forjar um retorno de login com um codigo que nao foi pedido aqui.
  const stateEsperado = lerCookie(request, COOKIE_STATE);
  if (!stateEsperado || stateEsperado !== state) return recusar(request, 'state');

  const verificador = lerCookie(request, COOKIE_VERIFICADOR);
  if (!verificador) return recusar(request, 'state');

  let identidade;
  try {
    identidade = await trocarCodigo(configGoogle(request), codigo, verificador);
  } catch (erro) {
    console.error('[auth] troca de código falhou', erro);
    return recusar(request, 'google');
  }

  // E-mail nao verificado no Google nao prova dominio nenhum.
  if (!identidade.emailVerificado) return recusar(request, 'nao_verificado');
  if (!emailPermitido(identidade.email)) {
    console.warn(JSON.stringify({ evento: 'login_negado', email: identidade.email }));
    return recusar(request, 'dominio');
  }

  const cookie = await assinarSessao(
    {
      email: identidade.email,
      nome: identidade.nome,
      foto: identidade.foto,
      expiraEm: Math.floor(Date.now() / 1000) + DURACAO_DA_SESSAO_S,
    },
    segredoDeSessao(),
  );

  const destino = decodeURIComponent(lerCookie(request, COOKIE_DESTINO) ?? '/');
  const cabecalhos = new Headers({ Location: new URL(destino, url.origin).toString() });
  cabecalhos.append(
    'Set-Cookie',
    `${COOKIE_DE_SESSAO}=${cookie}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${DURACAO_DA_SESSAO_S}`,
  );
  for (const nome of [COOKIE_STATE, COOKIE_VERIFICADOR, COOKIE_DESTINO]) {
    cabecalhos.append('Set-Cookie', cookieApagado(nome));
  }

  console.log(JSON.stringify({ evento: 'login', email: identidade.email }));
  return new Response(null, { status: 302, headers: cabecalhos });
}

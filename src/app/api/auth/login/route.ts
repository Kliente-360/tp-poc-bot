import { COOKIE_DESTINO, COOKIE_STATE, COOKIE_VERIFICADOR, configGoogle, cookieCurto } from '@/lib/auth/config';
import { listaDeDominios } from '@/lib/auth/dominios';
import { gerarDesafio, gerarState, gerarVerificador, urlDeAutorizacao } from '@/lib/auth/google';

export const runtime = 'edge';

export async function GET(request: Request): Promise<Response> {
  let config;
  try {
    config = configGoogle(request);
  } catch (erro) {
    return Response.json({ erro: erro instanceof Error ? erro.message : 'configuração ausente' }, { status: 503 });
  }

  /**
   * Comeca o fluxo sempre no host canonico.
   *
   * Os cookies de `state` e do verificador sao gravados no host desta
   * requisicao, mas o Google devolve em AUTH_BASE_URL. Quem entra pela URL do
   * deploy (`<id>--projeto.netlify.app`) grava o cookie la e volta aqui, onde
   * ele nao existe — e o login e recusado por cookie ausente, sem nada de
   * errado ter acontecido.
   *
   * Em preview AUTH_BASE_URL nao existe, a origem e derivada da requisicao, e
   * nao ha o que canonizar.
   */
  const base = process.env.AUTH_BASE_URL;
  if (base && new URL(base).origin !== new URL(request.url).origin) {
    const canonico = new URL('/api/auth/login', base);
    const destinoOriginal = new URL(request.url).searchParams.get('destino');
    if (destinoOriginal) canonico.searchParams.set('destino', destinoOriginal);
    return new Response(null, { status: 302, headers: { Location: canonico.toString() } });
  }

  const state = gerarState();
  const verificador = gerarVerificador();
  const desafio = await gerarDesafio(verificador);

  // Para onde voltar depois do login, para o link compartilhado nao levar
  // sempre para a home.
  const destino = new URL(request.url).searchParams.get('destino') ?? '/';
  const destinoSeguro = destino.startsWith('/') && !destino.startsWith('//') ? destino : '/';

  const dominios = listaDeDominios();
  const url = urlDeAutorizacao(config, state, desafio, dominios.length === 1 ? dominios[0] : undefined);

  const cabecalhos = new Headers({ Location: url });
  cabecalhos.append('Set-Cookie', cookieCurto(COOKIE_STATE, state));
  cabecalhos.append('Set-Cookie', cookieCurto(COOKIE_VERIFICADOR, verificador));
  cabecalhos.append('Set-Cookie', cookieCurto(COOKIE_DESTINO, encodeURIComponent(destinoSeguro)));

  return new Response(null, { status: 302, headers: cabecalhos });
}

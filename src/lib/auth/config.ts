import type { ConfigGoogle } from './google';

export const COOKIE_STATE = 'lets_oauth_state';
export const COOKIE_VERIFICADOR = 'lets_oauth_verificador';
export const COOKIE_DESTINO = 'lets_oauth_destino';

/** Duracao da sessao. Um dia util: quem demonstra nao quer relogar no meio. */
export const DURACAO_DA_SESSAO_S = 12 * 60 * 60;

export function segredoDeSessao(): string {
  const segredo = process.env.SESSION_SECRET;
  if (!segredo || segredo.length < 32) {
    throw new Error('SESSION_SECRET ausente ou curto demais (mínimo 32 caracteres).');
  }
  return segredo;
}

/**
 * A URL de callback precisa bater exatamente com a registrada no Google.
 *
 * Derivada da requisicao em desenvolvimento, para funcionar em localhost sem
 * configuracao. Em producao no Netlify, AUTH_BASE_URL e OBRIGATORIA: o host
 * que chega na funcao e o do deploy especifico
 * (`<id>--projeto.netlify.app`), nao o canonico. Sem fixar, cada deploy manda
 * ao Google uma redirect_uri diferente, nenhuma registrada, e o login falha
 * com redirect_uri_mismatch.
 */
export function configGoogle(request: Request): ConfigGoogle {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET são obrigatórios.');
  }

  const base = process.env.AUTH_BASE_URL ?? new URL(request.url).origin;
  return { clientId, clientSecret, redirectUri: new URL('/api/auth/callback', base).toString() };
}

export function cookieCurto(nome: string, valor: string): string {
  // 10 minutos: tempo de ir ao Google e voltar, e nada alem disso.
  // Lax, e nao Strict: o retorno do Google e uma navegacao de outro site, e
  // com Strict o cookie nao seria enviado e o login falharia sempre.
  return `${nome}=${valor}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`;
}

export function cookieApagado(nome: string): string {
  return `${nome}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

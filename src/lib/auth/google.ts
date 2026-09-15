const AUTORIZACAO = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN = 'https://oauth2.googleapis.com/token';

export interface ConfigGoogle {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface IdentidadeGoogle {
  email: string;
  emailVerificado: boolean;
  nome: string;
  foto?: string;
}

function aleatorioBase64Url(bytes = 32): string {
  const buffer = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...buffer))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export function gerarState(): string {
  return aleatorioBase64Url(16);
}

export function gerarVerificador(): string {
  return aleatorioBase64Url(32);
}

/** PKCE S256: o desafio e o hash do verificador, e so o hash viaja na URL. */
export async function gerarDesafio(verificador: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verificador));
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export function urlDeAutorizacao(
  config: ConfigGoogle,
  state: string,
  desafio: string,
  dicaDeDominio?: string,
): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    code_challenge: desafio,
    code_challenge_method: 'S256',
    // Sempre mostra o seletor de conta: quem tem duas contas no navegador
    // entraria com a errada em silencio.
    prompt: 'select_account',
  });

  // Dica de dominio para o Google ja sugerir a conta certa. E dica, nao
  // garantia — a validacao de quem pode entrar e nossa, no callback.
  if (dicaDeDominio) params.set('hd', dicaDeDominio);

  return `${AUTORIZACAO}?${params}`;
}

/**
 * Troca o codigo pela identidade.
 *
 * O `id_token` e lido sem verificar a assinatura, e isso e proposital: ele veio
 * direto do endpoint de token do Google, por TLS, numa requisicao que nos
 * fizemos. Nao passou por terceiro. Verificar JWKS aqui protegeria contra um
 * atacante que ja teria que ser o proprio Google.
 *
 * O mesmo NAO valeria se o token chegasse pelo navegador — ai a assinatura
 * seria a unica garantia.
 */
export async function trocarCodigo(
  config: ConfigGoogle,
  codigo: string,
  verificador: string,
): Promise<IdentidadeGoogle> {
  const resposta = await fetch(TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code: codigo,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: 'authorization_code',
      code_verifier: verificador,
    }),
  });

  const dados = (await resposta.json()) as { id_token?: string; error_description?: string; error?: string };

  if (!resposta.ok || !dados.id_token) {
    throw new Error(`Google recusou a troca do código: ${dados.error_description ?? dados.error ?? resposta.status}`);
  }

  const payload = JSON.parse(
    atob(dados.id_token.split('.')[1]!.replace(/-/g, '+').replace(/_/g, '/')),
  ) as { email?: string; email_verified?: boolean; name?: string; picture?: string };

  if (!payload.email) throw new Error('Google não devolveu e-mail no token.');

  return {
    email: payload.email,
    emailVerificado: payload.email_verified === true,
    nome: payload.name ?? payload.email,
    foto: payload.picture,
  };
}

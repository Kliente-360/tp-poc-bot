/**
 * Sessao assinada em cookie.
 *
 * Nao ha banco de sessao: o cookie carrega o proprio conteudo e uma assinatura
 * HMAC. Para "quem entrou e de que dominio" isso basta, e evita uma leitura de
 * Blob a cada requisicao de cada rota.
 *
 * Assinatura por Web Crypto (`crypto.subtle`), que existe em edge runtime — a
 * restricao do projeto e sobre o modulo `crypto` do Node, que e outra coisa.
 */

export interface Sessao {
  email: string;
  nome: string;
  foto?: string;
  /** Epoch em segundos. */
  expiraEm: number;
}

export const COOKIE_DE_SESSAO = 'lets_sessao';

const codificador = new TextEncoder();

async function chave(segredo: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    codificador.encode(segredo),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

/** base64url: cabe em cookie sem escape e sem os caracteres problematicos do base64. */
function paraBase64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function deBase64Url(texto: string): Uint8Array<ArrayBuffer> {
  const base64 = texto.replace(/-/g, '+').replace(/_/g, '/');
  const binario = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='));

  // Buffer criado explicitamente: `Uint8Array.from` devolve ArrayBufferLike,
  // que o tipo BufferSource do Web Crypto nao aceita.
  const bytes = new Uint8Array(new ArrayBuffer(binario.length));
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return bytes;
}

export async function assinarSessao(sessao: Sessao, segredo: string): Promise<string> {
  const corpo = paraBase64Url(codificador.encode(JSON.stringify(sessao)));
  const assinatura = await crypto.subtle.sign('HMAC', await chave(segredo), codificador.encode(corpo));
  return `${corpo}.${paraBase64Url(new Uint8Array(assinatura))}`;
}

/**
 * Devolve a sessao ou null. Nunca lanca: cookie corrompido, adulterado ou
 * vencido sao todos o mesmo desfecho — nao ha sessao.
 *
 * A verificacao usa `crypto.subtle.verify`, que compara em tempo constante.
 * Comparar strings com `===` vazaria informacao pelo tempo de resposta.
 */
export async function lerSessao(cookie: string | undefined, segredo: string): Promise<Sessao | null> {
  if (!cookie) return null;

  const [corpo, assinatura] = cookie.split('.');
  if (!corpo || !assinatura) return null;

  try {
    const valida = await crypto.subtle.verify(
      'HMAC',
      await chave(segredo),
      deBase64Url(assinatura),
      codificador.encode(corpo),
    );
    if (!valida) return null;

    const sessao = JSON.parse(new TextDecoder().decode(deBase64Url(corpo))) as Sessao;
    if (typeof sessao.expiraEm !== 'number' || sessao.expiraEm * 1000 < Date.now()) return null;
    if (typeof sessao.email !== 'string' || sessao.email.length === 0) return null;

    return sessao;
  } catch {
    return null;
  }
}

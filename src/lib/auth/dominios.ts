/**
 * Quem pode entrar.
 *
 * Lista de dominios em DOMINIOS_PERMITIDOS, separados por virgula. E-mails
 * avulsos em EMAILS_PERMITIDOS, para convidado pontual sem abrir o dominio
 * inteiro.
 *
 * Sem nenhuma das duas configuradas, ninguem entra. Falhar fechado: uma lista
 * vazia por engano nao pode virar "site aberto".
 */
export function listaDeDominios(): string[] {
  return (process.env.DOMINIOS_PERMITIDOS ?? '')
    .split(',')
    .map((d) => d.trim().toLowerCase().replace(/^@/, ''))
    .filter((d) => d.length > 0);
}

export function listaDeEmails(): string[] {
  return (process.env.EMAILS_PERMITIDOS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0);
}

export function emailPermitido(
  email: string,
  dominios: string[] = listaDeDominios(),
  emails: string[] = listaDeEmails(),
): boolean {
  const limpo = email.trim().toLowerCase();
  if (!limpo.includes('@')) return false;
  if (emails.includes(limpo)) return true;

  const dominio = limpo.slice(limpo.lastIndexOf('@') + 1);
  // Comparacao exata: `acme.com` nao libera `acme.com.br` nem `evil-acme.com`.
  return dominios.includes(dominio);
}

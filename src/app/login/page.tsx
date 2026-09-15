export const dynamic = 'force-dynamic';

/**
 * Mensagens de recusa.
 *
 * Deliberadamente vagas sobre o motivo em "dominio": dizer "seu e-mail nao
 * esta na lista" confirma para quem tentou que a lista existe e que ele nao
 * esta nela. Nao e segredo de estado, mas tambem nao ha ganho em detalhar.
 */
const MOTIVOS: Record<string, string> = {
  dominio: 'Essa conta não tem acesso a esta demonstração.',
  nao_verificado: 'Essa conta do Google não tem e-mail verificado.',
  cancelado: 'Login cancelado.',
  sem_cookie: 'O navegador não devolveu o cookie de login. Tente de novo; se repetir, verifique se cookies estão bloqueados para este site.',
  state_divergente: 'A tentativa de login não confere com a que começou aqui. Tente de novo.',
  sem_verificador: 'Faltou parte da sessão de login. Tente de novo.',
  incompleto: 'O Google não devolveu os dados do login. Tente de novo.',
  google: 'Não consegui falar com o Google. Tente de novo em instantes.',
};

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const erro = typeof params.erro === 'string' ? MOTIVOS[params.erro] : null;
  const destino = typeof params.destino === 'string' ? params.destino : '/';

  return (
    <main className="grid min-h-dvh place-items-center bg-tp-noite px-4 font-[family-name:var(--font-poppins)]">
      <div className="w-full max-w-sm">
        <p className="text-center text-[11px] font-semibold tracking-wide text-tp-verde">
          DEMONSTRAÇÃO KLIENTE 360
        </p>

        <h1 className="mt-3 text-center text-[26px] font-bold tracking-tight text-white">
          Total<span className="text-tp-verde">Pass</span>
        </h1>
        <p className="mt-2 text-center text-[13px] leading-relaxed text-white/60">
          Portal simulado com a Léts, assistente de atendimento. Acesso restrito.
        </p>

        {erro && (
          <p className="mt-6 rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-center text-[12.5px] text-amber-200">
            {erro}
          </p>
        )}

        {/*
          <a> puro, e nao <Link>: Link faz navegacao client-side, e apontada
          para uma rota de API o router busca a rota, recebe o 302 e pode
          acabar invocando o login duas vezes. Cada invocacao gera um `state`
          novo e sobrescreve o cookie — o state que vai ao Google fica de uma
          chamada e o cookie da outra, e o retorno e recusado por divergencia.
        */}
        <a
          href={`/api/auth/login?destino=${encodeURIComponent(destino)}`}
          className="mt-8 flex items-center justify-center gap-3 rounded-xl bg-white px-5 py-3 text-[14px] font-medium text-tp-noite transition-colors hover:bg-tp-verde"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path fill="#4285F4" d="M23 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.2a5.3 5.3 0 0 1-2.3 3.5v2.9h3.7c2.2-2 3.4-5 3.4-8.6Z" />
            <path fill="#34A853" d="M12 24c3.1 0 5.7-1 7.6-2.8l-3.7-2.9c-1 .7-2.3 1.1-3.9 1.1-3 0-5.5-2-6.4-4.7H1.8v3C3.7 21.4 7.6 24 12 24Z" />
            <path fill="#FBBC05" d="M5.6 14.7a7.2 7.2 0 0 1 0-4.6v-3H1.8a12 12 0 0 0 0 10.6l3.8-3Z" />
            <path fill="#EA4335" d="M12 4.8c1.7 0 3.2.6 4.4 1.7l3.3-3.3C17.7 1.2 15.1 0 12 0 7.6 0 3.7 2.6 1.8 6.1l3.8 3C6.5 6.7 9 4.8 12 4.8Z" />
          </svg>
          Entrar com Google
        </a>

        <p className="mt-6 text-center text-[11px] leading-relaxed text-white/35">
          Ambiente de demonstração. Não é o portal em produção.
        </p>
      </div>
    </main>
  );
}

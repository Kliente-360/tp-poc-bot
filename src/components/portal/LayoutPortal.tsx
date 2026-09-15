import Link from 'next/link';
import type { ReactNode } from 'react';
import { PainelDeChat } from '@/components/chat/PainelDeChat';

/**
 * Casca da pagina simulada do portal: tarja, cabecalho, menu lateral e o
 * painel de conversa. Cenario, nao produto.
 *
 * Os itens do menu sao inertes de proposito — a excecao e "Métricas MVP", que
 * e a unica tela de verdade aqui e existe para mostrar ao cliente o que o
 * produto mede.
 */

const MENU = [
  { rotulo: 'Início', href: '/' },
  { rotulo: 'Beneficiários', href: null },
  { rotulo: 'Financeiro', href: null },
  { rotulo: 'Relatórios', href: null },
  { rotulo: 'Contrato', href: null },
  { rotulo: 'Ajuda', href: null },
  { rotulo: 'Métricas MVP', href: '/metricas' },
] as const;

export function LayoutPortal({ ativo, children }: { ativo: string; children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-tp-nevoa font-[family-name:var(--font-poppins)] text-tp-grafite">
      <p className="bg-tp-verde-claro px-4 py-1.5 text-center text-[11px] font-semibold tracking-wide text-tp-noite">
        DEMONSTRAÇÃO KLIENTE 360
      </p>

      <header className="sticky top-0 z-10 border-b border-tp-borda bg-tp-noite">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3.5">
          <Link href="/" className="text-lg font-bold tracking-tight text-white">
            Total<span className="text-tp-verde">Pass</span>
          </Link>
          <nav className="hidden gap-5 md:flex">
            {MENU.slice(0, 4).map((item) => (
              <span
                key={item.rotulo}
                className={`text-[13px] ${item.rotulo === ativo ? 'font-semibold text-tp-verde' : 'text-white/70'}`}
              >
                {item.rotulo}
              </span>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-[12px] text-white/60 sm:inline">Empresa Teste</span>
            <span className="grid h-8 w-8 place-items-center rounded-full bg-tp-verde text-[13px] font-bold text-tp-noite">
              ET
            </span>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl gap-8 px-4 py-8">
        <aside className="hidden w-48 shrink-0 lg:block">
          <nav className="flex flex-col gap-1">
            {MENU.map((item) => {
              const classe = `rounded-lg px-3 py-2 text-[13px] ${
                item.rotulo === ativo
                  ? 'bg-white font-semibold text-tp-noite shadow-sm'
                  : item.href
                    ? 'text-tp-grafite hover:bg-white/60'
                    : 'text-tp-apagado'
              }`;

              return item.href ? (
                <Link key={item.rotulo} href={item.href} className={classe}>
                  {item.rotulo}
                </Link>
              ) : (
                <span key={item.rotulo} className={classe}>
                  {item.rotulo}
                </span>
              );
            })}
          </nav>
        </aside>

        <main className="min-w-0 flex-1">{children}</main>
      </div>

      <PainelDeChat />
    </div>
  );
}

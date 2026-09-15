import { PainelDeChat } from '@/components/chat/PainelDeChat';

/**
 * Pagina que simula o portal do cliente.
 *
 * Cenario, nao produto: estatica, sem funcionalidade, existe para dar contexto
 * visual ao painel de conversa. Layout proprio com a paleta da TotalPass, e
 * nao uma copia do portal deles.
 *
 * A tarja de simulacao e deliberada. Cliente vendo algo parecido com o proprio
 * portal tende a assumir que a integracao ja existe.
 */

const MENU = [
  { rotulo: 'Início', ativo: true },
  { rotulo: 'Beneficiários', ativo: false },
  { rotulo: 'Financeiro', ativo: false },
  { rotulo: 'Relatórios', ativo: false },
  { rotulo: 'Contrato', ativo: false },
  { rotulo: 'Ajuda', ativo: false },
];

const INDICADORES = [
  { rotulo: 'Colaboradores ativos', valor: '1.248', nota: '+32 no mês' },
  { rotulo: 'Dependentes', valor: '317', nota: '+8 no mês' },
  { rotulo: 'Check-ins no mês', valor: '4.902', nota: '61% de adesão' },
  { rotulo: 'Próximo faturamento', valor: '05/10', nota: 'Fee + coparticipação' },
];

const CARDS = [
  { titulo: 'Adicionar ou remover beneficiários', texto: 'Suba a base de colaboradores ativos e o sistema concilia as alterações para você aprovar.' },
  { titulo: 'Upgrade e downgrade de vidas', texto: 'Ajuste a quantidade contratada conforme o movimento do seu quadro.' },
  { titulo: 'Boletos e cobranças', texto: 'Acompanhe os boletos de fee e de coparticipação, e a situação de cada competência.' },
  { titulo: 'Divulgação do benefício', texto: 'Peças prontas para comunicar a TotalPass aos seus colaboradores.' },
];

export default function Portal() {
  return (
    <div className="min-h-dvh bg-tp-nevoa font-[family-name:var(--font-poppins)] text-tp-grafite">
      <p className="bg-tp-verde-claro px-4 py-1.5 text-center text-[11px] font-semibold tracking-wide text-tp-noite">
        DEMONSTRAÇÃO KLIENTE 360
      </p>

      <header className="sticky top-0 z-10 border-b border-tp-borda bg-tp-noite">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3.5">
          <span className="text-lg font-bold tracking-tight text-white">
            Total<span className="text-tp-verde">Pass</span>
          </span>
          <nav className="hidden gap-5 md:flex">
            {MENU.slice(0, 4).map((item) => (
              <span
                key={item.rotulo}
                className={`text-[13px] ${item.ativo ? 'font-semibold text-tp-verde' : 'text-white/70'}`}
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
            {MENU.map((item) => (
              <span
                key={item.rotulo}
                className={`rounded-lg px-3 py-2 text-[13px] ${
                  item.ativo ? 'bg-white font-semibold text-tp-noite shadow-sm' : 'text-tp-apagado'
                }`}
              >
                {item.rotulo}
              </span>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 flex-1">
          <h1 className="text-[22px] font-semibold text-tp-noite">Bom dia, Camila</h1>
          <p className="mt-1 text-[13px] text-tp-apagado">Aqui está o resumo do benefício na sua empresa.</p>

          <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {INDICADORES.map((i) => (
              <div key={i.rotulo} className="rounded-xl border border-tp-borda bg-white p-4">
                <p className="text-[11px] leading-tight text-tp-apagado">{i.rotulo}</p>
                <p className="mt-1.5 text-xl font-semibold text-tp-noite">{i.valor}</p>
                <p className="mt-0.5 text-[11px] text-tp-verde-escuro">{i.nota}</p>
              </div>
            ))}
          </section>

          <section className="mt-8">
            <h2 className="text-[15px] font-semibold text-tp-noite">Atalhos</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {CARDS.map((c) => (
                <article key={c.titulo} className="rounded-xl border border-tp-borda bg-white p-5">
                  <h3 className="text-[14px] font-semibold text-tp-noite">{c.titulo}</h3>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-tp-apagado">{c.texto}</p>
                  <span className="mt-3 inline-block rounded-full bg-tp-nevoa px-3 py-1 text-[11px] font-medium text-tp-grafite">
                    Acessar
                  </span>
                </article>
              ))}
            </div>
          </section>

          <section className="mt-8 rounded-xl border border-tp-borda bg-tp-noite p-6">
            <h2 className="text-[15px] font-semibold text-white">Dúvidas sobre o benefício?</h2>
            <p className="mt-1.5 max-w-lg text-[13px] leading-relaxed text-white/70">
              A Léts responde sobre planos, cadastro, cobrança e contrato — e abre um chamado quando
              precisar de alguém do time. Ela está no canto inferior direito da tela.
            </p>
          </section>
        </main>
      </div>

      <PainelDeChat />
    </div>
  );
}

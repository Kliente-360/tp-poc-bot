import { LayoutPortal } from '@/components/portal/LayoutPortal';

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
    <LayoutPortal ativo="Início">
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
    </LayoutPortal>
  );
}

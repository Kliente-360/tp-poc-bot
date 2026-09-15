import { LayoutPortal } from '@/components/portal/LayoutPortal';
import { criarStore } from '@/lib/conversation/criar-store';

/**
 * As duas metricas do MVP, e nenhuma alem.
 *
 * Renderizada no servidor, lendo o store direto: nao passa pela /api/metricas,
 * entao o token nao precisa existir no navegador.
 *
 * `force-dynamic` porque o numero muda a cada conversa — prerenderizar isto no
 * build entregaria um dashboard congelado no momento do deploy.
 */
export const dynamic = 'force-dynamic';

const dataHora = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

function Kpi({
  rotulo,
  valor,
  nota,
  destaque = false,
}: {
  rotulo: string;
  valor: string;
  nota: string;
  destaque?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        destaque ? 'border-tp-verde bg-tp-noite' : 'border-tp-borda bg-white'
      }`}
    >
      <p className={`text-[11px] leading-tight ${destaque ? 'text-white/60' : 'text-tp-apagado'}`}>
        {rotulo}
      </p>
      <p className={`mt-1.5 text-2xl font-semibold ${destaque ? 'text-tp-verde' : 'text-tp-noite'}`}>
        {valor}
      </p>
      <p className={`mt-0.5 text-[11px] ${destaque ? 'text-white/50' : 'text-tp-apagado'}`}>{nota}</p>
    </div>
  );
}

export default async function Metricas() {
  const tenantId = process.env.TENANT_ID ?? 'totalpass';
  const store = criarStore();

  const [metricas, naoRespondidas] = await Promise.all([
    store.calcularMetricas(tenantId),
    store.listarNaoRespondidas(tenantId),
  ]);

  const pct = Math.round(metricas.taxaDeDeflexao * 100);
  const recentes = [...naoRespondidas].sort((a, b) => b.registradaEm.localeCompare(a.registradaEm));

  return (
    <LayoutPortal ativo="Métricas MVP">
      <h1 className="text-[22px] font-semibold text-tp-noite">Métricas do assistente</h1>
      <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-tp-apagado">
        Duas medidas, com propósito definido. A deflexão diz o quanto o assistente resolve sozinho;
        as perguntas não respondidas são a fila de trabalho do time de conteúdo.
      </p>

      <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          rotulo="Taxa de deflexão"
          valor={`${pct}%`}
          nota="resolvido sem chamado"
          destaque
        />
        <Kpi rotulo="Conversas" valor={String(metricas.totalDeConversas)} nota="no total" />
        <Kpi
          rotulo="Chamados abertos"
          valor={String(metricas.conversasComChamado)}
          nota="foram para um atendente"
        />
        <Kpi
          rotulo="Perguntas sem resposta"
          valor={String(naoRespondidas.length)}
          nota="lacunas de conteúdo"
        />
      </section>

      {metricas.totalDeConversas > 0 && (
        <section className="mt-4 rounded-xl border border-tp-borda bg-white p-5">
          <div className="flex h-3 overflow-hidden rounded-full bg-tp-nevoa">
            <div className="bg-tp-verde" style={{ width: `${pct}%` }} />
            <div className="flex-1 bg-tp-grafite/25" />
          </div>
          <div className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1 text-[11.5px]">
            <span className="flex items-center gap-1.5">
              <i className="h-2 w-2 rounded-full bg-tp-verde" />
              {metricas.totalDeConversas - metricas.conversasComChamado} resolvidas pela Léts
            </span>
            <span className="flex items-center gap-1.5">
              <i className="h-2 w-2 rounded-full bg-tp-grafite/25" />
              {metricas.conversasComChamado} viraram chamado
            </span>
          </div>
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-[15px] font-semibold text-tp-noite">Perguntas que a base não cobriu</h2>
        <p className="mt-1 max-w-2xl text-[12.5px] leading-relaxed text-tp-apagado">
          Cada linha é uma pergunta real que ficou sem resposta. É o que a base precisa passar a
          responder — e, enquanto não responder, é o que vai continuar virando chamado.
        </p>

        {recentes.length === 0 ? (
          <div className="mt-3 rounded-xl border border-dashed border-tp-borda bg-white p-8 text-center">
            <p className="text-[13px] text-tp-apagado">
              Nenhuma lacuna registrada ainda. Toda vez que a Léts disser que não tem uma
              informação, a pergunta aparece aqui.
            </p>
          </div>
        ) : (
          <ul className="mt-3 divide-y divide-tp-borda overflow-hidden rounded-xl border border-tp-borda bg-white">
            {recentes.map((r, i) => (
              <li key={`${r.conversationId}-${i}`} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 p-4">
                <span className="min-w-0 flex-1 text-[13.5px] leading-snug text-tp-noite">
                  {r.pergunta}
                </span>
                <span className="text-[11px] text-tp-apagado">
                  {dataHora.format(new Date(r.registradaEm))}
                </span>
                <span
                  className="rounded-full bg-tp-nevoa px-2.5 py-0.5 text-[10.5px] text-tp-grafite"
                  title={
                    r.detectadaPeloServidor
                      ? 'A Léts se absteve mas não registrou; o servidor detectou pelo texto da resposta.'
                      : 'A Léts registrou explicitamente.'
                  }
                >
                  {r.detectadaPeloServidor ? 'detecção do servidor' : 'registro da Léts'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="mt-6 text-[11px] leading-relaxed text-tp-apagado">
        A deflexão é calculada na leitura, percorrendo as conversas — não há contador acumulado, que
        divergiria. Conversas ficam gravadas sem o conteúdo das mensagens: só contadores, artigos
        usados e se houve chamado.
      </p>
    </LayoutPortal>
  );
}

import Link from 'next/link';
import { LayoutPortal } from '@/components/portal/LayoutPortal';
import { agruparLacunas } from '@/lib/conversation/agrupar';
import { agruparPorSentido } from '@/lib/conversation/agrupar-semantico';
import { criarStore, persistenciaReal } from '@/lib/conversation/criar-store';
import { BundledSource } from '@/lib/kb/bundled-source';

/**
 * Metricas do assistente.
 *
 * Renderizada no servidor, lendo o store direto: nao passa pela /api/metricas,
 * entao o token nao precisa existir no navegador.
 *
 * `force-dynamic` porque o numero muda a cada conversa — prerenderizar isto no
 * build entregaria um dashboard congelado no momento do deploy.
 */
export const dynamic = 'force-dynamic';

const TOP_ARTIGOS = 5;

const dataHora = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

function Kpi({
  rotulo,
  valor,
  destaque = false,
}: {
  rotulo: string;
  valor: string;
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
    </div>
  );
}

function Vazio({ texto }: { texto: string }) {
  return (
    <div className="mt-3 rounded-xl border border-dashed border-tp-borda bg-white p-8 text-center">
      <p className="text-[13px] text-tp-apagado">{texto}</p>
    </div>
  );
}

export default async function Metricas({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const tenantId = process.env.TENANT_ID ?? 'totalpass';
  const agrupar = (await searchParams).agrupar === '1';

  const [metricas, naoRespondidas, artigos] = await Promise.all([
    criarStore().calcularMetricas(tenantId),
    criarStore().listarNaoRespondidas(tenantId),
    new BundledSource().listarArtigos(),
  ]);

  const titulos = new Map(artigos.map((a) => [a.id, a]));
  const ranking = metricas.artigosMaisUsados.slice(0, TOP_ARTIGOS);
  const maior = ranking[0]?.consultas ?? 1;
  const porTexto = agruparLacunas(naoRespondidas);
  const lacunas = agrupar ? await agruparPorSentido(porTexto) : porTexto;

  return (
    <LayoutPortal ativo="Métricas MVP">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="flex-1 text-[22px] font-semibold text-tp-noite">
          Métricas de performance da Léts
        </h1>
        {/* Link e nao botao: `force-dynamic` ja rebusca tudo a cada navegacao,
            e o `t` garante rota nova quando se clica estando na mesma URL.
            Sem JavaScript no cliente, sem token no navegador. */}
        <Link
          href={{ pathname: '/metricas', query: { agrupar: '1', t: Date.now() } }}
          prefetch={false}
          className="flex shrink-0 items-center gap-2 rounded-full bg-tp-noite px-4 py-2 text-[12.5px] font-medium text-white transition-colors hover:bg-tp-verde-escuro"
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" aria-hidden="true">
            <path
              d="M20 11A8 8 0 1 0 18 16.5M20 5v6h-6"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Atualizar e agrupar
        </Link>
      </div>

      {!persistenciaReal() && (
        <p className="mt-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-[12.5px] leading-relaxed text-amber-900">
          <strong>Sem persistência neste ambiente.</strong> As conversas estão em memória e somem no
          próximo reinício — é o que acontece com <code>next dev</code>. Para medir de verdade, use{' '}
          <code>netlify dev</code> ou o site publicado.
        </p>
      )}

      <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi rotulo="Taxa de deflexão" valor={`${Math.round(metricas.taxaDeDeflexao * 100)}%`} destaque />
        <Kpi rotulo="Conversas" valor={String(metricas.totalDeConversas)} />
        <Kpi rotulo="Chamados abertos" valor={String(metricas.conversasComChamado)} />
        <Kpi rotulo="Perguntas sem resposta" valor={String(naoRespondidas.length)} />
      </section>

      <section className="mt-10">
        <h2 className="text-[15px] font-semibold text-tp-noite">Artigos mais consultados pela IA</h2>

        {ranking.length === 0 ? (
          <Vazio texto="Nenhuma resposta sustentada por artigo ainda." />
        ) : (
          <ol className="mt-3 divide-y divide-tp-borda overflow-hidden rounded-xl border border-tp-borda bg-white">
            {ranking.map((item, i) => {
              const artigo = titulos.get(item.id);
              return (
                <li key={item.id} className="flex items-center gap-4 p-4">
                  <span className="w-4 shrink-0 text-[13px] font-semibold text-tp-apagado">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] text-tp-noite">
                      {artigo?.titulo ?? item.id}
                    </p>
                    <p className="mt-0.5 text-[11px] text-tp-apagado">
                      {artigo ? `${artigo.categoria} › ${artigo.secao}` : 'artigo fora da base atual'}
                    </p>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-tp-nevoa">
                      <div
                        className="h-full rounded-full bg-tp-verde"
                        style={{ width: `${Math.round((item.consultas / maior) * 100)}%` }}
                      />
                    </div>
                  </div>
                  <span className="shrink-0 text-right text-[13px] font-semibold text-tp-noite">
                    {item.consultas}
                    <span className="ml-1 text-[10.5px] font-normal text-tp-apagado">
                      {item.consultas === 1 ? 'uso' : 'usos'}
                    </span>
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <section className="mt-10">
        <div className="flex flex-wrap items-baseline gap-x-3">
          <h2 className="text-[15px] font-semibold text-tp-noite">Perguntas que a base não cobriu</h2>
          {agrupar && lacunas.length > 0 && (
            <span className="rounded-full bg-tp-verde/15 px-2.5 py-0.5 text-[10.5px] font-medium text-tp-verde-escuro">
              agrupadas por sentido
            </span>
          )}
        </div>

        {lacunas.length === 0 ? (
          <Vazio texto="Nenhuma lacuna registrada ainda." />
        ) : (
          <ul className="mt-3 divide-y divide-tp-borda overflow-hidden rounded-xl border border-tp-borda bg-white">
            {lacunas.map((l) => (
              <li key={l.pergunta + l.ultimaEm} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 p-4">
                {l.vezes > 1 && (
                  <span className="shrink-0 rounded-full bg-tp-verde px-2 py-0.5 text-[11px] font-semibold text-tp-noite">
                    {l.vezes}×
                  </span>
                )}
                <span className="min-w-0 flex-1 text-[13.5px] leading-snug text-tp-noite">
                  {l.pergunta}
                </span>
                <span className="shrink-0 text-[11px] text-tp-apagado">
                  {dataHora.format(new Date(l.ultimaEm))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </LayoutPortal>
  );
}

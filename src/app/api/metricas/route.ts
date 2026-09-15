import { agruparLacunas } from '@/lib/conversation/agrupar';
import { criarStore } from '@/lib/conversation/criar-store';
import { BundledSource } from '@/lib/kb/bundled-source';

export const runtime = 'edge';

/**
 * As duas metricas do MVP, e nenhuma alem: taxa de deflexao e perguntas nao
 * respondidas. Sem CSAT, sem thumbs, sem painel.
 *
 * Protegido por token. As perguntas nao respondidas sao texto digitado por
 * usuario: podem conter nome, e-mail, numero de contrato. Um endpoint publico
 * que devolve isso e vazamento, ainda que de piloto. Sem METRICS_TOKEN
 * configurado o endpoint nao abre — falhar fechado, e nao aberto.
 */
export async function GET(request: Request): Promise<Response> {
  const esperado = process.env.METRICS_TOKEN;

  if (!esperado) {
    return Response.json(
      { erro: 'METRICS_TOKEN não configurado no servidor — endpoint desativado.' },
      { status: 503 },
    );
  }

  const enviado = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (enviado !== esperado) {
    return Response.json({ erro: 'não autorizado' }, { status: 401 });
  }

  const tenantId = process.env.TENANT_ID ?? 'totalpass';
  const store = criarStore();

  const url = new URL(request.url);
  const dia = url.searchParams.get('dia') ?? undefined;

  try {
    const [metricas, naoRespondidas, artigos] = await Promise.all([
      store.calcularMetricas(tenantId),
      store.listarNaoRespondidas(tenantId, dia),
      new BundledSource().listarArtigos(),
    ]);

    const titulos = new Map(artigos.map((a) => [a.id, a]));

    return Response.json({
      tenant: tenantId,
      deflexao: {
        total: metricas.totalDeConversas,
        comChamado: metricas.conversasComChamado,
        semChamado: metricas.totalDeConversas - metricas.conversasComChamado,
        taxa: Number(metricas.taxaDeDeflexao.toFixed(4)),
      },
      artigosMaisConsultados: metricas.artigosMaisUsados.map((a) => ({
        id: a.id,
        titulo: titulos.get(a.id)?.titulo ?? null,
        categoria: titulos.get(a.id)?.categoria ?? null,
        consultas: a.consultas,
      })),
      naoRespondidas: {
        registros: naoRespondidas.length,
        distintas: agruparLacunas(naoRespondidas).length,
        // Agrupadas por forma normalizada, da mais repetida para a menos.
        // Isso junta a mesma frase escrita de formas diferentes, nao a mesma
        // duvida escrita com outras palavras — ver src/lib/conversation/agrupar.ts.
        perguntas: agruparLacunas(naoRespondidas).map((l) => ({
          pergunta: l.pergunta,
          vezes: l.vezes,
          ultimaEm: l.ultimaEm,
          conversas: l.conversas,
        })),
      },
    });
  } catch (erro) {
    console.error('[metricas] falhou', erro);
    return Response.json({ erro: 'não consegui ler as métricas' }, { status: 500 });
  }
}

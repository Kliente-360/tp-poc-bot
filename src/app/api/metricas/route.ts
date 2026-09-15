import { criarStore } from '@/lib/conversation/criar-store';

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
    const [metricas, naoRespondidas] = await Promise.all([
      store.calcularMetricas(tenantId),
      store.listarNaoRespondidas(tenantId, dia),
    ]);

    return Response.json({
      tenant: tenantId,
      deflexao: {
        total: metricas.totalDeConversas,
        comChamado: metricas.conversasComChamado,
        semChamado: metricas.totalDeConversas - metricas.conversasComChamado,
        taxa: Number(metricas.taxaDeDeflexao.toFixed(4)),
      },
      naoRespondidas: {
        total: naoRespondidas.length,
        // Mais recentes primeiro: esta lista e lida como fila de trabalho de
        // conteudo, e o que chegou hoje importa mais que o do mes passado.
        perguntas: naoRespondidas
          .sort((a, b) => b.registradaEm.localeCompare(a.registradaEm))
          .map((r) => ({
            pergunta: r.pergunta,
            quando: r.registradaEm,
            conversa: r.conversationId,
            origem: r.detectadaPeloServidor ? 'detecção do servidor' : 'ferramenta',
          })),
      },
    });
  } catch (erro) {
    console.error('[metricas] falhou', erro);
    return Response.json({ erro: 'não consegui ler as métricas' }, { status: 500 });
  }
}

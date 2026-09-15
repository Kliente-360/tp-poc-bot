import {
  chaveDaConversa,
  chaveDasNaoRespondidas,
  type Conversa,
  type ConversationStore,
  type Metricas,
  type PerguntaNaoRespondida,
} from './types.js';

/**
 * Implementacao em memoria, para scripts e testes.
 *
 * Existe desde a etapa 3 para que o motor de conversa nunca conheca o
 * armazenamento. Na etapa 6 entra a `BlobStore` com a mesma interface, e nada
 * no motor muda.
 */
export class InMemoryStore implements ConversationStore {
  private conversas = new Map<string, Conversa>();
  private naoRespondidas = new Map<string, PerguntaNaoRespondida[]>();

  async carregar(tenantId: string, id: string): Promise<Conversa | null> {
    return this.conversas.get(chaveDaConversa(tenantId, id)) ?? null;
  }

  async salvar(conversa: Conversa): Promise<void> {
    this.conversas.set(chaveDaConversa(conversa.tenantId, conversa.id), { ...conversa });
  }

  async registrarNaoRespondida(tenantId: string, registro: PerguntaNaoRespondida): Promise<void> {
    const chave = chaveDasNaoRespondidas(tenantId, registro.registradaEm.slice(0, 10));
    const doDia = this.naoRespondidas.get(chave) ?? [];

    // A tool e a deteccao do servidor podem disparar no mesmo turno.
    const jaTem = doDia.some(
      (r) => r.conversationId === registro.conversationId && r.pergunta === registro.pergunta,
    );
    if (jaTem) return;

    doDia.push(registro);
    this.naoRespondidas.set(chave, doDia);
  }

  async listarNaoRespondidas(tenantId: string, dia?: string): Promise<PerguntaNaoRespondida[]> {
    const prefixo = dia ? chaveDasNaoRespondidas(tenantId, dia) : `${tenantId}/unanswered/`;
    return [...this.naoRespondidas.entries()]
      .filter(([chave]) => chave.startsWith(prefixo))
      .flatMap(([, registros]) => registros);
  }

  async calcularMetricas(tenantId: string): Promise<Metricas> {
    const daOrg = [...this.conversas.values()].filter((c) => c.tenantId === tenantId);
    const comChamado = daOrg.filter((c) => c.abriuCaso).length;

    return {
      totalDeConversas: daOrg.length,
      conversasComChamado: comChamado,
      taxaDeDeflexao: daOrg.length === 0 ? 0 : (daOrg.length - comChamado) / daOrg.length,
    };
  }
}

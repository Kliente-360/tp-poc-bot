/**
 * Estado da conversa e persistencia.
 *
 * Decisao de produto: nao gravamos as mensagens. O que fica registrado e
 * metadado — contadores, ids de artigo, se abriu chamado — e as perguntas que a
 * base nao cobriu, que sao o insumo de conteudo do cliente. Sem transcript.
 *
 * Consequencia arquitetural: o historico da conversa vive no cliente e vem na
 * requisicao. Isso significa que um cliente malicioso pode forjar turnos
 * anteriores. Aceitavel no piloto — a superficie e uma base publica de FAQ e a
 * abertura de chamado, que ja tem rate limit e e-mail autodeclarado. Deixa de
 * ser aceitavel no dia em que a identidade virar `verified` e houver dado de
 * verdade atras dela.
 */

export type NivelDeIdentidade = 'unverified' | 'verified';

export interface Identidade {
  nivel: NivelDeIdentidade;
  email?: string;
  contactId?: string;
}

export interface Conversa {
  id: string;
  tenantId: string;
  iniciadaEm: string;
  ultimoTurnoEm: string;
  turnos: number;
  /** Um array de ids por resposta. Sem citacao visivel, este e o unico rastro. */
  artigosUsados: string[][];
  abriuCaso: boolean;
  numeroCaso: string | null;
  /** No MVP so existe 'unverified'. Ver secao 7.3 da especificacao. */
  identidade: Identidade;
}

export interface PerguntaNaoRespondida {
  pergunta: string;
  conversationId: string;
  registradaEm: string;
  /** true quando veio da deteccao do servidor, e nao da tool. */
  detectadaPeloServidor: boolean;
  /**
   * `lacuna`: assunto da TotalPass que a base nao cobre — vira roadmap de conteudo.
   * `fora_de_escopo`: assunto que nao e da TotalPass — vira leitura de expectativa.
   *
   * Ausente nos registros gravados antes desta distincao existir; trate como `lacuna`.
   */
  motivo?: 'lacuna' | 'fora_de_escopo';
}

export interface Metricas {
  totalDeConversas: number;
  conversasComChamado: number;
  /** Conversas encerradas sem abertura de chamado, sobre o total. */
  taxaDeDeflexao: number;
  /**
   * Quantas vezes cada artigo sustentou uma resposta, da mais para a menos.
   *
   * Conta por resposta, nao por conversa: o artigo consultado em cinco turnos
   * de uma mesma conversa foi util cinco vezes.
   */
  artigosMaisUsados: Array<{ id: string; consultas: number }>;
}

/** Percorre as conversas e conta uso de artigo. Compartilhado pelas duas stores. */
export function apurar(conversas: Conversa[]): Metricas {
  const comChamado = conversas.filter((c) => c.abriuCaso).length;
  const contagem = new Map<string, number>();

  for (const conversa of conversas) {
    for (const daResposta of conversa.artigosUsados) {
      for (const id of daResposta) contagem.set(id, (contagem.get(id) ?? 0) + 1);
    }
  }

  return {
    totalDeConversas: conversas.length,
    conversasComChamado: comChamado,
    taxaDeDeflexao: conversas.length === 0 ? 0 : (conversas.length - comChamado) / conversas.length,
    artigosMaisUsados: [...contagem.entries()]
      .map(([id, consultas]) => ({ id, consultas }))
      .sort((a, b) => b.consultas - a.consultas || a.id.localeCompare(b.id)),
  };
}

export interface ConversationStore {
  carregar(tenantId: string, id: string): Promise<Conversa | null>;
  /** Uma escrita por turno, sobrescrevendo a chave. Nunca uma por mensagem. */
  salvar(conversa: Conversa): Promise<void>;
  registrarNaoRespondida(tenantId: string, registro: PerguntaNaoRespondida): Promise<void>;
  listarNaoRespondidas(tenantId: string, dia?: string): Promise<PerguntaNaoRespondida[]>;
  /** Derivada na leitura. Contador incremental diverge e nao se justifica neste volume. */
  calcularMetricas(tenantId: string): Promise<Metricas>;
}

export function novaConversa(tenantId: string, id: string): Conversa {
  const agora = new Date().toISOString();
  return {
    id,
    tenantId,
    iniciadaEm: agora,
    ultimoTurnoEm: agora,
    turnos: 0,
    artigosUsados: [],
    abriuCaso: false,
    numeroCaso: null,
    identidade: { nivel: 'unverified' },
  };
}

/** Toda chave de persistencia leva o tenant. Trivial agora, retrofit chato depois. */
export function chaveDaConversa(tenantId: string, id: string): string {
  return `${tenantId}/${id}`;
}

export function chaveDasNaoRespondidas(tenantId: string, dia: string): string {
  return `${tenantId}/unanswered/${dia}`;
}

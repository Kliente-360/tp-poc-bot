import { getStore, type Store } from '@netlify/blobs';
import {
  chaveDaConversa,
  chaveDasNaoRespondidas,
  type Conversa,
  type ConversationStore,
  type Metricas,
  type PerguntaNaoRespondida,
} from './types';

/**
 * Persistencia em Netlify Blobs.
 *
 * Sem banco, sem migrations, sem conta extra: os Blobs vem com a plataforma e
 * funcionam em edge runtime. Nao da para gravar em arquivo local — edge nao tem
 * disco persistente e cada requisicao pode cair numa instancia diferente.
 *
 * Toda chave leva o tenant na frente. O produto vai ser reaproveitado em outros
 * clientes, e isso e trivial agora e retrofit chato depois.
 */
export class BlobStore implements ConversationStore {
  private _conversas: Store | null = null;
  private _metricas: Store | null = null;

  /** Preguicoso: getStore() precisa do contexto do runtime, ausente no build. */
  private get conversas(): Store {
    this._conversas ??= getStore('conversations');
    return this._conversas;
  }

  private get metricas(): Store {
    this._metricas ??= getStore('metrics');
    return this._metricas;
  }

  async carregar(tenantId: string, id: string): Promise<Conversa | null> {
    return (await this.conversas.get(chaveDaConversa(tenantId, id), {
      type: 'json',
    })) as Conversa | null;
  }

  /** Uma escrita por turno, sobrescrevendo a chave. Nunca uma por mensagem. */
  async salvar(conversa: Conversa): Promise<void> {
    await this.conversas.setJSON(chaveDaConversa(conversa.tenantId, conversa.id), conversa);
  }

  /**
   * Leitura e escrita do dia inteiro, nao so do registro novo.
   *
   * Duas requisicoes simultaneas podem se sobrescrever e perder um registro.
   * Blobs nao tem append nem transacao, e o volume de piloto nao justifica uma
   * chave por registro. Perder uma pergunta da lista de conteudo e um custo
   * aceitavel; perder uma conversa nao seria.
   */
  async registrarNaoRespondida(tenantId: string, registro: PerguntaNaoRespondida): Promise<void> {
    const chave = chaveDasNaoRespondidas(tenantId, registro.registradaEm.slice(0, 10));
    const doDia = ((await this.metricas.get(chave, { type: 'json' })) ?? []) as PerguntaNaoRespondida[];

    // A tool e a deteccao do servidor podem disparar no mesmo turno.
    const jaTem = doDia.some(
      (r) => r.conversationId === registro.conversationId && r.pergunta === registro.pergunta,
    );
    if (jaTem) return;

    doDia.push(registro);
    await this.metricas.setJSON(chave, doDia);
  }

  async listarNaoRespondidas(tenantId: string, dia?: string): Promise<PerguntaNaoRespondida[]> {
    if (dia) {
      return ((await this.metricas.get(chaveDasNaoRespondidas(tenantId, dia), {
        type: 'json',
      })) ?? []) as PerguntaNaoRespondida[];
    }

    const { blobs } = await this.metricas.list({ prefix: `${tenantId}/unanswered/` });
    const dias = await Promise.all(
      blobs.map((b) => this.metricas.get(b.key, { type: 'json' }) as Promise<PerguntaNaoRespondida[] | null>),
    );

    return dias.flatMap((d) => d ?? []);
  }

  /**
   * Derivada na leitura: varre as conversas e conta as que nao geraram chamado.
   *
   * Contador incremental produz divergencia e nao se justifica neste volume.
   * O custo e uma leitura por conversa — adequado para piloto, e o gatilho para
   * migrar a implementacao e esta varredura ficar lenta, nao um numero fixo.
   */
  async calcularMetricas(tenantId: string): Promise<Metricas> {
    const { blobs } = await this.conversas.list({ prefix: `${tenantId}/` });
    const conversas = await Promise.all(
      blobs.map((b) => this.conversas.get(b.key, { type: 'json' }) as Promise<Conversa | null>),
    );

    const validas = conversas.filter((c): c is Conversa => c !== null);
    const comChamado = validas.filter((c) => c.abriuCaso).length;

    return {
      totalDeConversas: validas.length,
      conversasComChamado: comChamado,
      taxaDeDeflexao: validas.length === 0 ? 0 : (validas.length - comChamado) / validas.length,
    };
  }
}

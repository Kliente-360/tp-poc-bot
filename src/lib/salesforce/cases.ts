import { SalesforceApiError, type SalesforceClient } from './client';

/** Valor do canal na picklist `Origin`. Configuravel: nem toda org tem `Webchat`. */
export const DEFAULT_CASE_ORIGIN = 'Webchat';

export interface AberturaDeCaso {
  /** Resumo gerado pelo assistente. */
  assunto: string;
  /** Descricao do problema, incluindo resumo do contexto da conversa. */
  descricao: string;
  /** E-mail informado pelo usuario e confirmado por ele. Nunca verificado de fato. */
  email: string;
  /** Correlaciona o chamado com a conversa gravada do nosso lado. */
  conversationId: string;
}

export interface CasoCriado {
  id: string;
  numero: string;
  /** Campos customizados que a org recusou e foram omitidos. Vazio no caminho feliz. */
  camposOmitidos: string[];
}

export interface CaseServiceConfig {
  origin?: string;
  /**
   * Nomes de API dos campos customizados. Todo campo alem dos padrao e opcional:
   * se a org nao tiver, o caso e criado sem ele e o sistema registra um aviso,
   * em vez de falhar a abertura do chamado.
   */
  campoConversationId?: string | null;
  campoIdentidadeVerificada?: string | null;
  onAviso?: (mensagem: string) => void;
}

/** Erros que significam "esse campo nao existe ou nao e gravavel nessa org". */
const ERROS_DE_CAMPO = new Set([
  'INVALID_FIELD',
  'INVALID_FIELD_FOR_INSERT_UPDATE',
  'FIELD_INTEGRITY_EXCEPTION',
]);

export class CaseService {
  private readonly origin: string;
  private readonly campoConversationId: string | null;
  private readonly campoIdentidadeVerificada: string | null;
  private readonly aviso: (mensagem: string) => void;

  constructor(
    private readonly client: SalesforceClient,
    config: CaseServiceConfig = {},
  ) {
    this.origin = config.origin ?? DEFAULT_CASE_ORIGIN;
    this.campoConversationId = config.campoConversationId ?? null;
    this.campoIdentidadeVerificada = config.campoIdentidadeVerificada ?? null;
    this.aviso = config.onAviso ?? ((m) => console.warn(`[salesforce] ${m}`));
  }

  async abrirCaso(input: AberturaDeCaso): Promise<CasoCriado> {
    const payload: Record<string, unknown> = {
      Origin: this.origin,
      Subject: input.assunto,
      Description: input.descricao,
      SuppliedEmail: input.email,
    };

    if (this.campoConversationId) payload[this.campoConversationId] = input.conversationId;
    if (this.campoIdentidadeVerificada) payload[this.campoIdentidadeVerificada] = false;

    const { id, camposOmitidos } = await this.criarComDegradacao(payload);
    const numero = await this.lerNumero(id);

    return { id, numero, camposOmitidos };
  }

  /**
   * Tenta criar o caso. Se a org recusar um campo customizado, remove o campo
   * e tenta de novo — uma vez por campo problematico. Chamado aberto sem
   * metadado e muito melhor que chamado nao aberto.
   */
  private async criarComDegradacao(
    payload: Record<string, unknown>,
  ): Promise<{ id: string; camposOmitidos: string[] }> {
    const omitidos: string[] = [];
    const tentativa = { ...payload };
    const camposOpcionais = [this.campoConversationId, this.campoIdentidadeVerificada].filter(
      (f): f is string => Boolean(f),
    );

    for (let i = 0; i <= camposOpcionais.length; i++) {
      try {
        const res = await this.client.request<{ id: string }>('/sobjects/Case', {
          method: 'POST',
          body: JSON.stringify(tentativa),
        });
        return { id: res.id, camposOmitidos: omitidos };
      } catch (erro) {
        const culpados = this.camposCulpados(erro, camposOpcionais, tentativa);
        if (culpados.length === 0) throw erro;

        for (const campo of culpados) {
          delete tentativa[campo];
          omitidos.push(campo);
          this.aviso(
            `campo "${campo}" nao existe ou nao e gravavel nesta org — caso criado sem ele.`,
          );
        }
      }
    }

    throw new Error('nao foi possivel criar o caso mesmo apos remover os campos opcionais');
  }

  /** Extrai do erro quais campos opcionais ainda presentes no payload foram recusados. */
  private camposCulpados(
    erro: unknown,
    opcionais: string[],
    payload: Record<string, unknown>,
  ): string[] {
    if (!(erro instanceof SalesforceApiError)) return [];
    if (!erro.errorCodes.some((c) => ERROS_DE_CAMPO.has(c))) return [];

    const presentes = opcionais.filter((c) => c in payload);
    const porFields = erro.offendingFields.filter((f) => presentes.includes(f));
    if (porFields.length > 0) return porFields;

    // Campo inexistente volta como "No such column 'X'", sem preencher `fields`.
    return presentes.filter((c) => erro.message.includes(c));
  }

  private async lerNumero(id: string): Promise<string> {
    const res = await this.client.request<{ records: Array<{ CaseNumber: string }> }>(
      `/query?q=${encodeURIComponent(`SELECT CaseNumber FROM Case WHERE Id = '${id}'`)}`,
    );
    return res.records[0]?.CaseNumber ?? '';
  }

  /**
   * Comentario interno no chamado. Fora do MVP como transcript (decisao de produto:
   * o contexto vai resumido no Description), mas o caminho fica pronto e validado.
   */
  async adicionarComentarioInterno(caseId: string, corpo: string): Promise<string> {
    const res = await this.client.request<{ id: string }>('/sobjects/CaseComment', {
      method: 'POST',
      body: JSON.stringify({ ParentId: caseId, CommentBody: corpo, IsPublished: false }),
    });
    return res.id;
  }
}

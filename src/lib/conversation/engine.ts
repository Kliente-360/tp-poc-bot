import Anthropic from '@anthropic-ai/sdk';
import type { KnowledgeSource } from '../kb/types.js';
import { MODELO, montarSystemPrompt } from '../prompt/system-prompt.js';
import { TOOLS, type EntradaAbrirCaso, type EntradaRegistrarNaoRespondida } from './tools.js';
import { novaConversa, type Conversa, type ConversationStore } from './types.js';

/**
 * O motor nao conhece o Salesforce. Depende so disto, para que a bateria de
 * testes rode sem abrir chamado de verdade na org do cliente.
 */
export interface AbridorDeCaso {
  abrir(entrada: EntradaAbrirCaso & { conversationId: string }): Promise<{ numero: string }>;
}

export interface Turno {
  /** Texto para a tela, ja sem a linha de registro interno. */
  resposta: string;
  artigosUsados: string[];
  abriuCaso: boolean;
  numeroCaso: string | null;
  registrouNaoRespondida: boolean;
  /** true quando quem registrou foi o servidor, e nao o modelo. */
  deteccaoDoServidor: boolean;
  uso: { entrada: number; escritaDeCache: number; leituraDeCache: number; saida: number };
}

/**
 * A linha de registro interno. Nunca chega ao navegador.
 *
 * Global e sem ancora no inicio de proposito: quando ha tool use o modelo
 * produz mais de um bloco de texto, e o marcador pode cair em qualquer um
 * deles. Ancorar no inicio perdia o registro em todo turno com ferramenta.
 */
const LINHA_DE_ARTIGOS = /<artigos>([\s\S]*?)<\/artigos>/g;

/**
 * Rede de seguranca da metrica de perguntas nao respondidas.
 *
 * A tool e o caminho principal, mas depender do modelo lembrar de chama-la
 * significa que toda abstencao esquecida some da metrica — e essa metrica e o
 * roadmap de conteudo do cliente. Isto aqui pega o que escapar.
 *
 * Casar frase e frágil por natureza: sempre havera uma formulacao nova que
 * escapa. O que torna isso aceitavel e a guarda de `artigosUsados` vazio, que
 * quase elimina falso positivo — resposta com artigo por tras nunca e
 * abstencao, por mais que a frase pareca. Por isso a lista pode ser generosa.
 * Um falso negativo custa uma linha de metrica; um falso positivo sujaria o
 * roadmap de conteudo do cliente com pergunta que a base ja responde.
 */
const SINAIS_DE_ABSTENCAO = [
  /n[ãa]o (tenho|encontrei|achei|localizei)\b[^.!?]{0,40}\b(informa[çc][ãa]o|dado|detalhe|resposta)/i,
  /n[ãa]o (est[áa]|consta|tenho)\b[^.!?]{0,30}\b(na (minha )?base|no meu material|aqui comigo)/i,
  /n[ãa]o (consigo|posso)\s+(te\s+)?(responder|informar|confirmar|dizer)/i,
  /n[ãa]o sei\s+(te\s+)?(dizer|informar|responder)/i,
  /(isso|essa|esse)\b[^.!?]{0,25}\bn[ãa]o (tenho|sei|est[áa])/i,
  /(foge|fora)\s+d[oa]\s+que\s+(eu\s+)?tenho/i,
];

export interface ConfigDoMotor {
  tenantId: string;
  knowledge: KnowledgeSource;
  store: ConversationStore;
  casos: AbridorDeCaso;
  client?: Anthropic;
  /** Alavanca de custo e qualidade. Padrao alto: disciplina de abstencao e o que importa aqui. */
  effort?: 'low' | 'medium' | 'high' | 'xhigh' | 'max';
}

export class MotorDeConversa {
  private readonly client: Anthropic;
  private system: Anthropic.TextBlockParam[] | null = null;

  constructor(private readonly config: ConfigDoMotor) {
    this.client = config.client ?? new Anthropic();
  }

  /** Carrega a base uma vez por processo. Sem leitura de disco por requisicao. */
  private async systemPrompt(): Promise<Anthropic.TextBlockParam[]> {
    this.system ??= montarSystemPrompt(await this.config.knowledge.listarArtigos());
    return this.system;
  }

  async responder(
    conversationId: string,
    historico: Anthropic.MessageParam[],
    pergunta: string,
  ): Promise<{ turno: Turno; mensagens: Anthropic.MessageParam[]; conversa: Conversa }> {
    const { tenantId, store } = this.config;
    const conversa =
      (await store.carregar(tenantId, conversationId)) ?? novaConversa(tenantId, conversationId);

    const mensagens: Anthropic.MessageParam[] = [...historico, { role: 'user', content: pergunta }];
    const turno: Turno = {
      resposta: '',
      artigosUsados: [],
      abriuCaso: false,
      numeroCaso: null,
      registrouNaoRespondida: false,
      deteccaoDoServidor: false,
      uso: { entrada: 0, escritaDeCache: 0, leituraDeCache: 0, saida: 0 },
    };

    // Laco de tool use. Para quando o modelo devolve texto sem pedir ferramenta.
    for (let volta = 0; volta < 6; volta++) {
      const resposta = await this.client.messages.create({
        model: MODELO,
        max_tokens: 4096,
        system: await this.systemPrompt(),
        tools: TOOLS,
        messages: mensagens,
        ...(this.config.effort ? { output_config: { effort: this.config.effort } } : {}),
      });

      turno.uso.entrada += resposta.usage.input_tokens;
      turno.uso.saida += resposta.usage.output_tokens;
      turno.uso.escritaDeCache += resposta.usage.cache_creation_input_tokens ?? 0;
      turno.uso.leituraDeCache += resposta.usage.cache_read_input_tokens ?? 0;

      mensagens.push({ role: 'assistant', content: resposta.content });

      // Acumula: o modelo costuma escrever antes de chamar a tool e depois de
      // receber o resultado. Sobrescrever perde a primeira metade da resposta.
      const texto = resposta.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('');
      if (texto) turno.resposta = turno.resposta ? `${turno.resposta}\n\n${texto}` : texto;

      const chamadas = resposta.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
      );
      if (resposta.stop_reason !== 'tool_use' || chamadas.length === 0) break;

      // Todos os tool_result voltam numa unica mensagem de usuario.
      const resultados: Anthropic.ToolResultBlockParam[] = [];
      for (const chamada of chamadas) {
        resultados.push(await this.executar(chamada, conversa, turno));
      }
      mensagens.push({ role: 'user', content: resultados });
    }

    this.extrairArtigos(turno);
    await this.redeDeSeguranca(turno, conversa, pergunta);

    conversa.turnos += 1;
    conversa.ultimoTurnoEm = new Date().toISOString();
    conversa.artigosUsados.push(turno.artigosUsados);
    await store.salvar(conversa);

    return { turno, mensagens, conversa };
  }

  private async executar(
    chamada: Anthropic.ToolUseBlock,
    conversa: Conversa,
    turno: Turno,
  ): Promise<Anthropic.ToolResultBlockParam> {
    const { tenantId, store, casos } = this.config;

    try {
      if (chamada.name === 'abrir_caso') {
        const entrada = chamada.input as EntradaAbrirCaso;
        const { numero } = await casos.abrir({ ...entrada, conversationId: conversa.id });

        conversa.abriuCaso = true;
        conversa.numeroCaso = numero;
        conversa.identidade = { ...conversa.identidade, email: entrada.email };
        turno.abriuCaso = true;
        turno.numeroCaso = numero;

        return { type: 'tool_result', tool_use_id: chamada.id, content: `Chamado ${numero} aberto.` };
      }

      if (chamada.name === 'registrar_nao_respondida') {
        const { pergunta } = chamada.input as EntradaRegistrarNaoRespondida;
        await store.registrarNaoRespondida(tenantId, {
          pergunta,
          conversationId: conversa.id,
          registradaEm: new Date().toISOString(),
          detectadaPeloServidor: false,
        });
        turno.registrouNaoRespondida = true;

        return { type: 'tool_result', tool_use_id: chamada.id, content: 'Registrado.' };
      }

      throw new Error(`ferramenta desconhecida: ${chamada.name}`);
    } catch (erro) {
      // O modelo precisa saber que falhou, para avisar a pessoa em vez de
      // afirmar que o chamado foi aberto.
      return {
        type: 'tool_result',
        tool_use_id: chamada.id,
        content: `Falhou: ${erro instanceof Error ? erro.message : String(erro)}`,
        is_error: true,
      };
    }
  }

  /** Separa a linha de registro interno do texto que vai para a tela. */
  private extrairArtigos(turno: Turno): void {
    const ids = new Set<string>();

    for (const [, lista] of turno.resposta.matchAll(LINHA_DE_ARTIGOS)) {
      for (const id of (lista ?? '').split(',')) {
        const limpo = id.trim();
        if (limpo.length > 0) ids.add(limpo);
      }
    }

    turno.artigosUsados = [...ids];
    turno.resposta = turno.resposta.replace(LINHA_DE_ARTIGOS, '').replace(/\n{3,}/g, '\n\n').trim();
  }

  private async redeDeSeguranca(turno: Turno, conversa: Conversa, pergunta: string): Promise<void> {
    if (turno.registrouNaoRespondida) return;

    const pareceAbstencao = SINAIS_DE_ABSTENCAO.some((s) => s.test(turno.resposta));
    // Sem artigo por tras e com linguagem de abstencao: o modelo se absteve e
    // esqueceu de chamar a tool.
    if (!pareceAbstencao || turno.artigosUsados.length > 0) return;

    await this.config.store.registrarNaoRespondida(this.config.tenantId, {
      pergunta,
      conversationId: conversa.id,
      registradaEm: new Date().toISOString(),
      detectadaPeloServidor: true,
    });
    turno.registrouNaoRespondida = true;
    turno.deteccaoDoServidor = true;
  }
}

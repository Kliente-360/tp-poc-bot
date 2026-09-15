import type Anthropic from '@anthropic-ai/sdk';
import { MotorDeConversa } from '@/lib/conversation/engine';
import { criarStore, persistenciaReal } from '@/lib/conversation/criar-store';
import { comLimiteDeChamados } from '@/lib/conversation/limite-de-chamados';
import { BlobLimitador, MemoriaLimitador, ipDaRequisicao, type Limitador } from '@/lib/rate-limit';
import { BundledSource } from '@/lib/kb/bundled-source';
import { criarAbridorSalesforce } from '@/lib/salesforce/case-adapter';

/**
 * Edge runtime, e nao por gosto: funcao sincrona no Netlify tem timeout de 10
 * segundos, e uma resposta com streaming segura a conexao aberta alem disso.
 * Em edge esse limite nao se aplica.
 *
 * A consequencia e que nada aqui pode depender de `node:fs` nem de `crypto` do
 * Node — por isso a base vem da `BundledSource` e a autenticacao do Salesforce
 * e Client Credentials, que e uma requisicao HTTP sem assinatura local.
 */
export const runtime = 'edge';

interface Corpo {
  conversationId: string;
  pergunta: string;
  historico?: Anthropic.MessageParam[];
}

/**
 * Construido na primeira requisicao e reaproveitado pela instancia.
 *
 * Preguicoso de proposito: `process.env` nao esta completo em tempo de build, e
 * avaliar isto no topo do modulo quebraria o build antes de qualquer chamada.
 */
let motor: MotorDeConversa | null = null;
let limitador: Limitador | null = null;

/** Quanto cada IP pode gastar. Numeros folgados para uso humano, apertados para bot. */
const LIMITES = {
  mensagens: Number(process.env.LIMITE_MENSAGENS ?? 30),
  janelaDeMensagens: Number(process.env.LIMITE_MENSAGENS_JANELA_S ?? 600),
  chamados: Number(process.env.LIMITE_CHAMADOS ?? 3),
  janelaDeChamados: Number(process.env.LIMITE_CHAMADOS_JANELA_S ?? 3600),
} as const;

function obterLimitador(): Limitador {
  limitador ??= persistenciaReal() ? new BlobLimitador() : new MemoriaLimitador();
  return limitador;
}

function obterMotor(): MotorDeConversa {
  if (motor) return motor;

  const exigir = (nome: string): string => {
    const valor = process.env[nome];
    if (!valor) throw new Error(`variável de ambiente ausente: ${nome}`);
    return valor;
  };

  motor = new MotorDeConversa({
    tenantId: process.env.TENANT_ID ?? 'totalpass',
    knowledge: new BundledSource(),
    store: criarStore(),
    casos: comLimiteDeChamados(
      criarAbridorSalesforce({
        loginUrl: exigir('SF_LOGIN_URL'),
        clientId: exigir('SF_CLIENT_ID'),
        clientSecret: exigir('SF_CLIENT_SECRET'),
        origin: process.env.SF_CASE_ORIGIN ?? 'Webchat',
        campoConversationId: process.env.SF_CAMPO_CONVERSATION_ID ?? 'Conversation_Id__c',
        campoIdentidadeVerificada: process.env.SF_CAMPO_IDENTIDADE_VERIFICADA ?? null,
      }),
      obterLimitador(),
      LIMITES.chamados,
      LIMITES.janelaDeChamados,
    ),
  });

  return motor;
}

function sse(dados: unknown): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(dados)}\n\n`);
}

export async function POST(request: Request): Promise<Response> {
  let corpo: Corpo;
  try {
    corpo = (await request.json()) as Corpo;
  } catch {
    return Response.json({ erro: 'corpo inválido' }, { status: 400 });
  }

  if (!corpo.conversationId || !corpo.pergunta?.trim()) {
    return Response.json({ erro: 'conversationId e pergunta são obrigatórios' }, { status: 400 });
  }

  /**
   * Limite de mensagens por IP.
   *
   * O limite de chamados protege a fila do cliente; este protege o custo. Cada
   * mensagem e uma chamada ao modelo com a base inteira no contexto, e um
   * script em laco gasta dinheiro de verdade sem precisar de ma intencao.
   */
  const ip = ipDaRequisicao(request);
  const veredito = await obterLimitador().consumir(
    `chat/${ip}`,
    LIMITES.mensagens,
    LIMITES.janelaDeMensagens,
  );

  if (!veredito.permitido) {
    console.warn(
      JSON.stringify({ evento: 'limite_de_mensagens', ip, usados: veredito.usados, limite: veredito.limite }),
    );
    return Response.json(
      { erro: 'Muitas mensagens em pouco tempo. Tente de novo daqui a pouco.' },
      { status: 429, headers: { 'Retry-After': String(veredito.reiniciaEm) } },
    );
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const eventos = obterMotor().responderEmStream(
          corpo.conversationId,
          corpo.historico ?? [],
          corpo.pergunta,
          ip,
        );

        for await (const evento of eventos) {
          if (evento.tipo === 'texto') {
            controller.enqueue(sse({ t: 'texto', v: evento.texto }));
            continue;
          }

          // Os artigos usados ficam no log do servidor, nunca na resposta:
          // a decisao de produto e nao citar fonte.
          console.log(
            JSON.stringify({
              evento: 'turno',
              conversationId: corpo.conversationId,
              artigos: evento.turno.artigosUsados,
              abriuCaso: evento.turno.abriuCaso,
              numeroCaso: evento.turno.numeroCaso,
              naoRespondida: evento.turno.registrouNaoRespondida,
              deteccaoDoServidor: evento.turno.deteccaoDoServidor,
              uso: evento.turno.uso,
            }),
          );

          controller.enqueue(
            sse({
              t: 'fim',
              numeroCaso: evento.turno.numeroCaso,
              // O cliente guarda o histórico e devolve no próximo turno:
              // não gravamos transcript do nosso lado.
              historico: evento.mensagens,
            }),
          );
        }
      } catch (erro) {
        console.error('[chat] falhou', erro);
        controller.enqueue(
          sse({ t: 'erro', v: 'Tive um problema aqui. Pode tentar de novo?' }),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}

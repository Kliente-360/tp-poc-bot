import type Anthropic from '@anthropic-ai/sdk';
import { MotorDeConversa } from '@/lib/conversation/engine';
import { criarStore } from '@/lib/conversation/criar-store';
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
    casos: criarAbridorSalesforce({
      loginUrl: exigir('SF_LOGIN_URL'),
      clientId: exigir('SF_CLIENT_ID'),
      clientSecret: exigir('SF_CLIENT_SECRET'),
      origin: process.env.SF_CASE_ORIGIN ?? 'Webchat',
      campoConversationId: process.env.SF_CAMPO_CONVERSATION_ID ?? 'Conversation_Id__c',
      campoIdentidadeVerificada: process.env.SF_CAMPO_IDENTIDADE_VERIFICADA ?? null,
    }),
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

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const eventos = obterMotor().responderEmStream(
          corpo.conversationId,
          corpo.historico ?? [],
          corpo.pergunta,
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

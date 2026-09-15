import type Anthropic from '@anthropic-ai/sdk';

/**
 * As duas tools expostas ao modelo. Nao ha uma terceira.
 *
 * A ordem de renderizacao do prompt e `tools` -> `system` -> `messages`, e o
 * cache e casamento de prefixo. Estas definicoes ficam antes da base no
 * prefixo: se a lista de tools variar entre requisicoes — ordem diferente,
 * descricao montada dinamicamente — o cache da base inteira e invalidado junto.
 * Por isso sao constantes de modulo, e nao algo construido por requisicao.
 */
export const TOOLS: Anthropic.Tool[] = [
  {
    name: 'abrir_caso',
    description:
      'Abre um chamado de atendimento para um atendente humano. Use quando a base não tiver a ' +
      'informação ou quando a pessoa pedir. Só chame depois de a pessoa ter confirmado o e-mail ' +
      'que ela mesma digitou.',
    input_schema: {
      type: 'object',
      properties: {
        assunto: {
          type: 'string',
          description: 'Resumo em uma linha, como um atendente escreveria ao abrir o chamado.',
        },
        descricao: {
          type: 'string',
          description:
            'O problema nas palavras da pessoa, seguido de um resumo curto do que já foi ' +
            'conversado: o que ela perguntou e o que você não conseguiu responder. Quem atende ' +
            'não viu a conversa.',
        },
        email: {
          type: 'string',
          description: 'O endereço que a pessoa digitou e confirmou.',
        },
      },
      required: ['assunto', 'descricao', 'email'],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    name: 'registrar_nao_respondida',
    description:
      'Registra uma pergunta que a base de conhecimento não cobriu. Chame sempre que se abster ' +
      'por falta de informação, mesmo que a pessoa recuse abrir chamado.',
    input_schema: {
      type: 'object',
      properties: {
        pergunta: {
          type: 'string',
          description: 'A pergunta original, nas palavras da pessoa. Não reformule.',
        },
      },
      required: ['pergunta'],
      additionalProperties: false,
    },
    strict: true,
  },
];

export interface EntradaAbrirCaso {
  assunto: string;
  descricao: string;
  email: string;
}

export interface EntradaRegistrarNaoRespondida {
  pergunta: string;
}

/** Validacao de e-mail deliberadamente frouxa: barra erro grosseiro, nao valida existencia. */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function emailPlausivel(email: string): boolean {
  return EMAIL.test(email.trim());
}

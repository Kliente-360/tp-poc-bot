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
      'Registra toda pergunta que você não respondeu, seja por falta de informação na base ou ' +
      'por ser assunto fora da TotalPass. Chame sempre que recusar ou se abster, mesmo que a ' +
      'pessoa não peça nada depois.',
    input_schema: {
      type: 'object',
      properties: {
        pergunta: {
          type: 'string',
          description: 'A pergunta original, nas palavras da pessoa. Não reformule.',
        },
        motivo: {
          type: 'string',
          enum: ['lacuna', 'fora_de_escopo'],
          description:
            'Use "lacuna" quando o assunto é da TotalPass mas a base não cobre — inclui pergunta ' +
            'sobre concorrente, comparação ou migração, que é assunto de quem usa o benefício. ' +
            'Use "fora_de_escopo" só quando o assunto não tem relação nenhuma com a TotalPass, ' +
            'como receita, política ou conselho pessoal.',
        },
      },
      required: ['pergunta', 'motivo'],
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

export type MotivoDeNaoResposta = 'lacuna' | 'fora_de_escopo';

export interface EntradaRegistrarNaoRespondida {
  pergunta: string;
  motivo: MotivoDeNaoResposta;
}

/** Validacao de e-mail deliberadamente frouxa: barra erro grosseiro, nao valida existencia. */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function emailPlausivel(email: string): boolean {
  return EMAIL.test(email.trim());
}

import Anthropic from '@anthropic-ai/sdk';
import { MODELO } from '../prompt/system-prompt';
import type { LacunaAgrupada } from './agrupar';

/** Teto de entrada: mantem o custo de um clique previsivel. */
const MAXIMO = 200;

const INSTRUCAO = `Você recebe perguntas que um assistente de atendimento não conseguiu responder.

Agrupe as que são a mesma dúvida escrita de formas diferentes. "Qual o valor da multa de cancelamento?" e "Quanto custa cancelar antes do prazo?" são o mesmo tema; "Como cancelo?" é outro.

Na dúvida, não agrupe. Dois temas fundidos escondem uma lacuna de conteúdo; dois temas separados só ocupam uma linha a mais.

Devolva apenas JSON, sem cerca de código e sem comentário:

{"grupos":[{"tema":"frase curta que descreve a dúvida","indices":[0,2]}]}

Todo índice recebido deve aparecer em exatamente um grupo.`;

/**
 * Agrupa por sentido, com uma chamada ao modelo.
 *
 * Roda so quando alguem clica no botao do dashboard — nao por conversa, nem
 * por requisicao. O custo fica preso ao numero de cliques, nao ao trafego.
 *
 * Qualquer falha devolve o agrupamento por texto. Um dashboard com duplicata
 * e melhor que um dashboard com erro.
 */
export async function agruparPorSentido(lacunas: LacunaAgrupada[]): Promise<LacunaAgrupada[]> {
  if (lacunas.length < 2) return lacunas;

  const entrada = lacunas.slice(0, MAXIMO);

  try {
    const resposta = await new Anthropic().messages.create({
      model: MODELO,
      max_tokens: 4096,
      system: INSTRUCAO,
      messages: [
        {
          role: 'user',
          content: entrada.map((l, i) => `${i}. ${l.pergunta}`).join('\n'),
        },
      ],
    });

    const texto = resposta.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');

    const json = /\{[\s\S]*\}/.exec(texto);
    if (!json) return lacunas;

    const { grupos } = JSON.parse(json[0]) as { grupos: Array<{ tema: string; indices: number[] }> };

    const agrupadas = grupos
      .map((grupo) => {
        const itens = grupo.indices
          .map((i) => entrada[i])
          .filter((l): l is LacunaAgrupada => l !== undefined);
        if (itens.length === 0) return null;

        return {
          // Com mais de uma formulacao, o tema do modelo descreve melhor que
          // qualquer uma delas isolada.
          pergunta: itens.length > 1 ? grupo.tema : itens[0]!.pergunta,
          vezes: itens.reduce((t, l) => t + l.vezes, 0),
          ultimaEm: itens.reduce((t, l) => (l.ultimaEm > t ? l.ultimaEm : t), ''),
          conversas: [...new Set(itens.flatMap((l) => l.conversas))],
        } satisfies LacunaAgrupada;
      })
      .filter((l): l is LacunaAgrupada => l !== null);

    if (agrupadas.length === 0) return lacunas;

    // O que passou do teto entra sem agrupamento, em vez de sumir da lista.
    return [...agrupadas, ...lacunas.slice(MAXIMO)].sort(
      (a, b) => b.vezes - a.vezes || b.ultimaEm.localeCompare(a.ultimaEm),
    );
  } catch (erro) {
    console.error('[agrupar] modelo falhou, mantendo agrupamento por texto', erro);
    return lacunas;
  }
}

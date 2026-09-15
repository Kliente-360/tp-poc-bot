import type { PerguntaNaoRespondida } from './types';

export interface LacunaAgrupada {
  /** A formulacao mais recente, para leitura. */
  pergunta: string;
  vezes: number;
  ultimaEm: string;
  conversas: string[];
}

/**
 * Normalizacao para agrupar repeticoes.
 *
 * Caixa, acento, pontuacao e espaco sobrando somem. O que sobra e comparado
 * por igualdade exata.
 *
 * O limite disso e conhecido e vale estar escrito: isto agrupa a mesma frase
 * escrita de formas ligeiramente diferentes, nao a mesma duvida escrita com
 * outras palavras. "Qual o valor da multa?" e "Quanto custa cancelar antes do
 * prazo?" continuam sendo duas linhas. Agrupar essas duas exigiria semantica —
 * embeddings ou uma chamada ao modelo — e isso so se justifica quando o volume
 * mostrar que a lista esta mesmo cheia de duplicata disfarcada.
 */
export function normalizar(pergunta: string): string {
  return pergunta
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Agrupa por forma normalizada e ordena por repeticao, depois por recencia. */
export function agruparLacunas(registros: PerguntaNaoRespondida[]): LacunaAgrupada[] {
  const grupos = new Map<string, LacunaAgrupada>();

  for (const registro of registros) {
    const chave = normalizar(registro.pergunta);
    if (chave.length === 0) continue;

    const grupo = grupos.get(chave);
    if (!grupo) {
      grupos.set(chave, {
        pergunta: registro.pergunta,
        vezes: 1,
        ultimaEm: registro.registradaEm,
        conversas: [registro.conversationId],
      });
      continue;
    }

    grupo.vezes += 1;
    if (!grupo.conversas.includes(registro.conversationId)) {
      grupo.conversas.push(registro.conversationId);
    }
    // A formulacao exibida acompanha o registro mais recente.
    if (registro.registradaEm > grupo.ultimaEm) {
      grupo.ultimaEm = registro.registradaEm;
      grupo.pergunta = registro.pergunta;
    }
  }

  return [...grupos.values()].sort(
    (a, b) => b.vezes - a.vezes || b.ultimaEm.localeCompare(a.ultimaEm),
  );
}

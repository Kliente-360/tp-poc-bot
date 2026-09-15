import { BlobStore } from './blob-store';
import { InMemoryStore } from './memory-store';
import type { ConversationStore } from './types';

/**
 * Escolhe a implementacao conforme o ambiente.
 *
 * Os Blobs precisam do contexto do runtime do Netlify. Rodando `next dev` puro,
 * esse contexto nao existe e a memoria serve — o que nao pode acontecer e o
 * chat quebrar na maquina de quem esta desenvolvendo por causa disso. Em
 * produção a ausência dos Blobs nao e detalhe: e perda silenciosa de metrica,
 * entao o aviso e ruidoso.
 */
/**
 * Ha persistencia de verdade neste ambiente?
 *
 * O dashboard mostra isso na tela. Um aviso so no console do servidor nao
 * serve: o modo de falha e a metrica zerar em silencio, e quem olha o
 * dashboard nao olha o log.
 */
export function persistenciaReal(): boolean {
  return Boolean(process.env.NETLIFY || process.env.NETLIFY_BLOBS_CONTEXT);
}

export function criarStore(): ConversationStore {
  if (!persistenciaReal()) {
    console.warn(
      '[store] fora do runtime do Netlify — usando memória. ' +
        'As métricas não sobrevivem ao reinício. Para testar a persistência de verdade: netlify dev',
    );
    return new InMemoryStore();
  }

  return new BlobStore();
}

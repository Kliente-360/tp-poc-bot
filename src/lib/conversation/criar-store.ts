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
export function criarStore(): ConversationStore {
  const noNetlify = Boolean(process.env.NETLIFY || process.env.NETLIFY_BLOBS_CONTEXT);

  if (!noNetlify) {
    console.warn(
      '[store] fora do runtime do Netlify — usando memória. ' +
        'As métricas não sobrevivem ao reinício. Para testar a persistência de verdade: netlify dev',
    );
    return new InMemoryStore();
  }

  return new BlobStore();
}

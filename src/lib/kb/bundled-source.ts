import { ARTIGOS } from './bundle.generated';
import { ordenarArtigos, type Artigo, type KnowledgeSource } from './types';

/**
 * A base resolvida em tempo de build.
 *
 * Mesma interface da `FilesystemSource`, sem tocar em disco: funciona em edge
 * runtime, e nao ha leitura por requisicao porque o modulo e avaliado uma vez
 * por instancia.
 */
export class BundledSource implements KnowledgeSource {
  private readonly artigos = ordenarArtigos(ARTIGOS);

  async listarArtigos(): Promise<Artigo[]> {
    return this.artigos;
  }
}

/**
 * A origem da base de conhecimento fica atras desta interface.
 *
 * Hoje os artigos vem de markdown no repositorio, gerados a partir da Central de
 * Ajuda. Quando a leitura passar a ser do Salesforce Knowledge, e uma
 * implementacao nova de `KnowledgeSource` — o motor de conversa nao muda.
 */
export interface Artigo {
  /** Identificador estavel. Vai no log de artigos usados por resposta. */
  id: string;
  titulo: string;
  categoria: string;
  secao: string;
  /** Markdown, sem frontmatter e sem URLs. */
  conteudo: string;
  atualizadoEm: string;
}

export interface KnowledgeSource {
  /** Devolve a base inteira. Nao existe etapa de recuperacao: tudo cabe no contexto. */
  listarArtigos(): Promise<Artigo[]>;
}

/**
 * Ordem estavel e deterministica.
 *
 * Isto nao e estetica: o bloco da base vai no prompt com cache ativado, e cache
 * e casamento de prefixo. Se a ordem dos artigos variar entre processos, o
 * prefixo muda, o cache nunca acerta e o custo por mensagem multiplica sem que
 * nada quebre visivelmente.
 */
export function ordenarArtigos(artigos: Artigo[]): Artigo[] {
  return [...artigos].sort((a, b) => a.id.localeCompare(b.id));
}

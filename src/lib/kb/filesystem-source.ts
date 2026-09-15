import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { ordenarArtigos, type Artigo, type KnowledgeSource } from './types';

/**
 * Le os artigos de /content/kb.
 *
 * Runtime Node apenas — scripts, testes e build. A rota de chat roda em edge,
 * que nao tem disco: la a base entra pela `BundledSource`.
 */
export class FilesystemSource implements KnowledgeSource {
  private cache: Artigo[] | null = null;

  constructor(private readonly diretorio: string = join(process.cwd(), 'content', 'kb')) {}

  async listarArtigos(): Promise<Artigo[]> {
    if (this.cache) return this.cache;

    const arquivos = (await readdir(this.diretorio)).filter((a) => a.endsWith('.md'));
    const artigos = await Promise.all(
      arquivos.map(async (arquivo) => parse(await readFile(join(this.diretorio, arquivo), 'utf8'), arquivo)),
    );

    this.cache = ordenarArtigos(artigos);
    return this.cache;
  }
}

/** Frontmatter do nosso proprio gerador: subconjunto de YAML com strings em JSON. */
export function parse(bruto: string, origem: string): Artigo {
  const casamento = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(bruto);
  if (!casamento) throw new Error(`${origem}: frontmatter ausente ou malformado`);

  const [, cabecalho = '', corpo = ''] = casamento;
  const campos = new Map<string, string>();

  for (const linha of cabecalho.split('\n')) {
    const par = /^([a-z_]+):\s*(.*)$/.exec(linha.trim());
    if (!par) continue;
    const [, chave = '', valor = ''] = par;
    campos.set(chave, valor.startsWith('"') ? (JSON.parse(valor) as string) : valor);
  }

  const exigir = (chave: string): string => {
    const valor = campos.get(chave);
    if (!valor) throw new Error(`${origem}: campo "${chave}" ausente no frontmatter`);
    return valor;
  };

  return {
    id: exigir('id'),
    titulo: exigir('titulo'),
    categoria: exigir('categoria'),
    secao: exigir('secao'),
    atualizadoEm: exigir('atualizado_em'),
    // O H1 repete o titulo, que ja vai no cabecalho do artigo montado no prompt.
    conteudo: corpo.replace(/^#\s+.*\n+/, '').trim(),
  };
}

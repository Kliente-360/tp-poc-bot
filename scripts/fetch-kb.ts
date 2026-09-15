/**
 * Etapa 2 — carga da base de conhecimento.
 *
 *   npm run kb:fetch
 *
 * Puxa os artigos publicados da Central de Ajuda da TotalPass (API publica do
 * Zendesk Help Center, sem autenticacao) e gera um markdown por artigo em
 * /content/kb.
 *
 * Isto e ferramenta de build, nao runtime: roda em Node, escreve em disco e so
 * e executado quando se quer atualizar a base. O motor de conversa nunca chama
 * este arquivo — ele le os markdowns atraves da `KnowledgeSource`.
 */
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import TurndownService from 'turndown';

const BASE = 'https://ajuda.totalpass.com.br/api/v2/help_center/pt-br';
const DESTINO = join(process.cwd(), 'content', 'kb');

/**
 * Escopo definido com o cliente. Ficam de fora:
 *   Academias    — publico da oferta (academia parceira), nao do portal
 *   Integradores — time tecnico de ERP
 *   Alunos       — o colaborador que usa a academia, nao o RH que administra
 *                  o beneficio. Eram 60 artigos e 53% da base, por uma duvida
 *                  de segunda ordem no portal do RH. Sair deles cortou 34% do
 *                  custo por conversa. Quando o RH perguntar algo dessa area,
 *                  a Lets se abstem e registra a lacuna — que e informacao.
 */
const CATEGORIAS = [
  { id: '18966060376347', nome: 'Empresa' },
  { id: '18966087949467', nome: 'LGPD' },
  { id: '18966062537627', nome: 'Quem somos' },
] as const;

interface ArtigoZendesk {
  id: number;
  title: string;
  body: string | null;
  section_id: number;
  html_url: string;
  updated_at: string;
  draft: boolean;
}

const turndown = new TurndownService({
  headingStyle: 'atx',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
});

/**
 * Decisao de produto: a assistente nao cita artigo nem compartilha link.
 * Se a URL entrar na base, ela vaza na resposta. Preservamos o texto do link
 * e descartamos o destino.
 */
turndown.addRule('linkSemUrl', {
  filter: 'a',
  replacement: (conteudo) => conteudo,
});

/** Imagem vira marcador explicito: artigos dizem "veja a imagem abaixo". */
turndown.addRule('imagemComoMarcador', {
  filter: 'img',
  replacement: (_c, node) => {
    const alt = (node as HTMLImageElement).getAttribute('alt')?.trim();
    return alt ? `[imagem: ${alt}]` : '[imagem]';
  },
});

function slug(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

function limpar(markdown: string): string {
  return markdown
    .replace(/ /g, ' ')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function buscarJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ao buscar ${url}`);
  return res.json() as Promise<T>;
}

/** O Zendesk pagina em 100; seguimos `next_page` ate o fim. */
async function buscarTodos<T>(url: string, chave: string): Promise<T[]> {
  const itens: T[] = [];
  let proxima: string | null = `${url}${url.includes('?') ? '&' : '?'}per_page=100`;
  while (proxima) {
    const pagina: Record<string, unknown> = await buscarJson<Record<string, unknown>>(proxima);
    itens.push(...((pagina[chave] as T[]) ?? []));
    proxima = (pagina.next_page as string | null) ?? null;
  }
  return itens;
}

async function main() {
  console.log('\x1b[1mBaixando a Central de Ajuda da TotalPass\x1b[0m\n');

  const secoes = new Map<number, string>(
    (await buscarTodos<{ id: number; name: string }>(`${BASE}/sections.json`, 'sections')).map((s) => [
      s.id,
      s.name,
    ]),
  );

  await mkdir(DESTINO, { recursive: true });

  // Apaga so o que este script gera. A pasta tambem guarda os artigos vindos
  // da base do cliente (`cliente-*.md`), que nao tem origem no Zendesk e
  // seriam varridos por um `endsWith('.md')`.
  for (const arquivo of await readdir(DESTINO).catch(() => [])) {
    if (arquivo.startsWith('kb-') && arquivo.endsWith('.md')) await rm(join(DESTINO, arquivo));
  }

  let totalArtigos = 0;
  let totalPalavras = 0;

  for (const categoria of CATEGORIAS) {
    const artigos = await buscarTodos<ArtigoZendesk>(
      `${BASE}/categories/${categoria.id}/articles.json`,
      'articles',
    );

    let palavrasCategoria = 0;
    for (const artigo of artigos) {
      if (artigo.draft) continue;

      const corpo = limpar(turndown.turndown(artigo.body ?? ''));
      if (corpo.length === 0) {
        console.warn(`  ! artigo ${artigo.id} "${artigo.title}" esta vazio — pulado`);
        continue;
      }

      const secao = secoes.get(artigo.section_id) ?? 'Geral';
      const frontmatter = [
        '---',
        `id: KB-${artigo.id}`,
        `titulo: ${JSON.stringify(artigo.title)}`,
        `categoria: ${JSON.stringify(categoria.nome)}`,
        `secao: ${JSON.stringify(secao)}`,
        `atualizado_em: ${artigo.updated_at.slice(0, 10)}`,
        `url_origem: ${artigo.html_url}`,
        '---',
      ].join('\n');

      const nome = `kb-${artigo.id}-${slug(artigo.title)}.md`;
      await writeFile(join(DESTINO, nome), `${frontmatter}\n\n# ${artigo.title}\n\n${corpo}\n`, 'utf8');

      palavrasCategoria += corpo.split(/\s+/).length;
      totalArtigos++;
    }

    totalPalavras += palavrasCategoria;
    console.log(
      `  \x1b[32m✓\x1b[0m ${categoria.nome.padEnd(12)} ${String(artigos.length).padStart(3)} artigos  ${String(palavrasCategoria).padStart(6)} palavras`,
    );
  }

  console.log(
    `\n  ${'TOTAL'.padEnd(14)} ${String(totalArtigos).padStart(3)} artigos  ${String(totalPalavras).padStart(6)} palavras`,
  );
  console.log(`\n  Gravado em content/kb — contagem exata de tokens: npm run kb:prompt\n`);
}

main().catch((erro: unknown) => {
  console.error(`\n\x1b[31mFALHOU\x1b[0m\n  ${erro instanceof Error ? erro.message : String(erro)}\n`);
  process.exit(1);
});

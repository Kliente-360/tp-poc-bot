/**
 * Importa a base de atendimento enviada pela TotalPass.
 *
 *   npm run kb:cliente
 *
 * Os CSVs sao dados de treino de intencao, nao artigos: dezenas de parafrases
 * apontam para a mesma resposta. Como o modelo generaliza sozinho, guardar as
 * parafrases so multiplicaria o mesmo texto no contexto — elas sao descartadas
 * e fica uma entrada por resposta.
 *
 * Duas regras de precedencia, decididas com o cliente:
 *   1. Quando a mesma pergunta existe nos dois arquivos, vale a versao do
 *      usuario logado, que e o publico do portal e a versao mais completa.
 *   2. Quando colide com um artigo do Zendesk, a base do cliente ganha e o
 *      artigo do Zendesk e removido. Manter os dois poria fatos divergentes no
 *      mesmo prompt, que e o pior cenario possivel para um bot ancorado.
 */
import { createHash } from 'node:crypto';
import { readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const FONTES = join(process.cwd(), 'content', 'fontes');
const DESTINO = join(process.cwd(), 'content', 'kb');

/** Parser RFC 4180: os campos tem quebra de linha e aspas escapadas dentro. */
function lerCsv(texto: string): Array<Record<string, string>> {
  const linhas: string[][] = [];
  let campo = '';
  let linha: string[] = [];
  let dentroDeAspas = false;

  for (let i = 0; i < texto.length; i++) {
    const c = texto[i]!;
    if (dentroDeAspas) {
      if (c === '"' && texto[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') dentroDeAspas = false;
      else campo += c;
      continue;
    }
    if (c === '"') dentroDeAspas = true;
    else if (c === ',') { linha.push(campo); campo = ''; }
    else if (c === '\n') { linha.push(campo); linhas.push(linha); linha = []; campo = ''; }
    else if (c !== '\r') campo += c;
  }
  if (campo || linha.length) { linha.push(campo); linhas.push(linha); }

  const [cabecalho, ...corpo] = linhas;
  if (!cabecalho) return [];
  return corpo
    .filter((l) => l.some((v) => v.trim()))
    .map((l) => Object.fromEntries(cabecalho.map((k, i) => [k.trim(), (l[i] ?? '').trim()])));
}

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function slug(texto: string): string {
  return normalizar(texto).replace(/\s/g, '-').slice(0, 55).replace(/-$/, '');
}

/** Id estavel: deriva do titulo, entao reimportar nao renumera nada. */
function identificador(titulo: string): string {
  return `CLI-${createHash('sha256').update(normalizar(titulo)).digest('hex').slice(0, 8).toUpperCase()}`;
}

interface Artigo {
  titulo: string;
  conteudo: string;
  origem: 'logado' | 'nao-logado';
  parafrases: number;
}

async function main() {
  const arquivos: Array<[Artigo['origem'], string]> = [
    ['nao-logado', 'rh-nao-logado.csv'],
    ['logado', 'rh-logado.csv'], // por ultimo: sobrescreve a versao nao logada
  ];

  const porResposta = new Map<string, Artigo>();
  const porTitulo = new Map<string, string>();
  let linhasLidas = 0;

  for (const [origem, nome] of arquivos) {
    for (const linha of lerCsv(await readFile(join(FONTES, nome), 'utf8'))) {
      const titulo = (linha.title ?? '').trim();
      const conteudo = (linha.content ?? '').trim();
      if (!titulo || !conteudo) continue;
      linhasLidas++;

      const chaveResposta = normalizar(conteudo).slice(0, 300);
      const jaVisto = porResposta.get(chaveResposta);

      if (jaVisto) {
        jaVisto.parafrases++;
        // A versao do logado substitui a do nao logado, mantendo o titulo.
        if (origem === 'logado' && jaVisto.origem === 'nao-logado') {
          jaVisto.conteudo = conteudo;
          jaVisto.origem = 'logado';
        }
        continue;
      }

      const chaveTitulo = normalizar(titulo);
      const respostaAnterior = porTitulo.get(chaveTitulo);
      if (respostaAnterior && origem === 'logado') {
        // Mesmo titulo, resposta diferente: fica a do logado.
        porResposta.delete(respostaAnterior);
      }

      porResposta.set(chaveResposta, { titulo, conteudo, origem, parafrases: 0 });
      porTitulo.set(chaveTitulo, chaveResposta);
    }
  }

  const artigos = [...porResposta.values()];

  // Data do proprio CSV, e nao "hoje": reimportar sem mudanca no conteudo nao
  // pode produzir diff.
  const atualizadoEm = (await stat(join(FONTES, 'rh-logado.csv'))).mtime.toISOString().slice(0, 10);

  // Colisao com o Zendesk: a base do cliente ganha.
  const titulosDoCliente = new Set(artigos.map((a) => normalizar(a.titulo)));
  const removidos: string[] = [];
  for (const arquivo of await readdir(DESTINO)) {
    if (!arquivo.startsWith('kb-') || !arquivo.endsWith('.md')) continue;
    const bruto = await readFile(join(DESTINO, arquivo), 'utf8');
    const titulo = /titulo: "(.*?)"/.exec(bruto)?.[1];
    if (titulo && titulosDoCliente.has(normalizar(titulo))) {
      await rm(join(DESTINO, arquivo));
      removidos.push(titulo);
    }
  }

  for (const arquivo of await readdir(DESTINO)) {
    if (arquivo.startsWith('cliente-')) await rm(join(DESTINO, arquivo));
  }

  for (const artigo of artigos) {
    const id = identificador(artigo.titulo);
    const frontmatter = [
      '---',
      `id: ${id}`,
      `titulo: ${JSON.stringify(artigo.titulo)}`,
      'categoria: "Empresa"',
      'secao: "Atendimento RH"',
      `atualizado_em: ${atualizadoEm}`,
      `origem: ${JSON.stringify(`base do cliente (${artigo.origem})`)}`,
      '---',
    ].join('\n');

    await writeFile(
      join(DESTINO, `cliente-${id.slice(4).toLowerCase()}-${slug(artigo.titulo)}.md`),
      `${frontmatter}\n\n# ${artigo.titulo}\n\n${artigo.conteudo}\n`,
      'utf8',
    );
  }

  const palavras = artigos.reduce((t, a) => t + a.conteudo.split(/\s+/).length, 0);
  console.log(`\n  linhas lidas nos CSVs:        ${linhasLidas}`);
  console.log(`  artigos gerados:              ${artigos.length}`);
  console.log(`  parafrases descartadas:       ${linhasLidas - artigos.length}`);
  console.log(`  palavras:                     ${palavras.toLocaleString('pt-BR')}`);
  console.log(`\n  artigos do Zendesk removidos por colisao: ${removidos.length}`);
  for (const t of removidos) console.log(`      · ${t.slice(0, 66)}`);
  console.log();
}

main().catch((erro: unknown) => {
  console.error(`\n\x1b[31mFALHOU\x1b[0m\n  ${erro instanceof Error ? erro.stack : String(erro)}\n`);
  process.exit(1);
});

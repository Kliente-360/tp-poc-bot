/**
 * Gera src/lib/kb/bundle.generated.ts a partir de /content/kb.
 *
 * Existe por uma razao so: a rota de chat roda em edge runtime, que nao tem
 * disco. `FilesystemSource` usa node:fs e nao funciona la. A base entra pelo
 * bundle, resolvida em tempo de build.
 *
 * Roda no prebuild, entao `npm run build` nunca usa um bundle velho.
 */
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parse } from '../src/lib/kb/filesystem-source';
import { ordenarArtigos, type Artigo } from '../src/lib/kb/types';

const ORIGEM = join(process.cwd(), 'content', 'kb');
const DESTINO = join(process.cwd(), 'src', 'lib', 'kb', 'bundle.generated.ts');

const arquivos = (await readdir(ORIGEM)).filter((a) => a.endsWith('.md'));
const artigos: Artigo[] = ordenarArtigos(
  await Promise.all(
    arquivos.map(async (a) => parse(await readFile(join(ORIGEM, a), 'utf8'), a)),
  ),
);

const conteudo = `// Gerado por scripts/build-kb-bundle.ts. Nao edite.
// Fonte: /content/kb (${artigos.length} artigos). Regenere com: npm run kb:bundle
import type { Artigo } from './types';

export const ARTIGOS: Artigo[] = ${JSON.stringify(artigos, null, 2)};
`;

await writeFile(DESTINO, conteudo, 'utf8');
console.log(`  bundle gerado: ${artigos.length} artigos, ${(conteudo.length / 1024).toFixed(0)}kB`);

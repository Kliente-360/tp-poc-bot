/**
 * Teste do filtro de streaming. Logica pura, roda em milissegundos e sem API.
 *
 *   npm run test:filtro
 *
 * Vale um teste proprio porque o modo de falha e traicoeiro: o marcador pisca
 * na tela por uma fracao de segundo e some. Ninguem ve isso revisando codigo.
 */
import { FiltroDeArtigos } from '../src/lib/conversation/stream-filter';

const CASOS: Array<{ nome: string; deltas: string[]; visivel: string; ids: string }> = [
  { nome: 'marcador inteiro num delta só', deltas: ['<artigos>KB-1,KB-2</artigos>Olá!'], visivel: 'Olá!', ids: 'KB-1,KB-2' },
  { nome: 'marcador fatiado byte a byte', deltas: '<artigos>KB-9</artigos>Oi'.split(''), visivel: 'Oi', ids: 'KB-9' },
  { nome: 'marcador vazio', deltas: ['<artigos>', '</artigos>', 'Bom dia'], visivel: 'Bom dia', ids: '' },
  { nome: 'resposta sem marcador', deltas: ['Texto ', 'normal'], visivel: 'Texto normal', ids: '' },
  { nome: 'menor-que solto não pode ser retido', deltas: ['Use a tecla <', ' para voltar'], visivel: 'Use a tecla < para voltar', ids: '' },
  { nome: 'marcador no meio do texto', deltas: ['Antes ', '<artigos>KB-7</artigos>', ' depois'], visivel: 'Antes  depois', ids: 'KB-7' },
  { nome: 'marcador aberto que nunca fecha', deltas: ['Oi <artigos>KB-3'], visivel: 'Oi ', ids: '' },
  { nome: 'tag no singular (Haiku emitiu assim)', deltas: ['<artigo>CLI-AB12</artigo>Olá!'], visivel: 'Olá!', ids: 'CLI-AB12' },
  { nome: 'singular fatiado byte a byte', deltas: '<artigo>KB-1</artigo>Oi'.split(''), visivel: 'Oi', ids: 'KB-1' },
  { nome: 'dois marcadores (turno com tool use)', deltas: ['<artigos>KB-1</artigos>a<artigos>KB-2</artigos>b'], visivel: 'ab', ids: 'KB-1,KB-2' },
];

let falhou = 0;
for (const caso of CASOS) {
  const filtro = new FiltroDeArtigos();
  const saida = caso.deltas.map((d) => filtro.empurrar(d)).join('') + filtro.encerrar();
  const ok = saida === caso.visivel && filtro.artigos.join(',') === caso.ids;

  console.log(`  ${ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${caso.nome}`);
  if (!ok) {
    falhou++;
    console.log(`      visível: ${JSON.stringify(saida)}  esperado ${JSON.stringify(caso.visivel)}`);
    console.log(`      ids:     ${filtro.artigos.join(',')}  esperado ${caso.ids}`);
  }
}

console.log(`\n  ${CASOS.length - falhou}/${CASOS.length}\n`);
if (falhou > 0) process.exit(1);

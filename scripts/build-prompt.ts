/**
 * Etapa 2 — montagem do prompt e contagem de tokens.
 *
 *   npm run kb:prompt          resumo e custo
 *   npm run kb:prompt -- --full   imprime o prompt inteiro
 *
 * A contagem vem de messages.count_tokens, nao de estimativa por palavras.
 */
import Anthropic from '@anthropic-ai/sdk';
import { FilesystemSource } from '../src/lib/kb/filesystem-source';
import { MODELO, montarSystemPrompt } from '../src/lib/prompt/system-prompt';

/** Claude Sonnet 5, por 1M de tokens. */
const PRECO = { entrada: 2.0, saida: 10.0, escritaDeCache: 2.5, leituraDeCache: 0.2 };

const titulo = (t: string) => console.log(`\n\x1b[1m${t}\x1b[0m`);
const linha = (k: string, v: string) => console.log(`  ${k.padEnd(34)} ${v}`);

async function main() {
  const artigos = await new FilesystemSource().listarArtigos();
  const system = montarSystemPrompt(artigos);

  if (process.argv.includes('--full')) {
    console.log(system.map((b) => b.text).join('\n\n' + '='.repeat(78) + '\n\n'));
    return;
  }

  const client = new Anthropic();

  // Uma pergunta minima: o custo real por turno e o system + a conversa.
  const { input_tokens: total } = await client.messages.countTokens({
    model: MODELO,
    system,
    messages: [{ role: 'user', content: 'Como faço o check-in na academia?' }],
  });

  const { input_tokens: soInstrucoes } = await client.messages.countTokens({
    model: MODELO,
    system: [system[0]!],
    messages: [{ role: 'user', content: 'oi' }],
  });

  titulo('Base de conhecimento');
  linha('artigos carregados', String(artigos.length));
  const porCategoria = new Map<string, number>();
  for (const a of artigos) porCategoria.set(a.categoria, (porCategoria.get(a.categoria) ?? 0) + 1);
  for (const [cat, n] of [...porCategoria].sort((a, b) => b[1] - a[1])) linha(`  ${cat}`, String(n));

  titulo('Tokens (contagem exata da API)');
  linha('instrucoes + persona', `~${soInstrucoes.toLocaleString('pt-BR')}`);
  linha('prompt completo por requisicao', total.toLocaleString('pt-BR'));
  linha('bloco com cache ativado', `${(total - soInstrucoes).toLocaleString('pt-BR')} (a base)`);

  titulo(`Custo por mensagem — ${MODELO}`);
  const semCache = (total / 1e6) * PRECO.entrada;
  const comCache = (total / 1e6) * PRECO.leituraDeCache;
  const primeira = (total / 1e6) * PRECO.escritaDeCache;
  linha('1a mensagem (escreve o cache)', `US$ ${primeira.toFixed(5)}`);
  linha('demais (le do cache)', `US$ ${comCache.toFixed(5)}`);
  linha('se o cache nunca acertar', `US$ ${semCache.toFixed(5)}`);
  linha('economia por mensagem cacheada', `${((1 - comCache / semCache) * 100).toFixed(0)}%`);

  /**
   * O cache e por prefixo, nao por conversa: o bloco da base e identico para
   * todo mundo. Com trafego continuo ele fica quente e quase ninguem paga a
   * escrita. Com trafego esparso, cada conversa reaquece.
   */
  const conversaQuente = comCache * 5;
  const conversaFria = primeira + comCache * 4;

  titulo('Projecao — conversa de 5 turnos, so entrada');
  linha('cache quente (trafego continuo)', `US$ ${conversaQuente.toFixed(4)}`);
  linha('cache frio (trafego esparso)', `US$ ${conversaFria.toFixed(4)}`);
  linha('1.000 conversas, cache quente', `US$ ${(conversaQuente * 1000).toFixed(2)}`);
  linha('1.000 conversas, cache frio', `US$ ${(conversaFria * 1000).toFixed(2)}`);

  titulo('Se o modelo fosse outro (mesma base, cache quente)');
  for (const [nome, entrada] of [['claude-opus-5', 5.0], ['claude-sonnet-5', 2.0], ['claude-haiku-4-5', 1.0]] as const) {
    const custo = (total / 1e6) * entrada * 0.1 * 5;
    linha(`  ${nome}`, `US$ ${(custo * 1000).toFixed(2)} / 1.000 conversas`);
  }

  console.log(
    `\n  \x1b[2mSo tokens de entrada. A saida (US$ ${PRECO.saida}/1M no Sonnet 5) depende do tamanho da resposta.\x1b[0m`,
  );
  console.log(
    `  \x1b[2mCache padrao expira em 5 min sem uso. O relogio e do prefixo, nao da conversa.\x1b[0m\n`,
  );
}

main().catch((erro: unknown) => {
  console.error(`\n\x1b[31mFALHOU\x1b[0m\n  ${erro instanceof Error ? erro.message : String(erro)}\n`);
  process.exit(1);
});

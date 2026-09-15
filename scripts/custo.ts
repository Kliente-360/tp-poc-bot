/**
 * Custo por mil conversas, medido e nao estimado.
 *
 *   npm run custo
 *
 * Roda uma conversa real e le `usage` de cada turno. Estimar isso na planilha
 * erra por dois motivos que so aparecem medindo: o historico e reenviado
 * inteiro a cada turno, entao a entrada cresce; e a saida varia muito com o
 * tipo de pergunta.
 */
import type Anthropic from '@anthropic-ai/sdk';
import { MotorDeConversa, type AbridorDeCaso } from '../src/lib/conversation/engine';
import { InMemoryStore } from '../src/lib/conversation/memory-store';
import { FilesystemSource } from '../src/lib/kb/filesystem-source';
import { MODELO } from '../src/lib/prompt/system-prompt';

/** Claude Haiku 4.5, US$ por 1M de tokens. */
const PRECO = { entrada: 1.0, saida: 5.0, escritaDeCache: 1.25, leituraDeCache: 0.1 };

/** Conversa plausivel de um RH: pergunta, desdobra, e termina em chamado. */
const TURNOS = [
  'Como cadastrar colaboradores?',
  'E se eu quiser adicionar só um, sem planilha?',
  'Subi a base e deu erro de limite de vidas',
  'Entendi. E quantos dependentes cada um pode ter?',
  'Qual a idade mínima pra dependente?',
  'Preciso do valor exato da multa se eu cancelar antes do prazo',
];

const usd = (v: number) => `US$ ${v.toFixed(2)}`;

async function main() {
  const motor = new MotorDeConversa({
    tenantId: 'custo',
    knowledge: new FilesystemSource(),
    store: new InMemoryStore(),
    casos: { async abrir() { return { numero: '00000000' }; } } satisfies AbridorDeCaso,
    ...(process.argv.includes('--effort')
      ? { effort: process.argv[process.argv.indexOf('--effort') + 1] as 'low' | 'medium' | 'high' }
      : {}),
  });

  let historico: Anthropic.MessageParam[] = [];
  const turnos: Array<{ leitura: number; escrita: number; entrada: number; saida: number }> = [];

  const nivel = process.argv.includes('--effort') ? process.argv[process.argv.indexOf('--effort')+1] : 'padrão (high)';
  console.log(`\n\x1b[1mConversa medida — ${MODELO} · effort ${nivel}\x1b[0m\n`);
  console.log('  turno  cache lido   sem cache   saída');

  for (const [i, pergunta] of TURNOS.entries()) {
    const r = await motor.responder(`custo-${Date.now()}`, historico, pergunta);
    historico = r.mensagens;
    const u = r.turno.uso;
    turnos.push({ leitura: u.leituraDeCache, escrita: u.escritaDeCache, entrada: u.entrada, saida: u.saida });
    console.log(
      `  ${String(i + 1).padStart(5)}  ${String(u.leituraDeCache).padStart(10)}  ${String(u.entrada).padStart(10)}  ${String(u.saida).padStart(6)}`,
    );
  }

  const soma = (k: keyof (typeof turnos)[number]) => turnos.reduce((t, x) => t + x[k], 0);
  const base = turnos[0]!.leitura + turnos[0]!.escrita; // tamanho do prefixo cacheado

  // Quente: o prefixo ja esta no cache quando a conversa comeca — e o caso de
  // trafego continuo, porque o cache e do prefixo e nao da conversa.
  const quente =
    (soma('leitura') + soma('escrita')) / 1e6 * PRECO.leituraDeCache +
    soma('entrada') / 1e6 * PRECO.entrada +
    soma('saida') / 1e6 * PRECO.saida;

  // Frio: a conversa paga a escrita do cache uma vez.
  const frio = quente + (base / 1e6) * (PRECO.escritaDeCache - PRECO.leituraDeCache);

  console.log(`\n  turnos medidos: ${TURNOS.length}`);
  console.log(`  prefixo cacheado: ${base.toLocaleString('pt-BR')} tokens`);
  console.log(`  saída total: ${soma('saida').toLocaleString('pt-BR')} tokens\n`);

  for (const [rotulo, n] of [['5 turnos', 5], ['6 turnos', 6], ['7 turnos', 7]] as const) {
    const fator = n / TURNOS.length;
    console.log(
      `  \x1b[1m${rotulo}\x1b[0m  ·  1.000 conversas:  cache quente ${usd(quente * fator * 1000)}   ·   cache frio ${usd(frio * fator * 1000)}`,
    );
  }
  console.log();
}

main().catch((e: unknown) => { console.error(e); process.exit(1); });

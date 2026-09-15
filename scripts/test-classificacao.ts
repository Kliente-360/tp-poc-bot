/**
 * Rede de seguranca: classificacao de recusa a partir do texto da resposta.
 *
 *   npm run test:classificacao
 *
 * Logica pura, sem API. Vale um teste proprio porque o modo de falha e mudo:
 * quando um padrao deixa de casar, a pergunta simplesmente nao aparece no
 * dashboard, e ninguem descobre ate o cliente perguntar por que a lista esta
 * vazia.
 */
import { classificarRecusa } from '../src/lib/conversation/engine';

type Esperado = 'lacuna' | 'fora_de_escopo' | null;

const CASOS: Array<{ resposta: string; esperado: Esperado }> = [
  // --- fora do escopo: assunto que nao e da TotalPass ---
  { resposta: 'Essa não é minha praia — eu só ando por aqui falando de TotalPass mesmo.', esperado: 'fora_de_escopo' },
  { resposta: 'Desculpa, mas aqui é só sobre TotalPass. Posso ajudar com o benefício?', esperado: 'fora_de_escopo' },
  { resposta: 'Isso foge do meu escopo, viu? Prefiro ficar nos assuntos daqui.', esperado: 'fora_de_escopo' },
  { resposta: 'Não trabalho com esse tipo de assunto. Quer falar de planos?', esperado: 'fora_de_escopo' },
  { resposta: 'Meu conhecimento é só sobre a TotalPass, infelizmente.', esperado: 'fora_de_escopo' },
  { resposta: 'Isso não tem a ver com a TotalPass. Posso ajudar em outra coisa?', esperado: 'fora_de_escopo' },
  { resposta: 'Essa não é bem a minha área. Só falo de TotalPass por aqui.', esperado: 'fora_de_escopo' },

  // --- lacuna: assunto da TotalPass que a base nao cobre ---
  { resposta: 'Não tenho essa informação aqui. Quer que eu abra um chamado?', esperado: 'lacuna' },
  { resposta: 'Não está na minha base — não tenho informação sobre webhook com Senior.', esperado: 'lacuna' },
  { resposta: 'Não consigo te responder isso com certeza.', esperado: 'lacuna' },
  { resposta: 'Não sei te dizer o valor exato, mas posso abrir um chamado.', esperado: 'lacuna' },
  { resposta: 'Essa informação eu não tenho aqui comigo.', esperado: 'lacuna' },

  // --- nao e recusa: nao pode registrar nada ---
  { resposta: 'Oi! Eu sou a Léts, assistente virtual da TotalPass. Como posso te ajudar?', esperado: null },
  { resposta: 'Para cadastrar colaboradores, você faz o upload da base pelo Portal RH.', esperado: null },
  { resposta: 'Perfeito, confirmado: felipe@kliente360.com. Já vou abrir o chamado.', esperado: null },
  { resposta: 'Prontinho! Seu chamado é o número 00002088.', esperado: null },
  // O caso traicoeiro: comeca com "Só" e menciona TotalPass na frase seguinte.
  // O padrao nao atravessa pontuacao final, entao os dois nao se encontram.
  { resposta: 'Claro! Só preciso do seu e-mail. Depois disso eu abro o chamado da TotalPass.', esperado: null },
  { resposta: 'O check-in é feito pelo app, com a localização ativada.', esperado: null },
];

let falhou = 0;
for (const caso of CASOS) {
  const obtido = classificarRecusa(caso.resposta);
  const ok = obtido === caso.esperado;
  const rotulo = (caso.esperado ?? 'não é recusa').padEnd(14);

  console.log(`  ${ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${rotulo} ${caso.resposta.slice(0, 62)}`);
  if (!ok) {
    falhou++;
    console.log(`      esperado ${caso.esperado}, obtido ${obtido}`);
  }
}

console.log(`\n  ${CASOS.length - falhou}/${CASOS.length}\n`);
if (falhou > 0) process.exit(1);

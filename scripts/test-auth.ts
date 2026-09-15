/**
 * Testes da sessao e da lista de acesso.
 *
 *   npm run test:auth
 *
 * Logica pura, sem rede. Autenticacao e o codigo onde um defeito nao aparece
 * como erro: aparece como alguem entrando sem poder, e ninguem percebe.
 */
import { assinarSessao, lerSessao, type Sessao } from '../src/lib/auth/sessao';
import { emailPermitido } from '../src/lib/auth/dominios';

const SEGREDO = 'um-segredo-de-teste-com-mais-de-32-caracteres';
const OUTRO = 'outro-segredo-de-teste-com-mais-de-32-caract';

const daquiAUmaHora = Math.floor(Date.now() / 1000) + 3600;
const ontem = Math.floor(Date.now() / 1000) - 86400;

let falhou = 0;
function checar(nome: string, condicao: boolean) {
  console.log(`  ${condicao ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${nome}`);
  if (!condicao) falhou++;
}

console.log('\n\x1b[1mSessão\x1b[0m');

const valida: Sessao = { email: 'felipe@kliente360.com', nome: 'Felipe', expiraEm: daquiAUmaHora };
const cookie = await assinarSessao(valida, SEGREDO);

checar('ida e volta preserva o e-mail', (await lerSessao(cookie, SEGREDO))?.email === valida.email);
checar('assinatura com outro segredo é recusada', (await lerSessao(cookie, OUTRO)) === null);
checar('corpo adulterado é recusado', (await lerSessao(`${cookie.split('.')[0]}X.${cookie.split('.')[1]}`, SEGREDO)) === null);
checar('assinatura adulterada é recusada', (await lerSessao(`${cookie.split('.')[0]}.AAAA`, SEGREDO)) === null);
checar('cookie ausente é recusado', (await lerSessao(undefined, SEGREDO)) === null);
checar('lixo é recusado sem lançar', (await lerSessao('nao-e-um-cookie', SEGREDO)) === null);
checar(
  'sessão vencida é recusada',
  (await lerSessao(await assinarSessao({ ...valida, expiraEm: ontem }, SEGREDO), SEGREDO)) === null,
);
checar(
  'sessão sem e-mail é recusada',
  (await lerSessao(await assinarSessao({ ...valida, email: '' }, SEGREDO), SEGREDO)) === null,
);

console.log('\n\x1b[1mLista de acesso\x1b[0m');

const dominios = ['kliente360.com', 'acme.com'];
const emails = ['convidado@gmail.com'];
const permitido = (e: string) => emailPermitido(e, dominios, emails);

checar('domínio permitido entra', permitido('felipe@kliente360.com'));
checar('caixa alta não importa', permitido('Felipe@Kliente360.COM'));
checar('segundo domínio entra', permitido('rh@acme.com'));
checar('convidado avulso entra', permitido('convidado@gmail.com'));
checar('domínio de fora não entra', permitido('alguem@gmail.com') === false);
// Os dois abaixo sao o motivo de a comparacao ser exata, e nao "termina com".
checar('acme.com.br NÃO entra', permitido('atacante@acme.com.br') === false);
checar('evil-acme.com NÃO entra', permitido('atacante@evil-acme.com') === false);
checar('subdomínio NÃO entra', permitido('atacante@mail.acme.com') === false);
checar('sem arroba não entra', permitido('acme.com') === false);
checar('lista vazia não deixa ninguém entrar', emailPermitido('felipe@kliente360.com', [], []) === false);

console.log(`\n  ${falhou === 0 ? '\x1b[32mtudo certo\x1b[0m' : `\x1b[31m${falhou} falha(s)\x1b[0m`}\n`);
if (falhou > 0) process.exit(1);

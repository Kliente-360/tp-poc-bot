/**
 * Etapa 1 — validacao da integracao com o Salesforce, sem interface nenhuma.
 *
 *   npm run sf:smoke
 *
 * Autentica por Client Credentials, abre um Case de teste (prefixado com [POC])
 * e grava um comentario interno. Imprime tudo que foi feito.
 */
import { ClientCredentialsAuth, SalesforceAuthError } from '../src/lib/salesforce/auth';
import { SalesforceClient } from '../src/lib/salesforce/client';
import { CaseService } from '../src/lib/salesforce/cases';
import { config } from '../src/lib/config';

const ok = (m: string) => console.log(`  \x1b[32m✓\x1b[0m ${m}`);
const info = (k: string, v: string) => console.log(`      ${k.padEnd(18)} ${v}`);
const passo = (m: string) => console.log(`\n\x1b[1m${m}\x1b[0m`);

async function main() {
  const auth = new ClientCredentialsAuth({
    loginUrl: config.salesforce.loginUrl,
    clientId: config.salesforce.clientId,
    clientSecret: config.salesforce.clientSecret,
  });

  passo('1. Autenticacao (OAuth Client Credentials)');
  const sessao = await auth.getSession();
  ok('token obtido');
  info('instance_url', sessao.instanceUrl);

  const client = new SalesforceClient(auth);

  passo('2. Identidade do Run As User');
  const identidade = await fetch(`${sessao.instanceUrl}/services/oauth2/userinfo`, {
    headers: { Authorization: `Bearer ${sessao.accessToken}` },
  }).then((r) => r.json() as Promise<{ name: string; preferred_username: string }>);
  ok('identidade confirmada');
  info('nome', identidade.name);
  info('username', identidade.preferred_username);

  passo('3. Abertura de Case');
  const avisos: string[] = [];
  const casos = new CaseService(client, {
    origin: config.salesforce.caseOrigin,
    campoConversationId: config.salesforce.campoConversationId,
    campoIdentidadeVerificada: config.salesforce.campoIdentidadeVerificada,
    onAviso: (m) => avisos.push(m),
  });

  const conversationId = `${config.tenantId}/smoke-${Date.now()}`;
  const caso = await casos.abrirCaso({
    assunto: '[POC] Colaborador nao consegue acessar o Portal RH',
    descricao:
      'Chamado aberto pelo script de validacao da etapa 1.\n\n' +
      'Resumo do contexto: o usuario perguntou como recuperar o acesso ao Portal RH. ' +
      'A assistente nao encontrou a informacao na base e ofereceu abertura de chamado.\n\n' +
      'E-mail informado pelo usuario e confirmado por ele. Identidade nao verificada.',
    email: 'felipe@kliente360.com',
    conversationId,
  });

  ok('Case criado');
  info('CaseNumber', caso.numero);
  info('Id', caso.id);
  info('Conversation Id', conversationId);
  info('Origin', config.salesforce.caseOrigin);

  passo('4. Comentario interno (IsPublished = false)');
  const comentario = await casos.adicionarComentarioInterno(
    caso.id,
    '[POC] Caminho de comentario interno validado. Fora do escopo do MVP como transcript.',
  );
  ok('CaseComment criado');
  info('Id', comentario);

  passo('5. Cache de token');
  const antes = performance.now();
  await auth.getSession();
  ok(`segunda chamada resolvida em ${(performance.now() - antes).toFixed(1)}ms (sem ida a rede)`);

  if (avisos.length > 0) {
    console.log('\n\x1b[33mAvisos\x1b[0m');
    for (const a of avisos) console.log(`  ! ${a}`);
    console.log(`  Campos omitidos: ${caso.camposOmitidos.join(', ')}`);
  }

  console.log(`\n\x1b[32mEtapa 1 OK.\x1b[0m Chamado ${caso.numero} criado na org.\n`);
}

main().catch((erro: unknown) => {
  console.error('\n\x1b[31mFALHOU\x1b[0m');
  console.error(`  ${erro instanceof Error ? erro.message : String(erro)}`);
  if (erro instanceof SalesforceAuthError && erro.hint) console.error(`\n  Provavel causa: ${erro.hint}`);
  process.exit(1);
});

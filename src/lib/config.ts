function obrigatoria(nome: string): string {
  const valor = process.env[nome];
  if (!valor) throw new Error(`variavel de ambiente ausente: ${nome} (confira o .env.local)`);
  return valor;
}

function opcional(nome: string, padrao: string | null = null): string | null {
  const valor = process.env[nome];
  return valor && valor.length > 0 ? valor : padrao;
}

export const config = {
  tenantId: opcional('TENANT_ID', 'totalpass') as string,

  salesforce: {
    loginUrl: obrigatoria('SF_LOGIN_URL'),
    clientId: obrigatoria('SF_CLIENT_ID'),
    clientSecret: obrigatoria('SF_CLIENT_SECRET'),
    caseOrigin: opcional('SF_CASE_ORIGIN', 'Webchat') as string,
    // Todo campo alem dos padrao e opcional: basta esvaziar a variavel para desligar.
    campoConversationId: opcional('SF_CAMPO_CONVERSATION_ID', 'Conversation_Id__c'),
    campoIdentidadeVerificada: opcional('SF_CAMPO_IDENTIDADE_VERIFICADA', null),
  },
} as const;

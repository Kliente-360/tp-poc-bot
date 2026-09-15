import type { AbridorDeCaso } from '../conversation/engine';
import { ClientCredentialsAuth } from './auth';
import { CaseService } from './cases';
import { SalesforceClient } from './client';

export interface ConfigDoAdaptador {
  loginUrl: string;
  clientId: string;
  clientSecret: string;
  origin: string;
  campoConversationId: string | null;
  campoIdentidadeVerificada: string | null;
}

/**
 * Liga o motor de conversa ao Salesforce.
 *
 * O motor conhece so `AbridorDeCaso`. Este adaptador e o unico ponto onde as
 * duas metades se encontram — e por isso a bateria de testes consegue rodar
 * com um abridor falso, sem criar chamado na org do cliente.
 */
export function criarAbridorSalesforce(config: ConfigDoAdaptador): AbridorDeCaso {
  const auth = new ClientCredentialsAuth({
    loginUrl: config.loginUrl,
    clientId: config.clientId,
    clientSecret: config.clientSecret,
  });

  const casos = new CaseService(new SalesforceClient(auth), {
    origin: config.origin,
    campoConversationId: config.campoConversationId,
    campoIdentidadeVerificada: config.campoIdentidadeVerificada,
  });

  return {
    async abrir(entrada) {
      const caso = await casos.abrirCaso({
        assunto: entrada.assunto,
        descricao: entrada.descricao,
        email: entrada.email,
        conversationId: entrada.conversationId,
      });
      return { numero: caso.numero };
    },
  };
}

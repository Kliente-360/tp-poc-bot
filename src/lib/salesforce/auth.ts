/**
 * Autenticacao com o Salesforce.
 *
 * A interface existe para que a troca de fluxo (Client Credentials -> JWT Bearer,
 * caso a seguranca do cliente exija em producao) seja uma implementacao nova,
 * sem tocar em nenhum outro ponto do sistema.
 *
 * Restricao de runtime: tudo aqui roda em edge. Apenas `fetch`, nada de `crypto`
 * do Node, nada de dependencia externa.
 */

export interface SalesforceSession {
  accessToken: string;
  /** Sempre a URL devolvida pelo token endpoint, nunca uma URL fixa de config. */
  instanceUrl: string;
}

export interface SalesforceAuth {
  /** Devolve uma sessao valida, do cache quando possivel. */
  getSession(): Promise<SalesforceSession>;
  /** Descarta o cache. Chamado no primeiro 401 para forcar renovacao. */
  invalidate(): void;
}

export interface ClientCredentialsConfig {
  /**
   * My Domain da org — por exemplo https://acme--dev.sandbox.my.salesforce.com
   *
   * ATENCAO: nao use login.salesforce.com nem test.salesforce.com aqui.
   * O fluxo Client Credentials so e aceito no My Domain; nos dominios genericos
   * o Salesforce responde `invalid_grant: request not supported on this domain`.
   */
  loginUrl: string;
  clientId: string;
  clientSecret: string;
}

/**
 * O Salesforce nao devolve `expires_in` no Client Credentials. O tempo de vida real
 * vem da politica de sessao da org. Usamos um TTL conservador e tratamos o 401 como
 * a fonte de verdade — o cache e otimizacao, nao garantia.
 */
const DEFAULT_TTL_MS = 30 * 60 * 1000;

export class ClientCredentialsAuth implements SalesforceAuth {
  private cached: SalesforceSession | null = null;
  private expiresAt = 0;
  /** Deduplica chamadas concorrentes: varias requisicoes, um unico token em voo. */
  private inFlight: Promise<SalesforceSession> | null = null;

  constructor(private readonly config: ClientCredentialsConfig) {}

  invalidate(): void {
    this.cached = null;
    this.expiresAt = 0;
  }

  async getSession(): Promise<SalesforceSession> {
    if (this.cached && Date.now() < this.expiresAt) return this.cached;
    if (this.inFlight) return this.inFlight;

    this.inFlight = this.requestToken()
      .then((session) => {
        this.cached = session;
        this.expiresAt = Date.now() + DEFAULT_TTL_MS;
        return session;
      })
      .finally(() => {
        this.inFlight = null;
      });

    return this.inFlight;
  }

  private async requestToken(): Promise<SalesforceSession> {
    const endpoint = `${this.config.loginUrl.replace(/\/+$/, '')}/services/oauth2/token`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
      }),
    });

    const payload = (await response.json()) as Record<string, unknown>;

    if (!response.ok || typeof payload.access_token !== 'string') {
      throw new SalesforceAuthError(
        String(payload.error ?? response.status),
        String(payload.error_description ?? 'falha ao obter token'),
      );
    }

    return {
      accessToken: payload.access_token,
      instanceUrl: String(payload.instance_url),
    };
  }
}

export class SalesforceAuthError extends Error {
  constructor(
    readonly code: string,
    readonly detail: string,
  ) {
    super(`[${code}] ${detail}`);
    this.name = 'SalesforceAuthError';
  }

  /** Erros de autenticacao repetem muito e as causas sao sempre as mesmas. */
  get hint(): string | null {
    switch (this.code) {
      case 'invalid_grant':
        return 'SF_LOGIN_URL precisa ser o My Domain da org. login/test.salesforce.com nao aceitam Client Credentials.';
      case 'invalid_app_access':
        return 'O Run As User nao esta pre-autorizado no Connected App. Vincule o app a um perfil ou permission set.';
      case 'invalid_client_id':
        return 'Consumer Key errada, ou o Connected App ainda nao propagou (leva de 2 a 10 minutos apos criado).';
      case 'invalid_client':
        return 'Consumer Secret errado, ou o Run As User nao foi definido nas OAuth Policies do Connected App.';
      default:
        return null;
    }
  }
}

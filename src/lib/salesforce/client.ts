import type { SalesforceAuth } from './auth.js';

export const SF_API_VERSION = 'v62.0';

export interface SalesforceApiErrorDetail {
  errorCode?: string;
  message?: string;
  fields?: string[];
}

export class SalesforceApiError extends Error {
  constructor(
    readonly status: number,
    readonly details: SalesforceApiErrorDetail[],
  ) {
    super(details.map((d) => `[${d.errorCode ?? status}] ${d.message ?? ''}`).join(' | ') || `HTTP ${status}`);
    this.name = 'SalesforceApiError';
  }

  get errorCodes(): string[] {
    return this.details.map((d) => d.errorCode ?? '').filter(Boolean);
  }

  /** Campos que a org recusou — usado para degradar em vez de falhar. */
  get offendingFields(): string[] {
    return this.details.flatMap((d) => d.fields ?? []);
  }
}

/**
 * Wrapper fino sobre a REST API.
 *
 * Duas responsabilidades, so: usar sempre a `instance_url` da sessao (nunca uma
 * URL de config) e renovar o token no primeiro 401 — que e a forma que o
 * Salesforce tem de dizer que a sessao expirou.
 */
export class SalesforceClient {
  constructor(private readonly auth: SalesforceAuth) {}

  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    let response = await this.send(path, init);

    if (response.status === 401) {
      this.auth.invalidate();
      response = await this.send(path, init);
    }

    if (response.status === 204) return undefined as T;

    const body = await response.text();
    const parsed: unknown = body ? JSON.parse(body) : null;

    if (!response.ok) {
      const details = Array.isArray(parsed) ? (parsed as SalesforceApiErrorDetail[]) : [parsed as SalesforceApiErrorDetail];
      throw new SalesforceApiError(response.status, details);
    }

    return parsed as T;
  }

  private async send(path: string, init: RequestInit): Promise<Response> {
    const { accessToken, instanceUrl } = await this.auth.getSession();

    return fetch(`${instanceUrl}/services/data/${SF_API_VERSION}${path}`, {
      ...init,
      headers: {
        ...init.headers,
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });
  }
}

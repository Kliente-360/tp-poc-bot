import { getStore, type Store } from '@netlify/blobs';

export interface Veredito {
  permitido: boolean;
  usados: number;
  limite: number;
  /** Segundos até a janela virar. Vira o Retry-After da resposta. */
  reiniciaEm: number;
}

export interface Limitador {
  consumir(chave: string, limite: number, janelaSegundos: number): Promise<Veredito>;
}

/**
 * Janela fixa: a chave carrega o numero do balde, e o balde some sozinho quando
 * o tempo passa. Sem expiracao a agendar, sem varredura de limpeza.
 *
 * A contagem e aproximada, e isto precisa estar dito: ler-somar-gravar nao e
 * atomico nos Blobs, entao duas requisicoes simultaneas leem o mesmo valor e
 * gravam o mesmo incremento. Contra trafego normal e contra um script ingenuo
 * funciona; contra um atacante disparando em paralelo, nao segura. Para um
 * piloto o custo de errar e uma requisicao a mais passar — e a alternativa
 * seria um Redis, que e infraestrutura nova para resolver o problema errado.
 */
function balde(janelaSegundos: number): number {
  return Math.floor(Date.now() / 1000 / janelaSegundos);
}

export class BlobLimitador implements Limitador {
  private _store: Store | null = null;

  private get store(): Store {
    this._store ??= getStore('rate_limits');
    return this._store;
  }

  async consumir(chave: string, limite: number, janelaSegundos: number): Promise<Veredito> {
    const atual = balde(janelaSegundos);
    const reiniciaEm = (atual + 1) * janelaSegundos - Math.floor(Date.now() / 1000);
    const completa = `${chave}/${atual}`;

    let usados = 0;
    try {
      usados = Number((await this.store.get(completa, { type: 'text' })) ?? 0) || 0;
    } catch {
      // Store indisponivel nao pode derrubar o chat. Deixa passar e segue.
      return { permitido: true, usados: 0, limite, reiniciaEm };
    }

    if (usados >= limite) return { permitido: false, usados, limite, reiniciaEm };

    try {
      await this.store.set(completa, String(usados + 1));
    } catch {
      // idem: falhar ao contar e melhor que falhar a conversa
    }

    return { permitido: true, usados: usados + 1, limite, reiniciaEm };
  }
}

/** Para `next dev` e testes. Some com o processo, como tudo em memoria. */
export class MemoriaLimitador implements Limitador {
  private contagem = new Map<string, number>();

  async consumir(chave: string, limite: number, janelaSegundos: number): Promise<Veredito> {
    const atual = balde(janelaSegundos);
    const reiniciaEm = (atual + 1) * janelaSegundos - Math.floor(Date.now() / 1000);
    const completa = `${chave}/${atual}`;

    const usados = this.contagem.get(completa) ?? 0;
    if (usados >= limite) return { permitido: false, usados, limite, reiniciaEm };

    this.contagem.set(completa, usados + 1);
    return { permitido: true, usados: usados + 1, limite, reiniciaEm };
  }
}

/**
 * De onde vem o IP.
 *
 * `x-nf-client-connection-ip` e posto pelo Netlify e nao vem do cliente.
 * `x-forwarded-for` e cabecalho de requisicao e pode ser forjado — fica so
 * como ultimo recurso, e o primeiro item da lista e o mais proximo do cliente.
 */
export function ipDaRequisicao(request: Request): string {
  const doNetlify = request.headers.get('x-nf-client-connection-ip');
  if (doNetlify) return doNetlify;

  const encaminhado = request.headers.get('x-forwarded-for');
  if (encaminhado) return encaminhado.split(',')[0]?.trim() || 'desconhecido';

  return 'desconhecido';
}

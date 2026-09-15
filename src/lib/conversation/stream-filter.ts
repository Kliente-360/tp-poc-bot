/**
 * Aceita `<artigos>` e `<artigo>`.
 *
 * O Haiku 4.5 emitiu a tag no singular numa medicao, e o custo foi duplo: o
 * marcador apareceu na tela e o id do artigo sumiu do log de auditoria. Tolerar
 * a variacao e mais barato que confiar que todo modelo escreva a tag exata.
 */
const VARIANTES = [
  { abre: '<artigos>', fecha: '</artigos>' },
  { abre: '<artigo>', fecha: '</artigo>' },
] as const;

const ABRE = VARIANTES[0].abre;
const FECHA = VARIANTES[0].fecha;

/**
 * Separa a linha de registro interno do texto visivel, durante o streaming.
 *
 * O marcador chega fatiado — "<art", "igos>KB-1", "23</arti", "gos>" — entao
 * nao da para decidir olhando um delta isolado. A regra e: nunca emita um
 * trecho que ainda possa virar marcador.
 *
 * Duas coisas ficam retidas:
 *   - tudo a partir de um `<artigos>` aberto e ainda sem fechamento
 *   - qualquer sufixo do buffer que seja prefixo de `<artigos>`, porque o
 *     proximo delta pode completa-lo
 *
 * Sem isso o marcador aparece por uma fracao de segundo antes de sumir, que e
 * pior que nao ter marcador nenhum.
 */
export class FiltroDeArtigos {
  private buffer = '';
  private readonly ids = new Set<string>();

  /** Recebe um pedaco do stream e devolve so o que pode ir para a tela. */
  empurrar(delta: string): string {
    this.buffer += delta;
    let visivel = '';

    for (;;) {
      const { abre, fecha, inicio } = this.proximoMarcador();

      if (inicio === -1) {
        const retido = this.tamanhoDoSufixoAmbiguo(this.buffer);
        visivel += this.buffer.slice(0, this.buffer.length - retido);
        this.buffer = this.buffer.slice(this.buffer.length - retido);
        return visivel;
      }

      const fim = this.buffer.indexOf(fecha, inicio);
      if (fim === -1) {
        // Marcador aberto e incompleto: emite o que veio antes e segura o resto.
        visivel += this.buffer.slice(0, inicio);
        this.buffer = this.buffer.slice(inicio);
        return visivel;
      }

      for (const id of this.buffer.slice(inicio + abre.length, fim).split(',')) {
        const limpo = id.trim();
        if (limpo.length > 0) this.ids.add(limpo);
      }

      visivel += this.buffer.slice(0, inicio);
      this.buffer = this.buffer.slice(fim + fecha.length);
    }
  }

  /** Primeiro marcador de qualquer variante presente no buffer. */
  private proximoMarcador(): { abre: string; fecha: string; inicio: number } {
    let escolhido: { abre: string; fecha: string; inicio: number } = { abre: ABRE, fecha: FECHA, inicio: -1 };
    for (const v of VARIANTES) {
      const i = this.buffer.indexOf(v.abre);
      if (i !== -1 && (escolhido.inicio === -1 || i < escolhido.inicio)) {
        escolhido = { abre: v.abre, fecha: v.fecha, inicio: i };
      }
    }
    return escolhido;
  }

  /** Libera o que sobrou. Chamado quando o stream termina. */
  encerrar(): string {
    // Marcador aberto que nunca fechou nao e texto: o modelo cortou no meio.
    const { inicio } = this.proximoMarcador();
    const resto = inicio !== -1 ? this.buffer.slice(0, inicio) : this.buffer;
    this.buffer = '';
    return resto;
  }

  get artigos(): string[] {
    return [...this.ids];
  }

  /** Maior sufixo do texto que ainda pode se tornar `<artigos>`. */
  private tamanhoDoSufixoAmbiguo(texto: string): number {
    const maximo = Math.min(ABRE.length - 1, texto.length);
    for (let n = maximo; n > 0; n--) {
      const sufixo = texto.slice(texto.length - n);
      if (VARIANTES.some((v) => v.abre.startsWith(sufixo))) return n;
    }
    return 0;
  }
}

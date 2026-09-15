/**
 * Qualquer tag cuja forma lembre a do marcador.
 *
 * O Haiku 4.5 ja emitiu `<artigo>` no singular e `<artigos></artios>` com erro
 * de digitacao no fechamento. Perseguir variante uma a uma e jogo perdido:
 * cada modelo inventa a sua, e o preco de errar e alto — o marcador aparece na
 * tela e o id some do log de auditoria.
 *
 * Entao a regra deixou de ser "estas duas strings" e passou a ser "qualquer
 * coisa com cara de tag de artigo": abre em `<`, comeca com `arti`, fecha em
 * `>`. O que estiver entre a primeira e a segunda e a lista de ids.
 *
 * O prefixo e `arti` e nao `artig` porque o erro observado foi justamente a
 * falta do `g` — `</artios>`.
 */
const TAG = /<\/?\s*arti\w*\s*>/i;
const TAG_GLOBAL = new RegExp(TAG.source, 'gi');

/** Maior prefixo possivel de uma tag, para segurar no buffer. */
const INICIO_AMBIGUO = /<\/?\s*a?r?t?i?\w*$/i;

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
      const abertura = TAG.exec(this.buffer);

      if (!abertura) {
        const retido = this.tamanhoDoSufixoAmbiguo(this.buffer);
        visivel += this.buffer.slice(0, this.buffer.length - retido);
        this.buffer = this.buffer.slice(this.buffer.length - retido);
        return visivel;
      }

      const inicioConteudo = abertura.index + abertura[0].length;
      TAG_GLOBAL.lastIndex = inicioConteudo;
      const fechamento = TAG_GLOBAL.exec(this.buffer);

      if (!fechamento) {
        // Marcador aberto e ainda sem par: emite o que veio antes e segura.
        visivel += this.buffer.slice(0, abertura.index);
        this.buffer = this.buffer.slice(abertura.index);
        return visivel;
      }

      for (const id of this.buffer.slice(inicioConteudo, fechamento.index).split(',')) {
        const limpo = id.trim();
        if (limpo.length > 0) this.ids.add(limpo);
      }

      visivel += this.buffer.slice(0, abertura.index);
      this.buffer = this.buffer.slice(fechamento.index + fechamento[0].length);
    }
  }

  /** Libera o que sobrou. Chamado quando o stream termina. */
  encerrar(): string {
    const abertura = TAG.exec(this.buffer);
    const resto = abertura ? this.buffer.slice(0, abertura.index) : this.buffer;
    this.buffer = '';
    return resto;
  }

  get artigos(): string[] {
    return [...this.ids];
  }

  /** Maior sufixo do texto que ainda pode se tornar uma tag de artigo. */
  private tamanhoDoSufixoAmbiguo(texto: string): number {
    const m = INICIO_AMBIGUO.exec(texto);
    return m ? m[0].length : 0;
  }
}

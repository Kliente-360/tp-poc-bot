import type { Limitador } from '../rate-limit';
import type { AbridorDeCaso } from './engine';

/** Excedeu o limite. O motor devolve isto ao modelo como erro de ferramenta. */
export class LimiteDeChamadosExcedido extends Error {
  constructor(readonly reiniciaEm: number) {
    super(
      'Você já abriu chamados demais em pouco tempo. ' +
        'Explique isso à pessoa com naturalidade, diga que ela pode tentar de novo mais tarde, ' +
        'e continue ajudando no que der.',
    );
    this.name = 'LimiteDeChamadosExcedido';
  }
}

/**
 * Envolve o abridor com limite por IP.
 *
 * E aqui que o rate limit importa mais: sem ele, o primeiro bot que achar o
 * endpoint enche a fila de atendimento do cliente — e cada chamado falso custa
 * tempo de gente, nao de maquina.
 *
 * Decorador, e nao uma checagem dentro do motor, para que o motor continue sem
 * saber que limite existe. A bateria de testes segue rodando sem limitador.
 *
 * Quando estoura, o erro volta ao modelo como resultado de ferramenta: ele
 * avisa a pessoa com as palavras dele, em vez de a conversa quebrar.
 */
export function comLimiteDeChamados(
  abridor: AbridorDeCaso,
  limitador: Limitador,
  limite: number,
  janelaSegundos: number,
): AbridorDeCaso {
  return {
    async abrir(entrada) {
      const origem = entrada.ip ?? 'desconhecido';
      const veredito = await limitador.consumir(`caso/${origem}`, limite, janelaSegundos);

      if (!veredito.permitido) {
        console.warn(
          JSON.stringify({
            evento: 'limite_de_chamados',
            ip: origem,
            usados: veredito.usados,
            limite: veredito.limite,
          }),
        );
        throw new LimiteDeChamadosExcedido(veredito.reiniciaEm);
      }

      return abridor.abrir(entrada);
    },
  };
}

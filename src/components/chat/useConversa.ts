'use client';

import { useCallback, useRef, useState } from 'react';

export interface MensagemVisivel {
  papel: 'usuario' | 'lets';
  texto: string;
}

type EventoSSE =
  | { t: 'texto'; v: string }
  | { t: 'fim'; numeroCaso: string | null; historico: unknown[] }
  | { t: 'erro'; v: string };

/**
 * Estado da conversa no cliente.
 *
 * O historico completo fica aqui e volta ao servidor a cada turno: nao gravamos
 * transcript do nosso lado. Ele mora num ref, e nao em state, porque nada na
 * tela depende dele — colocar em state renderizaria o painel inteiro a cada
 * token que chega.
 */
export function useConversa() {
  const [mensagens, setMensagens] = useState<MensagemVisivel[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const historico = useRef<unknown[]>([]);
  const conversationId = useRef<string>('');
  const ultimaPergunta = useRef<string>('');

  if (!conversationId.current && typeof crypto !== 'undefined') {
    conversationId.current = crypto.randomUUID();
  }

  const enviar = useCallback(async (pergunta: string, reenvio = false) => {
    const texto = pergunta.trim();
    if (!texto) return;

    ultimaPergunta.current = texto;
    setErro(null);
    setEnviando(true);
    if (!reenvio) setMensagens((m) => [...m, { papel: 'usuario', texto }]);

    try {
      const resposta = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: conversationId.current,
          pergunta: texto,
          historico: historico.current,
        }),
      });

      if (!resposta.ok || !resposta.body) throw new Error(`HTTP ${resposta.status}`);

      const leitor = resposta.body.getReader();
      const decoder = new TextDecoder();
      let sobra = '';
      let abriuBalao = false;

      for (;;) {
        const { done, value } = await leitor.read();
        if (done) break;

        sobra += decoder.decode(value, { stream: true });
        const linhas = sobra.split('\n\n');
        sobra = linhas.pop() ?? '';

        for (const bruta of linhas) {
          if (!bruta.startsWith('data: ')) continue;
          const evento = JSON.parse(bruta.slice(6)) as EventoSSE;

          if (evento.t === 'texto') {
            // O balao da Lets so nasce com o primeiro token: ate la a tela
            // mostra o indicador de digitando, e nao um balao vazio piscando.
            if (!abriuBalao) {
              abriuBalao = true;
              setMensagens((m) => [...m, { papel: 'lets', texto: evento.v }]);
            } else {
              setMensagens((m) => {
                const copia = [...m];
                const ultima = copia[copia.length - 1];
                if (ultima) copia[copia.length - 1] = { ...ultima, texto: ultima.texto + evento.v };
                return copia;
              });
            }
          } else if (evento.t === 'fim') {
            historico.current = evento.historico;
          } else if (evento.t === 'erro') {
            throw new Error(evento.v);
          }
        }
      }

      if (!abriuBalao) throw new Error('resposta vazia');
    } catch {
      setErro('Não consegui falar com o servidor. Quer tentar de novo?');
    } finally {
      setEnviando(false);
    }
  }, []);

  const tentarDeNovo = useCallback(() => {
    void enviar(ultimaPergunta.current, true);
  }, [enviar]);

  return { mensagens, enviando, erro, enviar, tentarDeNovo };
}

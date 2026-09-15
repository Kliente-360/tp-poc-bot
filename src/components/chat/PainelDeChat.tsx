'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import estilos from './painel.module.css';
import { useConversa } from './useConversa';

const SAUDACAO = 'Oi! Eu sou a Léts, assistente virtual da TotalPass. Como posso te ajudar?';

/**
 * Sugestoes so da secao Empresa, que e o publico do portal.
 *
 * A base carregada e maior — Alunos, LGPD, Quem somos — e a Lets responde tudo
 * isso normalmente. As sugestoes e que sao a porta de entrada, e a porta de
 * entrada e de quem administra o beneficio, nao de quem usa a academia.
 */
const SUGESTOES = [
  'Como cadastrar colaboradores?',
  'O que são os boletos Fee e Coparticipação?',
  'Como funciona o distrato com a TotalPass?',
];

/**
 * Painel de conversa.
 *
 * Componente React comum, dentro da mesma aplicacao — nao e a arquitetura final
 * de loader externo com iframe, que e a fase de integracao no portal real.
 *
 * Mas nada aqui depende da pagina que o hospeda: os estilos sao um CSS Module
 * com tokens proprios, e nao ha estado compartilhado. Quando ele virar o widget
 * embedado, o componente vai junto sem alteracao — muda so o invólucro.
 */
export function PainelDeChat() {
  const [aberto, setAberto] = useState(false);
  const { mensagens, enviando, erro, enviar, tentarDeNovo } = useConversa();
  const [rascunho, setRascunho] = useState('');

  const fim = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLTextAreaElement>(null);
  const botao = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    fim.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [mensagens, enviando, erro]);

  useEffect(() => {
    if (aberto) campo.current?.focus();
  }, [aberto]);

  // Esc fecha, e o foco volta para o botao — senao quem navega por teclado
  // fica perdido no fim do documento.
  useEffect(() => {
    if (!aberto) return;
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setAberto(false);
        botao.current?.focus();
      }
    };
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [aberto]);

  function submeter(e: FormEvent) {
    e.preventDefault();
    if (enviando || !rascunho.trim()) return;
    void enviar(rascunho);
    setRascunho('');
  }

  const esperandoPrimeiroToken = enviando && mensagens[mensagens.length - 1]?.papel === 'usuario';

  return (
    <>
      <button
        ref={botao}
        type="button"
        className={estilos.flutuante}
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        aria-label={aberto ? 'Fechar conversa com a Léts' : 'Abrir conversa com a Léts'}
      >
        {aberto ? <IconeFechar /> : <IconeBalao />}
      </button>

      {aberto && (
        <section className={estilos.painel} aria-label="Conversa com a Léts">
          <header className={estilos.topo}>
            <span className={estilos.avatar} aria-hidden="true">
              L
            </span>
            <div>
              <p className={estilos.nome}>Léts</p>
              <p className={estilos.status}>Assistente da TotalPass</p>
            </div>
            <button
              type="button"
              className={estilos.fechar}
              onClick={() => {
                setAberto(false);
                botao.current?.focus();
              }}
              aria-label="Fechar conversa"
            >
              <IconeFechar />
            </button>
          </header>

          <div className={estilos.corpo} role="log" aria-live="polite" aria-atomic="false">
            <div className={`${estilos.balao} ${estilos.daLets}`}>{SAUDACAO}</div>

            {mensagens.length === 0 && (
              <div className={estilos.sugestoes}>
                {SUGESTOES.map((s) => (
                  <button key={s} type="button" className={estilos.sugestao} onClick={() => void enviar(s)}>
                    {s}
                  </button>
                ))}
              </div>
            )}

            {mensagens.map((m, i) => (
              <div
                key={i}
                className={`${estilos.balao} ${m.papel === 'lets' ? estilos.daLets : estilos.doUsuario}`}
              >
                {m.texto}
              </div>
            ))}

            {esperandoPrimeiroToken && (
              <div className={`${estilos.balao} ${estilos.daLets} ${estilos.digitando}`} aria-label="Léts está digitando">
                <i />
                <i />
                <i />
              </div>
            )}

            {erro && (
              <div className={estilos.erro} role="alert">
                <span>{erro}</span>
                <button type="button" onClick={tentarDeNovo}>
                  Tentar de novo
                </button>
              </div>
            )}

            <div ref={fim} />
          </div>

          <form className={estilos.rodape} onSubmit={submeter}>
            <textarea
              ref={campo}
              className={estilos.campo}
              value={rascunho}
              onChange={(e) => setRascunho(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) submeter(e);
              }}
              placeholder="Escreva sua dúvida"
              rows={1}
              aria-label="Sua mensagem"
              disabled={enviando}
            />
            <button
              type="submit"
              className={estilos.enviar}
              disabled={enviando || !rascunho.trim()}
              aria-label="Enviar"
            >
              <IconeSeta />
            </button>
          </form>

          <p className={estilos.aviso}>Demonstração IA Kliente 360</p>
        </section>
      )}
    </>
  );
}

function IconeBalao() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" aria-hidden="true">
      <path
        d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.3-.6L3 21l1.8-4.9A8.2 8.2 0 0 1 3.6 11.5a8.4 8.4 0 0 1 9-8.4 8.4 8.4 0 0 1 8.4 8.4Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconeFechar() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true">
      <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconeSeta() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
      <path d="M12 19V5M5 12l7-7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

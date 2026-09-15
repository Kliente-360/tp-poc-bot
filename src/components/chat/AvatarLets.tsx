import { useId } from 'react';

/**
 * Avatar da Lets, desenhado em SVG.
 *
 * Vetor e nao imagem: fica nitido no circulo de 38px do cabecalho e no botao
 * flutuante sem virar mais uma requisicao, e a cor do cabelo e do blazer sao
 * dois gradientes, nao um arquivo para reexportar.
 *
 * Os ids dos gradientes levam useId porque id de SVG e global no documento: o
 * avatar aparece duas vezes na tela ao mesmo tempo.
 */
export function AvatarLets({ tamanho = 38 }: { tamanho?: number }) {
  const id = useId().replace(/:/g, '');

  return (
    <svg
      viewBox="0 0 120 120"
      width={tamanho}
      height={tamanho}
      role="img"
      aria-label="Léts"
      style={{ display: 'block', borderRadius: '50%' }}
    >
      <defs>
      <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stopColor="#63BCA0"/><stop offset="1" stopColor="#3C9A83"/>
      </linearGradient>
      <linearGradient id={`${id}-cabelo`} x1="0.15" y1="0" x2="0.8" y2="1">
      <stop offset="0" stopColor="#E8C078"/><stop offset="0.45" stopColor="#CE9F55"/><stop offset="1" stopColor="#A97C3C"/>
      </linearGradient>
      <linearGradient id={`${id}-pele`} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#F8D7BA"/><stop offset="1" stopColor="#EBBE9A"/>
      </linearGradient>
      <linearGradient id={`${id}-blazer`} x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stopColor="#A9737E"/><stop offset="1" stopColor="#8A5964"/>
      </linearGradient>
      <clipPath id={`${id}-recorte`}><circle cx="60" cy="60" r="60"/></clipPath>
      </defs>
      <g clipPath={`url(#${id}-recorte)`}>
      <circle cx="60" cy="60" r="60" fill={`url(#${id}-bg)`}/>
      <circle cx="60" cy="56" r="41" fill="#ffffff" opacity="0.17"/>
      <g fill="#ffffff" opacity="0.14">
      <rect x="4" y="26" width="25" height="15" rx="5"/><path d="M10 41h8l-6 6z"/>
      <rect x="88" y="16" width="30" height="11" rx="5"/>
      <rect x="94" y="33" width="24" height="9" rx="4"/>
      <rect x="2" y="52" width="16" height="8" rx="4"/>
      </g>
      {/* cabelo de tras: silhueta ondulada, com volume nos lados */}
      <path d="M60 11C38 11 25 27 25 52c0 11-2 19-5 27 4-2 8-1 10 2 2 4 1 9-2 14 6-1 12-4 16-9 4-5 6-11 7-17h18c1 6 3 12 7 17 4 5 10 8 16 9-3-5-4-10-2-14 2-3 6-4 10-2-3-8-5-16-5-27 0-25-13-41-35-41z" fill={`url(#${id}-cabelo)`}/>
      {/* pescoco */}
      <path d="M52 71h16v17c0 7-16 7-16 0z" fill="#E3B392"/>
      <path d="M52 71h16v6c-5 5-11 5-16 0z" fill="#D7A582"/>
      {/* base dos ombros: uma peca so, para nao sobrar fresta de fundo */}
      <path d="M60 84c-26 0-45 13-49 36h98c-4-23-23-36-49-36z" fill={`url(#${id}-blazer)`}/>
      {/* blusa, no decote */}
      <path d="M45 85 60 110 75 85l4 35H41z" fill="#F4EBE0"/>
      {/* lapelas por cima, fechando o V */}
      <path d="M45 85 63 120H50L36 93c3-4 6-6 9-8z" fill={`url(#${id}-blazer)`}/>
      <path d="M75 85 57 120h13l14-27c-3-4-6-6-9-8z" fill={`url(#${id}-blazer)`}/>
      <path d="M45 85 62 120h-4L41 91z" fill="#96666F" opacity="0.85"/>
      <path d="M75 85 58 120h4l17-29z" fill="#96666F" opacity="0.85"/>
      {/* correntinha */}
      <path d="M54 94c2 4.5 10 4.5 12 0" stroke="#DCBA6A" strokeWidth="1.7" fill="none" strokeLinecap="round"/>
      {/* rosto */}
      <path d="M40 51c0-15 8-24 20-24s20 9 20 24c0 17-9 31-20 31s-20-14-20-31z" fill={`url(#${id}-pele)`}/>
      {/* franja e mechas sobre o rosto, com onda */}
      <path d="M60 24c-13 0-21 9-22 23 4-11 10-17 20-18 11-1 19 4 23 14-1-13-9-19-21-19z" fill={`url(#${id}-cabelo)`}/>
      <path d="M38 45c-4 11-4 23-1 34-6-13-7-29-2-42 4-11 12-18 23-20-11 6-17 15-20 28z" fill={`url(#${id}-cabelo)`}/>
      <path d="M82 45c4 11 4 23 1 34 6-13 7-29 2-42-4-11-12-18-23-20 11 6 17 15 20 28z" fill={`url(#${id}-cabelo)`}/>
      {/* feicoes */}
      <path d="M46 46c3-2.5 8-2.5 11 0" stroke="#6B4A2A" strokeWidth="1.9" fill="none" strokeLinecap="round"/>
      <path d="M63 46c3-2.5 8-2.5 11 0" stroke="#6B4A2A" strokeWidth="1.9" fill="none" strokeLinecap="round"/>
      <ellipse cx="51" cy="55" rx="3.3" ry="3.6" fill="#fff"/>
      <ellipse cx="69" cy="55" rx="3.3" ry="3.6" fill="#fff"/>
      <circle cx="51.5" cy="55.4" r="2.1" fill="#6B4423"/><circle cx="69.5" cy="55.4" r="2.1" fill="#6B4423"/>
      <circle cx="52.3" cy="54.5" r="0.8" fill="#fff"/><circle cx="70.3" cy="54.5" r="0.8" fill="#fff"/>
      <path d="M58.5 62.5c1 1.5 2 1.5 3 0" stroke="#D3A183" strokeWidth="1.4" fill="none" strokeLinecap="round"/>
      <path d="M52 68c4 4.5 12 4.5 16 0-1.5 6.5-14.5 6.5-16 0z" fill="#BE6363"/>
      <path d="M53.6 68.8c4 1.1 8.8 1.1 12.8 0-3.5-1.3-9.3-1.3-12.8 0z" fill="#fff"/>
      <ellipse cx="44.5" cy="61" rx="3.4" ry="2.3" fill="#E79A8A" opacity="0.42"/>
      <ellipse cx="75.5" cy="61" rx="3.4" ry="2.3" fill="#E79A8A" opacity="0.42"/>
      </g>
      <circle cx="60" cy="60" r="59" fill="none" stroke="#ffffff" strokeOpacity="0.28" strokeWidth="2"/>
    </svg>
  );
}

import type { Metadata, Viewport } from 'next';
import { Poppins } from 'next/font/google';
import type { ReactNode } from 'react';
import './globals.css';

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-poppins',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Portal TotalPass — simulação',
  description: 'Prova de conceito do assistente de atendimento. Kliente 360.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // O painel ocupa a tela inteira no celular; sem isto o teclado virtual
  // empurra o layout e a caixa de texto some atras dele.
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className={poppins.variable}>
      <body>{children}</body>
    </html>
  );
}

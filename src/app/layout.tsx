import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import { NextAuthProvider } from "@/providers/auth-provider";
import { QueryProvider } from "@/providers/query-provider";
import ThemeInitializer from "@/components/theme-initializer";
import AlertDialog from "@/components/alert-dialog";
const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Solutii - Apontamentos",
  description: "Sistema de Controle de Apontamentos",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <NextAuthProvider>
      {/* suppressHydrationWarning: o script abaixo adiciona a classe "dark" no
          <html> antes de o React hidratar (evita o flash claro), então o HTML do
          servidor e o do navegador diferem de propósito nesse atributo. Vale só
          para este elemento, não para os filhos. */}
      <html lang="en" suppressHydrationWarning>
        <head>
          {/* Aplica a classe "dark" antes do primeiro paint, lendo direto
                do localStorage -- sem isso, a página sempre nasce clara e só
                troca pra escura depois que o React hidrata e o Zustand
                persist termina de reidratar, causando o "flash" claro. */}
          <script
            dangerouslySetInnerHTML={{
              __html: `
                  (function () {
                    try {
                      var raw = localStorage.getItem('gerproj-theme');
                      var theme = raw ? JSON.parse(raw).state.theme : 'light';
                      if (theme === 'dark') {
                        document.documentElement.classList.add('dark');
                      }
                    } catch (e) {}
                  })();
                `,
            }}
          />
        </head>
        <body className={poppins.className}>
          <ThemeInitializer />
          <AlertDialog />
          <QueryProvider>{children}</QueryProvider>
        </body>
      </html>
    </NextAuthProvider>
  );
}

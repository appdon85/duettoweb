import type { Metadata } from "next";
import { AuthProvider } from "@/contexts/AuthContext";
import "./globals.css";

// Deliberadamente SEM next/font/google: o build (next build) baixa a fonte da
// rede no momento da compilação, o que falha atrás de proxy corporativo ou
// sem internet - exatamente a categoria de problema que já consumiu bastante
// tempo no deploy do backend. A pilha de fontes do sistema (ver globals.css)
// já cobre bem o visual sem essa dependência de rede em build time.

export const metadata: Metadata = {
  title: "Duetto CRM",
  description: "Painel do Duetto CRM",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-zinc-50">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}

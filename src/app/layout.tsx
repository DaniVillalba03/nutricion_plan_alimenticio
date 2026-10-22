import type { Metadata } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme/ThemeProvider";

// Grotesca geométrica: titulares en negrita con tracking cerrado y cifras muy legibles
const ui = Space_Grotesk({
  variable: "--font-ui",
  subsets: ["latin"],
});

// Monoespaciada para microetiquetas de datos (mayúsculas pequeñas)
const mono = JetBrains_Mono({
  variable: "--font-mono-ui",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "NutriPlan PY - Sistema de Intercambios Nutricionales",
  description:
    "Plataforma clínica para nutricionistas en Paraguay. Planificación ágil por sistema de intercambios y alimentos locales (Lic. Laura Molinas Reg. Prof. 6020).",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={`${ui.variable} ${mono.variable} h-full antialiased`}
    >
      <head>
        {/* Aplica el tema antes del primer pintado para evitar el parpadeo */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=localStorage.getItem('nutriplan-theme');var d=s==='dark'||((!s||s==='system')&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground font-sans transition-colors duration-150">
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme/ThemeProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/* Aplica el tema antes del primer pintado para evitar el parpadeo */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=localStorage.getItem('nutriplan-theme');var d=s==='dark'||((!s||s==='system')&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground font-sans selection:bg-emerald-500 selection:text-white transition-colors duration-150">
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}

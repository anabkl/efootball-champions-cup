import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "eFootball Champions Cup", template: "%s · eFootball Champions Cup" },
  description: "Private eFootball tournament management for friends.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className="h-full antialiased">
      <body className="min-h-full">
        <header className="site-header">
          <nav className="site-nav" aria-label="Navigation principale">
            <Link className="brand" href="/"><span className="brand-mark">E</span><span>EFC <small>Champions Cup</small></span></Link>
            <div className="nav-links">
              <Link href="/tournaments">Tournoi</Link><Link href="/players">Joueurs</Link><Link href="/dashboard">Dashboard</Link><Link className="nav-admin" href="/admin">Admin</Link>
            </div>
          </nav>
        </header>
        {children}
        <footer className="site-footer">eFootball Champions Cup · Compétition privée entre amis</footer>
      </body>
    </html>
  );
}

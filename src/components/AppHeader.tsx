"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

const NAV_LINKS = [
  { href: "/dashboard", label: "Painel" },
  { href: "/companies", label: "Empresas" },
  { href: "/contacts", label: "Contatos" },
  { href: "/deals", label: "Negócios" },
];

export function AppHeader() {
  const { logout } = useAuth();
  const pathname = usePathname();

  return (
    <header className="border-b border-zinc-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
        <div className="flex items-center gap-8">
          <span className="text-lg font-semibold text-zinc-900">Duetto CRM</span>
          <nav className="flex gap-4">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm font-medium ${
                  pathname === link.href
                    ? "text-zinc-900"
                    : "text-zinc-500 hover:text-zinc-700"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <button
          onClick={() => logout()}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
        >
          Sair
        </button>
      </div>
    </header>
  );
}

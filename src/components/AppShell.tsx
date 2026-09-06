"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Building2,
  CalendarDays,
  ClipboardList,
  FileCheck,
  FileSignature,
  FileText,
  Handshake,
  LayoutDashboard,
  LogOut,
  Users,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const NAV_LINKS = [
  { href: "/dashboard", label: "Painel", icon: LayoutDashboard },
  { href: "/companies", label: "Empresas", icon: Building2 },
  { href: "/contacts", label: "Contatos", icon: Users },
  { href: "/deals", label: "Negócios", icon: Handshake },
  { href: "/activities", label: "Atividades", icon: ClipboardList },
  { href: "/calendar", label: "Calendário", icon: CalendarDays },
  { href: "/templates", label: "Modelos", icon: FileText },
  { href: "/proposals", label: "Propostas", icon: FileSignature },
  { href: "/contracts", label: "Contratos", icon: FileCheck },
  { href: "/reports", label: "Relatórios", icon: BarChart3 },
];

/**
 * Casca visual de toda pagina autenticada: barra lateral fixa (navegacao +
 * identidade do usuario) e area de conteudo rolavel a direita. Substitui o
 * antigo AppHeader (barra superior) - cada pagina so precisa envolver seu
 * conteudo aqui dentro, sem repetir a estrutura de layout.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  return (
    <div className="flex flex-1">
      <aside className="flex w-64 flex-shrink-0 flex-col border-r border-zinc-200 bg-white">
        <div className="flex items-center gap-2 px-6 py-5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white">
            D
          </span>
          <span className="text-base font-semibold tracking-tight text-zinc-900">
            Duetto CRM
          </span>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-2">
          {NAV_LINKS.map((link) => {
            const isActive = pathname === link.href;
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-blue-50 text-blue-700"
                    : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
                }`}
              >
                <Icon className="h-4.5 w-4.5" strokeWidth={2} />
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-zinc-200 px-3 py-3">
          <div className="flex items-center gap-2 rounded-lg px-3 py-2">
            <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-semibold text-zinc-600">
              {user?.name ? user.name.slice(0, 1).toUpperCase() : "?"}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-zinc-900">{user?.name}</p>
              <p className="truncate text-xs text-zinc-400">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={() => logout()}
            className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-900"
          >
            <LogOut className="h-4.5 w-4.5" strokeWidth={2} />
            Sair
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import type { TenantUserRow } from "@/lib/types";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { AppHeader } from "@/components/AppHeader";

export default function DashboardPage() {
  const { user, isLoading, authFetch } = useRequireAuth();

  const [users, setUsers] = useState<TenantUserRow[] | null>(null);
  const [usersError, setUsersError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    if (!user.permissions.includes("users:read")) return;

    let cancelled = false;
    authFetch<TenantUserRow[]>("/users")
      .then((rows) => {
        if (!cancelled) setUsers(rows);
      })
      .catch((err) => {
        if (cancelled) return;
        setUsersError(
          err instanceof ApiError ? err.message : "Não foi possível carregar os usuários.",
        );
      });
    return () => {
      cancelled = true;
    };
  }, [user, authFetch]);

  if (isLoading || !user) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-zinc-500">Carregando…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <div className="mb-8 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-medium text-zinc-500">Sua conta</h2>
          <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-zinc-400">Nome</dt>
              <dd className="text-sm text-zinc-900">{user.name}</dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-400">E-mail</dt>
              <dd className="text-sm text-zinc-900">{user.email}</dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-400">Permissões</dt>
              <dd className="text-sm text-zinc-900">{user.permissions.join(", ")}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-medium text-zinc-500">Usuários da empresa</h2>

          {!user.permissions.includes("users:read") && (
            <p className="text-sm text-zinc-500">
              Seu papel não tem permissão para ver a lista de usuários.
            </p>
          )}

          {usersError && <p className="text-sm text-red-600">{usersError}</p>}

          {user.permissions.includes("users:read") && !usersError && (
            <div className="overflow-x-auto">
              {users === null ? (
                <p className="text-sm text-zinc-500">Carregando…</p>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 text-xs text-zinc-400">
                      <th className="py-2 pr-4 font-medium">Nome</th>
                      <th className="py-2 pr-4 font-medium">E-mail</th>
                      <th className="py-2 pr-4 font-medium">Papel</th>
                      <th className="py-2 pr-4 font-medium">Status</th>
                      <th className="py-2 pr-4 font-medium">MFA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((row) => (
                      <tr key={row.id} className="border-b border-zinc-100 last:border-0">
                        <td className="py-2 pr-4 text-zinc-900">{row.name}</td>
                        <td className="py-2 pr-4 text-zinc-600">{row.email}</td>
                        <td className="py-2 pr-4 text-zinc-600">{row.roleName}</td>
                        <td className="py-2 pr-4 text-zinc-600">{row.status}</td>
                        <td className="py-2 pr-4 text-zinc-600">
                          {row.mfaEnabled ? "Ativo" : "Inativo"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

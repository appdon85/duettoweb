"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import { ApiError } from "@/lib/api";
import type { Company, Paginated } from "@/lib/types";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { AppShell } from "@/components/AppShell";
import { Drawer } from "@/components/Drawer";

const PAGE_SIZE = 20;

const EMPTY_FORM = { name: "", cnpj: "", website: "", phone: "", notes: "" };

export default function CompaniesPage() {
  const { user, isLoading, authFetch } = useRequireAuth();
  const canManage = user?.permissions.includes("contacts:manage") ?? false;

  const [result, setResult] = useState<Paginated<Company> | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const load = useCallback(
    async (targetPage: number, targetSearch: string) => {
      const params = new URLSearchParams({
        page: String(targetPage),
        pageSize: String(PAGE_SIZE),
      });
      if (targetSearch) params.set("search", targetSearch);

      try {
        const data = await authFetch<Paginated<Company>>(`/companies?${params.toString()}`);
        setResult(data);
        setListError(null);
      } catch (err) {
        setListError(
          err instanceof ApiError ? err.message : "Não foi possível carregar as empresas.",
        );
      }
    },
    [authFetch],
  );

  useEffect(() => {
    if (!user) return;
    // Padrao recomendado pela doc do React para data fetching em efeito
    // (https://react.dev/learn/you-might-not-need-an-effect#fetching-data) -
    // load() ja atualiza seu proprio estado (result/listError) diretamente,
    // entao nao ha corrida de "resposta antiga sobrescrevendo a mais nova"
    // aqui: page/search mudam de forma sincrona (clique/digitacao), nao
    // concorrentemente.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(page, search);
  }, [user, page, search, load]);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setIsDrawerOpen(true);
  }

  function startEdit(company: Company) {
    setEditingId(company.id);
    setForm({
      name: company.name,
      cnpj: company.cnpj ?? "",
      website: company.website ?? "",
      phone: company.phone ?? "",
      notes: company.notes ?? "",
    });
    setFormError(null);
    setIsDrawerOpen(true);
  }

  function closeDrawer() {
    setIsDrawerOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setIsSubmitting(true);

    const payload = {
      name: form.name,
      cnpj: form.cnpj || undefined,
      website: form.website || undefined,
      phone: form.phone || undefined,
      notes: form.notes || undefined,
    };

    try {
      if (editingId) {
        await authFetch(`/companies/${editingId}`, { method: "PATCH", body: payload });
      } else {
        await authFetch("/companies", { method: "POST", body: payload });
      }
      closeDrawer();
      await load(page, search);
    } catch (err) {
      setFormError(
        err instanceof ApiError ? err.message : "Não foi possível salvar a empresa.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Excluir esta empresa? Essa ação não pode ser desfeita.")) return;
    try {
      await authFetch(`/companies/${id}`, { method: "DELETE" });
      if (editingId === id) closeDrawer();
      await load(page, search);
    } catch (err) {
      setListError(
        err instanceof ApiError ? err.message : "Não foi possível excluir a empresa.",
      );
    }
  }

  if (isLoading || !user) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-zinc-500">Carregando…</p>
      </div>
    );
  }

  const totalPages = result ? Math.max(1, Math.ceil(result.total / PAGE_SIZE)) : 1;

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Empresas</h1>
          {canManage && (
            <button
              onClick={openCreate}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" strokeWidth={2.5} />
              Nova empresa
            </button>
          )}
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-sm font-medium text-zinc-500">
              {result ? `${result.total} empresa(s)` : "Empresas"}
            </h2>
            <input
              type="search"
              placeholder="Buscar por nome…"
              value={search}
              onChange={(e) => {
                setPage(1);
                setSearch(e.target.value);
              }}
              className="w-56 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>

          {listError && <p className="text-sm text-red-600">{listError}</p>}

          {!listError && (
            <div className="overflow-x-auto">
              {result === null ? (
                <p className="text-sm text-zinc-500">Carregando…</p>
              ) : result.data.length === 0 ? (
                <p className="text-sm text-zinc-500">Nenhuma empresa cadastrada ainda.</p>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 text-xs font-medium tracking-wide text-zinc-500 uppercase">
                      <th className="py-2 pr-4 font-medium">Nome</th>
                      <th className="py-2 pr-4 font-medium">CNPJ</th>
                      <th className="py-2 pr-4 font-medium">Telefone</th>
                      <th className="py-2 pr-4 font-medium">Site</th>
                      {canManage && <th className="py-2 pr-4 font-medium" />}
                    </tr>
                  </thead>
                  <tbody>
                    {result.data.map((company) => (
                      <tr key={company.id} className="border-b border-zinc-100 last:border-0">
                        <td className="py-2 pr-4 text-zinc-900">{company.name}</td>
                        <td className="py-2 pr-4 text-zinc-600">{company.cnpj ?? "—"}</td>
                        <td className="py-2 pr-4 text-zinc-600">{company.phone ?? "—"}</td>
                        <td className="py-2 pr-4 text-zinc-600">{company.website ?? "—"}</td>
                        {canManage && (
                          <td className="py-2 pr-4 whitespace-nowrap text-right">
                            <button
                              onClick={() => startEdit(company)}
                              className="mr-3 text-zinc-500 hover:text-zinc-900"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => handleDelete(company.id)}
                              className="text-red-500 hover:text-red-700"
                            >
                              Excluir
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {result && totalPages > 1 && (
            <div className="mt-4 flex items-center justify-end gap-3 text-sm text-zinc-500">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="disabled:opacity-40"
              >
                Anterior
              </button>
              <span>
                Página {page} de {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="disabled:opacity-40"
              >
                Próxima
              </button>
            </div>
          )}
        </div>
      </div>

      <Drawer
        open={isDrawerOpen}
        onClose={closeDrawer}
        title={editingId ? "Editar empresa" : "Nova empresa"}
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700">Nome</label>
            <input
              required
              maxLength={200}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700">CNPJ</label>
            <input
              maxLength={32}
              value={form.cnpj}
              onChange={(e) => setForm({ ...form, cnpj: e.target.value })}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700">Telefone</label>
            <input
              maxLength={40}
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700">Site</label>
            <input
              maxLength={255}
              value={form.website}
              onChange={(e) => setForm({ ...form, website: e.target.value })}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700">Notas</label>
            <textarea
              maxLength={4000}
              rows={3}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>

          {formError && <p className="text-sm text-red-600">{formError}</p>}

          <div className="mt-2 flex gap-3">
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? "Salvando…" : editingId ? "Atualizar" : "Adicionar"}
            </button>
            <button
              type="button"
              onClick={closeDrawer}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50"
            >
              Cancelar
            </button>
          </div>
        </form>
      </Drawer>
    </AppShell>
  );
}

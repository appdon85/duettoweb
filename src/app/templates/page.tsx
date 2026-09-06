"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import { ApiError } from "@/lib/api";
import type { DocumentTemplate, Paginated, TemplateType, TemplateVariable } from "@/lib/types";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { AppShell } from "@/components/AppShell";
import { Drawer } from "@/components/Drawer";

const PAGE_SIZE = 20;

const TYPES: Array<{ value: TemplateType; label: string }> = [
  { value: "PROPOSAL", label: "Proposta" },
  { value: "CONTRACT", label: "Contrato" },
];

function typeLabel(type: TemplateType): string {
  return TYPES.find((t) => t.value === type)?.label ?? type;
}

const EMPTY_FORM = { type: "PROPOSAL" as TemplateType, name: "", content: "" };

export default function TemplatesPage() {
  const { user, isLoading, authFetch } = useRequireAuth();
  const canManage = user?.permissions.includes("templates:manage") ?? false;

  const [result, setResult] = useState<Paginated<DocumentTemplate> | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TemplateType | "">("");

  const [variables, setVariables] = useState<TemplateVariable[]>([]);

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const load = useCallback(
    async (targetPage: number, targetSearch: string, targetType: TemplateType | "") => {
      const params = new URLSearchParams({
        page: String(targetPage),
        pageSize: String(PAGE_SIZE),
      });
      if (targetSearch) params.set("search", targetSearch);
      if (targetType) params.set("type", targetType);

      try {
        const data = await authFetch<Paginated<DocumentTemplate>>(
          `/templates?${params.toString()}`,
        );
        setResult(data);
        setListError(null);
      } catch (err) {
        setListError(
          err instanceof ApiError ? err.message : "Não foi possível carregar os modelos.",
        );
      }
    },
    [authFetch],
  );

  useEffect(() => {
    if (!user) return;
    // Ver comentario equivalente em app/companies/page.tsx.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(page, search, typeFilter);
  }, [user, page, search, typeFilter, load]);

  useEffect(() => {
    if (!user) return;
    authFetch<TemplateVariable[]>("/templates/variables")
      .then(setVariables)
      .catch(() => {
        // Legenda de variaveis e' so' um apoio visual no editor - uma falha
        // aqui nao deve travar a pagina de modelos inteira.
      });
  }, [user, authFetch]);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setIsDrawerOpen(true);
  }

  function startEdit(template: DocumentTemplate) {
    setEditingId(template.id);
    setForm({ type: template.type, name: template.name, content: template.content });
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

    const payload = { type: form.type, name: form.name, content: form.content };

    try {
      if (editingId) {
        await authFetch(`/templates/${editingId}`, { method: "PATCH", body: payload });
      } else {
        await authFetch("/templates", { method: "POST", body: payload });
      }
      closeDrawer();
      await load(page, search, typeFilter);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Não foi possível salvar o modelo.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Excluir este modelo? Essa ação não pode ser desfeita.")) return;
    try {
      await authFetch(`/templates/${id}`, { method: "DELETE" });
      if (editingId === id) closeDrawer();
      await load(page, search, typeFilter);
    } catch (err) {
      setListError(err instanceof ApiError ? err.message : "Não foi possível excluir o modelo.");
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
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Modelos</h1>
          {canManage && (
            <button
              onClick={openCreate}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" strokeWidth={2.5} />
              Novo modelo
            </button>
          )}
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-sm font-medium text-zinc-500">
              {result ? `${result.total} modelo(s)` : "Modelos"}
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={typeFilter}
                onChange={(e) => {
                  setPage(1);
                  setTypeFilter(e.target.value as TemplateType | "");
                }}
                className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              >
                <option value="">Todos os tipos</option>
                {TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
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
          </div>

          {listError && <p className="text-sm text-red-600">{listError}</p>}

          {!listError && (
            <div className="overflow-x-auto">
              {result === null ? (
                <p className="text-sm text-zinc-500">Carregando…</p>
              ) : result.data.length === 0 ? (
                <p className="text-sm text-zinc-500">Nenhum modelo cadastrado ainda.</p>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 text-xs font-medium tracking-wide text-zinc-500 uppercase">
                      <th className="py-2 pr-4 font-medium">Nome</th>
                      <th className="py-2 pr-4 font-medium">Tipo</th>
                      {canManage && <th className="py-2 pr-4 font-medium" />}
                    </tr>
                  </thead>
                  <tbody>
                    {result.data.map((template) => (
                      <tr key={template.id} className="border-b border-zinc-100 last:border-0">
                        <td className="py-2 pr-4 text-zinc-900">{template.name}</td>
                        <td className="py-2 pr-4">
                          <span className="inline-block rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                            {typeLabel(template.type)}
                          </span>
                        </td>
                        {canManage && (
                          <td className="py-2 pr-4 whitespace-nowrap text-right">
                            <button
                              onClick={() => startEdit(template)}
                              className="mr-3 text-zinc-500 hover:text-zinc-900"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => handleDelete(template.id)}
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
        title={editingId ? "Editar modelo" : "Novo modelo"}
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700">Tipo</label>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as TemplateType })}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            >
              {TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
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
            <label className="block text-sm font-medium text-zinc-700">Conteúdo</label>
            <textarea
              required
              rows={10}
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>

          {variables.length > 0 && (
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
              <p className="mb-1.5 text-xs font-medium text-zinc-500 uppercase">
                Variáveis disponíveis
              </p>
              <ul className="flex flex-col gap-1 text-xs text-zinc-600">
                {variables.map((v) => (
                  <li key={v.key}>
                    <code className="rounded bg-zinc-200 px-1 py-0.5 text-zinc-800">
                      {`{{${v.key}}}`}
                    </code>{" "}
                    — {v.description}
                  </li>
                ))}
              </ul>
            </div>
          )}

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

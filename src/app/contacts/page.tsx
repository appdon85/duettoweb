"use client";

import { Fragment, useCallback, useEffect, useState, type FormEvent } from "react";
import { ApiError } from "@/lib/api";
import type { Contact, ContactDetail, Company, Paginated } from "@/lib/types";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { AppShell } from "@/components/AppShell";

const PAGE_SIZE = 20;

const EMPTY_FORM = { name: "", email: "", phone: "", title: "", notes: "" };

export default function ContactsPage() {
  const { user, isLoading, authFetch } = useRequireAuth();
  const canManage = user?.permissions.includes("contacts:manage") ?? false;

  const [result, setResult] = useState<Paginated<Contact> | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Empresas disponiveis para vincular (lista leve, carregada uma vez).
  const [companyOptions, setCompanyOptions] = useState<Company[]>([]);

  // Painel de vinculos: expande abaixo da linha do contato selecionado.
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedDetail, setExpandedDetail] = useState<ContactDetail | null>(null);
  const [linkCompanyId, setLinkCompanyId] = useState("");
  const [linkRole, setLinkRole] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);

  const load = useCallback(
    async (targetPage: number, targetSearch: string) => {
      const params = new URLSearchParams({
        page: String(targetPage),
        pageSize: String(PAGE_SIZE),
      });
      if (targetSearch) params.set("search", targetSearch);

      try {
        const data = await authFetch<Paginated<Contact>>(`/contacts?${params.toString()}`);
        setResult(data);
        setListError(null);
      } catch (err) {
        setListError(
          err instanceof ApiError ? err.message : "Não foi possível carregar os contatos.",
        );
      }
    },
    [authFetch],
  );

  useEffect(() => {
    if (!user) return;
    // Ver comentario equivalente em app/companies/page.tsx.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(page, search);
  }, [user, page, search, load]);

  useEffect(() => {
    if (!user || !canManage) return;
    authFetch<Paginated<Company>>("/companies?pageSize=100")
      .then((data) => setCompanyOptions(data.data))
      .catch(() => {
        // Lista de empresas e' so para o formulario de vinculo - uma falha
        // aqui nao deve travar a pagina de contatos inteira.
      });
  }, [user, canManage, authFetch]);

  function startEdit(contact: Contact) {
    setEditingId(contact.id);
    setForm({
      name: contact.name,
      email: contact.email ?? "",
      phone: contact.phone ?? "",
      title: contact.title ?? "",
      notes: contact.notes ?? "",
    });
    setFormError(null);
  }

  function cancelEdit() {
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
      email: form.email || undefined,
      phone: form.phone || undefined,
      title: form.title || undefined,
      notes: form.notes || undefined,
    };

    try {
      if (editingId) {
        await authFetch(`/contacts/${editingId}`, { method: "PATCH", body: payload });
      } else {
        await authFetch("/contacts", { method: "POST", body: payload });
      }
      cancelEdit();
      await load(page, search);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Não foi possível salvar o contato.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Excluir este contato? Essa ação não pode ser desfeita.")) return;
    try {
      await authFetch(`/contacts/${id}`, { method: "DELETE" });
      if (editingId === id) cancelEdit();
      if (expandedId === id) setExpandedId(null);
      await load(page, search);
    } catch (err) {
      setListError(err instanceof ApiError ? err.message : "Não foi possível excluir o contato.");
    }
  }

  async function loadDetail(id: string) {
    try {
      const detail = await authFetch<ContactDetail>(`/contacts/${id}`);
      setExpandedDetail(detail);
      setLinkError(null);
    } catch (err) {
      setLinkError(err instanceof ApiError ? err.message : "Não foi possível carregar os vínculos.");
    }
  }

  function toggleExpand(id: string) {
    if (expandedId === id) {
      setExpandedId(null);
      setExpandedDetail(null);
      return;
    }
    setExpandedId(id);
    setExpandedDetail(null);
    setLinkCompanyId("");
    setLinkRole("");
    loadDetail(id);
  }

  async function handleLink(event: FormEvent) {
    event.preventDefault();
    if (!expandedId || !linkCompanyId) return;
    setLinkError(null);
    try {
      await authFetch(`/contacts/${expandedId}/companies`, {
        method: "POST",
        body: { companyId: linkCompanyId, role: linkRole || undefined },
      });
      setLinkCompanyId("");
      setLinkRole("");
      await loadDetail(expandedId);
    } catch (err) {
      setLinkError(err instanceof ApiError ? err.message : "Não foi possível vincular a empresa.");
    }
  }

  async function handleUnlink(companyId: string) {
    if (!expandedId) return;
    try {
      await authFetch(`/contacts/${expandedId}/companies/${companyId}`, { method: "DELETE" });
      await loadDetail(expandedId);
    } catch (err) {
      setLinkError(err instanceof ApiError ? err.message : "Não foi possível desvincular a empresa.");
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
        <h1 className="mb-6 text-2xl font-semibold tracking-tight text-zinc-900">Contatos</h1>

        {canManage && (
          <form
            onSubmit={handleSubmit}
            className="mb-8 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm"
          >
            <h2 className="mb-4 text-sm font-medium text-zinc-500">
              {editingId ? "Editar contato" : "Novo contato"}
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                <label className="block text-sm font-medium text-zinc-700">Cargo</label>
                <input
                  maxLength={150}
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700">E-mail</label>
                <input
                  type="email"
                  maxLength={255}
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
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
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-zinc-700">Notas</label>
                <textarea
                  maxLength={4000}
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </div>
            </div>

            {formError && <p className="mt-3 text-sm text-red-600">{formError}</p>}

            <div className="mt-4 flex gap-3">
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting ? "Salvando…" : editingId ? "Atualizar" : "Adicionar"}
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50"
                >
                  Cancelar
                </button>
              )}
            </div>
          </form>
        )}

        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-sm font-medium text-zinc-500">
              {result ? `${result.total} contato(s)` : "Contatos"}
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
                <p className="text-sm text-zinc-500">Nenhum contato cadastrado ainda.</p>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 text-xs font-medium tracking-wide text-zinc-500 uppercase">
                      <th className="py-2 pr-4 font-medium">Nome</th>
                      <th className="py-2 pr-4 font-medium">Cargo</th>
                      <th className="py-2 pr-4 font-medium">E-mail</th>
                      <th className="py-2 pr-4 font-medium">Telefone</th>
                      <th className="py-2 pr-4 font-medium" />
                    </tr>
                  </thead>
                  <tbody>
                    {result.data.map((contact) => (
                      <Fragment key={contact.id}>
                        <tr className="border-b border-zinc-100 last:border-0">
                          <td className="py-2 pr-4 text-zinc-900">{contact.name}</td>
                          <td className="py-2 pr-4 text-zinc-600">{contact.title ?? "—"}</td>
                          <td className="py-2 pr-4 text-zinc-600">{contact.email ?? "—"}</td>
                          <td className="py-2 pr-4 text-zinc-600">{contact.phone ?? "—"}</td>
                          <td className="py-2 pr-4 whitespace-nowrap text-right">
                            <button
                              onClick={() => toggleExpand(contact.id)}
                              className="mr-3 text-zinc-500 hover:text-zinc-900"
                            >
                              {expandedId === contact.id ? "Fechar" : "Empresas"}
                            </button>
                            {canManage && (
                              <>
                                <button
                                  onClick={() => startEdit(contact)}
                                  className="mr-3 text-zinc-500 hover:text-zinc-900"
                                >
                                  Editar
                                </button>
                                <button
                                  onClick={() => handleDelete(contact.id)}
                                  className="text-red-500 hover:text-red-700"
                                >
                                  Excluir
                                </button>
                              </>
                            )}
                          </td>
                        </tr>
                        {expandedId === contact.id && (
                          <tr key={`${contact.id}-detail`} className="border-b border-zinc-100 bg-zinc-50">
                            <td colSpan={5} className="px-4 py-4">
                              {!expandedDetail ? (
                                <p className="text-sm text-zinc-500">Carregando vínculos…</p>
                              ) : (
                                <div className="space-y-3">
                                  {expandedDetail.companies.length === 0 ? (
                                    <p className="text-sm text-zinc-500">
                                      Nenhuma empresa vinculada.
                                    </p>
                                  ) : (
                                    <ul className="space-y-1">
                                      {expandedDetail.companies.map((c) => (
                                        <li
                                          key={c.id}
                                          className="flex items-center justify-between text-sm"
                                        >
                                          <span>
                                            {c.name}
                                            {c.role && (
                                              <span className="text-zinc-400"> — {c.role}</span>
                                            )}
                                          </span>
                                          {canManage && (
                                            <button
                                              onClick={() => handleUnlink(c.id)}
                                              className="text-xs text-red-500 hover:text-red-700"
                                            >
                                              Desvincular
                                            </button>
                                          )}
                                        </li>
                                      ))}
                                    </ul>
                                  )}

                                  {canManage && (
                                    <form onSubmit={handleLink} className="flex flex-wrap items-end gap-2 pt-2">
                                      <div>
                                        <label className="block text-xs text-zinc-500">
                                          Vincular empresa
                                        </label>
                                        <select
                                          value={linkCompanyId}
                                          onChange={(e) => setLinkCompanyId(e.target.value)}
                                          className="mt-1 rounded-lg border border-zinc-300 px-2 py-1.5 text-sm shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                                        >
                                          <option value="">Selecione…</option>
                                          {companyOptions.map((c) => (
                                            <option key={c.id} value={c.id}>
                                              {c.name}
                                            </option>
                                          ))}
                                        </select>
                                      </div>
                                      <div>
                                        <label className="block text-xs text-zinc-500">
                                          Cargo (opcional)
                                        </label>
                                        <input
                                          value={linkRole}
                                          onChange={(e) => setLinkRole(e.target.value)}
                                          className="mt-1 rounded-lg border border-zinc-300 px-2 py-1.5 text-sm shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                                        />
                                      </div>
                                      <button
                                        type="submit"
                                        disabled={!linkCompanyId}
                                        className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                                      >
                                        Vincular
                                      </button>
                                    </form>
                                  )}

                                  {linkError && <p className="text-sm text-red-600">{linkError}</p>}
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
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
    </AppShell>
  );
}

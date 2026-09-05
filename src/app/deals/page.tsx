"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ApiError } from "@/lib/api";
import type { Company, Contact, Deal, DealStage, Paginated } from "@/lib/types";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { AppHeader } from "@/components/AppHeader";

const STAGES: Array<{ value: DealStage; label: string }> = [
  { value: "PROSPECTING", label: "Prospecção" },
  { value: "QUALIFICATION", label: "Qualificação" },
  { value: "PROPOSAL", label: "Proposta" },
  { value: "NEGOTIATION", label: "Negociação" },
  { value: "WON", label: "Ganho" },
  { value: "LOST", label: "Perdido" },
];

// Ordem dos estagios "abertos" - usada pelos botoes "Avançar"/"Voltar" (ver
// especificacao 3.2 - "regras de avanco de estagio"). WON/LOST sao terminais
// e so se alcancam pelos botoes dedicados "Marcar como Ganho/Perdido".
const OPEN_STAGES: DealStage[] = ["PROSPECTING", "QUALIFICATION", "PROPOSAL", "NEGOTIATION"];

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const EMPTY_FORM = {
  title: "",
  value: "",
  companyId: "",
  contactId: "",
  expectedCloseDate: "",
  notes: "",
};

export default function DealsPage() {
  const { user, isLoading, authFetch } = useRequireAuth();
  const canManage = user?.permissions.includes("deals:manage") ?? false;

  const [columns, setColumns] = useState<Record<DealStage, Deal[]> | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [companyOptions, setCompanyOptions] = useState<Company[]>([]);
  const [contactOptions, setContactOptions] = useState<Contact[]>([]);

  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const load = useCallback(
    async (targetSearch: string) => {
      try {
        const params = new URLSearchParams({ pageSize: "100" });
        if (targetSearch) params.set("search", targetSearch);

        const results = await Promise.all(
          STAGES.map((s) => {
            const stageParams = new URLSearchParams(params);
            stageParams.set("stage", s.value);
            return authFetch<Paginated<Deal>>(`/deals?${stageParams.toString()}`);
          }),
        );

        const next = {} as Record<DealStage, Deal[]>;
        STAGES.forEach((s, i) => {
          next[s.value] = results[i].data;
        });
        setColumns(next);
        setListError(null);
      } catch (err) {
        setListError(
          err instanceof ApiError ? err.message : "Não foi possível carregar os negócios.",
        );
      }
    },
    [authFetch],
  );

  useEffect(() => {
    if (!user) return;
    // Ver comentario equivalente em app/companies/page.tsx.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(search);
  }, [user, search, load]);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      authFetch<Paginated<Company>>("/companies?pageSize=100"),
      authFetch<Paginated<Contact>>("/contacts?pageSize=100"),
    ])
      .then(([companiesRes, contactsRes]) => {
        setCompanyOptions(companiesRes.data);
        setContactOptions(contactsRes.data);
      })
      .catch(() => {
        // Listas usadas so' para exibir nomes e para o formulario de vinculo -
        // uma falha aqui nao deve travar a pagina de negocios inteira.
      });
  }, [user, authFetch]);

  function companyName(id: string | null): string | null {
    if (!id) return null;
    return companyOptions.find((c) => c.id === id)?.name ?? null;
  }

  function contactName(id: string | null): string | null {
    if (!id) return null;
    return contactOptions.find((c) => c.id === id)?.name ?? null;
  }

  function startEdit(deal: Deal) {
    setEditingId(deal.id);
    setForm({
      title: deal.title,
      value: deal.value != null ? String(deal.value) : "",
      companyId: deal.companyId ?? "",
      contactId: deal.contactId ?? "",
      expectedCloseDate: deal.expectedCloseDate ?? "",
      notes: deal.notes ?? "",
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
      title: form.title,
      value: form.value ? Number(form.value) : undefined,
      companyId: form.companyId || undefined,
      contactId: form.contactId || undefined,
      expectedCloseDate: form.expectedCloseDate || undefined,
      notes: form.notes || undefined,
    };

    try {
      if (editingId) {
        await authFetch(`/deals/${editingId}`, { method: "PATCH", body: payload });
      } else {
        await authFetch("/deals", { method: "POST", body: payload });
      }
      cancelEdit();
      await load(search);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Não foi possível salvar o negócio.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Excluir este negócio? Essa ação não pode ser desfeita.")) return;
    try {
      await authFetch(`/deals/${id}`, { method: "DELETE" });
      if (editingId === id) cancelEdit();
      await load(search);
    } catch (err) {
      setListError(err instanceof ApiError ? err.message : "Não foi possível excluir o negócio.");
    }
  }

  async function changeStage(id: string, stage: DealStage, lostReason?: string) {
    try {
      await authFetch(`/deals/${id}/stage`, { method: "PATCH", body: { stage, lostReason } });
      await load(search);
    } catch (err) {
      setListError(
        err instanceof ApiError ? err.message : "Não foi possível mudar o estágio do negócio.",
      );
    }
  }

  function handleMarkLost(id: string) {
    const reason = window.prompt("Motivo da perda (obrigatório):");
    if (reason === null) return; // cancelado
    if (!reason.trim()) {
      window.alert("Informe um motivo para marcar o negócio como perdido.");
      return;
    }
    void changeStage(id, "LOST", reason.trim());
  }

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

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8">
        <h1 className="mb-6 text-xl font-semibold text-zinc-900">Negócios</h1>

        {canManage && (
          <form
            onSubmit={handleSubmit}
            className="mb-8 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm"
          >
            <h2 className="mb-4 text-sm font-medium text-zinc-500">
              {editingId ? "Editar negócio" : "Novo negócio"}
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="sm:col-span-2 lg:col-span-1">
                <label className="block text-sm font-medium text-zinc-700">Título</label>
                <input
                  required
                  maxLength={200}
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700">Valor (R$)</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.value}
                  onChange={(e) => setForm({ ...form, value: e.target.value })}
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700">
                  Previsão de fechamento
                </label>
                <input
                  type="date"
                  value={form.expectedCloseDate}
                  onChange={(e) => setForm({ ...form, expectedCloseDate: e.target.value })}
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700">Empresa</label>
                <select
                  value={form.companyId}
                  onChange={(e) => setForm({ ...form, companyId: e.target.value })}
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
                >
                  <option value="">Nenhuma</option>
                  {companyOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700">Contato</label>
                <select
                  value={form.contactId}
                  onChange={(e) => setForm({ ...form, contactId: e.target.value })}
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
                >
                  <option value="">Nenhum</option>
                  {contactOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <label className="block text-sm font-medium text-zinc-700">Notas</label>
                <textarea
                  maxLength={4000}
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
                />
              </div>
            </div>

            {formError && <p className="mt-3 text-sm text-red-600">{formError}</p>}

            <div className="mt-4 flex gap-3">
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting ? "Salvando…" : editingId ? "Atualizar" : "Adicionar"}
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="rounded-md border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
                >
                  Cancelar
                </button>
              )}
            </div>
          </form>
        )}

        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-sm font-medium text-zinc-500">Funil de vendas</h2>
          <input
            type="search"
            placeholder="Buscar por título…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-56 rounded-md border border-zinc-300 px-3 py-1.5 text-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          />
        </div>

        {listError && <p className="mb-4 text-sm text-red-600">{listError}</p>}

        {columns === null && !listError ? (
          <p className="text-sm text-zinc-500">Carregando…</p>
        ) : (
          <div className="overflow-x-auto pb-2">
            <div className="flex gap-4" style={{ minWidth: `${STAGES.length * 260}px` }}>
              {STAGES.map((stageDef) => {
                const dealsInStage = columns?.[stageDef.value] ?? [];
                const total = dealsInStage.reduce((sum, d) => sum + (d.value ?? 0), 0);
                const isClosedColumn = stageDef.value === "WON" || stageDef.value === "LOST";

                return (
                  <div
                    key={stageDef.value}
                    className="flex w-64 flex-shrink-0 flex-col rounded-lg border border-zinc-200 bg-zinc-50"
                  >
                    <div className="border-b border-zinc-200 bg-white px-3 py-2 rounded-t-lg">
                      <p className="text-sm font-medium text-zinc-900">{stageDef.label}</p>
                      <p className="text-xs text-zinc-400">
                        {dealsInStage.length} negócio(s) · {currencyFormatter.format(total)}
                      </p>
                    </div>

                    <div className="flex flex-1 flex-col gap-2 p-2">
                      {dealsInStage.length === 0 && (
                        <p className="px-1 py-2 text-xs text-zinc-400">Nenhum negócio aqui.</p>
                      )}

                      {dealsInStage.map((deal) => {
                        const openIdx = OPEN_STAGES.indexOf(deal.stage);

                        return (
                          <div
                            key={deal.id}
                            className="rounded-md border border-zinc-200 bg-white p-3 text-sm shadow-sm"
                          >
                            <p className="font-medium text-zinc-900">{deal.title}</p>
                            {deal.value != null && (
                              <p className="text-zinc-600">{currencyFormatter.format(deal.value)}</p>
                            )}
                            {companyName(deal.companyId) && (
                              <p className="text-xs text-zinc-500">
                                Empresa: {companyName(deal.companyId)}
                              </p>
                            )}
                            {contactName(deal.contactId) && (
                              <p className="text-xs text-zinc-500">
                                Contato: {contactName(deal.contactId)}
                              </p>
                            )}
                            {deal.expectedCloseDate && (
                              <p className="text-xs text-zinc-500">
                                Previsão: {deal.expectedCloseDate}
                              </p>
                            )}
                            {deal.stage === "LOST" && deal.lostReason && (
                              <p className="text-xs text-red-500">Motivo: {deal.lostReason}</p>
                            )}

                            {canManage && (
                              <div className="mt-2 flex flex-wrap gap-x-2 gap-y-1 border-t border-zinc-100 pt-2 text-xs">
                                <button
                                  onClick={() => startEdit(deal)}
                                  className="text-zinc-500 hover:text-zinc-900"
                                >
                                  Editar
                                </button>
                                <button
                                  onClick={() => handleDelete(deal.id)}
                                  className="text-red-500 hover:text-red-700"
                                >
                                  Excluir
                                </button>

                                {!isClosedColumn && openIdx > 0 && (
                                  <button
                                    onClick={() =>
                                      void changeStage(deal.id, OPEN_STAGES[openIdx - 1])
                                    }
                                    className="text-zinc-500 hover:text-zinc-900"
                                  >
                                    ◀ Voltar
                                  </button>
                                )}
                                {!isClosedColumn && openIdx < OPEN_STAGES.length - 1 && (
                                  <button
                                    onClick={() =>
                                      void changeStage(deal.id, OPEN_STAGES[openIdx + 1])
                                    }
                                    className="text-zinc-500 hover:text-zinc-900"
                                  >
                                    Avançar ▶
                                  </button>
                                )}
                                {!isClosedColumn && (
                                  <>
                                    <button
                                      onClick={() => void changeStage(deal.id, "WON")}
                                      className="text-emerald-600 hover:text-emerald-800"
                                    >
                                      Marcar como Ganho
                                    </button>
                                    <button
                                      onClick={() => handleMarkLost(deal.id)}
                                      className="text-red-500 hover:text-red-700"
                                    >
                                      Marcar como Perdido
                                    </button>
                                  </>
                                )}
                                {isClosedColumn && (
                                  <button
                                    onClick={() => void changeStage(deal.id, "NEGOTIATION")}
                                    className="text-zinc-500 hover:text-zinc-900"
                                  >
                                    Reabrir
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

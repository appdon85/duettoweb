"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { ApiError } from "@/lib/api";
import type {
  Company,
  Contact,
  Deal,
  DocumentTemplate,
  Paginated,
  Proposal,
  ProposalStatus,
  TenantUserRow,
} from "@/lib/types";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { AppShell } from "@/components/AppShell";
import { Drawer } from "@/components/Drawer";

const PAGE_SIZE = 20;

const STATUSES: Array<{ value: ProposalStatus; label: string }> = [
  { value: "DRAFT", label: "Rascunho" },
  { value: "SENT", label: "Enviada" },
  { value: "ACCEPTED", label: "Aceita" },
  { value: "REJECTED", label: "Rejeitada" },
  { value: "EXPIRED", label: "Expirada" },
];

function statusLabel(status: ProposalStatus): string {
  return STATUSES.find((s) => s.value === status)?.label ?? status;
}

const STATUS_BADGE_CLASS: Record<ProposalStatus, string> = {
  DRAFT: "bg-zinc-100 text-zinc-700",
  SENT: "bg-blue-50 text-blue-700",
  ACCEPTED: "bg-emerald-50 text-emerald-700",
  REJECTED: "bg-red-50 text-red-700",
  EXPIRED: "bg-amber-50 text-amber-700",
};

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

interface ItemForm {
  description: string;
  quantity: string;
  unitPrice: string;
  discount: string;
}

const EMPTY_ITEM: ItemForm = { description: "", quantity: "1", unitPrice: "0", discount: "0" };

const EMPTY_FORM = {
  title: "",
  companyId: "",
  contactId: "",
  dealId: "",
  templateId: "",
  content: "",
  validUntil: "",
  ownerUserId: "",
  notes: "",
};

function itemsTotal(items: ItemForm[]): number {
  return items.reduce((sum, item) => {
    const quantity = Number(item.quantity) || 0;
    const unitPrice = Number(item.unitPrice) || 0;
    const discount = Number(item.discount) || 0;
    return sum + quantity * unitPrice - discount;
  }, 0);
}

export default function ProposalsPage() {
  const { user, isLoading, authFetch, authFetchBlob } = useRequireAuth();
  const router = useRouter();
  const canManage = user?.permissions.includes("proposals:manage") ?? false;

  const [result, setResult] = useState<Paginated<Proposal> | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProposalStatus | "">("");
  const [companyFilter, setCompanyFilter] = useState("");

  const [companyOptions, setCompanyOptions] = useState<Company[]>([]);
  const [contactOptions, setContactOptions] = useState<Contact[]>([]);
  const [dealOptions, setDealOptions] = useState<Deal[]>([]);
  const [templateOptions, setTemplateOptions] = useState<DocumentTemplate[]>([]);
  const [userOptions, setUserOptions] = useState<TenantUserRow[]>([]);

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [items, setItems] = useState<ItemForm[]>([{ ...EMPTY_ITEM }]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingDetailId, setLoadingDetailId] = useState<string | null>(null);

  const load = useCallback(
    async (
      targetPage: number,
      targetSearch: string,
      targetStatus: ProposalStatus | "",
      targetCompanyId: string,
    ) => {
      const params = new URLSearchParams({
        page: String(targetPage),
        pageSize: String(PAGE_SIZE),
      });
      if (targetSearch) params.set("search", targetSearch);
      if (targetStatus) params.set("status", targetStatus);
      if (targetCompanyId) params.set("companyId", targetCompanyId);

      try {
        const data = await authFetch<Paginated<Proposal>>(`/proposals?${params.toString()}`);
        setResult(data);
        setListError(null);
      } catch (err) {
        setListError(
          err instanceof ApiError ? err.message : "Não foi possível carregar as propostas.",
        );
      }
    },
    [authFetch],
  );

  useEffect(() => {
    if (!user) return;
    // Ver comentario equivalente em app/companies/page.tsx.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(page, search, statusFilter, companyFilter);
  }, [user, page, search, statusFilter, companyFilter, load]);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      authFetch<Paginated<Company>>("/companies?pageSize=100"),
      authFetch<Paginated<Contact>>("/contacts?pageSize=100"),
      authFetch<Paginated<Deal>>("/deals?pageSize=100"),
      authFetch<Paginated<DocumentTemplate>>("/templates?type=PROPOSAL&pageSize=100"),
    ])
      .then(([companiesRes, contactsRes, dealsRes, templatesRes]) => {
        setCompanyOptions(companiesRes.data);
        setContactOptions(contactsRes.data);
        setDealOptions(dealsRes.data);
        setTemplateOptions(templatesRes.data);
      })
      .catch(() => {
        // Listas usadas so' para exibir nomes, filtros e para o formulario de
        // vinculo - uma falha aqui nao deve travar a pagina de propostas inteira.
      });
  }, [user, authFetch]);

  useEffect(() => {
    // Lista de usuarios do tenant para o campo "Responsavel" (owner) - ver
    // comentario equivalente em app/deals/page.tsx.
    if (!user || !user.permissions.includes("users:read")) return;
    authFetch<TenantUserRow[]>("/users")
      .then(setUserOptions)
      .catch(() => {
        // Falha aqui nao deve travar a pagina - o campo "Responsavel" so' fica vazio.
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

  function clientLabel(proposal: Proposal): string {
    return contactName(proposal.contactId) ?? companyName(proposal.companyId) ?? "—";
  }

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setItems([{ ...EMPTY_ITEM }]);
    setFormError(null);
    setIsDrawerOpen(true);
  }

  function populateFromDetail(proposal: Proposal) {
    setEditingId(proposal.id);
    setForm({
      title: proposal.title,
      companyId: proposal.companyId ?? "",
      contactId: proposal.contactId ?? "",
      dealId: proposal.dealId ?? "",
      templateId: proposal.templateId ?? "",
      content: proposal.content ?? "",
      validUntil: proposal.validUntil ?? "",
      ownerUserId: proposal.ownerUserId ?? "",
      notes: proposal.notes ?? "",
    });
    setItems(
      proposal.items && proposal.items.length > 0
        ? proposal.items
            .slice()
            .sort((a, b) => a.position - b.position)
            .map((item) => ({
              description: item.description,
              quantity: String(item.quantity),
              unitPrice: String(item.unitPrice),
              discount: String(item.discount),
            }))
        : [{ ...EMPTY_ITEM }],
    );
    setFormError(null);
  }

  async function startEdit(proposal: Proposal) {
    setLoadingDetailId(proposal.id);
    try {
      // Linhas da listagem nao trazem `items` - e' preciso buscar o detalhe.
      const detail = await authFetch<Proposal>(`/proposals/${proposal.id}`);
      populateFromDetail(detail);
      setIsDrawerOpen(true);
    } catch (err) {
      setListError(
        err instanceof ApiError ? err.message : "Não foi possível carregar a proposta.",
      );
    } finally {
      setLoadingDetailId(null);
    }
  }

  function closeDrawer() {
    setIsDrawerOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setItems([{ ...EMPTY_ITEM }]);
    setFormError(null);
  }

  function addItemRow() {
    setItems((prev) => [...prev, { ...EMPTY_ITEM }]);
  }

  function removeItemRow(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function updateItemField(index: number, field: keyof ItemForm, value: string) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);

    if (!form.companyId && !form.contactId) {
      setFormError("Selecione ao menos uma empresa ou um contato.");
      return;
    }

    setIsSubmitting(true);

    const payload = {
      title: form.title,
      companyId: form.companyId || undefined,
      contactId: form.contactId || undefined,
      dealId: form.dealId || undefined,
      templateId: form.templateId || undefined,
      content: form.content.trim() ? form.content : undefined,
      validUntil: form.validUntil || undefined,
      ownerUserId: form.ownerUserId || undefined,
      notes: form.notes || undefined,
      items: items.map((item) => ({
        description: item.description,
        quantity: Number(item.quantity) || 0,
        unitPrice: Number(item.unitPrice) || 0,
        discount: Number(item.discount) || 0,
      })),
    };

    try {
      if (editingId) {
        const updated = await authFetch<Proposal>(`/proposals/${editingId}`, {
          method: "PATCH",
          body: payload,
        });
        populateFromDetail(updated);
      } else {
        const created = await authFetch<Proposal>("/proposals", {
          method: "POST",
          body: payload,
        });
        // Mantem o drawer aberto em modo edicao para exibir o conteudo
        // renderizado a partir do modelo (quando templateId foi informado e
        // content ficou em branco, o backend preenche `content` sozinho).
        populateFromDetail(created);
      }
      await load(page, search, statusFilter, companyFilter);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Não foi possível salvar a proposta.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Excluir esta proposta? Essa ação não pode ser desfeita.")) return;
    try {
      await authFetch(`/proposals/${id}`, { method: "DELETE" });
      if (editingId === id) closeDrawer();
      await load(page, search, statusFilter, companyFilter);
    } catch (err) {
      setListError(err instanceof ApiError ? err.message : "Não foi possível excluir a proposta.");
    }
  }

  async function changeStatus(id: string, status: ProposalStatus) {
    try {
      await authFetch(`/proposals/${id}/status`, { method: "PATCH", body: { status } });
      await load(page, search, statusFilter, companyFilter);
    } catch (err) {
      setListError(
        err instanceof ApiError ? err.message : "Não foi possível mudar o status da proposta.",
      );
    }
  }

  async function generateContract(proposal: Proposal) {
    try {
      await authFetch("/contracts", {
        method: "POST",
        body: { proposalId: proposal.id, title: proposal.title },
      });
      router.push("/contracts");
    } catch (err) {
      setListError(
        err instanceof ApiError ? err.message : "Não foi possível gerar o contrato.",
      );
    }
  }

  async function downloadPdf(id: string) {
    try {
      const blob = await authFetchBlob(`/proposals/${id}/pdf`);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `proposta-${id}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setListError(err instanceof ApiError ? err.message : "Não foi possível baixar o PDF.");
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
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Propostas</h1>
          {canManage && (
            <button
              onClick={openCreate}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" strokeWidth={2.5} />
              Nova proposta
            </button>
          )}
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-sm font-medium text-zinc-500">
              {result ? `${result.total} proposta(s)` : "Propostas"}
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => {
                  setPage(1);
                  setStatusFilter(e.target.value as ProposalStatus | "");
                }}
                className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              >
                <option value="">Todos os status</option>
                {STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
              <select
                value={companyFilter}
                onChange={(e) => {
                  setPage(1);
                  setCompanyFilter(e.target.value);
                }}
                className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              >
                <option value="">Todas as empresas</option>
                {companyOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <input
                type="search"
                placeholder="Buscar por título…"
                value={search}
                onChange={(e) => {
                  setPage(1);
                  setSearch(e.target.value);
                }}
                className="w-56 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>
          </div>

          {listError && <p className="mb-4 text-sm text-red-600">{listError}</p>}

          {!listError && (
            <div className="overflow-x-auto">
              {result === null ? (
                <p className="text-sm text-zinc-500">Carregando…</p>
              ) : result.data.length === 0 ? (
                <p className="text-sm text-zinc-500">Nenhuma proposta cadastrada ainda.</p>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 text-xs font-medium tracking-wide text-zinc-500 uppercase">
                      <th className="py-2 pr-4 font-medium">Título</th>
                      <th className="py-2 pr-4 font-medium">Cliente</th>
                      <th className="py-2 pr-4 font-medium">Status</th>
                      <th className="py-2 pr-4 font-medium">Valor total</th>
                      <th className="py-2 pr-4 font-medium" />
                    </tr>
                  </thead>
                  <tbody>
                    {result.data.map((proposal) => (
                      <tr key={proposal.id} className="border-b border-zinc-100 last:border-0">
                        <td className="py-2 pr-4 text-zinc-900">{proposal.title}</td>
                        <td className="py-2 pr-4 text-zinc-600">{clientLabel(proposal)}</td>
                        <td className="py-2 pr-4">
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE_CLASS[proposal.status]}`}
                          >
                            {statusLabel(proposal.status)}
                          </span>
                        </td>
                        <td className="py-2 pr-4 text-zinc-600">
                          {currencyFormatter.format(proposal.totalValue)}
                        </td>
                        <td className="py-2 pr-4">
                          <div className="flex flex-wrap justify-end gap-x-3 gap-y-1 text-xs whitespace-nowrap">
                            <button
                              onClick={() => downloadPdf(proposal.id)}
                              className="text-zinc-500 hover:text-zinc-900"
                            >
                              Baixar PDF
                            </button>
                            {canManage && (
                              <>
                                <button
                                  onClick={() => void startEdit(proposal)}
                                  disabled={loadingDetailId === proposal.id}
                                  className="text-zinc-500 hover:text-zinc-900 disabled:opacity-40"
                                >
                                  {loadingDetailId === proposal.id ? "Carregando…" : "Editar"}
                                </button>
                                <button
                                  onClick={() => handleDelete(proposal.id)}
                                  className="text-red-500 hover:text-red-700"
                                >
                                  Excluir
                                </button>
                                {proposal.status === "DRAFT" && (
                                  <button
                                    onClick={() => void changeStatus(proposal.id, "SENT")}
                                    className="font-medium text-blue-600 hover:text-blue-800"
                                  >
                                    Enviar
                                  </button>
                                )}
                                {proposal.status === "SENT" && (
                                  <>
                                    <button
                                      onClick={() => void changeStatus(proposal.id, "ACCEPTED")}
                                      className="text-emerald-600 hover:text-emerald-800"
                                    >
                                      Marcar como Aceita
                                    </button>
                                    <button
                                      onClick={() => void changeStatus(proposal.id, "REJECTED")}
                                      className="text-red-500 hover:text-red-700"
                                    >
                                      Marcar como Rejeitada
                                    </button>
                                  </>
                                )}
                                {proposal.status !== "DRAFT" && (
                                  <button
                                    onClick={() => void changeStatus(proposal.id, "DRAFT")}
                                    className="text-zinc-500 hover:text-zinc-900"
                                  >
                                    Reabrir
                                  </button>
                                )}
                                {proposal.status === "ACCEPTED" && (
                                  <button
                                    onClick={() => void generateContract(proposal)}
                                    className="font-medium text-blue-600 hover:text-blue-800"
                                  >
                                    Gerar contrato
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
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
        title={editingId ? "Editar proposta" : "Nova proposta"}
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700">Título</label>
            <input
              required
              maxLength={200}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700">Empresa</label>
            <select
              value={form.companyId}
              onChange={(e) => setForm({ ...form, companyId: e.target.value })}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
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
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            >
              <option value="">Nenhum</option>
              {contactOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700">Negócio</label>
            <select
              value={form.dealId}
              onChange={(e) => setForm({ ...form, dealId: e.target.value })}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            >
              <option value="">Nenhum</option>
              {dealOptions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700">Modelo</label>
            <select
              value={form.templateId}
              onChange={(e) => setForm({ ...form, templateId: e.target.value })}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            >
              <option value="">Nenhum</option>
              {templateOptions.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700">Conteúdo</label>
            <textarea
              rows={8}
              placeholder="Deixe em branco para preencher automaticamente a partir do modelo selecionado."
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700">Válida até</label>
            <input
              type="date"
              value={form.validUntil}
              onChange={(e) => setForm({ ...form, validUntil: e.target.value })}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>
          {userOptions.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-zinc-700">Responsável</label>
              <select
                value={form.ownerUserId}
                onChange={(e) => setForm({ ...form, ownerUserId: e.target.value })}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              >
                <option value="">Nenhum</option>
                {userOptions.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
          )}
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

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="block text-sm font-medium text-zinc-700">Itens</label>
              <button
                type="button"
                onClick={addItemRow}
                className="text-xs font-medium text-blue-600 hover:text-blue-800"
              >
                + Adicionar item
              </button>
            </div>
            <div className="flex flex-col gap-3">
              {items.map((item, index) => (
                <div
                  key={index}
                  className="rounded-lg border border-zinc-200 p-3 text-sm"
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <input
                      required
                      placeholder="Descrição"
                      value={item.description}
                      onChange={(e) => updateItemField(index, "description", e.target.value)}
                      className="w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    />
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItemRow(index)}
                        className="flex-shrink-0 text-xs text-red-500 hover:text-red-700"
                      >
                        Remover
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-xs text-zinc-500">Qtd.</label>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={item.quantity}
                        onChange={(e) => updateItemField(index, "quantity", e.target.value)}
                        className="mt-0.5 w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-500">Preço unit.</label>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={item.unitPrice}
                        onChange={(e) => updateItemField(index, "unitPrice", e.target.value)}
                        className="mt-0.5 w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-500">Desconto</label>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={item.discount}
                        onChange={(e) => updateItemField(index, "discount", e.target.value)}
                        className="mt-0.5 w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-2 text-right text-sm font-medium text-zinc-700">
              Total estimado: {currencyFormatter.format(itemsTotal(items))}
            </p>
          </div>

          <p className="text-xs text-zinc-400">
            Selecione ao menos uma empresa ou um contato.
          </p>
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

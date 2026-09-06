"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import { ApiError } from "@/lib/api";
import type {
  Activity,
  ActivityType,
  Company,
  Contact,
  Deal,
  Paginated,
  TenantUserRow,
} from "@/lib/types";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { AppShell } from "@/components/AppShell";
import { Drawer } from "@/components/Drawer";

const TYPES: Array<{ value: ActivityType; label: string }> = [
  { value: "CALL", label: "Ligação" },
  { value: "MEETING", label: "Reunião" },
  { value: "EMAIL", label: "E-mail" },
  { value: "NOTE", label: "Nota" },
  { value: "TASK", label: "Tarefa" },
  { value: "EVENT", label: "Evento" },
];

function typeLabel(type: ActivityType): string {
  return TYPES.find((t) => t.value === type)?.label ?? type;
}

const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

// Formulario usa <input type="datetime-local"> (sem timezone) - convertido
// para/de ISO 8601 (UTC) na borda com a API. Ver comentario no schema
// (activities.schema.ts) sobre o duplo sentido do campo: "quando aconteceu"
// para CALL/MEETING/EMAIL/NOTE, "prazo" para TASK.
function toDateTimeLocalValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const EMPTY_FORM = {
  type: "CALL" as ActivityType,
  subject: "",
  notes: "",
  activityDate: "",
  companyId: "",
  contactId: "",
  dealId: "",
  ownerUserId: "",
};

export default function ActivitiesPage() {
  const { user, isLoading, authFetch } = useRequireAuth();
  const canManage = user?.permissions.includes("activities:manage") ?? false;

  const [activities, setActivities] = useState<Activity[] | null>(null);
  const [total, setTotal] = useState(0);
  const [listError, setListError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<ActivityType | "">("");
  const [pendingOnly, setPendingOnly] = useState(false);
  const [companyFilter, setCompanyFilter] = useState("");
  const [contactFilter, setContactFilter] = useState("");
  const [dealFilter, setDealFilter] = useState("");

  const [companyOptions, setCompanyOptions] = useState<Company[]>([]);
  const [contactOptions, setContactOptions] = useState<Contact[]>([]);
  const [dealOptions, setDealOptions] = useState<Deal[]>([]);
  const [userOptions, setUserOptions] = useState<TenantUserRow[]>([]);

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const load = useCallback(
    async (
      targetType: ActivityType | "",
      targetPendingOnly: boolean,
      targetCompanyId: string,
      targetContactId: string,
      targetDealId: string,
    ) => {
      try {
        const params = new URLSearchParams({ pageSize: "100" });
        if (targetType) params.set("type", targetType);
        if (targetPendingOnly) params.set("pendingOnly", "true");
        if (targetCompanyId) params.set("companyId", targetCompanyId);
        if (targetContactId) params.set("contactId", targetContactId);
        if (targetDealId) params.set("dealId", targetDealId);

        const res = await authFetch<Paginated<Activity>>(`/activities?${params.toString()}`);
        setActivities(res.data);
        setTotal(res.total);
        setListError(null);
      } catch (err) {
        setListError(
          err instanceof ApiError ? err.message : "Não foi possível carregar as atividades.",
        );
      }
    },
    [authFetch],
  );

  useEffect(() => {
    if (!user) return;
    // Ver comentario equivalente em app/companies/page.tsx.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(typeFilter, pendingOnly, companyFilter, contactFilter, dealFilter);
  }, [user, typeFilter, pendingOnly, companyFilter, contactFilter, dealFilter, load]);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      authFetch<Paginated<Company>>("/companies?pageSize=100"),
      authFetch<Paginated<Contact>>("/contacts?pageSize=100"),
      authFetch<Paginated<Deal>>("/deals?pageSize=100"),
    ])
      .then(([companiesRes, contactsRes, dealsRes]) => {
        setCompanyOptions(companiesRes.data);
        setContactOptions(contactsRes.data);
        setDealOptions(dealsRes.data);
      })
      .catch(() => {
        // Listas usadas so' para exibir nomes, filtros e para o formulario de
        // vinculo - uma falha aqui nao deve travar a pagina de atividades inteira.
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

  function dealTitle(id: string | null): string | null {
    if (!id) return null;
    return dealOptions.find((d) => d.id === id)?.title ?? null;
  }

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setIsDrawerOpen(true);
  }

  function startEdit(activity: Activity) {
    setEditingId(activity.id);
    setForm({
      type: activity.type,
      subject: activity.subject,
      notes: activity.notes ?? "",
      activityDate: toDateTimeLocalValue(activity.activityDate),
      companyId: activity.companyId ?? "",
      contactId: activity.contactId ?? "",
      dealId: activity.dealId ?? "",
      ownerUserId: activity.ownerUserId ?? "",
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

    if (!form.companyId && !form.contactId && !form.dealId) {
      setFormError("Selecione ao menos um vínculo: empresa, contato ou negócio.");
      return;
    }

    setIsSubmitting(true);

    const payload = {
      type: form.type,
      subject: form.subject,
      notes: form.notes || undefined,
      activityDate: form.activityDate ? new Date(form.activityDate).toISOString() : undefined,
      companyId: form.companyId || undefined,
      contactId: form.contactId || undefined,
      dealId: form.dealId || undefined,
      ownerUserId: form.ownerUserId || undefined,
    };

    try {
      if (editingId) {
        await authFetch(`/activities/${editingId}`, { method: "PATCH", body: payload });
      } else {
        await authFetch("/activities", { method: "POST", body: payload });
      }
      closeDrawer();
      await load(typeFilter, pendingOnly, companyFilter, contactFilter, dealFilter);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Não foi possível salvar a atividade.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Excluir esta atividade? Essa ação não pode ser desfeita.")) return;
    try {
      await authFetch(`/activities/${id}`, { method: "DELETE" });
      if (editingId === id) closeDrawer();
      await load(typeFilter, pendingOnly, companyFilter, contactFilter, dealFilter);
    } catch (err) {
      setListError(err instanceof ApiError ? err.message : "Não foi possível excluir a atividade.");
    }
  }

  async function setCompleted(id: string, completed: boolean) {
    try {
      await authFetch(`/activities/${id}/complete`, { method: "PATCH", body: { completed } });
      await load(typeFilter, pendingOnly, companyFilter, contactFilter, dealFilter);
    } catch (err) {
      setListError(
        err instanceof ApiError ? err.message : "Não foi possível atualizar a tarefa.",
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

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Atividades</h1>
          {canManage && (
            <button
              onClick={openCreate}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" strokeWidth={2.5} />
              Nova atividade
            </button>
          )}
        </div>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-sm font-medium text-zinc-500">Linha do tempo ({total})</h2>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as ActivityType | "")}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            >
              <option value="">Todos os tipos</option>
              {TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <select
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            >
              <option value="">Todas as empresas</option>
              {companyOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              value={contactFilter}
              onChange={(e) => setContactFilter(e.target.value)}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            >
              <option value="">Todos os contatos</option>
              {contactOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              value={dealFilter}
              onChange={(e) => setDealFilter(e.target.value)}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            >
              <option value="">Todos os negócios</option>
              {dealOptions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title}
                </option>
              ))}
            </select>
            {typeFilter === "TASK" && (
              <label className="flex items-center gap-1.5 text-sm text-zinc-600">
                <input
                  type="checkbox"
                  checked={pendingOnly}
                  onChange={(e) => setPendingOnly(e.target.checked)}
                />
                Somente pendentes
              </label>
            )}
          </div>
        </div>

        {listError && <p className="mb-4 text-sm text-red-600">{listError}</p>}

        {activities === null && !listError ? (
          <p className="text-sm text-zinc-500">Carregando…</p>
        ) : activities?.length === 0 ? (
          <p className="text-sm text-zinc-400">Nenhuma atividade registrada ainda.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {activities?.map((activity) => (
              <li
                key={activity.id}
                className="rounded-xl border border-zinc-200 bg-white p-4 text-sm shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="inline-block rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                      {typeLabel(activity.type)}
                    </span>
                    <p className="mt-1 font-medium text-zinc-900">{activity.subject}</p>
                  </div>
                  <p className="whitespace-nowrap text-xs text-zinc-500">
                    {dateTimeFormatter.format(new Date(activity.activityDate))}
                  </p>
                </div>

                {activity.notes && <p className="mt-1 text-zinc-600">{activity.notes}</p>}

                <div className="mt-2 flex flex-wrap gap-x-3 text-xs text-zinc-500">
                  {companyName(activity.companyId) && (
                    <span>Empresa: {companyName(activity.companyId)}</span>
                  )}
                  {contactName(activity.contactId) && (
                    <span>Contato: {contactName(activity.contactId)}</span>
                  )}
                  {dealTitle(activity.dealId) && <span>Negócio: {dealTitle(activity.dealId)}</span>}
                </div>

                {activity.type === "TASK" && (
                  <p className="mt-1 text-xs">
                    {activity.completedAt ? (
                      <span className="text-emerald-600">
                        Concluída em {dateTimeFormatter.format(new Date(activity.completedAt))}
                      </span>
                    ) : (
                      <span className="text-amber-600">Pendente</span>
                    )}
                  </p>
                )}

                {canManage && (
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 border-t border-zinc-100 pt-2 text-xs">
                    <button
                      onClick={() => startEdit(activity)}
                      className="text-zinc-500 hover:text-zinc-900"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDelete(activity.id)}
                      className="text-red-500 hover:text-red-700"
                    >
                      Excluir
                    </button>
                    {activity.type === "TASK" &&
                      (activity.completedAt ? (
                        <button
                          onClick={() => void setCompleted(activity.id, false)}
                          className="text-zinc-500 hover:text-zinc-900"
                        >
                          Reabrir
                        </button>
                      ) : (
                        <button
                          onClick={() => void setCompleted(activity.id, true)}
                          className="text-emerald-600 hover:text-emerald-800"
                        >
                          Concluir
                        </button>
                      ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <Drawer
        open={isDrawerOpen}
        onClose={closeDrawer}
        title={editingId ? "Editar atividade" : "Nova atividade"}
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700">Tipo</label>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as ActivityType })}
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
            <label className="block text-sm font-medium text-zinc-700">Assunto</label>
            <input
              required
              maxLength={200}
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700">
              {form.type === "TASK" ? "Prazo" : "Quando aconteceu"}
            </label>
            <input
              type="datetime-local"
              value={form.activityDate}
              onChange={(e) => setForm({ ...form, activityDate: e.target.value })}
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

          <p className="text-xs text-zinc-400">
            Selecione ao menos um vínculo (empresa, contato ou negócio).
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

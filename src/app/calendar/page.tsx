"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { ChevronLeft, ChevronRight, Lock, Plus } from "lucide-react";
import { ApiError } from "@/lib/api";
import type {
  Activity,
  ActivityType,
  CalendarBlock,
  Company,
  Contact,
  Deal,
  Paginated,
  TenantUserRow,
} from "@/lib/types";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { AppShell } from "@/components/AppShell";
import { Drawer } from "@/components/Drawer";

type CalendarView = "month" | "week" | "list";

const TYPES: Array<{ value: ActivityType; label: string }> = [
  { value: "EVENT", label: "Evento" },
  { value: "CALL", label: "Ligação" },
  { value: "MEETING", label: "Reunião" },
  { value: "EMAIL", label: "E-mail" },
  { value: "NOTE", label: "Nota" },
  { value: "TASK", label: "Tarefa" },
];

function typeLabel(type: ActivityType): string {
  return TYPES.find((t) => t.value === type)?.label ?? type;
}

const WEEKDAY_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

const monthYearFormatter = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });
const dayFormatter = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "2-digit",
  month: "long",
});
const timeFormatter = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });
const shortDayFormatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, amount: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + amount);
}

function addMonths(d: Date, amount: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + amount, 1);
}

// Semana comecando na segunda-feira (convencao de calendario de negocios) -
// getDay() retorna 0 para domingo, entao "recuamos" ate a segunda anterior.
function startOfWeek(d: Date): Date {
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  return addDays(startOfDay(d), -diff);
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// <input type="datetime-local"> nao aceita timezone - convertido para/de ISO
// 8601 (UTC) na borda com a API, mesma convencao de app/activities/page.tsx.
function toDateTimeLocalValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function monthGridDays(anchor: Date): Date[] {
  const gridStart = startOfWeek(new Date(anchor.getFullYear(), anchor.getMonth(), 1));
  return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
}

function weekDays(anchor: Date): Date[] {
  const start = startOfWeek(anchor);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

const EMPTY_EVENT_FORM = {
  type: "EVENT" as ActivityType,
  subject: "",
  notes: "",
  activityDate: "",
  companyId: "",
  contactId: "",
  dealId: "",
  ownerUserId: "",
};

const EMPTY_BLOCK_FORM = {
  userId: "",
  startAt: "",
  endAt: "",
  reason: "",
};

export default function CalendarPage() {
  const { user, isLoading, authFetch } = useRequireAuth();
  const canManageActivities = user?.permissions.includes("activities:manage") ?? false;
  const canManageCalendar = user?.permissions.includes("calendar:manage") ?? false;

  const [view, setView] = useState<CalendarView>("month");
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()));

  const [activities, setActivities] = useState<Activity[] | null>(null);
  const [blocks, setBlocks] = useState<CalendarBlock[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  const [companyOptions, setCompanyOptions] = useState<Company[]>([]);
  const [contactOptions, setContactOptions] = useState<Contact[]>([]);
  const [dealOptions, setDealOptions] = useState<Deal[]>([]);
  const [userOptions, setUserOptions] = useState<TenantUserRow[]>([]);

  const [isEventDrawerOpen, setIsEventDrawerOpen] = useState(false);
  const [eventForm, setEventForm] = useState(EMPTY_EVENT_FORM);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [eventFormError, setEventFormError] = useState<string | null>(null);
  const [isSubmittingEvent, setIsSubmittingEvent] = useState(false);

  const [isBlockDrawerOpen, setIsBlockDrawerOpen] = useState(false);
  const [blockForm, setBlockForm] = useState(EMPTY_BLOCK_FORM);
  const [blockFormError, setBlockFormError] = useState<string | null>(null);
  const [isSubmittingBlock, setIsSubmittingBlock] = useState(false);

  // O periodo visivel depende da visao (mes/semana/lista - lista reaproveita
  // o mes atual, so muda a apresentacao) - usado tanto para montar a grade
  // quanto para os filtros from/to enviados a API.
  const { rangeStart, rangeEnd, gridDays } = useMemo(() => {
    if (view === "week") {
      const days = weekDays(anchor);
      return { rangeStart: days[0], rangeEnd: addDays(days[6], 1), gridDays: days };
    }
    const days = monthGridDays(anchor);
    return { rangeStart: days[0], rangeEnd: addDays(days[41], 1), gridDays: days };
  }, [view, anchor]);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        pageSize: "100",
        from: rangeStart.toISOString(),
        to: rangeEnd.toISOString(),
      });
      const [activitiesRes, blocksRes] = await Promise.all([
        authFetch<Paginated<Activity>>(`/activities?${params.toString()}`),
        authFetch<Paginated<CalendarBlock>>(`/calendar/blocks?${params.toString()}`),
      ]);
      setActivities(activitiesRes.data);
      setBlocks(blocksRes.data);
      setListError(null);
    } catch (err) {
      setListError(
        err instanceof ApiError ? err.message : "Não foi possível carregar o calendário.",
      );
    }
  }, [authFetch, rangeStart, rangeEnd]);

  useEffect(() => {
    if (!user) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [user, load]);

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
        // Listas usadas so' para os vinculos do formulario de evento - uma
        // falha aqui nao deve travar a pagina de calendario inteira.
      });
  }, [user, authFetch]);

  useEffect(() => {
    if (!user || !user.permissions.includes("users:read")) return;
    authFetch<TenantUserRow[]>("/users")
      .then(setUserOptions)
      .catch(() => {
        // Falha aqui nao deve travar a pagina - os campos "Responsavel" e
        // "Bloquear agenda de" so' ficam com a opcao "Eu mesmo(a)".
      });
  }, [user, authFetch]);

  function userName(id: string): string {
    if (user && id === user.id) return `${user.name} (você)`;
    return userOptions.find((u) => u.id === id)?.name ?? "Usuário";
  }

  const activitiesByDay = useMemo(() => {
    const map = new Map<string, Activity[]>();
    for (const activity of activities ?? []) {
      const key = dayKey(new Date(activity.activityDate));
      const list = map.get(key) ?? [];
      list.push(activity);
      map.set(key, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.activityDate.localeCompare(b.activityDate));
    }
    return map;
  }, [activities]);

  // Um bloqueio cobre um periodo [startAt, endAt] - "espalha" em cada dia da
  // grade visivel que ele sobrepoe, para aparecer em todos eles.
  const blocksByDay = useMemo(() => {
    const map = new Map<string, CalendarBlock[]>();
    for (const day of gridDays) {
      const dayStart = day.getTime();
      const dayEnd = addDays(day, 1).getTime();
      const matching = (blocks ?? []).filter((b) => {
        const start = new Date(b.startAt).getTime();
        const end = new Date(b.endAt).getTime();
        return start < dayEnd && end > dayStart;
      });
      if (matching.length > 0) map.set(dayKey(day), matching);
    }
    return map;
  }, [blocks, gridDays]);

  function openCreateEvent(defaultDate?: Date) {
    setEditingEventId(null);
    setEventForm({
      ...EMPTY_EVENT_FORM,
      activityDate: toDateTimeLocalValue(defaultDate ?? new Date()),
    });
    setEventFormError(null);
    setIsEventDrawerOpen(true);
  }

  function openEditEvent(activity: Activity) {
    setEditingEventId(activity.id);
    setEventForm({
      type: activity.type,
      subject: activity.subject,
      notes: activity.notes ?? "",
      activityDate: toDateTimeLocalValue(new Date(activity.activityDate)),
      companyId: activity.companyId ?? "",
      contactId: activity.contactId ?? "",
      dealId: activity.dealId ?? "",
      ownerUserId: activity.ownerUserId ?? "",
    });
    setEventFormError(null);
    setIsEventDrawerOpen(true);
  }

  function closeEventDrawer() {
    setIsEventDrawerOpen(false);
    setEditingEventId(null);
    setEventForm(EMPTY_EVENT_FORM);
    setEventFormError(null);
  }

  async function handleEventSubmit(event: FormEvent) {
    event.preventDefault();
    setEventFormError(null);

    if (!eventForm.companyId && !eventForm.contactId && !eventForm.dealId) {
      setEventFormError("Selecione ao menos um vínculo: empresa, contato ou negócio.");
      return;
    }

    setIsSubmittingEvent(true);
    const payload = {
      type: eventForm.type,
      subject: eventForm.subject,
      notes: eventForm.notes || undefined,
      activityDate: eventForm.activityDate
        ? new Date(eventForm.activityDate).toISOString()
        : undefined,
      companyId: eventForm.companyId || undefined,
      contactId: eventForm.contactId || undefined,
      dealId: eventForm.dealId || undefined,
      ownerUserId: eventForm.ownerUserId || undefined,
    };

    try {
      if (editingEventId) {
        await authFetch(`/activities/${editingEventId}`, { method: "PATCH", body: payload });
      } else {
        await authFetch("/activities", { method: "POST", body: payload });
      }
      closeEventDrawer();
      await load();
    } catch (err) {
      // Inclui o 409 da "trava de verdade" (bloqueio de agenda do
      // responsavel cobrindo esta data) - a mensagem do backend ja e' clara
      // o suficiente para exibir direto.
      setEventFormError(
        err instanceof ApiError ? err.message : "Não foi possível salvar o evento.",
      );
    } finally {
      setIsSubmittingEvent(false);
    }
  }

  async function handleEventDelete(id: string) {
    if (!window.confirm("Excluir este evento? Essa ação não pode ser desfeita.")) return;
    try {
      await authFetch(`/activities/${id}`, { method: "DELETE" });
      closeEventDrawer();
      await load();
    } catch (err) {
      setEventFormError(err instanceof ApiError ? err.message : "Não foi possível excluir.");
    }
  }

  function openCreateBlock(defaultDate?: Date) {
    const day = defaultDate ?? new Date();
    const start = new Date(day);
    start.setHours(9, 0, 0, 0);
    const end = new Date(day);
    end.setHours(18, 0, 0, 0);
    setBlockForm({
      userId: "",
      startAt: toDateTimeLocalValue(start),
      endAt: toDateTimeLocalValue(end),
      reason: "",
    });
    setBlockFormError(null);
    setIsBlockDrawerOpen(true);
  }

  function closeBlockDrawer() {
    setIsBlockDrawerOpen(false);
    setBlockForm(EMPTY_BLOCK_FORM);
    setBlockFormError(null);
  }

  async function handleBlockSubmit(event: FormEvent) {
    event.preventDefault();
    setBlockFormError(null);

    if (!blockForm.startAt || !blockForm.endAt) {
      setBlockFormError("Informe o início e o fim do bloqueio.");
      return;
    }

    setIsSubmittingBlock(true);
    try {
      await authFetch("/calendar/blocks", {
        method: "POST",
        body: {
          userId: blockForm.userId || undefined,
          startAt: new Date(blockForm.startAt).toISOString(),
          endAt: new Date(blockForm.endAt).toISOString(),
          reason: blockForm.reason || undefined,
        },
      });
      closeBlockDrawer();
      await load();
    } catch (err) {
      setBlockFormError(
        err instanceof ApiError ? err.message : "Não foi possível criar o bloqueio.",
      );
    } finally {
      setIsSubmittingBlock(false);
    }
  }

  async function handleBlockDelete(id: string) {
    if (!window.confirm("Remover este bloqueio de agenda?")) return;
    try {
      await authFetch(`/calendar/blocks/${id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setListError(err instanceof ApiError ? err.message : "Não foi possível remover o bloqueio.");
    }
  }

  function goToday() {
    setAnchor(startOfDay(new Date()));
  }

  function goPrevious() {
    if (view === "month") setAnchor((a) => addMonths(a, -1));
    else if (view === "week") setAnchor((a) => addDays(a, -7));
    else setAnchor((a) => addMonths(a, -1));
  }

  function goNext() {
    if (view === "month") setAnchor((a) => addMonths(a, 1));
    else if (view === "week") setAnchor((a) => addDays(a, 7));
    else setAnchor((a) => addMonths(a, 1));
  }

  const periodLabel =
    view === "week"
      ? `${shortDayFormatter.format(gridDays[0])} – ${shortDayFormatter.format(gridDays[6])}`
      : monthYearFormatter.format(anchor);

  if (isLoading || !user) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-zinc-500">Carregando…</p>
      </div>
    );
  }

  const today = startOfDay(new Date());

  function DayCell({ day, compact }: { day: Date; compact: boolean }) {
    const key = dayKey(day);
    const dayActivities = activitiesByDay.get(key) ?? [];
    const dayBlocks = blocksByDay.get(key) ?? [];
    const isCurrentMonth = day.getMonth() === anchor.getMonth();
    const isToday = day.getTime() === today.getTime();
    const visibleActivities = compact ? dayActivities.slice(0, 3) : dayActivities;
    const hiddenCount = compact ? dayActivities.length - visibleActivities.length : 0;

    return (
      <div
        className={`flex min-h-[7rem] flex-col gap-1 border border-zinc-100 p-1.5 text-left align-top ${
          isCurrentMonth ? "bg-white" : "bg-zinc-50"
        }`}
      >
        <button
          type="button"
          onClick={() => openCreateEvent(new Date(day.getFullYear(), day.getMonth(), day.getDate(), 9, 0))}
          className={`flex w-fit items-center justify-center rounded-full text-xs font-medium ${
            isToday
              ? "h-6 w-6 bg-blue-600 text-white"
              : isCurrentMonth
                ? "h-6 w-6 text-zinc-700 hover:bg-zinc-100"
                : "h-6 w-6 text-zinc-400 hover:bg-zinc-100"
          }`}
          title="Novo evento neste dia"
        >
          {day.getDate()}
        </button>

        {dayBlocks.length > 0 && (
          <div
            className="flex items-center gap-1 truncate rounded bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-700"
            title={dayBlocks
              .map((b) => `${userName(b.userId)}${b.reason ? ` - ${b.reason}` : ""}`)
              .join(" · ")}
          >
            <Lock className="h-3 w-3 flex-shrink-0" strokeWidth={2} />
            <span className="truncate">
              {dayBlocks.length === 1 ? userName(dayBlocks[0].userId) : `${dayBlocks.length} bloqueios`}
            </span>
          </div>
        )}

        <div className="flex flex-col gap-1">
          {visibleActivities.map((activity) => (
            <button
              key={activity.id}
              type="button"
              onClick={() => openEditEvent(activity)}
              className="truncate rounded bg-blue-50 px-1.5 py-0.5 text-left text-[11px] font-medium text-blue-700 hover:bg-blue-100"
              title={activity.subject}
            >
              {timeFormatter.format(new Date(activity.activityDate))} {activity.subject}
            </button>
          ))}
          {hiddenCount > 0 && <p className="px-1.5 text-[11px] text-zinc-400">+{hiddenCount} mais</p>}
        </div>
      </div>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Calendário</h1>
          <div className="flex flex-wrap items-center gap-2">
            {canManageCalendar && (
              <button
                onClick={() => openCreateBlock(anchor)}
                className="flex items-center gap-1.5 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50"
              >
                <Lock className="h-4 w-4" strokeWidth={2.5} />
                Bloquear data
              </button>
            )}
            {canManageActivities && (
              <button
                onClick={() => openCreateEvent()}
                className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
              >
                <Plus className="h-4 w-4" strokeWidth={2.5} />
                Novo evento
              </button>
            )}
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={goPrevious}
              aria-label="Período anterior"
              className="rounded-lg border border-zinc-300 p-1.5 text-zinc-500 hover:bg-zinc-50"
            >
              <ChevronLeft className="h-4 w-4" strokeWidth={2.5} />
            </button>
            <button
              onClick={goToday}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Hoje
            </button>
            <button
              onClick={goNext}
              aria-label="Próximo período"
              className="rounded-lg border border-zinc-300 p-1.5 text-zinc-500 hover:bg-zinc-50"
            >
              <ChevronRight className="h-4 w-4" strokeWidth={2.5} />
            </button>
            <h2 className="ml-2 text-sm font-medium capitalize text-zinc-700">{periodLabel}</h2>
          </div>

          <div className="flex overflow-hidden rounded-lg border border-zinc-300">
            {(["month", "week", "list"] as CalendarView[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  view === v ? "bg-blue-600 text-white" : "bg-white text-zinc-600 hover:bg-zinc-50"
                }`}
              >
                {v === "month" ? "Mês" : v === "week" ? "Semana" : "Lista"}
              </button>
            ))}
          </div>
        </div>

        {listError && <p className="mb-4 text-sm text-red-600">{listError}</p>}

        {(view === "month" || view === "week") && (
          <div className="overflow-hidden rounded-xl border border-zinc-200 shadow-sm">
            <div className="grid grid-cols-7 border-b border-zinc-200 bg-zinc-50">
              {WEEKDAY_LABELS.map((label) => (
                <div key={label} className="px-2 py-2 text-center text-xs font-medium text-zinc-500">
                  {label}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {gridDays.map((day) => (
                <DayCell key={day.toISOString()} day={day} compact={view === "month"} />
              ))}
            </div>
          </div>
        )}

        {view === "list" && (
          <div className="flex flex-col gap-4">
            {gridDays
              .filter((day) => (activitiesByDay.get(dayKey(day))?.length ?? 0) > 0)
              .map((day) => (
                <div key={day.toISOString()}>
                  <h3 className="mb-2 text-sm font-medium capitalize text-zinc-500">
                    {dayFormatter.format(day)}
                  </h3>
                  <ul className="flex flex-col gap-2">
                    {(activitiesByDay.get(dayKey(day)) ?? []).map((activity) => (
                      <li key={activity.id}>
                        <button
                          type="button"
                          onClick={() => openEditEvent(activity)}
                          className="flex w-full items-center gap-3 rounded-xl border border-zinc-200 bg-white p-3 text-left text-sm shadow-sm transition-shadow hover:shadow-md"
                        >
                          <span className="whitespace-nowrap text-xs text-zinc-500">
                            {timeFormatter.format(new Date(activity.activityDate))}
                          </span>
                          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                            {typeLabel(activity.type)}
                          </span>
                          <span className="truncate font-medium text-zinc-900">
                            {activity.subject}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            {activities?.length === 0 && (
              <p className="text-sm text-zinc-400">Nenhum evento ou atividade neste período.</p>
            )}
          </div>
        )}

        {(blocks?.length ?? 0) > 0 && (
          <div className="mt-8">
            <h2 className="mb-3 text-sm font-medium text-zinc-500">
              Bloqueios de agenda no período
            </h2>
            <ul className="flex flex-col gap-2">
              {blocks?.map((block) => (
                <li
                  key={block.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-amber-100 bg-amber-50 p-3 text-sm"
                >
                  <div className="flex items-center gap-2 text-amber-800">
                    <Lock className="h-4 w-4 flex-shrink-0" strokeWidth={2} />
                    <span className="font-medium">{userName(block.userId)}</span>
                    <span className="text-amber-600">
                      {shortDayFormatter.format(new Date(block.startAt))} –{" "}
                      {shortDayFormatter.format(new Date(block.endAt))}
                    </span>
                    {block.reason && <span className="text-amber-600">· {block.reason}</span>}
                  </div>
                  {canManageCalendar && (
                    <button
                      onClick={() => handleBlockDelete(block.id)}
                      className="text-xs font-medium text-red-500 hover:text-red-700"
                    >
                      Remover
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <Drawer
        open={isEventDrawerOpen}
        onClose={closeEventDrawer}
        title={editingEventId ? "Editar evento" : "Novo evento"}
      >
        <form onSubmit={handleEventSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700">Tipo</label>
            <select
              value={eventForm.type}
              onChange={(e) => setEventForm({ ...eventForm, type: e.target.value as ActivityType })}
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
              value={eventForm.subject}
              onChange={(e) => setEventForm({ ...eventForm, subject: e.target.value })}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700">Data e hora</label>
            <input
              type="datetime-local"
              value={eventForm.activityDate}
              onChange={(e) => setEventForm({ ...eventForm, activityDate: e.target.value })}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700">Empresa</label>
            <select
              value={eventForm.companyId}
              onChange={(e) => setEventForm({ ...eventForm, companyId: e.target.value })}
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
              value={eventForm.contactId}
              onChange={(e) => setEventForm({ ...eventForm, contactId: e.target.value })}
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
              value={eventForm.dealId}
              onChange={(e) => setEventForm({ ...eventForm, dealId: e.target.value })}
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
                value={eventForm.ownerUserId}
                onChange={(e) => setEventForm({ ...eventForm, ownerUserId: e.target.value })}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              >
                <option value="">Nenhum</option>
                {userOptions.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-zinc-400">
                Se o responsável tiver um bloqueio de agenda cobrindo esta data, o evento será
                recusado.
              </p>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-zinc-700">Notas</label>
            <textarea
              maxLength={4000}
              rows={3}
              value={eventForm.notes}
              onChange={(e) => setEventForm({ ...eventForm, notes: e.target.value })}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>

          <p className="text-xs text-zinc-400">
            Selecione ao menos um vínculo (empresa, contato ou negócio).
          </p>
          {eventFormError && <p className="text-sm text-red-600">{eventFormError}</p>}

          <div className="mt-2 flex items-center gap-3">
            <button
              type="submit"
              disabled={isSubmittingEvent}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmittingEvent ? "Salvando…" : editingEventId ? "Atualizar" : "Adicionar"}
            </button>
            <button
              type="button"
              onClick={closeEventDrawer}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50"
            >
              Cancelar
            </button>
            {editingEventId && canManageActivities && (
              <button
                type="button"
                onClick={() => handleEventDelete(editingEventId)}
                className="ml-auto text-sm font-medium text-red-500 hover:text-red-700"
              >
                Excluir
              </button>
            )}
          </div>
        </form>
      </Drawer>

      <Drawer open={isBlockDrawerOpen} onClose={closeBlockDrawer} title="Bloquear data">
        <form onSubmit={handleBlockSubmit} className="flex flex-col gap-4">
          {userOptions.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-zinc-700">Bloquear agenda de</label>
              <select
                value={blockForm.userId}
                onChange={(e) => setBlockForm({ ...blockForm, userId: e.target.value })}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              >
                <option value="">Eu mesmo(a)</option>
                {userOptions
                  .filter((u) => u.id !== user.id)
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-zinc-700">Início</label>
            <input
              type="datetime-local"
              required
              value={blockForm.startAt}
              onChange={(e) => setBlockForm({ ...blockForm, startAt: e.target.value })}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700">Fim</label>
            <input
              type="datetime-local"
              required
              value={blockForm.endAt}
              onChange={(e) => setBlockForm({ ...blockForm, endAt: e.target.value })}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700">Motivo (opcional)</label>
            <input
              maxLength={500}
              value={blockForm.reason}
              onChange={(e) => setBlockForm({ ...blockForm, reason: e.target.value })}
              placeholder="Férias, folga, viagem…"
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>

          <p className="text-xs text-zinc-400">
            Enquanto o bloqueio estiver ativo, não será possível agendar eventos ou atividades
            para esta pessoa dentro do período informado.
          </p>
          {blockFormError && <p className="text-sm text-red-600">{blockFormError}</p>}

          <div className="mt-2 flex gap-3">
            <button
              type="submit"
              disabled={isSubmittingBlock}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmittingBlock ? "Salvando…" : "Bloquear"}
            </button>
            <button
              type="button"
              onClick={closeBlockDrawer}
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

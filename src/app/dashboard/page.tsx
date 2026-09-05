"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, ClipboardList, TrendingUp } from "lucide-react";
import { ApiError } from "@/lib/api";
import type { DashboardSummary, TenantUserRow } from "@/lib/types";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { AppShell } from "@/components/AppShell";

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

const percentFormatter = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  maximumFractionDigits: 0,
});

const STAGE_LABELS: Record<string, string> = {
  PROSPECTING: "Prospecção",
  QUALIFICATION: "Qualificação",
  PROPOSAL: "Proposta",
  NEGOTIATION: "Negociação",
  WON: "Ganho",
  LOST: "Perdido",
};

// Cores reservadas de status (ver skill dataviz): azul = aberto/neutro,
// esmeralda = ganho/positivo, vermelho = perdido/critico. Nunca reaproveitadas
// para outra serie.
function stageBarColor(stage: string): string {
  if (stage === "WON") return "bg-emerald-500";
  if (stage === "LOST") return "bg-red-500";
  return "bg-blue-500";
}

function StatTile({
  icon,
  label,
  value,
  sublabel,
  tone = "default",
}: {
  icon: ReactNode;
  label: string;
  value: string;
  sublabel?: string;
  tone?: "default" | "warning" | "critical";
}) {
  const iconTone =
    tone === "critical"
      ? "bg-red-50 text-red-600"
      : tone === "warning"
        ? "bg-amber-50 text-amber-600"
        : "bg-blue-50 text-blue-600";

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${iconTone}`}>
          {icon}
        </span>
        <p className="text-sm font-medium text-zinc-500">{label}</p>
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-zinc-900">{value}</p>
      {sublabel && <p className="mt-1 text-xs text-zinc-400">{sublabel}</p>}
    </div>
  );
}

export default function DashboardPage() {
  const { user, isLoading, authFetch } = useRequireAuth();

  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const [users, setUsers] = useState<TenantUserRow[] | null>(null);
  const [usersError, setUsersError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    if (!user.permissions.includes("reports:read")) return;

    let cancelled = false;
    authFetch<DashboardSummary>("/reports/dashboard")
      .then((data) => {
        if (!cancelled) setSummary(data);
      })
      .catch((err) => {
        if (cancelled) return;
        setSummaryError(
          err instanceof ApiError ? err.message : "Não foi possível carregar os indicadores.",
        );
      });
    return () => {
      cancelled = true;
    };
  }, [user, authFetch]);

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

  const canSeeReports = user.permissions.includes("reports:read");
  const maxStageValue = summary
    ? Math.max(1, ...summary.pipeline.byStage.map((s) => s.value))
    : 1;

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="mb-6 text-2xl font-semibold tracking-tight text-zinc-900">Painel</h1>

        {!canSeeReports && (
          <div className="mb-8 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
            <p className="text-sm text-zinc-500">
              Seu papel não tem permissão para ver os indicadores do painel.
            </p>
          </div>
        )}

        {canSeeReports && summaryError && (
          <p className="mb-6 text-sm text-red-600">{summaryError}</p>
        )}

        {canSeeReports && !summaryError && summary === null && (
          <p className="mb-6 text-sm text-zinc-500">Carregando indicadores…</p>
        )}

        {canSeeReports && summary && (
          <>
            {/* Visão geral do funil */}
            <section className="mb-8">
              <h2 className="mb-3 text-sm font-medium text-zinc-500">Visão geral do funil</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <StatTile
                  icon={<TrendingUp className="h-4.5 w-4.5" strokeWidth={2} />}
                  label="Pipeline aberto"
                  value={currencyFormatter.format(summary.pipeline.openPipelineValue)}
                  sublabel="Soma dos negócios em aberto"
                />
                <StatTile
                  icon={<CheckCircle2 className="h-4.5 w-4.5" strokeWidth={2} />}
                  label="Ganhos no mês"
                  value={currencyFormatter.format(summary.pipeline.wonThisMonth.value)}
                  sublabel={`${summary.pipeline.wonThisMonth.count} negócio(s) fechado(s)`}
                />
                <StatTile
                  icon={<TrendingUp className="h-4.5 w-4.5" strokeWidth={2} />}
                  label="Taxa de conversão"
                  value={percentFormatter.format(summary.pipeline.conversionRate)}
                  sublabel="Ganhos ÷ (ganhos + perdidos), histórico"
                />
              </div>

              <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
                <p className="mb-3 text-sm font-medium text-zinc-500">Negócios por estágio</p>
                <div className="flex flex-col gap-2">
                  {summary.pipeline.byStage.map((s) => (
                    <div key={s.stage} className="flex items-center gap-3 text-sm">
                      <span className="w-28 flex-shrink-0 text-zinc-600">
                        {STAGE_LABELS[s.stage] ?? s.stage}
                      </span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-100">
                        <div
                          className={`h-full rounded-full ${stageBarColor(s.stage)}`}
                          style={{ width: `${Math.max(2, (s.value / maxStageValue) * 100)}%` }}
                        />
                      </div>
                      <span className="w-16 flex-shrink-0 text-right text-xs text-zinc-500">
                        {s.count}
                      </span>
                      <span className="w-28 flex-shrink-0 text-right text-xs text-zinc-500">
                        {currencyFormatter.format(s.value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* Cadastros */}
            <section className="mb-8">
              <h2 className="mb-3 text-sm font-medium text-zinc-500">Cadastros</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <StatTile
                  icon={<ClipboardList className="h-4.5 w-4.5" strokeWidth={2} />}
                  label="Empresas"
                  value={String(summary.registrations.companies.total)}
                  sublabel={`+${summary.registrations.companies.last30Days} nos últimos 30 dias`}
                />
                <StatTile
                  icon={<ClipboardList className="h-4.5 w-4.5" strokeWidth={2} />}
                  label="Contatos"
                  value={String(summary.registrations.contacts.total)}
                  sublabel={`+${summary.registrations.contacts.last30Days} nos últimos 30 dias`}
                />
              </div>
            </section>

            {/* Atividades e tarefas */}
            <section className="mb-8">
              <h2 className="mb-3 text-sm font-medium text-zinc-500">Atividades e tarefas</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <StatTile
                  icon={<ClipboardList className="h-4.5 w-4.5" strokeWidth={2} />}
                  label="Tarefas pendentes"
                  value={String(summary.activities.pendingTasks)}
                />
                <StatTile
                  icon={<AlertTriangle className="h-4.5 w-4.5" strokeWidth={2} />}
                  label="Tarefas vencidas"
                  value={String(summary.activities.overdueTasks)}
                  tone={summary.activities.overdueTasks > 0 ? "critical" : "default"}
                />
                <StatTile
                  icon={<ClipboardList className="h-4.5 w-4.5" strokeWidth={2} />}
                  label="Atividades esta semana"
                  value={String(summary.activities.activitiesThisWeek)}
                />
              </div>
            </section>

            {/* Por responsável */}
            <section className="mb-8">
              <h2 className="mb-3 text-sm font-medium text-zinc-500">Por responsável</h2>
              <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
                {summary.byOwner.length === 0 ? (
                  <p className="text-sm text-zinc-500">
                    Nenhum negócio ou atividade com responsável atribuído ainda.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-zinc-200 text-xs font-medium tracking-wide text-zinc-500 uppercase">
                          <th className="py-2 pr-4 font-medium">Responsável</th>
                          <th className="py-2 pr-4 font-medium">Negócios ganhos</th>
                          <th className="py-2 pr-4 font-medium">Pipeline aberto</th>
                          <th className="py-2 pr-4 font-medium">Atividades (30 dias)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {summary.byOwner.map((owner) => (
                          <tr key={owner.ownerUserId} className="border-b border-zinc-100 last:border-0">
                            <td className="py-2 pr-4 text-zinc-900">{owner.ownerName}</td>
                            <td className="py-2 pr-4 text-zinc-600">{owner.wonDeals}</td>
                            <td className="py-2 pr-4 text-zinc-600">
                              {currencyFormatter.format(owner.openPipelineValue)}
                            </td>
                            <td className="py-2 pr-4 text-zinc-600">
                              {owner.activitiesLast30Days}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
          </>
        )}

        <div className="mb-8 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
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

        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
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
                    <tr className="border-b border-zinc-200 text-xs font-medium tracking-wide text-zinc-500 uppercase">
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
      </div>
    </AppShell>
  );
}

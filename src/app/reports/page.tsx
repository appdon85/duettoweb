"use client";

import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import type { SalesFunnel } from "@/lib/types";
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

// Mesmas cores de status reservadas do painel principal (ver dashboard/page.tsx
// e a skill dataviz): azul = aberto/neutro, esmeralda = ganho, vermelho = perdido.
function stageBarColor(stage: string): string {
  if (stage === "WON") return "bg-emerald-500";
  if (stage === "LOST") return "bg-red-500";
  return "bg-blue-500";
}

export default function ReportsPage() {
  const { user, isLoading, authFetch } = useRequireAuth();

  const [funnel, setFunnel] = useState<SalesFunnel | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    if (!user.permissions.includes("reports:read")) return;

    let cancelled = false;
    authFetch<SalesFunnel>("/reports/sales-funnel")
      .then((data) => {
        if (!cancelled) setFunnel(data);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : "Não foi possível carregar o relatório.");
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
  const maxCount = funnel ? Math.max(1, ...funnel.byStage.map((s) => s.count)) : 1;
  const maxReasonCount = funnel
    ? Math.max(1, ...funnel.lostReasons.map((r) => r.count))
    : 1;

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="mb-6 text-2xl font-semibold tracking-tight text-zinc-900">Relatórios</h1>

        {!canSeeReports && (
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
            <p className="text-sm text-zinc-500">
              Seu papel não tem permissão para ver os relatórios.
            </p>
          </div>
        )}

        {canSeeReports && error && <p className="text-sm text-red-600">{error}</p>}

        {canSeeReports && !error && funnel === null && (
          <p className="text-sm text-zinc-500">Carregando…</p>
        )}

        {canSeeReports && funnel && (
          <>
            <section className="mb-8 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-medium text-zinc-500">Funil de vendas por estágio</h2>
                <p className="text-sm text-zinc-500">
                  Taxa de conversão:{" "}
                  <span className="font-semibold text-zinc-900">
                    {percentFormatter.format(funnel.conversionRate)}
                  </span>
                </p>
              </div>

              <div className="flex flex-col gap-3">
                {funnel.byStage.map((s) => (
                  <div key={s.stage} className="flex items-center gap-3 text-sm">
                    <span className="w-28 flex-shrink-0 text-zinc-600">
                      {STAGE_LABELS[s.stage] ?? s.stage}
                    </span>
                    <div className="h-3 flex-1 overflow-hidden rounded-full bg-zinc-100">
                      <div
                        className={`h-full rounded-full ${stageBarColor(s.stage)}`}
                        style={{ width: `${Math.max(2, (s.count / maxCount) * 100)}%` }}
                      />
                    </div>
                    <span className="w-20 flex-shrink-0 text-right text-xs text-zinc-500">
                      {s.count} negócio(s)
                    </span>
                    <span className="w-28 flex-shrink-0 text-right text-xs text-zinc-500">
                      {currencyFormatter.format(s.value)}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-sm font-medium text-zinc-500">
                Motivos de perda mais frequentes
              </h2>

              {funnel.lostReasons.length === 0 ? (
                <p className="text-sm text-zinc-500">
                  Nenhum negócio perdido com motivo registrado ainda.
                </p>
              ) : (
                <div className="flex flex-col gap-3">
                  {funnel.lostReasons.map((r) => (
                    <div key={r.reason} className="flex items-center gap-3 text-sm">
                      <span className="w-40 flex-shrink-0 truncate text-zinc-600" title={r.reason}>
                        {r.reason}
                      </span>
                      <div className="h-3 flex-1 overflow-hidden rounded-full bg-zinc-100">
                        <div
                          className="h-full rounded-full bg-red-500"
                          style={{ width: `${Math.max(2, (r.count / maxReasonCount) * 100)}%` }}
                        />
                      </div>
                      <span className="w-24 flex-shrink-0 text-right text-xs text-zinc-500">
                        {r.count} negócio(s)
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}

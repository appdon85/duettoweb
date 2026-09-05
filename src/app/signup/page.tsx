"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { ApiError } from "@/lib/api";

// Mesma regra do backend (ver crm-saas/src/auth/dto/signup.dto.ts) - replicada
// aqui só para dar feedback imediato ao usuário; a validação que vale de
// verdade é sempre a da API.
function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove acentos (marcas de combinação, após NFD)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63);
}

const PASSWORD_HINT =
  "Mínimo de 12 caracteres, com letra maiúscula, minúscula, número e símbolo.";

export default function SignupPage() {
  const { signup } = useAuth();
  const router = useRouter();

  const [tenantName, setTenantName] = useState("");
  const [tenantSlug, setTenantSlug] = useState("");
  const [slugEditedManually, setSlugEditedManually] = useState(false);
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleTenantNameChange(value: string) {
    setTenantName(value);
    if (!slugEditedManually) {
      setTenantSlug(slugify(value));
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (adminPassword !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }

    setIsSubmitting(true);
    try {
      await signup({ tenantName, tenantSlug, adminName, adminEmail, adminPassword });
      router.push("/dashboard");
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Não foi possível criar a conta. Tente novamente.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <span className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-lg font-bold text-white">
            D
          </span>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Duetto CRM</h1>
          <p className="mt-1 text-sm text-zinc-500">Crie a conta da sua empresa</p>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="tenantName" className="block text-sm font-medium text-zinc-700">
                Nome da empresa
              </label>
              <input
                id="tenantName"
                type="text"
                required
                minLength={2}
                maxLength={120}
                value={tenantName}
                onChange={(e) => handleTenantNameChange(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>

            <div>
              <label htmlFor="tenantSlug" className="block text-sm font-medium text-zinc-700">
                Identificador (slug)
              </label>
              <input
                id="tenantSlug"
                type="text"
                required
                minLength={3}
                maxLength={63}
                pattern="[a-z0-9](-?[a-z0-9])*"
                value={tenantSlug}
                onChange={(e) => {
                  setSlugEditedManually(true);
                  setTenantSlug(e.target.value);
                }}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-mono shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
              <p className="mt-1 text-xs text-zinc-400">
                Só letras minúsculas, números e hífens. Identifica sua empresa no sistema.
              </p>
            </div>

            <div>
              <label htmlFor="adminName" className="block text-sm font-medium text-zinc-700">
                Seu nome
              </label>
              <input
                id="adminName"
                type="text"
                required
                minLength={2}
                maxLength={120}
                autoComplete="name"
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>

            <div>
              <label htmlFor="adminEmail" className="block text-sm font-medium text-zinc-700">
                Seu e-mail
              </label>
              <input
                id="adminEmail"
                type="email"
                required
                autoComplete="email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>

            <div>
              <label htmlFor="adminPassword" className="block text-sm font-medium text-zinc-700">
                Senha
              </label>
              <input
                id="adminPassword"
                type="password"
                required
                minLength={12}
                maxLength={128}
                autoComplete="new-password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
              <p className="mt-1 text-xs text-zinc-400">{PASSWORD_HINT}</p>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-zinc-700">
                Confirmar senha
              </label>
              <input
                id="confirmPassword"
                type="password"
                required
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? "Criando conta…" : "Criar conta"}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-zinc-500">
          Já tem uma conta?{" "}
          <Link href="/login" className="font-medium text-blue-600 hover:text-blue-700 hover:underline">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}

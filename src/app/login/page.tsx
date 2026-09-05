"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { ApiError } from "@/lib/api";

type Step = { kind: "credentials" } | { kind: "mfa"; mfaToken: string };

export default function LoginPage() {
  const { login, verifyMfa } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState<Step>({ kind: "credentials" });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleCredentialsSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const result = await login(email, password);
      if (result.mfaRequired) {
        setStep({ kind: "mfa", mfaToken: result.mfaToken });
      } else {
        router.push("/dashboard");
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível entrar. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleMfaSubmit(event: FormEvent) {
    event.preventDefault();
    if (step.kind !== "mfa") return;
    setError(null);
    setIsSubmitting(true);
    try {
      await verifyMfa(step.mfaToken, code);
      router.push("/dashboard");
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível confirmar o código. Tente novamente.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold text-zinc-900">Duetto CRM</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {step.kind === "credentials" ? "Entre na sua conta" : "Confirme o código do seu autenticador"}
          </p>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
          {step.kind === "credentials" ? (
            <form onSubmit={handleCredentialsSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-zinc-700">
                  E-mail
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-zinc-700">
                  Senha
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
                />
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting ? "Entrando…" : "Entrar"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleMfaSubmit} className="space-y-4">
              <div>
                <label htmlFor="code" className="block text-sm font-medium text-zinc-700">
                  Código de 6 dígitos (ou um código de recuperação)
                </label>
                <input
                  id="code"
                  type="text"
                  inputMode="numeric"
                  required
                  autoComplete="one-time-code"
                  autoFocus
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm tracking-widest focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
                />
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting ? "Confirmando…" : "Confirmar"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setStep({ kind: "credentials" });
                  setCode("");
                  setError(null);
                }}
                className="w-full text-center text-sm text-zinc-500 hover:text-zinc-700"
              >
                Voltar
              </button>
            </form>
          )}
        </div>

        {step.kind === "credentials" && (
          <p className="mt-6 text-center text-sm text-zinc-500">
            Ainda não tem uma conta?{" "}
            <Link href="/signup" className="font-medium text-zinc-900 hover:underline">
              Criar conta da empresa
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}

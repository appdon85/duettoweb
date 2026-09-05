"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Repetido em toda pagina protegida (dashboard, empresas, contatos): manda
 * para /login assim que a checagem inicial de sessao termina sem usuario
 * logado. Nao redireciona enquanto isLoading e' true para nao expulsar
 * alguem cujo refresh token ainda esta sendo validado (ex.: apos um F5).
 */
export function useRequireAuth() {
  const auth = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!auth.isLoading && !auth.user) {
      router.replace("/login");
    }
  }, [auth.isLoading, auth.user, router]);

  return auth;
}

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

// Rota raiz: nunca renderiza conteúdo próprio - só decide para onde mandar o
// visitante assim que a checagem de sessão (restauração via refresh token,
// ver AuthContext) termina.
export default function Home() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    router.replace(user ? "/dashboard" : "/login");
  }, [isLoading, user, router]);

  return (
    <div className="flex flex-1 items-center justify-center">
      <p className="text-sm text-zinc-500">Carregando…</p>
    </div>
  );
}

'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useRouter } from 'next/navigation';
import { apiRequest, ApiError } from '@/lib/api';
import type { PublicUser, Tenant, Tokens } from '@/lib/types';

// Estratégia de armazenamento de sessão (documentada aqui porque é uma
// decisão de segurança, não só de conveniência):
//
//   - accessToken: SÓ em memória (estado React). Nunca toca localStorage nem
//     cookie. Curto prazo de vida - se vazar via XSS, a janela de uso é
//     pequena.
//   - refreshToken: localStorage. É de uso único (o backend o invalida a
//     cada refresh e emite um novo - ver tokens.service.ts), então mesmo se
//     vazado o dano fica limitado à próxima renovação. O ideal a longo prazo
//     é um cookie httpOnly, mas isso exigiria o front e a API no mesmo
//     domínio (ou configuração cross-site SameSite=None+Secure) - adiado
//     deliberadamente para não somar mais uma variável à primeira publicação.
const REFRESH_TOKEN_KEY = 'duetto.refreshToken';

type LoginResult = { mfaRequired: true; mfaToken: string } | { mfaRequired: false };

interface SignupPayload {
  tenantName: string;
  tenantSlug: string;
  adminName: string;
  adminEmail: string;
  adminPassword: string;
}

interface AuthFetchOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
}

interface AuthContextValue {
  user: PublicUser | null;
  tenant: Tenant | null;
  isLoading: boolean;
  signup: (payload: SignupPayload) => Promise<void>;
  login: (email: string, password: string) => Promise<LoginResult>;
  verifyMfa: (mfaToken: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
  authFetch: <T>(path: string, options?: AuthFetchOptions) => Promise<T>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function readStoredRefreshToken(): string | null {
  try {
    return window.localStorage.getItem(REFRESH_TOKEN_KEY);
  } catch {
    // localStorage pode estar indisponível (modo privado estrito, política de
    // navegador) - a sessão simplesmente não sobrevive a um reload nesse caso.
    return null;
  }
}

function writeStoredRefreshToken(token: string | null) {
  try {
    if (token) {
      window.localStorage.setItem(REFRESH_TOKEN_KEY, token);
    } else {
      window.localStorage.removeItem(REFRESH_TOKEN_KEY);
    }
  } catch {
    // ver comentário acima
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // O access token propriamente dito não precisa ser estado React (nada
  // renderiza de forma diferente com base nele - `user` já cobre isso) - só
  // precisa ser lido de forma síncrona e sempre atualizado por authFetch/
  // logout, inclusive logo após `await refresh()` resolver, antes do próximo
  // re-render. Por isso vive só numa ref, atualizada diretamente aqui dentro
  // de applySession/clearSession (nunca via useEffect: um efeito rodaria
  // depois dos efeitos dos componentes filhos - React executa efeitos de
  // baixo para cima na mesma comutação - então um consumidor com efeito
  // próprio, ex. o dashboard buscando /users assim que `user` aparece,
  // poderia disparar antes da sincronização da ref, vendo um token
  // desatualizado/nulo e recebendo 401 à toa).
  const accessTokenRef = useRef<string | null>(null);

  const applySession = useCallback((tokens: Tokens, publicUser: PublicUser) => {
    accessTokenRef.current = tokens.accessToken;
    setUser(publicUser);
    writeStoredRefreshToken(tokens.refreshToken);
  }, []);

  const clearSession = useCallback(() => {
    accessTokenRef.current = null;
    setUser(null);
    setTenant(null);
    writeStoredRefreshToken(null);
  }, []);

  // O refresh token é de USO ÚNICO no backend (rotação a cada chamada - ver
  // tokens.service.ts). Isso cria uma corrida real se duas chamadas a
  // refresh() disparam ao mesmo tempo (ex.: React StrictMode remontando este
  // provider em dev, ou dois authFetch() em paralelo recebendo 401 juntos
  // quando o access token expira): a segunda chamada usaria um token que a
  // primeira já consumiu, receberia 401 e derrubaria a sessão que a primeira
  // acabou de restaurar com sucesso. A ref abaixo faz todas as chamadas
  // concorrentes compartilharem a MESMA promise em vez de disparar requests
  // duplicados.
  const refreshInFlightRef = useRef<Promise<boolean> | null>(null);

  const refresh = useCallback((): Promise<boolean> => {
    if (refreshInFlightRef.current) {
      return refreshInFlightRef.current;
    }

    const promise = (async () => {
      const storedRefreshToken = readStoredRefreshToken();
      if (!storedRefreshToken) return false;

      try {
        const result = await apiRequest<{ user: PublicUser; tokens: Tokens }>('/auth/refresh', {
          method: 'POST',
          body: { refreshToken: storedRefreshToken },
        });
        applySession(result.tokens, result.user);
        return true;
      } catch {
        clearSession();
        return false;
      }
    })();

    refreshInFlightRef.current = promise;
    promise.finally(() => {
      refreshInFlightRef.current = null;
    });
    return promise;
  }, [applySession, clearSession]);

  // Ao carregar a aplicação (primeira renderização, ou F5), tenta restaurar a
  // sessão a partir do refresh token salvo - o access token, por ficar só em
  // memória, não sobrevive a um reload de página.
  useEffect(() => {
    let cancelled = false;
    // Padrão recomendado pela própria doc do React para data fetching em
    // efeito (https://react.dev/learn/you-might-not-need-an-effect#fetching-data):
    // a flag `cancelled` evita setState após desmontagem/re-execução.
    refresh().finally(() => {
      if (!cancelled) setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signup = useCallback(
    async (payload: SignupPayload) => {
      const result = await apiRequest<{ tenant: Tenant; user: PublicUser; tokens: Tokens }>(
        '/auth/signup',
        { method: 'POST', body: payload },
      );
      setTenant(result.tenant);
      applySession(result.tokens, result.user);
    },
    [applySession],
  );

  const login = useCallback(
    async (email: string, password: string): Promise<LoginResult> => {
      const result = await apiRequest<
        | { mfaRequired: true; mfaToken: string }
        | { mfaRequired: false; user: PublicUser; tokens: Tokens }
      >('/auth/login', { method: 'POST', body: { email, password } });

      if (result.mfaRequired) {
        return { mfaRequired: true, mfaToken: result.mfaToken };
      }
      applySession(result.tokens, result.user);
      return { mfaRequired: false };
    },
    [applySession],
  );

  const verifyMfa = useCallback(
    async (mfaToken: string, code: string) => {
      const result = await apiRequest<{ user: PublicUser; tokens: Tokens }>('/auth/mfa/verify', {
        method: 'POST',
        body: { mfaToken, code },
      });
      applySession(result.tokens, result.user);
    },
    [applySession],
  );

  const logout = useCallback(async () => {
    const storedRefreshToken = readStoredRefreshToken();
    try {
      await apiRequest('/auth/logout', {
        method: 'POST',
        accessToken: accessTokenRef.current,
        body: storedRefreshToken ? { refreshToken: storedRefreshToken } : undefined,
      });
    } catch {
      // Mesmo se a chamada falhar (token já expirado, API fora do ar), o
      // usuário espera sair localmente de qualquer forma.
    }
    clearSession();
    router.push('/login');
  }, [clearSession, router]);

  // Wrapper para chamadas autenticadas: injeta o access token atual e, se a
  // API responder 401 (access token expirado), tenta renovar UMA vez via
  // refresh token antes de desistir - evita deslogar o usuário a cada
  // expiração natural do access token (curto por design).
  const authFetch = useCallback(
    async <T,>(path: string, options: AuthFetchOptions = {}): Promise<T> => {
      try {
        return await apiRequest<T>(path, { ...options, accessToken: accessTokenRef.current });
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          const refreshed = await refresh();
          if (refreshed) {
            return apiRequest<T>(path, { ...options, accessToken: accessTokenRef.current });
          }
        }
        throw err;
      }
    },
    [refresh],
  );

  const value = useMemo<AuthContextValue>(
    () => ({ user, tenant, isLoading, signup, login, verifyMfa, logout, authFetch }),
    [user, tenant, isLoading, signup, login, verifyMfa, logout, authFetch],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth precisa ser usado dentro de um <AuthProvider>.');
  }
  return ctx;
}

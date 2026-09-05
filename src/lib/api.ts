/**
 * Cliente HTTP mínimo para falar com a API (NestJS). Sem dependências
 * externas - fetch nativo, com tratamento uniforme de erro e parsing seguro
 * do corpo da resposta (o corpo pode ser vazio - ex.: 204 do /auth/logout).
 */

export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000').replace(
  /\/+$/,
  '',
);

export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Access token JWT a enviar como `Authorization: Bearer <token>`. */
  accessToken?: string | null;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, accessToken } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    // Falha de rede (API fora do ar, CORS bloqueado, sem internet) - o fetch
    // nativo não distingue essas causas, então damos uma mensagem genérica
    // mas acionável.
    throw new ApiError(
      0,
      'Não foi possível conectar à API. Verifique sua internet ou tente novamente em instantes.',
    );
  }

  // 204 No Content (ex.: logout) - não há corpo para ler.
  if (response.status === 204) {
    return undefined as T;
  }

  const rawText = await response.text();
  const data = rawText ? safeJsonParse(rawText) : undefined;

  if (!response.ok) {
    throw new ApiError(response.status, extractErrorMessage(data, response.status), data);
  }

  return data as T;
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function extractErrorMessage(data: unknown, status: number): string {
  if (data && typeof data === 'object' && 'message' in data) {
    const msg = (data as { message?: unknown }).message;
    if (typeof msg === 'string') return msg;
    // class-validator (ValidationPipe) retorna um array de strings quando
    // vários campos falham a validação de uma vez.
    if (Array.isArray(msg) && msg.every((m) => typeof m === 'string')) {
      return msg.join(' ');
    }
  }
  return `Erro inesperado (HTTP ${status}). Tente novamente.`;
}

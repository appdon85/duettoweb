// Formatos de resposta da API (ver crm-saas/src/auth, src/users, src/roles).
// Mantidos manualmente em sincronia com o backend - não há geração automática
// de tipos nesta fase da fundação.

export interface PublicUser {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  roleId: string;
  permissions: string[];
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface Tokens {
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
}

export interface TenantUserRow {
  id: string;
  email: string;
  name: string;
  status: string;
  mfaEnabled: boolean;
  roleId: string;
  roleName: string;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  isSystem: boolean;
}

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

export interface Company {
  id: string;
  tenantId: string;
  name: string;
  cnpj: string | null;
  website: string | null;
  phone: string | null;
  notes: string | null;
  ownerUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CompanyDetail extends Company {
  contacts: Array<{ id: string; name: string; email: string | null; role: string | null }>;
}

export interface Contact {
  id: string;
  tenantId: string;
  name: string;
  email: string | null;
  phone: string | null;
  title: string | null;
  notes: string | null;
  ownerUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ContactDetail extends Contact {
  companies: Array<{ id: string; name: string; role: string | null }>;
}

// Espelha o pgEnum "deal_stage" (ver crm-saas/src/deals/deal-stage.constants.ts).
export type DealStage =
  | 'PROSPECTING'
  | 'QUALIFICATION'
  | 'PROPOSAL'
  | 'NEGOTIATION'
  | 'WON'
  | 'LOST';

export interface Deal {
  id: string;
  tenantId: string;
  title: string;
  value: number | null;
  stage: DealStage;
  companyId: string | null;
  contactId: string | null;
  ownerUserId: string | null;
  expectedCloseDate: string | null;
  notes: string | null;
  lostReason: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// Espelha o pgEnum "activity_type" (ver
// crm-saas/src/activities/activity-type.constants.ts).
export type ActivityType = 'CALL' | 'MEETING' | 'EMAIL' | 'NOTE' | 'TASK';

export interface Activity {
  id: string;
  tenantId: string;
  type: ActivityType;
  subject: string;
  notes: string | null;
  activityDate: string;
  completedAt: string | null;
  companyId: string | null;
  contactId: string | null;
  dealId: string | null;
  ownerUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Paginated<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
}

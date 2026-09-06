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
// crm-saas/src/activities/activity-type.constants.ts). 'EVENT' foi
// adicionado para o modulo de Calendario - ver app/calendar/page.tsx.
export type ActivityType = 'CALL' | 'MEETING' | 'EMAIL' | 'NOTE' | 'TASK' | 'EVENT';

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

// Bloqueio de agenda (indisponibilidade por usuario) do modulo de
// Calendario (ver crm-saas/src/database/schema/calendar-blocks.schema.ts).
export interface CalendarBlock {
  id: string;
  tenantId: string;
  userId: string;
  startAt: string;
  endAt: string;
  reason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Paginated<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
}

// Formatos de resposta do modulo de relatorios (ver
// crm-saas/src/reports/reports.service.ts). Somente leitura - sem tabela
// propria no backend, e' uma agregacao sobre deals/companies/contacts/
// activities (ver especificacao funcional 3.5).
export interface DealStageSummary {
  stage: DealStage;
  count: number;
  value: number;
}

export interface OwnerRanking {
  ownerUserId: string;
  ownerName: string;
  wonDeals: number;
  openPipelineValue: number;
  activitiesLast30Days: number;
}

export interface DashboardSummary {
  pipeline: {
    byStage: DealStageSummary[];
    openPipelineValue: number;
    wonThisMonth: { count: number; value: number };
    conversionRate: number;
  };
  registrations: {
    companies: { total: number; last30Days: number };
    contacts: { total: number; last30Days: number };
  };
  activities: {
    pendingTasks: number;
    overdueTasks: number;
    activitiesThisWeek: number;
  };
  byOwner: OwnerRanking[];
}

export interface LostReason {
  reason: string;
  count: number;
}

export interface SalesFunnel {
  byStage: DealStageSummary[];
  conversionRate: number;
  lostReasons: LostReason[];
}

// Espelha o pgEnum "document_template_type" (ver
// crm-saas/src/templates/template-type.constants.ts). Modulo Comercial:
// modelos de texto reutilizaveis (com variaveis {{...}}) usados para
// pre-preencher o conteudo de propostas/contratos.
export type TemplateType = 'PROPOSAL' | 'CONTRACT';

export interface DocumentTemplate {
  id: string;
  tenantId: string;
  type: TemplateType;
  name: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

// Catalogo de variaveis suportadas no conteudo de um DocumentTemplate (ver
// GET /templates/variables no backend) - usado como legenda no editor.
export interface TemplateVariable {
  key: string;
  description: string;
}

// Espelha o pgEnum "proposal_status" (ver
// crm-saas/src/proposals/proposal-status.constants.ts).
export type ProposalStatus = 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';

export interface ProposalItem {
  id: string;
  tenantId: string;
  proposalId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface Proposal {
  id: string;
  tenantId: string;
  title: string;
  companyId: string | null;
  contactId: string | null;
  dealId: string | null;
  templateId: string | null;
  content: string | null;
  status: ProposalStatus;
  validUntil: string | null;
  totalValue: number;
  notes: string | null;
  ownerUserId: string | null;
  acceptedAt: string | null;
  rejectedAt: string | null;
  createdAt: string;
  updatedAt: string;
  // Presente apenas no detalhe (GET /proposals/:id) - linhas de item nao
  // vem nas listagens paginadas (GET /proposals).
  items?: ProposalItem[];
}

// Espelha o pgEnum "contract_status" (ver
// crm-saas/src/contracts/contract-status.constants.ts).
export type ContractStatus = 'DRAFT' | 'ACTIVE' | 'EXPIRED' | 'TERMINATED';

export interface Contract {
  id: string;
  tenantId: string;
  proposalId: string | null;
  title: string;
  companyId: string | null;
  contactId: string | null;
  dealId: string | null;
  templateId: string | null;
  content: string | null;
  status: ContractStatus;
  totalValue: number | null;
  startDate: string | null;
  endDate: string | null;
  signedAt: string | null;
  notes: string | null;
  ownerUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

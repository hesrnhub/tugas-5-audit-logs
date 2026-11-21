import { api } from './client';

export interface AuditLog {
  id: number;
  userId: number;
  userName: string;
  userEmail: string;
  action: string;
  targetTable: string;
  targetId: number;
  metadata: Record<string, unknown> | string | null;
  createdAt: string | null;
}

export interface AuditLogQuery {
  page: number;
  pageSize: number;
  targetId?: number;
  userId?: number;
}

export interface AuditLogPage {
  items: AuditLog[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export const auditLogsApi = {
  list: async (query: AuditLogQuery) =>
    (await api.get<{ status: string; data: AuditLogPage }>('/audit-logs', { params: query })).data.data,

  getById: async (id: number) =>
    (await api.get<{ status: string; data: AuditLog }>(`/audit-logs/${id}`)).data.data,
};

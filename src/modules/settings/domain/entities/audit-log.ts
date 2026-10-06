export interface AuditLogEntry {
  id: string;
  userId: string | null;
  userName: string;
  action: string;
  tableName: string;
  recordId: string | null;
  oldValue: unknown;
  newValue: unknown;
  createdAt: Date;
}

export interface AuditLogFilter {
  userId?: string;
  action?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export interface AuditLogListResult {
  items: AuditLogEntry[];
  total: number;
  page: number;
  pageSize: number;
}

import { NotFoundError } from '../errors/NotFoundError.ts';
import { AuditLogRepository } from '../repositories/auditLogRepository.ts';
import type { AuditLogQuery } from '../schemas/auditLogSchema.ts';

export class AuditLogQueryService {
    constructor(private readonly repository: AuditLogRepository = new AuditLogRepository()) {}

    getAll(query: AuditLogQuery) {
        return this.repository.findAll(query);
    }

    async getById(id: number) {
        const log = await this.repository.findById(id);
        if (!log) throw new NotFoundError('Catatan audit tidak ditemukan');
        return log;
    }
}

import type { Request, Response } from 'express';
import { getValidated } from '../middlewares/validate.ts';
import type { AuditLogQuery } from '../schemas/auditLogSchema.ts';
import { AuditLogQueryService } from '../services/auditLogQueryService.ts';

export class AuditLogController {
    constructor(private readonly service: AuditLogQueryService = new AuditLogQueryService()) {}

    getAll = async (_req: Request, res: Response): Promise<void> => {
        const query = getValidated<AuditLogQuery>(res, 'query');
        const data = await this.service.getAll(query);
        res.status(200).json({ status: 'success', data });
    };

    getById = async (req: Request, res: Response): Promise<void> => {
        const { id } = getValidated<{ id: number }>(res, 'params');
        const data = await this.service.getById(id);
        res.status(200).json({ status: 'success', data });
    };
}

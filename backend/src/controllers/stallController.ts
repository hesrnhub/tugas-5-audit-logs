import type { Request, Response } from 'express';
import { StallService } from '../services/stallService.ts';
import { getUser } from '../middlewares/auth.ts';
import { getValidated } from '../middlewares/validate.ts';
import type { CreateStallInput, IdParam, StallQuery, UpdateStallInput } from '../schemas/stallSchema.ts';
import { auditActorFromRequest } from '../services/auditLogService.ts';

export class StallController {
    constructor(private readonly stallService: StallService = new StallService()) {}

    getStalls = async (_req: Request, res: Response): Promise<void> => {
        const query = getValidated<StallQuery>(res, 'query');
        const { data, total } = await this.stallService.getAllStalls(query);
        res.status(200).json({ status: 'success', meta: { page: query.page, limit: query.limit, total }, data });
    };

    getStallById = async (_req: Request, res: Response): Promise<void> => {
        const { id } = getValidated<IdParam>(res, 'params');
        const stall = await this.stallService.getStallById(id);
        res.status(200).json({ status: 'success', data: stall });
    };

    getStallMenus = async (_req: Request, res: Response): Promise<void> => {
        const { id } = getValidated<IdParam>(res, 'params');
        const menus = await this.stallService.getStallMenus(id);
        res.status(200).json({ status: 'success', data: menus });
    };

    createStall = async (req: Request, res: Response): Promise<void> => {
        const body = getValidated<CreateStallInput>(res, 'body');
        const user = getUser(req);
        const stall = await this.stallService.createStall(
            user.id,
            body,
            auditActorFromRequest(req, user),
        );
        res.status(201).json({ status: 'success', data: stall });
    };

    updateStall = async (req: Request, res: Response): Promise<void> => {
        const { id } = getValidated<IdParam>(res, 'params');
        const body = getValidated<UpdateStallInput>(res, 'body');
        const user = getUser(req);
        const stall = await this.stallService.updateStall(
            id,
            body,
            user,
            auditActorFromRequest(req, user),
        );
        res.status(200).json({ status: 'success', data: stall });
    };

    deleteStall = async (req: Request, res: Response): Promise<void> => {
        const { id } = getValidated<IdParam>(res, 'params');
        const user = getUser(req);
        const stall = await this.stallService.deleteStall(id, auditActorFromRequest(req, user));
        res.status(200).json({ status: 'success', data: stall });
    };
}

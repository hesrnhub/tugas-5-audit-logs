import type { Request, Response } from 'express';
import { getUser } from '../middlewares/auth.ts';
import { getValidated } from '../middlewares/validate.ts';
import type { LoginInput, RegisterInput } from '../schemas/authSchema.ts';
import { AuthService } from '../services/authService.ts';

export class AuthController {
    constructor(private readonly authService: AuthService = new AuthService()) {}

    register = async (_req: Request, res: Response): Promise<void> => {
        const user = await this.authService.register(getValidated<RegisterInput>(res, 'body'));
        res.status(201).json({ status: 'success', data: { user } });
    };

    login = async (req: Request, res: Response): Promise<void> => {
        const data = await this.authService.login(
            getValidated<LoginInput>(res, 'body'),
            { ipAddress: req.ip || null, userAgent: req.get('user-agent') ?? null },
        );
        res.status(200).json({ status: 'success', data });
    };

    logout = async (req: Request, res: Response): Promise<void> => {
        await this.authService.logout(
            getUser(req),
            { ipAddress: req.ip || null, userAgent: req.get('user-agent') ?? null },
        );
        res.status(200).json({ status: 'success', message: 'Logout berhasil' });
    };

    getMe = (req: Request, res: Response): void => {
        res.status(200).json({ status: 'success', data: getUser(req) });
    };
}

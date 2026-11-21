import type { Request } from 'express';
import type { AuthUser } from './tokenService.ts';
import type { NewAuditLog } from '../repositories/auditLogRepository.ts';

export interface AuditActor {
    user: AuthUser;
    ipAddress: string | null;
    userAgent: string | null;
}

export function auditActorFromRequest(req: Request, user: AuthUser): AuditActor {
    return {
        user,
        ipAddress: req.ip || null,
        userAgent: req.get('user-agent') ?? null,
    };
}

export function createAuditEntry(
    actor: AuditActor,
    action: string,
    targetTable: string,
    targetId: number,
): NewAuditLog {
    return {
        userId: actor.user.id,
        action,
        targetTable,
        targetId,
        metadata: JSON.stringify({
            role: actor.user.role,
            ip_address: actor.ipAddress,
            user_agent: actor.userAgent,
            result: 'success',
        }),
        createdAt: new Date(),
    };
}

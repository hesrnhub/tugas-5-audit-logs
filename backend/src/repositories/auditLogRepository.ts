import {
    and,
    count,
    desc,
    eq,
    gte,
    lt,
    type SQL,
} from 'drizzle-orm';
import type { NodeMsSqlTransaction } from 'drizzle-orm/node-mssql';
import { getDb } from '../db/index.js';
import { auditLogs, users } from '../db/schema.js';
import type { AuditLogQuery } from '../schemas/auditLogSchema.ts';

export type DbExecutor = Awaited<ReturnType<typeof getDb>> | NodeMsSqlTransaction;

export interface NewAuditLog {
    userId: number;
    action: string;
    targetTable: string;
    targetId: number;
    metadata: string;
    createdAt: Date;
}

function parseMetadata(metadata: string | null): unknown {
    if (metadata === null) return null;
    try {
        return JSON.parse(metadata) as unknown;
    } catch {
        return metadata;
    }
}

function dateStart(value: string): Date {
    return new Date(`${value}T00:00:00.000Z`);
}

function dateAfterEnd(value: string): Date {
    const date = dateStart(value);
    date.setUTCDate(date.getUTCDate() + 1);
    return date;
}

export class AuditLogRepository {
    async create(input: NewAuditLog, executor?: DbExecutor) {
        const db = executor ?? await getDb();
        const rows = await db.insert(auditLogs).output().values(input);
        return rows[0];
    }

    async findAll(query: AuditLogQuery) {
        const db = await getDb();
        const conditions: SQL[] = [];
        if (query.action !== undefined) conditions.push(eq(auditLogs.action, query.action));
        if (query.targetTable !== undefined) conditions.push(eq(auditLogs.targetTable, query.targetTable));
        if (query.targetId !== undefined) conditions.push(eq(auditLogs.targetId, query.targetId));
        if (query.userId !== undefined) conditions.push(eq(auditLogs.userId, query.userId));
        if (query.from !== undefined) conditions.push(gte(auditLogs.createdAt, dateStart(query.from)));
        if (query.to !== undefined) conditions.push(lt(auditLogs.createdAt, dateAfterEnd(query.to)));
        const where = conditions.length > 0 ? and(...conditions) : undefined;

        const [rows, totals] = await Promise.all([
            db
                .select({
                    id: auditLogs.id,
                    userId: auditLogs.userId,
                    userName: users.name,
                    userEmail: users.email,
                    action: auditLogs.action,
                    targetTable: auditLogs.targetTable,
                    targetId: auditLogs.targetId,
                    metadata: auditLogs.metadata,
                    createdAt: auditLogs.createdAt,
                })
                .from(auditLogs)
                .innerJoin(users, eq(auditLogs.userId, users.id))
                .where(where)
                .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
                .offset((query.page - 1) * query.pageSize)
                .fetch(query.pageSize),
            db.select({ total: count() }).from(auditLogs).where(where),
        ]);

        const total = Number(totals[0]?.total ?? 0);
        return {
            items: rows.map((row) => ({ ...row, metadata: parseMetadata(row.metadata) })),
            pagination: {
                page: query.page,
                pageSize: query.pageSize,
                total,
                totalPages: Math.ceil(total / query.pageSize),
            },
        };
    }

    async findById(id: number) {
        const db = await getDb();
        const rows = await db
            .select({
                id: auditLogs.id,
                userId: auditLogs.userId,
                userName: users.name,
                userEmail: users.email,
                action: auditLogs.action,
                targetTable: auditLogs.targetTable,
                targetId: auditLogs.targetId,
                metadata: auditLogs.metadata,
                createdAt: auditLogs.createdAt,
            })
            .from(auditLogs)
            .innerJoin(users, eq(auditLogs.userId, users.id))
            .where(eq(auditLogs.id, id));
        const row = rows[0];
        return row ? { ...row, metadata: parseMetadata(row.metadata) } : undefined;
    }
}

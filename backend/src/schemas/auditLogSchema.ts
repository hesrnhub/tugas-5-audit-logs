import { z } from 'zod';

function isCalendarDate(value: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(0);
    date.setUTCHours(0, 0, 0, 0);
    date.setUTCFullYear(year, month - 1, day);
    return date.getUTCFullYear() === year
        && date.getUTCMonth() === month - 1
        && date.getUTCDate() === day;
}

const dateFilter = z
    .string()
    .refine(isCalendarDate, 'Tanggal harus menggunakan format YYYY-MM-DD dan merupakan tanggal yang valid');

export const auditLogQuerySchema = z
    .object({
        page: z.coerce.number().int('page harus bilangan bulat').min(1, 'page minimal 1').default(1),
        pageSize: z.coerce
            .number()
            .int('pageSize harus bilangan bulat')
            .min(1, 'pageSize minimal 1')
            .max(100, 'pageSize maksimal 100')
            .default(20),
        action: z.string().max(50, 'action maksimal 50 karakter').optional(),
        targetTable: z.string().max(50, 'targetTable maksimal 50 karakter').optional(),
        targetId: z.coerce.number().int('targetId harus bilangan bulat').positive('targetId harus bilangan bulat positif').optional(),
        userId: z.coerce.number().int('userId harus bilangan bulat').positive('userId harus bilangan bulat positif').optional(),
        from: dateFilter.optional(),
        to: dateFilter.optional(),
    })
    .strict('Parameter query tidak dikenal')
    .refine((query) => !query.from || !query.to || query.from <= query.to, {
        message: 'from tidak boleh lebih besar dari to',
        path: ['from'],
    });

export const auditLogIdSchema = z.object({
    id: z.coerce.number().int().positive(),
});

export type AuditLogQuery = z.infer<typeof auditLogQuerySchema>;

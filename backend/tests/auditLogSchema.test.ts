import assert from 'node:assert/strict';
import test from 'node:test';
import { AuthService } from '../src/services/authService.ts';
import { AuditLogRepository, type DbExecutor, type NewAuditLog } from '../src/repositories/auditLogRepository.ts';
import { auditLogQuerySchema } from '../src/schemas/auditLogSchema.ts';
import { createAuditEntry } from '../src/services/auditLogService.ts';

class FailingAuditLogRepository extends AuditLogRepository {
    override async create(_input: NewAuditLog, _executor?: DbExecutor): Promise<never> {
        throw new Error('audit unavailable');
    }
}

test('audit list query applies defaults and accepts valid filters', () => {
    const result = auditLogQuerySchema.safeParse({
        targetId: '12',
        userId: '3',
        from: '2026-11-01',
        to: '2026-11-21',
    });

    assert.equal(result.success, true);
    if (!result.success) return;
    assert.deepEqual(result.data, {
        page: 1,
        pageSize: 20,
        targetId: 12,
        userId: 3,
        from: '2026-11-01',
        to: '2026-11-21',
    });
});

test('audit list query rejects invalid paging, date ranges, and unknown parameters', () => {
    assert.equal(auditLogQuerySchema.safeParse({ page: '0' }).success, false);
    assert.equal(auditLogQuerySchema.safeParse({ pageSize: '101' }).success, false);
    assert.equal(auditLogQuerySchema.safeParse({ targetId: '1.5' }).success, false);
    assert.equal(auditLogQuerySchema.safeParse({ from: '2026-02-30' }).success, false);
    assert.equal(auditLogQuerySchema.safeParse({ from: '2026-11-22', to: '2026-11-21' }).success, false);
    assert.equal(auditLogQuerySchema.safeParse({ unexpected: 'value' }).success, false);
});

test('audit entries include request context without credentials', () => {
    const entry = createAuditEntry({
        user: { id: 8, name: 'Admin', email: 'admin@example.test', role: 'admin' },
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
    }, 'LOGOUT', 'USERS', 8);
    const metadata = JSON.parse(entry.metadata) as Record<string, unknown>;

    assert.equal(entry.userId, 8);
    assert.equal(entry.targetId, 8);
    assert.equal(metadata.role, 'admin');
    assert.equal(metadata.ip_address, '127.0.0.1');
    assert.equal(metadata.user_agent, 'test-agent');
    assert.equal(metadata.result, 'success');
    assert.equal('password' in metadata || 'token' in metadata || 'cookie' in metadata, false);
});

test('logout still succeeds when audit persistence fails', async () => {
    const service = new AuthService(undefined, new FailingAuditLogRepository());
    const user = { id: 8, name: 'Admin', email: 'admin@example.test', role: 'admin' as const };
    const errors: unknown[][] = [];
    const originalConsoleError = console.error;
    console.error = (...args) => errors.push(args);

    try {
        await assert.doesNotReject(service.logout(user, {
            ipAddress: '127.0.0.1',
            userAgent: 'test-agent',
        }));
    } finally {
        console.error = originalConsoleError;
    }

    assert.equal(errors.length, 1);
});

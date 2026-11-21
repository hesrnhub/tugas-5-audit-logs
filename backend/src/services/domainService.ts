import { randomBytes, scrypt as scryptCallback } from 'node:crypto';
import { promisify } from 'node:util';
import {
    DomainRepository,
    type NewLike,
    type NewMenuItem,
    type NewReview,
    type NewUser,
} from '../repositories/domainRepository.ts';
import { getDb } from '../db/index.js';
import { AuditLogRepository, type DbExecutor } from '../repositories/auditLogRepository.ts';
import { createAuditEntry, type AuditActor } from './auditLogService.ts';

const scrypt = promisify(scryptCallback);
type UserRole = NewUser['role'];

function invalidInput(): never {
    throw new Error('INVALID_INPUT');
}

function objectInput(input: unknown): Record<string, unknown> {
    if (typeof input !== 'object' || input === null || Array.isArray(input)) invalidInput();
    return input as Record<string, unknown>;
}

function requiredString(input: Record<string, unknown>, key: string, maxLength: number): string {
    const value = input[key];
    if (typeof value !== 'string' || !value.trim() || value.length > maxLength) invalidInput();
    return value.trim();
}

function positiveInteger(value: unknown): number {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) invalidInput();
    return parsed;
}

async function hashPassword(password: string): Promise<string> {
    const salt = randomBytes(16);
    const hash = (await scrypt(password, salt, 64)) as Buffer;
    return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export class DomainService {
    constructor(
        private readonly repository: DomainRepository = new DomainRepository(),
        private readonly auditRepository: AuditLogRepository = new AuditLogRepository(),
    ) {}

    private async auditedMutation<T extends { id: number }>(
        actor: AuditActor,
        action: string,
        targetTable: string,
        missingMessage: string,
        mutation: (tx: DbExecutor) => Promise<T | undefined>,
    ): Promise<T> {
        const db = await getDb();
        return db.transaction(async (tx) => {
            const row = await mutation(tx);
            if (!row) throw new Error(missingMessage);
            await this.auditRepository.create(
                createAuditEntry(actor, action, targetTable, row.id),
                tx,
            );
            return row;
        });
    }

    async getUsers() {
        return this.repository.findUsers();
    }

    async createUser(input: unknown, actor: AuditActor) {
        const body = objectInput(input);
        const name = requiredString(body, 'name', 100);
        const email = requiredString(body, 'email', 150);
        if (!/^\S+@\S+\.\S+$/.test(email)) invalidInput();
        const password = requiredString(body, 'password', 200);
        if (password.length < 8) invalidInput();
        const role = body.role;
        if (role !== 'admin' && role !== 'owner' && role !== 'customer') invalidInput();
        const passwordHash = await hashPassword(password);

        const user = await this.auditedMutation(
            actor,
            'CREATE_USER',
            'USERS',
            'USER_NOT_FOUND',
            async (tx) => this.repository.createUser({
                name,
                email,
                role: role as UserRole,
                passwordHash,
            }, tx),
        );
        const { passwordHash: _passwordHash, ...publicUser } = user;
        return publicUser;
    }

    async getMenuItems(id?: number) {
        const items = await this.repository.findMenuItems(id);
        if (id !== undefined && items.length === 0) throw new Error('MENU_ITEM_NOT_FOUND');
        return id === undefined ? items : items[0];
    }

    async createMenuItem(input: unknown, actor: AuditActor) {
        const body = objectInput(input);
        const menuItem = {
            stallId: positiveInteger(body.stallId),
            name: requiredString(body, 'name', 100),
            price: Number(body.price),
            isAvailable: body.isAvailable,
        };
        if (!Number.isInteger(menuItem.price) || menuItem.price < 0 || typeof menuItem.isAvailable !== 'boolean') {
            invalidInput();
        }
        return this.auditedMutation(
            actor,
            'CREATE_MENU',
            'MENU_ITEMS',
            'MENU_ITEM_CREATE_FAILED',
            (tx) => this.repository.createMenuItem(menuItem as NewMenuItem, tx),
        );
    }

    async updateMenuItem(id: number, input: unknown, actor: AuditActor) {
        const body = objectInput(input);
        const update: Partial<NewMenuItem> = {};
        if (body.stallId !== undefined) update.stallId = positiveInteger(body.stallId);
        if (body.name !== undefined) update.name = requiredString(body, 'name', 100);
        if (body.price !== undefined) {
            const price = Number(body.price);
            if (!Number.isInteger(price) || price < 0) invalidInput();
            update.price = price;
        }
        if (body.isAvailable !== undefined) {
            if (typeof body.isAvailable !== 'boolean') invalidInput();
            update.isAvailable = body.isAvailable;
        }
        if (Object.keys(update).length === 0) invalidInput();
        return this.auditedMutation(
            actor,
            'UPDATE_MENU',
            'MENU_ITEMS',
            'MENU_ITEM_NOT_FOUND',
            (tx) => this.repository.updateMenuItem(id, update, tx),
        );
    }

    async deleteMenuItem(id: number, actor: AuditActor) {
        return this.auditedMutation(
            actor,
            'DELETE_MENU',
            'MENU_ITEMS',
            'MENU_ITEM_NOT_FOUND',
            (tx) => this.repository.removeMenuItem(id, tx),
        );
    }

    async getReviews(id?: number) {
        const items = await this.repository.findReviews(id);
        if (id !== undefined && items.length === 0) throw new Error('REVIEW_NOT_FOUND');
        return id === undefined ? items : items[0];
    }

    async createReview(input: unknown, actor: AuditActor) {
        const body = objectInput(input);
        const rating = Number(body.rating);
        if (!Number.isInteger(rating) || rating < 1 || rating > 5) invalidInput();
        const comment = body.comment;
        if (comment !== undefined && comment !== null && typeof comment !== 'string') invalidInput();
        return this.auditedMutation(
            actor,
            'CREATE_REVIEW',
            'REVIEWS',
            'REVIEW_CREATE_FAILED',
            (tx) => this.repository.createReview({
                stallId: positiveInteger(body.stallId),
                userId: positiveInteger(body.userId),
                rating,
                comment: (comment as string | null | undefined) ?? null,
            } as NewReview, tx),
        );
    }

    async deleteReview(id: number, actor: AuditActor) {
        return this.auditedMutation(
            actor,
            'DELETE_REVIEW',
            'REVIEWS',
            'REVIEW_NOT_FOUND',
            (tx) => this.repository.removeReview(id, tx),
        );
    }

    async createLike(input: unknown, actor: AuditActor) {
        const body = objectInput(input);
        const like = {
            reviewId: positiveInteger(body.reviewId),
            userId: positiveInteger(body.userId),
        };
        return this.auditedMutation(
            actor,
            'CREATE_LIKE',
            'LIKES',
            'LIKE_CREATE_FAILED',
            (tx) => this.repository.createLike(like as NewLike, tx),
        );
    }

    async deleteLike(id: number, actor: AuditActor) {
        return this.auditedMutation(
            actor,
            'DELETE_LIKE',
            'LIKES',
            'LIKE_NOT_FOUND',
            (tx) => this.repository.removeLike(id, tx),
        );
    }

    async getFlags() {
        return this.repository.findFlags();
    }

    async updateFlag(id: number, input: unknown, actor: AuditActor) {
        const body = objectInput(input);
        const status = requiredString(body, 'status', 20);
        return this.auditedMutation(
            actor,
            'UPDATE_FLAG',
            'FLAGS',
            'FLAG_NOT_FOUND',
            (tx) => this.repository.updateFlag(id, status, tx),
        );
    }
}
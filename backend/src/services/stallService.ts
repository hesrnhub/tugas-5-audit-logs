import {
    StallRepository,
    type FindAllParams,
} from '../repositories/stallRepository.ts';
import { MenuItemRepository } from '../repositories/menuItemRepository.ts';
import type { MenuItemDto, StallResponseDto } from '../dtos/stallDto.ts';
import { ForbiddenError } from '../errors/ForbiddenError.ts';
import { NotFoundError } from '../errors/NotFoundError.ts';
import type { UserRole } from '../repositories/userRepository.ts';
import type { CreateStallInput, UpdateStallInput } from '../schemas/stallSchema.ts';
import { getDb } from '../db/index.js';
import { AuditLogRepository, type DbExecutor } from '../repositories/auditLogRepository.ts';
import { createAuditEntry, type AuditActor } from './auditLogService.ts';

type StallRow = NonNullable<Awaited<ReturnType<StallRepository['findById']>>>;

export class StallService {
    private stallRepository: StallRepository;
    private menuItemRepository: MenuItemRepository;

    constructor(
        stallRepository: StallRepository = new StallRepository(),
        menuItemRepository: MenuItemRepository = new MenuItemRepository(),
        private readonly auditRepository: AuditLogRepository = new AuditLogRepository(),
    ) {
        this.stallRepository = stallRepository;
        this.menuItemRepository = menuItemRepository;
    }

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
            if (!row) throw new NotFoundError(missingMessage);
            await this.auditRepository.create(
                createAuditEntry(actor, action, targetTable, row.id),
                tx,
            );
            return row;
        });
    }

    // Mapping row DB -> DTO API (sekaligus logika bisnis isPopular).
    private toDto(row: StallRow): StallResponseDto {
        const avgRating = Number(row.avgRating);
        return {
            id: row.id,
            ownerId: row.ownerId,
            name: row.name,
            category: row.category,
            location: row.location,
            description: row.description,
            avgRating,
            reviewCount: row.reviewCount,
            isPopular: avgRating >= 4.7,
        };
    }

    async getAllStalls(params: FindAllParams) {
        const { rows, total } = await this.stallRepository.findAll(params);
        return { data: rows.map((row) => this.toDto(row)), total };
    }

    async getStallById(id: number): Promise<StallResponseDto> {
        const row = await this.stallRepository.findById(id);
        if (!row) throw new NotFoundError('Warung tidak ditemukan');
        return this.toDto(row);
    }

    async getStallMenus(id: number): Promise<MenuItemDto[]> {
        const row = await this.stallRepository.findById(id);
        if (!row) throw new NotFoundError('Warung tidak ditemukan');
        return this.menuItemRepository.findByStallId(id);
    }

    async createStall(
        ownerId: number,
        input: CreateStallInput,
        actor: AuditActor,
    ): Promise<StallResponseDto> {
        const row = await this.auditedMutation(
            actor,
            'CREATE_STALL',
            'STALLS',
            'Warung gagal dibuat',
            (tx) => this.stallRepository.create(ownerId, input, tx),
        );
        if (!row) throw new NotFoundError('Warung gagal dibuat');
        return this.toDto(row);
    }

    async updateStall(
        id: number,
        input: UpdateStallInput,
        actor: { id: number; role: UserRole },
        auditActor: AuditActor,
    ): Promise<StallResponseDto> {
        const existing = await this.stallRepository.findById(id);
        if (!existing) throw new NotFoundError('Warung tidak ditemukan');
        if (actor.role !== 'admin' && existing.ownerId !== actor.id) {
            throw new ForbiddenError('Owner hanya dapat mengubah warung miliknya');
        }

        const row = await this.auditedMutation(
            auditActor,
            'UPDATE_STALL',
            'STALLS',
            'Warung tidak ditemukan',
            (tx) => this.stallRepository.update(id, input, tx),
        );
        if (!row) throw new NotFoundError('Warung tidak ditemukan');
        return this.toDto(row);
    }

    async deleteStall(id: number, actor: AuditActor): Promise<StallResponseDto> {
        const row = await this.auditedMutation(
            actor,
            'DELETE_STALL',
            'STALLS',
            'Warung tidak ditemukan',
            (tx) => this.stallRepository.remove(id, tx),
        );
        if (!row) throw new NotFoundError('Warung tidak ditemukan');
        return this.toDto(row);
    }
}

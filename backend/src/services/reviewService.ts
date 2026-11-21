import { AppError } from '../errors/AppError.ts';
import { NotFoundError } from '../errors/NotFoundError.ts';
import { ReviewRepository } from '../repositories/reviewRepository.ts';
import { StallRepository } from '../repositories/stallRepository.ts';
import type { CreateReviewInput } from '../schemas/reviewSchema.ts';
import { getDb } from '../db/index.js';
import { AuditLogRepository } from '../repositories/auditLogRepository.ts';
import { createAuditEntry, type AuditActor } from './auditLogService.ts';

export class ReviewService {
    constructor(
        private readonly reviewRepository: ReviewRepository = new ReviewRepository(),
        private readonly stallRepository: StallRepository = new StallRepository(),
        private readonly auditRepository: AuditLogRepository = new AuditLogRepository(),
    ) {}

    async createReview(
        stallId: number,
        userId: number,
        input: CreateReviewInput,
        actor: AuditActor,
    ) {
        const db = await getDb();
        const row = await db.transaction(async (tx) => {
            const stall = await this.stallRepository.findById(stallId, tx);
            if (!stall) throw new NotFoundError('Warung tidak ditemukan');

            const existing = await this.reviewRepository.findByStallAndUser(stallId, userId, tx);
            if (existing) throw new AppError(409, 'Kamu sudah pernah memberi review untuk warung ini');

            const created = await this.reviewRepository.create({
                stallId,
                userId,
                rating: input.rating,
                comment: input.comment ?? null,
            }, tx);
            if (!created) throw new AppError(500, 'Review gagal disimpan');
            await this.reviewRepository.refreshStallSummary(stallId, tx);
            await this.auditRepository.create(
                createAuditEntry(actor, 'CREATE_REVIEW', 'REVIEWS', created.id),
                tx,
            );
            return created;
        });

        return {
            id: row.id,
            stallId: row.stallId,
            userId: row.userId,
            rating: row.rating,
            comment: row.comment,
            likeCount: row.likeCount,
            createdAt: row.createdAt ? row.createdAt.toISOString() : null,
        };
    }
}

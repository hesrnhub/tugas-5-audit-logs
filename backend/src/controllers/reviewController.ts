import type { Request, Response } from 'express';
import { getUser } from '../middlewares/auth.ts';
import { getValidated } from '../middlewares/validate.ts';
import type { IdParam } from '../schemas/stallSchema.ts';
import type { CreateReviewInput } from '../schemas/reviewSchema.ts';
import { ReviewService } from '../services/reviewService.ts';
import { auditActorFromRequest } from '../services/auditLogService.ts';

export class ReviewController {
    constructor(private readonly reviewService: ReviewService = new ReviewService()) {}

    createReview = async (req: Request, res: Response): Promise<void> => {
        const { id: stallId } = getValidated<IdParam>(res, 'params');
        const body = getValidated<CreateReviewInput>(res, 'body');
        const user = getUser(req);
        const data = await this.reviewService.createReview(
            stallId,
            user.id,
            body,
            auditActorFromRequest(req, user),
        );
        res.status(201).json({ status: 'success', data });
    };
}

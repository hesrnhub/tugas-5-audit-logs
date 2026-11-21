import { Router } from 'express';
import { AuditLogController } from '../controllers/auditLogController.ts';
import { authenticate } from '../middlewares/auth.ts';
import { authorize } from '../middlewares/authorize.ts';
import { validate } from '../middlewares/validate.ts';
import { auditLogIdSchema, auditLogQuerySchema } from '../schemas/auditLogSchema.ts';

const auditLogRouter = Router();
const controller = new AuditLogController();

auditLogRouter.use(authenticate, authorize('admin'));

auditLogRouter.get('/', (req, res, next) => {
    // #swagger.security = [{ "BearerAuth": [] }]
    // #swagger.parameters['page'] = { in: 'query', required: false, type: 'integer', default: 1 }
    // #swagger.parameters['pageSize'] = { in: 'query', required: false, type: 'integer', default: 20 }
    // #swagger.parameters['action'] = { in: 'query', required: false, type: 'string' }
    // #swagger.parameters['targetTable'] = { in: 'query', required: false, type: 'string' }
    // #swagger.parameters['targetId'] = { in: 'query', required: false, type: 'integer' }
    // #swagger.parameters['userId'] = { in: 'query', required: false, type: 'integer' }
    // #swagger.parameters['from'] = { in: 'query', required: false, type: 'string', format: 'date' }
    // #swagger.parameters['to'] = { in: 'query', required: false, type: 'string', format: 'date' }
    // #swagger.responses[200] = { description: 'Daftar audit log dengan pagination' }
    // #swagger.responses[400] = { description: 'Parameter query tidak valid' }
    // #swagger.responses[401] = { description: 'Token tidak valid atau tidak ada' }
    // #swagger.responses[403] = { description: 'Hanya admin yang dapat mengakses audit log' }
    return validate(auditLogQuerySchema, 'query')(req, res, next);
}, controller.getAll);
auditLogRouter.get('/:id', (req, res, next) => {
    // #swagger.security = [{ "BearerAuth": [] }]
    // #swagger.parameters['id'] = { in: 'path', required: true, type: 'integer' }
    // #swagger.responses[200] = { description: 'Detail audit log' }
    // #swagger.responses[401] = { description: 'Token tidak valid atau tidak ada' }
    // #swagger.responses[403] = { description: 'Hanya admin yang dapat mengakses audit log' }
    // #swagger.responses[404] = { description: 'Catatan audit tidak ditemukan' }
    return validate(auditLogIdSchema, 'params')(req, res, next);
}, controller.getById);

export { auditLogRouter };

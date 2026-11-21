import bcrypt from 'bcryptjs';
import { AppError } from '../errors/AppError.ts';
import { UnauthorizedError } from '../errors/UnauthorizedError.ts';
import { UserRepository } from '../repositories/userRepository.ts';
import { AuditLogRepository } from '../repositories/auditLogRepository.ts';
import type { LoginInput, RegisterInput } from '../schemas/authSchema.ts';
import type { AuthUserDto, LoginResponseDto } from '../dtos/authDto.ts';
import { signToken, type AuthUser } from './tokenService.ts';
import { createAuditEntry } from './auditLogService.ts';

type UserRow = NonNullable<Awaited<ReturnType<UserRepository['findByEmail']>>>;

export class AuthService {
    constructor(
        private readonly userRepository: UserRepository = new UserRepository(),
        private readonly auditRepository: AuditLogRepository = new AuditLogRepository(),
    ) {}

    private toDto(row: UserRow): AuthUserDto {
        return { id: row.id, name: row.name, email: row.email, role: row.role };
    }

    async register(input: RegisterInput): Promise<AuthUserDto> {
        const existing = await this.userRepository.findByEmail(input.email);
        if (existing) throw new AppError(409, 'Email sudah terdaftar');

        const passwordHash = await bcrypt.hash(input.password, Number(process.env.BCRYPT_SALT_ROUNDS ?? 10));
        const row = await this.userRepository.create({
            name: input.name,
            email: input.email,
            passwordHash,
            role: 'customer',
        });
        if (!row) throw new AppError(500, 'User gagal dibuat');
        return this.toDto(row);
    }

    async login(
        input: LoginInput,
        requestContext: { ipAddress: string | null; userAgent: string | null },
    ): Promise<LoginResponseDto> {
        const row = await this.userRepository.findByEmail(input.email);
        if (!row || !(await bcrypt.compare(input.password, row.passwordHash))) {
            throw new UnauthorizedError('Email atau password salah');
        }

        const user: AuthUser = this.toDto(row);
        const data = {
            token: signToken(user),
            tokenType: 'Bearer' as const,
            expiresIn: process.env.JWT_EXPIRES_IN ?? '2h',
            user,
        };
        try {
            await this.auditRepository.create(createAuditEntry({
                user,
                ...requestContext,
            }, 'LOGIN', 'USERS', user.id));
        } catch (error) {
            console.error('Gagal menyimpan audit login:', error);
        }

        return data;
    }

    async logout(
        user: AuthUser,
        requestContext: { ipAddress: string | null; userAgent: string | null },
    ): Promise<void> {
        try {
            await this.auditRepository.create(createAuditEntry({
                user,
                ...requestContext,
            }, 'LOGOUT', 'USERS', user.id));
        } catch (error) {
            console.error('Gagal menyimpan audit logout:', error);
        }
    }
}

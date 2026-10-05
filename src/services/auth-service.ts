import { randomBytes, randomUUID } from 'crypto';
import database from '../lib/database';
import CustomError from '../types/custom-error';
import { Errors } from '../constants/responses';
import UserRepo from '../repositories/user-repo';
import OfferingRepo from '../repositories/offering-repo';
import EnrollmentRepo from '../repositories/enrollment-repo';
import InviteRepo from '../repositories/invite-repo';
import { hashPassword, verifyPassword } from '../lib/hash';
import { signAccessToken } from '../lib/jwt';
import { generateRefreshToken, hashRefreshToken } from '../lib/refresh-token';
import RefreshTokenRepo from '../repositories/refresh-token-repo';
import { env } from '../config/env';
import { normalizeName } from '../lib/normalize';
import Role from '../types/enums/roles';
import UserStatus from '../types/enums/user-status';
import { PublicUser, User } from '../types/models';
import { LoginInput, RegisterStudentInput, RegisterTeacherInput } from '../validators/auth-validator';

export interface Session {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
}

const isUniqueViolation = (error: unknown) => (error as { code?: string })?.code === '23505';

class AuthService {
  public static toPublicUser(user: User): PublicUser {
    return {
      id: user.id,
      cedula: user.cedula,
      fullName: user.full_name,
      email: user.email,
      role: user.role,
      status: user.status,
    };
  }

  private static async issueRefreshToken(userId: string, familyId: string = randomUUID()): Promise<string> {
    const token = generateRefreshToken();
    await RefreshTokenRepo.deleteExpired(userId);
    await RefreshTokenRepo.create({
      userId,
      familyId,
      tokenHash: hashRefreshToken(token),
      expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000),
    });
    return token;
  }

  private static async buildSession(user: User, familyId?: string): Promise<Session> {
    return {
      user: AuthService.toPublicUser(user),
      accessToken: signAccessToken(user.id, user.role),
      refreshToken: await AuthService.issueRefreshToken(user.id, familyId),
    };
  }

  private static assertCanSignIn(user: User) {
    if (user.status === UserStatus.PendingApproval) {
      throw new CustomError(Errors.AccountPending.status, Errors.AccountPending.message);
    }
    if (user.status === UserStatus.Disabled) {
      throw new CustomError(Errors.AccountDisabled.status, Errors.AccountDisabled.message);
    }
  }

  public static async registerStudent(input: RegisterStudentInput): Promise<Session> {
    const offerings = await OfferingRepo.findByIds(input.offeringIds);
    if (offerings.length !== new Set(input.offeringIds).size || offerings.some((offering) => !offering.active)) {
      throw new CustomError(Errors.OfferingNotFound.status, Errors.OfferingNotFound.message);
    }

    const passwordHash = await hashPassword(input.password);

    try {
      const user = await database.transaction(async (trx) => {
        const created = await UserRepo.create(
          {
            cedula: input.cedula,
            fullName: input.fullName,
            fullNameSearch: normalizeName(input.fullName),
            email: input.email,
            passwordHash,
            role: Role.Student,
            status: UserStatus.Active,
          },
          trx,
        );
        await EnrollmentRepo.addMany(created.id, input.offeringIds, trx);
        return created;
      });
      return await AuthService.buildSession(user);
    } catch (error) {
      if (isUniqueViolation(error)) throw new CustomError(Errors.CedulaTaken.status, Errors.CedulaTaken.message);
      throw error;
    }
  }

  public static async registerTeacher(input: RegisterTeacherInput): Promise<{ user: PublicUser; session?: Session }> {
    const passwordHash = await hashPassword(input.password);

    try {
      const user = await database.transaction(async (trx) => {
        if (input.inviteCode && !(await InviteRepo.isValid(input.inviteCode, trx))) {
          throw new CustomError(Errors.InvalidInvite.status, Errors.InvalidInvite.message);
        }

        const created = await UserRepo.create(
          {
            cedula: input.cedula,
            fullName: input.fullName,
            fullNameSearch: normalizeName(input.fullName),
            email: input.email,
            passwordHash,
            role: Role.Teacher,
            status: input.inviteCode ? UserStatus.Active : UserStatus.PendingApproval,
          },
          trx,
        );

        if (input.inviteCode && !(await InviteRepo.consume(input.inviteCode, created.id, trx))) {
          throw new CustomError(Errors.InvalidInvite.status, Errors.InvalidInvite.message);
        }

        return created;
      });

      return {
        user: AuthService.toPublicUser(user),
        session: user.status === UserStatus.Active ? await AuthService.buildSession(user) : undefined,
      };
    } catch (error) {
      if (isUniqueViolation(error)) throw new CustomError(Errors.CedulaTaken.status, Errors.CedulaTaken.message);
      throw error;
    }
  }

  public static async login(input: LoginInput): Promise<Session> {
    const user = await UserRepo.findByCedula(input.cedula);
    const valid = user ? await verifyPassword(user.password_hash, input.password) : false;

    if (!user || !valid) {
      throw new CustomError(Errors.InvalidCredentials.status, Errors.InvalidCredentials.message);
    }

    AuthService.assertCanSignIn(user);
    return AuthService.buildSession(user);
  }

  private static unauthenticated() {
    return new CustomError(Errors.Unauthenticated.status, Errors.Unauthenticated.message);
  }

  public static async refresh(refreshToken: string | undefined): Promise<Session> {
    if (!refreshToken) throw AuthService.unauthenticated();

    const stored = await RefreshTokenRepo.findByHash(hashRefreshToken(refreshToken));
    if (!stored || stored.revoked_at || stored.expires_at.getTime() <= Date.now()) {
      throw AuthService.unauthenticated();
    }

    const claimed = await RefreshTokenRepo.markUsed(stored.id);
    if (!claimed) {
      const latest = (await RefreshTokenRepo.findByHash(stored.token_hash)) ?? stored;
      const graceEnds = (latest.used_at?.getTime() ?? 0) + env.REFRESH_REUSE_GRACE_SECONDS * 1000;
      if (latest.revoked_at || Date.now() > graceEnds) {
        await RefreshTokenRepo.revokeFamily(stored.family_id);
        throw AuthService.unauthenticated();
      }
    }

    const user = await UserRepo.findById(stored.user_id);
    if (!user) throw AuthService.unauthenticated();

    AuthService.assertCanSignIn(user);
    return AuthService.buildSession(user, stored.family_id);
  }

  public static async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return;
    const stored = await RefreshTokenRepo.findByHash(hashRefreshToken(refreshToken));
    if (stored) await RefreshTokenRepo.revokeFamily(stored.family_id);
  }

  public static async me(userId: string): Promise<PublicUser> {
    const user = await UserRepo.findById(userId);
    if (!user) throw new CustomError(Errors.UserNotFound.status, Errors.UserNotFound.message);
    return AuthService.toPublicUser(user);
  }

  public static generateInviteCode(): string {
    return randomBytes(6).toString('hex').toUpperCase();
  }
}

export default AuthService;

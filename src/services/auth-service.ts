import { randomBytes, randomUUID } from 'crypto';
import Database from '../lib/database';
import CustomError from '../types/custom-error';
import { Errors } from '../constants/responses';
import UserRepo from '../repositories/user-repo';
import OfferingRepo from '../repositories/offering-repo';
import EnrollmentRepo from '../repositories/enrollment-repo';
import InviteRepo from '../repositories/invite-repo';
import { hashPassword, verifyPassword } from '../lib/hash';
import { signAccessToken } from '../lib/jwt';
import { mailer, MailMessage } from '../lib/mailer';
import { passwordChangedMessage, passwordResetMessage } from '../lib/mail-templates';
import PasswordResetRepo from '../repositories/password-reset-repo';
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

const uniqueViolation = (error: unknown) => {
  const { code, constraint } = error as { code?: string; constraint?: string };
  if (code !== '23505') return null;
  return constraint?.includes('email')
    ? new CustomError(Errors.EmailTaken.status, Errors.EmailTaken.message)
    : new CustomError(Errors.CedulaTaken.status, Errors.CedulaTaken.message);
};

class AuthService {
  public static toPublicUser(user: User): PublicUser {
    return {
      id: user.id,
      cedula: user.cedula,
      fullName: user.fullName,
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
      const user = await Database.transaction(async (trx) => {
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
      throw uniqueViolation(error) ?? error;
    }
  }

  public static async registerTeacher(input: RegisterTeacherInput): Promise<{ user: PublicUser; session?: Session }> {
    const passwordHash = await hashPassword(input.password);

    try {
      const user = await Database.transaction(async (trx) => {
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
      throw uniqueViolation(error) ?? error;
    }
  }

  public static async login(input: LoginInput): Promise<Session> {
    const user = await UserRepo.findByCedula(input.cedula);
    const valid = user ? await verifyPassword(user.passwordHash, input.password) : false;

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
    if (!stored || stored.revokedAt || stored.expiresAt.getTime() <= Date.now()) {
      throw AuthService.unauthenticated();
    }

    const claimed = await RefreshTokenRepo.markUsed(stored.id);
    if (!claimed) {
      const latest = (await RefreshTokenRepo.findByHash(stored.tokenHash)) ?? stored;
      const graceEnds = (latest.usedAt?.getTime() ?? 0) + env.REFRESH_REUSE_GRACE_SECONDS * 1000;
      if (latest.revokedAt || Date.now() > graceEnds) {
        await RefreshTokenRepo.revokeFamily(stored.familyId);
        throw AuthService.unauthenticated();
      }
    }

    const user = await UserRepo.findById(stored.userId);
    if (!user) throw AuthService.unauthenticated();

    AuthService.assertCanSignIn(user);
    return AuthService.buildSession(user, stored.familyId);
  }

  public static async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return;
    const stored = await RefreshTokenRepo.findByHash(hashRefreshToken(refreshToken));
    if (stored) await RefreshTokenRepo.revokeFamily(stored.familyId);
  }

  private static webUrl(path: string): string {
    return `${env.WEB_BASE_URL.replace(/\/$/, '')}${path}`;
  }

  private static dispatch(message: MailMessage): void {
    void mailer.send(message).catch((error) => {
      if (!env.isTest) console.error('email delivery failed', error);
    });
  }

  private static notifyPasswordChanged(user: User): void {
    if (!user.email) return;
    AuthService.dispatch(
      passwordChangedMessage({
        to: user.email,
        fullName: user.fullName,
        recoveryUrl: AuthService.webUrl('/recuperar-contrasena'),
        changedAt: new Date(),
      }),
    );
  }

  public static async requestPasswordReset(email: string): Promise<void> {
    const user = await UserRepo.findByEmail(email);
    if (!user) return;

    const latest = await PasswordResetRepo.latestForUser(user.id);
    if (latest && Date.now() - latest.createdAt.getTime() < env.PASSWORD_RESET_COOLDOWN_SECONDS * 1000) return;

    await PasswordResetRepo.invalidateForUser(user.id);
    const token = generateRefreshToken();
    await PasswordResetRepo.create(
      user.id,
      hashRefreshToken(token),
      new Date(Date.now() + env.PASSWORD_RESET_TTL_MINUTES * 60 * 1000),
    );

    AuthService.dispatch(
      passwordResetMessage({
        to: user.email!,
        fullName: user.fullName,
        link: AuthService.webUrl(`/restablecer-contrasena#token=${token}`),
        ttlMinutes: env.PASSWORD_RESET_TTL_MINUTES,
      }),
    );
  }

  public static async resetPassword(token: string, newPassword: string): Promise<void> {
    const stored = await PasswordResetRepo.findByHash(hashRefreshToken(token));
    if (!stored || !(await PasswordResetRepo.consume(stored.id))) {
      throw new CustomError(Errors.InvalidResetToken.status, Errors.InvalidResetToken.message);
    }

    await UserRepo.updatePassword(stored.userId, await hashPassword(newPassword));
    await PasswordResetRepo.invalidateForUser(stored.userId);
    await RefreshTokenRepo.revokeAllForUser(stored.userId);

    const user = await UserRepo.findById(stored.userId);
    if (user) AuthService.notifyPasswordChanged(user);
  }

  public static async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<Session> {
    const user = await UserRepo.findById(userId);
    if (!user) throw new CustomError(Errors.UserNotFound.status, Errors.UserNotFound.message);

    if (!(await verifyPassword(user.passwordHash, currentPassword))) {
      throw new CustomError(Errors.WrongPassword.status, Errors.WrongPassword.message);
    }
    if (currentPassword === newPassword) {
      throw new CustomError(Errors.SamePassword.status, Errors.SamePassword.message);
    }

    await UserRepo.updatePassword(user.id, await hashPassword(newPassword));
    await PasswordResetRepo.invalidateForUser(user.id);
    await RefreshTokenRepo.revokeAllForUser(user.id);
    AuthService.notifyPasswordChanged(user);
    return AuthService.buildSession(user);
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

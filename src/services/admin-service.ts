import CustomError from '../types/custom-error';
import { Errors } from '../constants/responses';
import UserRepo from '../repositories/user-repo';
import InviteRepo from '../repositories/invite-repo';
import RefreshTokenRepo from '../repositories/refresh-token-repo';
import AuthService from './auth-service';
import { hashPassword } from '../lib/hash';
import { normalizeName } from '../lib/normalize';
import Role from '../types/enums/roles';
import UserStatus from '../types/enums/user-status';
import { CreateAdminInput } from '../validators/admin-validator';

class AdminService {
  public static async listTeachers(status: UserStatus | undefined, page: number, limit: number) {
    const { rows, total } = await UserRepo.listByRole(Role.Teacher, status, page, limit);
    return { teachers: rows.map(AuthService.toPublicUser), total };
  }

  public static async setTeacherStatus(id: string, status: UserStatus) {
    const teacher = await UserRepo.findById(id);
    if (!teacher || teacher.role !== Role.Teacher) {
      throw new CustomError(Errors.UserNotFound.status, Errors.UserNotFound.message);
    }
    const updated = await UserRepo.updateStatus(id, status);
    if (status === UserStatus.Disabled) await RefreshTokenRepo.revokeAllForUser(id);
    return AuthService.toPublicUser(updated!);
  }

  public static async createInvite(adminId: string, expiresInDays: number) {
    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);
    const invite = await InviteRepo.create(AuthService.generateInviteCode(), adminId, expiresAt);
    return { code: invite.code, expiresAt: invite.expires_at };
  }

  public static async createAdmin(input: CreateAdminInput) {
    if (await UserRepo.findByCedula(input.cedula)) {
      throw new CustomError(Errors.CedulaTaken.status, Errors.CedulaTaken.message);
    }
    const user = await UserRepo.create({
      cedula: input.cedula,
      fullName: input.fullName,
      fullNameSearch: normalizeName(input.fullName),
      email: input.email,
      passwordHash: await hashPassword(input.password),
      role: Role.Admin,
      status: UserStatus.Active,
    });
    return AuthService.toPublicUser(user);
  }
}

export default AdminService;

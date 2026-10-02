import database from '../lib/database';
import { User } from '../types/models';
import Role from '../types/enums/roles';
import UserStatus from '../types/enums/user-status';

interface CreateUserData {
  cedula: string;
  fullName: string;
  fullNameSearch: string;
  email?: string;
  passwordHash: string;
  role: Role;
  status: UserStatus;
}

class UserRepo {
  public static async findById(id: string): Promise<User | undefined> {
    return database<User>('users').where({ id }).first();
  }

  public static async findByCedula(cedula: string): Promise<User | undefined> {
    return database<User>('users').where({ cedula }).first();
  }

  public static async create(data: CreateUserData, trx = database): Promise<User> {
    const [user] = await trx<User>('users')
      .insert({
        cedula: data.cedula,
        full_name: data.fullName,
        full_name_search: data.fullNameSearch,
        email: data.email ?? null,
        password_hash: data.passwordHash,
        role: data.role,
        status: data.status,
      })
      .returning('*');
    return user;
  }

  public static async updateStatus(id: string, status: UserStatus): Promise<User | undefined> {
    const [user] = await database<User>('users')
      .where({ id })
      .update({ status, updated_at: database.fn.now() })
      .returning('*');
    return user;
  }

  public static async incrementQrVersion(id: string): Promise<User> {
    const [user] = await database<User>('users')
      .where({ id })
      .update({ qr_token_version: database.raw('qr_token_version + 1'), updated_at: database.fn.now() })
      .returning('*');
    return user;
  }

  public static async listByRole(role: Role, status: UserStatus | undefined, page: number, limit: number) {
    const query = database<User>('users').where({ role });
    if (status) query.where({ status });

    const [{ count }] = await query.clone().count<{ count: string }[]>('id as count');
    const rows = await query
      .clone()
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset((page - 1) * limit);

    return { rows, total: Number(count) };
  }
}

export default UserRepo;

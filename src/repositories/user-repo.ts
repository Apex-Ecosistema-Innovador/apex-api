import Database from '../lib/database';
import { User } from '../types/models';
import Role from '../types/enums/roles';
import UserStatus from '../types/enums/user-status';
import { Queryable } from '../types/database';
import { CreateUserData } from '../types/repositories';

const USER_COLUMNS = `
  id,
  cedula,
  full_name AS "fullName",
  full_name_search AS "fullNameSearch",
  email,
  password_hash AS "passwordHash",
  role,
  status,
  qr_token_version AS "qrTokenVersion",
  created_at AS "createdAt",
  updated_at AS "updatedAt"
`;

class UserRepo {
  public static async findById(id: string): Promise<User | undefined> {
    const query = `SELECT ${USER_COLUMNS} FROM users WHERE id = $1`;
    const rows = await Database.query<User>(query, [id], { queryId: 'UserRepo.findById' });
    return rows[0];
  }

  public static async findByCedula(cedula: string): Promise<User | undefined> {
    const query = `SELECT ${USER_COLUMNS} FROM users WHERE cedula = $1`;
    const rows = await Database.query<User>(query, [cedula], { queryId: 'UserRepo.findByCedula' });
    return rows[0];
  }

  public static async findByEmail(email: string): Promise<User | undefined> {
    const query = `SELECT ${USER_COLUMNS} FROM users WHERE email = $1`;
    const rows = await Database.query<User>(query, [email.toLowerCase()], { queryId: 'UserRepo.findByEmail' });
    return rows[0];
  }

  public static async updatePassword(id: string, passwordHash: string): Promise<void> {
    const query = `
      UPDATE users
      SET password_hash = $2, updated_at = now()
      WHERE id = $1
    `;
    await Database.execute(query, [id, passwordHash], { queryId: 'UserRepo.updatePassword' });
  }

  public static async create(data: CreateUserData, executor: Queryable = Database): Promise<User> {
    const query = `
      INSERT INTO users (cedula, full_name, full_name_search, email, password_hash, role, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING ${USER_COLUMNS}
    `;
    const parameters = [
      data.cedula,
      data.fullName,
      data.fullNameSearch,
      data.email ?? null,
      data.passwordHash,
      data.role,
      data.status,
    ];
    const rows = await executor.query<User>(query, parameters, { queryId: 'UserRepo.create' });
    return rows[0];
  }

  public static async updateStatus(id: string, status: UserStatus): Promise<User | undefined> {
    const query = `
      UPDATE users
      SET status = $2, updated_at = now()
      WHERE id = $1
      RETURNING ${USER_COLUMNS}
    `;
    const rows = await Database.query<User>(query, [id, status], { queryId: 'UserRepo.updateStatus' });
    return rows[0];
  }

  public static async incrementQrVersion(id: string): Promise<User> {
    const query = `
      UPDATE users
      SET qr_token_version = qr_token_version + 1, updated_at = now()
      WHERE id = $1
      RETURNING ${USER_COLUMNS}
    `;
    const rows = await Database.query<User>(query, [id], { queryId: 'UserRepo.incrementQrVersion' });
    return rows[0];
  }

  public static async listByRole(role: Role, status: UserStatus | undefined, page: number, limit: number) {
    const LIST_FILTERS = `WHERE role = $1 AND ($2::user_status IS NULL OR status = $2::user_status)`;
    const rowsQuery = `
      SELECT ${USER_COLUMNS}
      FROM users
      ${LIST_FILTERS}
      ORDER BY created_at DESC
      LIMIT $3 OFFSET $4
    `;
    const countQuery = `SELECT count(*)::int AS total FROM users ${LIST_FILTERS}`;

    const [rows, totals] = await Promise.all([
      Database.query<User>(rowsQuery, [role, status ?? null, limit, (page - 1) * limit], {
        queryId: 'UserRepo.listByRole',
      }),
      Database.query<{ total: number }>(countQuery, [role, status ?? null], { queryId: 'UserRepo.listByRole.count' }),
    ]);

    return { rows, total: totals[0].total };
  }
}

export default UserRepo;

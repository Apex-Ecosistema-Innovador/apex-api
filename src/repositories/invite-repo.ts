import Database, { Queryable } from '../lib/database';

interface Invite {
  id: string;
  code: string;
  createdBy: string;
  usedBy: string | null;
  expiresAt: Date;
}

const INVITE_COLUMNS = `
  id,
  code,
  created_by AS "createdBy",
  used_by AS "usedBy",
  expires_at AS "expiresAt"
`;

class InviteRepo {
  public static async create(code: string, createdBy: string, expiresAt: Date): Promise<Invite> {
    const query = `
      INSERT INTO teacher_invites (code, created_by, expires_at)
      VALUES ($1, $2, $3)
      RETURNING ${INVITE_COLUMNS}
    `;
    const rows = await Database.query<Invite>(query, [code, createdBy, expiresAt], { queryId: 'InviteRepo.create' });
    return rows[0];
  }

  public static async consume(code: string, userId: string, executor: Queryable): Promise<boolean> {
    const query = `
      UPDATE teacher_invites
      SET used_by = $2
      WHERE code = $1 AND used_by IS NULL AND expires_at > now()
    `;
    const updated = await executor.execute(query, [code, userId], { queryId: 'InviteRepo.consume' });
    return updated > 0;
  }

  public static async isValid(code: string, executor: Queryable): Promise<boolean> {
    const query = `
      SELECT 1 AS found
      FROM teacher_invites
      WHERE code = $1 AND used_by IS NULL AND expires_at > now()
    `;
    const rows = await executor.query<{ found: number }>(query, [code], { queryId: 'InviteRepo.isValid' });
    return rows.length > 0;
  }
}

export default InviteRepo;

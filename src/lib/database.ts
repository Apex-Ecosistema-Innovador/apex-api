import { Pool, PoolClient, QueryResultRow } from 'pg';
import { buildPoolConfig } from './connection';
import { QueryParams, Queryable } from '../types/database';

const pool = new Pool(buildPoolConfig());

function tagged(error: unknown, queryId?: string): unknown {
  if (queryId && error instanceof Error) Object.assign(error, { queryId });
  return error;
}

class Database {
  public static async query<T extends QueryResultRow>(
    text: string,
    values: unknown[] = [],
    { queryId }: QueryParams = {},
  ): Promise<T[]> {
    try {
      const result = await pool.query<T>({ text, values });
      return result.rows;
    } catch (error) {
      throw tagged(error, queryId);
    }
  }

  public static async execute(text: string, values: unknown[] = [], { queryId }: QueryParams = {}): Promise<number> {
    try {
      const result = await pool.query({ text, values });
      return result.rowCount ?? 0;
    } catch (error) {
      throw tagged(error, queryId);
    }
  }

  public static async withPoolClient<ResultType>(callback: (client: PoolClient) => Promise<ResultType>) {
    const client = await pool.connect();
    try {
      return await callback(client);
    } finally {
      client.release();
    }
  }

  public static async transaction<ResultType>(callback: (transaction: Queryable) => Promise<ResultType>) {
    return Database.withPoolClient(async (client) => {
      const transaction: Queryable = {
        query: async <T extends QueryResultRow>(
          text: string,
          values: unknown[] = [],
          { queryId }: QueryParams = {},
        ) => {
          try {
            return (await client.query<T>({ text, values })).rows;
          } catch (error) {
            throw tagged(error, queryId);
          }
        },
        execute: async (text, values = [], { queryId } = {}) => {
          try {
            return (await client.query({ text, values })).rowCount ?? 0;
          } catch (error) {
            throw tagged(error, queryId);
          }
        },
      };

      await client.query('BEGIN');
      try {
        const result = await callback(transaction);
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    });
  }

  public static async close(): Promise<void> {
    await pool.end();
  }
}

export default Database;

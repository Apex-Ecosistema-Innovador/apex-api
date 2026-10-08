import type { QueryResultRow } from 'pg';

export interface QueryParams {
  queryId?: string;
}

export interface Queryable {
  query<T extends QueryResultRow>(text: string, values?: unknown[], params?: QueryParams): Promise<T[]>;
  execute(text: string, values?: unknown[], params?: QueryParams): Promise<number>;
}

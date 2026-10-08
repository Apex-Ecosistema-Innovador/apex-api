export type BatchStatus = 'created' | 'duplicate' | 'rejected';

export interface BatchResult {
  idempotencyKey: string;
  status: BatchStatus;
  error?: string;
}

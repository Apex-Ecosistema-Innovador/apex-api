import HttpStatus from './enums/http-status';

export interface ResponseSuccess<Payload> {
  statusCode?: HttpStatus;
  message?: string;
  payload?: Payload;
  page?: number;
  limit?: number;
  total?: number;
}

export interface Page {
  page: number;
  limit: number;
}

import HttpStatus from './enums/http-status';

class CustomError extends Error {
  public readonly statusCode: HttpStatus;

  public readonly details?: unknown;

  constructor(statusCode: HttpStatus, message: string, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}

export default CustomError;

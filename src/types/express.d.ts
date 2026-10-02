import Role from './enums/roles';

export interface AuthContext {
  userId: string;
  role: Role;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

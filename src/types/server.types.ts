import type { User } from '@prisma/client';
import type { Request } from 'express';

export type SessionPayload = {
  sub: string;
  email: string;
  remember?: boolean;
};

export type RequestUser = User & {
  passwordHash?: string | null;
};

export type AuthedRequest = Request & {
  user: RequestUser;
  session?: { remember: boolean };
};

export type PartialAuthedRequest = Request & {
  user?: RequestUser;
  session?: { remember: boolean };
};

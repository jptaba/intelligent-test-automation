import { ENV } from '../helpers/env';

export type UserType = 'standard' | 'locked' | 'problem';

export interface User {
  username: string;
  password: string;
}

/**
 * Typed user credentials sourced from .env — never hardcode credentials in test files.
 * Usage: USERS.standard.username, USERS.standard.password
 */
export const USERS: Record<UserType, User> = {
  standard: { username: ENV.STANDARD_USER, password: ENV.USER_PASSWORD },
  locked: { username: ENV.LOCKED_USER, password: ENV.USER_PASSWORD },
  problem: { username: ENV.PROBLEM_USER, password: ENV.USER_PASSWORD },
};

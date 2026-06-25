import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { createHttpError } from './validation.js';

const passwordSalt = 'tricycall-demo-login-v1';
const users = [
  {
    id: 'passenger-1',
    name: 'Ana Passenger',
    email: 'ana@example.com',
    passwordHash: hashPassword('password123')
  }
];

export function authenticateUser(input) {
  const email = input.email.toLowerCase();
  const user = users.find(item => item.email === email);

  if (!user || !verifyPassword(input.password, user.passwordHash)) {
    throw createHttpError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect');
  }

  return {
    token: `demo_${randomBytes(24).toString('hex')}`,
    user: toPublicUser(user)
  };
}

function hashPassword(password) {
  return scryptSync(password, passwordSalt, 32).toString('hex');
}

function verifyPassword(password, expectedHash) {
  const actual = Buffer.from(hashPassword(password), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function toPublicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email
  };
}

import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from '../src/server.js';
import { createRideStore } from '../src/store.js';

test('API logs in a demo passenger', async () => {
  const server = createServer(createRideStore());
  const baseUrl = await listen(server);

  try {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'ana@example.com', password: 'password123' })
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.user.email, 'ana@example.com');
    assert.equal(body.user.name, 'Ana Passenger');
    assert.equal(typeof body.token, 'string');
    assert.ok(body.token.length > 16);
    assert.equal(body.user.password, undefined);
    assert.equal(body.user.passwordHash, undefined);
  } finally {
    await close(server);
  }
});

test('API rejects invalid login credentials', async () => {
  const server = createServer(createRideStore());
  const baseUrl = await listen(server);

  try {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'ana@example.com', password: 'wrong-password' })
    });
    const body = await response.json();

    assert.equal(response.status, 401);
    assert.equal(body.error.code, 'INVALID_CREDENTIALS');
  } finally {
    await close(server);
  }
});

function listen(server) {
  return new Promise(resolve => {
    server.listen(0, () => {
      const address = server.address();
      resolve(`http://127.0.0.1:${address.port}`);
    });
  });
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close(error => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

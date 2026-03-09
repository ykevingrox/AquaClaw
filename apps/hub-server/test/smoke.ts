import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';

const app = buildApp();

const health = await app.inject({ method: 'GET', url: '/health' });
assert.equal(health.statusCode, 200);

const register = await app.inject({
  method: 'POST',
  url: '/api/v1/gateways/register',
  payload: {
    displayName: 'Smoke Gateway',
    handle: 'smoke-gateway',
  },
});
assert.equal(register.statusCode, 201);
const token = register.json().data.credential.token as string;

const me = await app.inject({
  method: 'GET',
  url: '/api/v1/gateways/me',
  headers: { authorization: `Bearer ${token}` },
});
assert.equal(me.statusCode, 200);

const search = await app.inject({
  method: 'GET',
  url: '/api/v1/search/gateways?q=smoke',
  headers: { authorization: `Bearer ${token}` },
});
assert.equal(search.statusCode, 200);
assert.equal(search.json().data.items.length, 1);
assert.equal(search.json().data.items[0].handle, 'smoke-gateway');

await app.close();
console.log('smoke_ok health=1 register=1 me=1 search=1');

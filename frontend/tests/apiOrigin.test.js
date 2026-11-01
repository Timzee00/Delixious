import { describe, expect, it } from 'vitest';
import api from '../src/lib/api.js';

describe('browser transport routing', () => {
  it('always uses the local API path', () => {
    expect(api.defaults.baseURL).toBe('/api');
    expect(api.defaults.withCredentials).toBe(true);
  });
});

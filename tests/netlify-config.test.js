import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Netlify frontend routing', () => {
  it('processes the API proxy before the SPA fallback', () => {
    const toml = fs.readFileSync(path.join(process.cwd(), 'frontend/netlify.toml'), 'utf8');
    const apiPos = toml.indexOf('from = "/api/*"');
    const spaPos = toml.indexOf('from = "/*"');
    expect(apiPos).toBeGreaterThanOrEqual(0);
    expect(spaPos).toBeGreaterThan(apiPos);
  });

  it('does not ship an earlier catch-all _redirects rule', () => {
    const redirects = path.join(process.cwd(), 'frontend/public/_redirects');
    expect(fs.existsSync(redirects)).toBe(false);
  });
});

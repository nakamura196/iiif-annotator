import { describe, it, expect } from 'vitest';
import { openApiSpec } from './openapi';

describe('openApiSpec', () => {
  it('OpenAPI 3.x で必須セクションを持つ', () => {
    expect(openApiSpec.openapi).toMatch(/^3\./);
    expect(openApiSpec.info.title).toBeTruthy();
    expect(openApiSpec.paths).toBeTruthy();
  });

  it('アノテーション CRUD のパス・メソッドを網羅している', () => {
    const paths = openApiSpec.paths as Record<string, Record<string, unknown>>;
    expect(Object.keys(paths['/api/annotations'])).toEqual(
      expect.arrayContaining(['get', 'post'])
    );
    expect(Object.keys(paths['/api/annotations/{id}'])).toEqual(
      expect.arrayContaining(['get', 'put', 'delete'])
    );
  });

  it('API キーと Bearer の両認証方式を定義している', () => {
    const schemes = openApiSpec.components.securitySchemes;
    expect(schemes.ApiKeyAuth.name).toBe('X-API-Key');
    expect(schemes.BearerAuth.scheme).toBe('bearer');
  });
});

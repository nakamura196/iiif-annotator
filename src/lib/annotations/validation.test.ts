import { describe, it, expect } from 'vitest';
import { validateCreate, validateUpdate, normalizeMetadata, normalizeTags } from './validation';

const validTarget = {
  selector: { type: 'FragmentSelector', value: 'xywh=1,2,3,4' },
  source: { id: 'c', type: 'Canvas' },
};

describe('normalizeMetadata', () => {
  it('label/value 両方ある行だけ残し trim する', () => {
    expect(
      normalizeMetadata([
        { label: ' 種別 ', value: ' パース ' },
        { label: '空', value: '' },
        { label: '', value: 'x' },
      ])
    ).toEqual([{ label: '種別', value: 'パース' }]);
  });

  it('配列でなければ undefined', () => {
    expect(normalizeMetadata('nope')).toBeUndefined();
    expect(normalizeMetadata(undefined)).toBeUndefined();
  });
});

describe('normalizeTags', () => {
  it('非空・trim・重複排除した文字列配列にする', () => {
    expect(normalizeTags([' OCR ', 'OCR', '', 'foo', 123 as unknown as string])).toEqual([
      'OCR',
      'foo',
    ]);
  });
  it('空配列は空配列のまま（全タグ削除の表現）', () => {
    expect(normalizeTags([])).toEqual([]);
  });
  it('配列でなければ undefined', () => {
    expect(normalizeTags('OCR')).toBeUndefined();
    expect(normalizeTags(undefined)).toBeUndefined();
  });
});

describe('validateUpdate tags', () => {
  it('tags だけの部分更新は valid', () => {
    const r = validateUpdate({ tags: ['OCR'] });
    expect(r.valid).toBe(true);
    expect(r.value.tags).toEqual(['OCR']);
  });
  it('tags:[] （全タグ削除）も valid', () => {
    const r = validateUpdate({ tags: [] });
    expect(r.valid).toBe(true);
    expect(r.value.tags).toEqual([]);
  });
});

describe('validateCreate', () => {
  it('manifestId / canvasId / target が揃えば valid、既定値を補う', () => {
    const r = validateCreate({
      manifestId: 'm',
      canvasId: 'c',
      target: validTarget,
    });
    expect(r.valid).toBe(true);
    expect(r.errors).toEqual([]);
    expect(r.value.motivation).toBe('commenting');
    expect(r.value.type).toBe('Annotation');
    expect(r.value.body).toEqual({ type: 'TextualBody', value: '' });
  });

  it('manifestId 欠落で invalid', () => {
    const r = validateCreate({ canvasId: 'c', target: validTarget });
    expect(r.valid).toBe(false);
    expect(r.errors).toContain('manifestId is required');
  });

  it('selector が無い target は invalid', () => {
    const r = validateCreate({ manifestId: 'm', canvasId: 'c', target: { source: {} } });
    expect(r.valid).toBe(false);
    expect(r.errors).toContain('target.selector is required');
  });

  it('selector が配列でも OK', () => {
    const r = validateCreate({
      manifestId: 'm',
      canvasId: 'c',
      target: { selector: [{ type: 'FragmentSelector', value: 'xywh=0,0,1,1' }] },
    });
    expect(r.valid).toBe(true);
  });

  it('body.value を保持し metadata を正規化する', () => {
    const r = validateCreate({
      manifestId: 'm',
      canvasId: 'c',
      target: validTarget,
      body: { type: 'TextualBody', value: 'hello' },
      metadata: [{ label: 'a', value: 'b' }],
    });
    expect(r.value.body).toEqual({ type: 'TextualBody', value: 'hello' });
    expect(r.value.metadata).toEqual([{ label: 'a', value: 'b' }]);
  });
});

describe('validateUpdate', () => {
  it('body だけの部分更新は valid', () => {
    const r = validateUpdate({ body: { value: 'x' } });
    expect(r.valid).toBe(true);
    expect(r.value.body).toEqual({ type: 'TextualBody', value: 'x' });
  });

  it('空の更新は invalid', () => {
    const r = validateUpdate({});
    expect(r.valid).toBe(false);
    expect(r.errors).toContain('no updatable fields provided');
  });

  it('target を渡すなら selector 必須', () => {
    const r = validateUpdate({ target: { source: {} } });
    expect(r.valid).toBe(false);
    expect(r.errors).toContain('target must contain a selector when provided');
  });
});

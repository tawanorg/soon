import { describe, it, expect } from 'vitest';
import { parse, stringify, validate, fromJSON, toJSON } from './index';

describe('SOON API', () => {
  describe('parse', () => {
    it('should parse null', () => {
      expect(parse('null')).toBe(null);
    });

    it('should parse booleans', () => {
      expect(parse('true')).toBe(true);
      expect(parse('false')).toBe(false);
    });

    it('should parse numbers', () => {
      expect(parse('42')).toBe(42);
      expect(parse('3.14')).toBe(3.14);
      expect(parse('1.5e10')).toBe(1.5e10);
    });

    it('should parse unquoted strings', () => {
      expect(parse('hello')).toBe('hello');
    });

    it('should parse quoted strings', () => {
      expect(parse('"hello world"')).toBe('hello world');
    });

    it('should parse key-value pairs', () => {
      const source = `name John
age 30
active true`;
      const result = parse(source);
      expect(result).toEqual({
        name: 'John',
        age: 30,
        active: true,
      });
    });

    it('should parse arrays as space-separated values', () => {
      const result = parse('items 1 2 3');
      expect(result).toEqual({ items: [1, 2, 3] });
    });

    it('should parse nested structures with indentation', () => {
      const source = `user
  name John
  city NYC`;
      const result = parse(source);
      expect(result).toEqual({
        user: {
          name: 'John',
          city: 'NYC',
        },
      });
    });

    it('should parse inline object syntax', () => {
      const result = parse('point\n  x:10 y:20');
      expect(result).toEqual({
        point: { x: 10, y: 20 },
      });
    });
  });

  describe('stringify', () => {
    it('should stringify null', () => {
      expect(stringify(null)).toBe('null');
    });

    it('should stringify booleans', () => {
      expect(stringify(true)).toBe('true');
      expect(stringify(false)).toBe('false');
    });

    it('should stringify numbers', () => {
      expect(stringify(42)).toBe('42');
      expect(stringify(3.14)).toBe('3.14');
    });

    it('should stringify simple strings without quotes', () => {
      expect(stringify('hello')).toBe('hello');
    });

    it('should stringify strings with spaces using quotes', () => {
      const result = stringify('hello world');
      expect(result).toBe('"hello world"');
    });

    it('should stringify objects', () => {
      const obj = {
        name: 'John',
        age: 30,
        active: true,
      };
      const result = stringify(obj);
      expect(result).toContain('name');
      expect(result).toContain('John');
      expect(result).toContain('age');
      expect(result).toContain('30');
    });

    it('should stringify arrays as space-separated values', () => {
      const arr = [1, 2, 3];
      const result = stringify(arr);
      expect(result).toBe('1 2 3');
    });

    it('should stringify objects in compact mode', () => {
      const obj = { x: 10, y: 20 };
      const result = stringify(obj, { compact: true });
      expect(result).toContain('x');
      expect(result).toContain('10');
    });

    it('should sort keys when requested', () => {
      const obj = { z: 3, a: 1, m: 2 };
      const result = stringify(obj, { sortKeys: true, compact: true });
      const aIndex = result.indexOf('a');
      const mIndex = result.indexOf('m');
      const zIndex = result.indexOf('z');
      expect(aIndex).toBeLessThan(mIndex);
      expect(mIndex).toBeLessThan(zIndex);
    });
  });

  describe('validate', () => {
    it('should validate correct SOON', () => {
      const result = validate('name John\nage 30');
      expect(result.valid).toBe(true);
    });

    it('should detect syntax errors', () => {
      const result = validate('name "unclosed string');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('fromJSON', () => {
    it('should convert JSON to SOON', () => {
      const json = '{"name":"John","age":30}';
      const soon = fromJSON(json);
      expect(soon).toContain('name');
      expect(soon).toContain('John');
    });
  });

  describe('toJSON', () => {
    it('should convert SOON to JSON', () => {
      const soon = 'name John\nage 30';
      const json = toJSON(soon);
      const parsed = JSON.parse(json);
      expect(parsed).toEqual({ name: 'John', age: 30 });
    });
  });

  describe('round-trip', () => {
    it('should preserve data through parse/stringify', () => {
      const original = {
        name: 'John',
        age: 30,
        active: true,
        tags: ['web', 'mobile'],
      };
      const soon = stringify(original);
      const parsed = parse(soon);
      expect(parsed).toEqual(original);
    });
  });
});

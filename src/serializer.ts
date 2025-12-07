/**
 * SOON v2 Serializer - Converts JavaScript values to SOON format
 * Features:
 * - Indentation-based structure (no braces)
 * - Tabular data with column alignment
 * - Minimal token output for LLM efficiency
 */

import { SoonValue, SoonObject, SerializerOptions } from './types';

interface TableCandidate {
  isTable: boolean;
  columns: string[];
  rows: SoonObject[];
}

export class Serializer {
  private options: Required<SerializerOptions>;
  private indentLevel: number = 0;
  private indentStr: string = '  '; // 2 spaces

  constructor(options: SerializerOptions = {}) {
    this.options = {
      indent: options.indent ?? 2,
      sortKeys: options.sortKeys ?? false,
      compact: options.compact ?? false,
      explicitTypes: options.explicitTypes ?? false,
    };
    this.indentStr = ' '.repeat(this.options.indent);
  }

  /**
   * Serialize JavaScript value to SOON string
   */
  public serialize(value: SoonValue): string {
    return this.serializeValue(value, true);
  }

  private serializeValue(value: SoonValue, isTopLevel: boolean = false): string {
    if (value === null) {
      return 'null';
    }

    if (typeof value === 'boolean') {
      return value ? 'true' : 'false';
    }

    if (typeof value === 'number') {
      if (!isFinite(value)) {
        throw new Error(`Cannot serialize non-finite number: ${value}`);
      }
      return String(value);
    }

    if (typeof value === 'string') {
      return this.serializeString(value);
    }

    if (value instanceof Date) {
      return this.serializeDate(value);
    }

    if (value instanceof Uint8Array) {
      return this.serializeBinary(value);
    }

    if (Array.isArray(value)) {
      return this.serializeArray(value, isTopLevel);
    }

    if (typeof value === 'object') {
      return this.serializeObject(value as SoonObject, isTopLevel);
    }

    throw new Error(`Cannot serialize value of type: ${typeof value}`);
  }

  private serializeString(str: string): string {
    if (this.needsQuoting(str)) {
      return this.quoteString(str);
    }
    return str;
  }

  private needsQuoting(str: string): boolean {
    // Empty string needs quotes
    if (str.length === 0) return true;

    // Contains characters that need quoting in SOON
    // Only quote for newlines, tabs, colons, leading/trailing spaces
    if (/[\n\t\r]/.test(str)) return true;
    if (str.includes(':')) return true;
    if (str.startsWith(' ') || str.endsWith(' ')) return true;

    // Looks like a keyword
    if (str === 'true' || str === 'false' || str === 'null') return true;

    // Looks like a number
    if (/^-?\d+\.?\d*([eE][+-]?\d+)?$/.test(str)) return true;

    return false;
  }

  private quoteString(str: string): string {
    let result = '"';
    for (const char of str) {
      switch (char) {
        case '"':
          result += '\\"';
          break;
        case '\\':
          result += '\\\\';
          break;
        case '\n':
          result += '\\n';
          break;
        case '\t':
          result += '\\t';
          break;
        case '\r':
          result += '\\r';
          break;
        default:
          result += char;
      }
    }
    result += '"';
    return result;
  }

  private serializeDate(date: Date): string {
    if (isNaN(date.getTime())) {
      throw new Error('Cannot serialize invalid date');
    }
    return date.toISOString();
  }

  private serializeBinary(data: Uint8Array): string {
    const binary = Array.from(data)
      .map(byte => String.fromCharCode(byte))
      .join('');
    return '"' + btoa(binary) + '"';
  }

  private serializeArray(arr: SoonValue[], _isTopLevel: boolean): string {
    if (arr.length === 0) {
      return '';
    }

    // Check if all elements are simple primitives (space-separated on single line)
    const allSimplePrimitives = arr.every(
      item =>
        item === null ||
        typeof item === 'boolean' ||
        typeof item === 'number' ||
        (typeof item === 'string' && !this.needsQuoting(item))
    );

    if (allSimplePrimitives && !this.hasComplexElements(arr)) {
      return arr.map(item => this.serializeValue(item)).join(' ');
    }

    // For array of objects - check if it can be a table
    const tableCandidate = this.checkTableCandidate(arr);
    if (tableCandidate.isTable) {
      return this.serializeTable(tableCandidate);
    }

    // Array of inline objects
    if (this.isArrayOfSimpleObjects(arr)) {
      return this.serializeArrayOfInlineObjects(arr as SoonObject[]);
    }

    // Complex array - one item per line
    const lines: string[] = [];
    for (const item of arr) {
      if (typeof item === 'object' && item !== null && !Array.isArray(item) && !(item instanceof Date) && !(item instanceof Uint8Array)) {
        // Inline object syntax
        const inlineObj = this.serializeInlineObject(item as SoonObject);
        lines.push(inlineObj);
      } else {
        lines.push(this.serializeValue(item));
      }
    }

    return lines.join('\n' + this.getIndent());
  }

  private hasComplexElements(arr: SoonValue[]): boolean {
    return arr.some(
      item =>
        typeof item === 'object' &&
        item !== null &&
        !(item instanceof Date) &&
        !(item instanceof Uint8Array)
    );
  }

  private checkTableCandidate(arr: SoonValue[]): TableCandidate {
    // Check if array can be represented as a table
    // Requirements:
    // 1. All elements are objects
    // 2. All objects have same keys
    // 3. All values are primitives

    if (arr.length === 0) {
      return { isTable: false, columns: [], rows: [] };
    }

    const objects: SoonObject[] = [];

    for (const item of arr) {
      if (
        typeof item !== 'object' ||
        item === null ||
        Array.isArray(item) ||
        item instanceof Date ||
        item instanceof Uint8Array
      ) {
        return { isTable: false, columns: [], rows: [] };
      }
      objects.push(item as SoonObject);
    }

    // Get keys from first object
    const columns = Object.keys(objects[0]);
    if (columns.length === 0) {
      return { isTable: false, columns: [], rows: [] };
    }

    // Check all objects have same keys and primitive values
    for (const obj of objects) {
      const keys = Object.keys(obj);
      if (keys.length !== columns.length) {
        return { isTable: false, columns: [], rows: [] };
      }

      for (const key of columns) {
        if (!(key in obj)) {
          return { isTable: false, columns: [], rows: [] };
        }

        const val = obj[key];
        if (
          typeof val === 'object' &&
          val !== null &&
          !(val instanceof Date) &&
          !(val instanceof Uint8Array)
        ) {
          return { isTable: false, columns: [], rows: [] };
        }
      }
    }

    return { isTable: true, columns, rows: objects };
  }

  private serializeTable(table: TableCandidate): string {
    const { columns, rows } = table;

    // Calculate column widths for alignment
    const widths: number[] = columns.map(col => col.length);

    for (const row of rows) {
      for (let i = 0; i < columns.length; i++) {
        const val = this.serializeValue(row[columns[i]]);
        widths[i] = Math.max(widths[i], val.length);
      }
    }

    // Build header line
    const header = columns.map((col, i) => col.padEnd(widths[i])).join(' ');

    // Build data rows
    const dataRows = rows.map(row => {
      const values = columns.map((col, i) => {
        const val = this.serializeValue(row[col]);
        return val.padEnd(widths[i]);
      });
      return values.join(' ');
    });

    // Return with indentation for data rows
    const indent = this.getIndent() + this.indentStr;
    return header + '\n' + dataRows.map(r => indent + r).join('\n');
  }

  private isArrayOfSimpleObjects(arr: SoonValue[]): boolean {
    return arr.every(item => {
      if (
        typeof item !== 'object' ||
        item === null ||
        Array.isArray(item) ||
        item instanceof Date ||
        item instanceof Uint8Array
      ) {
        return false;
      }

      // Check all values are primitives
      return Object.values(item).every(
        val =>
          val === null ||
          typeof val === 'boolean' ||
          typeof val === 'number' ||
          typeof val === 'string' ||
          val instanceof Date
      );
    });
  }

  private serializeArrayOfInlineObjects(arr: SoonObject[]): string {
    const lines = arr.map(obj => this.serializeInlineObject(obj));
    const indent = this.getIndent() + this.indentStr;
    return '\n' + lines.map(line => indent + line).join('\n');
  }

  private serializeInlineObject(obj: SoonObject): string {
    const keys = this.options.sortKeys ? Object.keys(obj).sort() : Object.keys(obj);

    const pairs = keys.map(key => {
      const val = this.serializeValue(obj[key]);
      return `${key}:${val}`;
    });

    return pairs.join(' ');
  }

  private serializeObject(obj: SoonObject, isTopLevel: boolean): string {
    const keys = this.options.sortKeys ? Object.keys(obj).sort() : Object.keys(obj);

    if (keys.length === 0) {
      return '';
    }

    // Compact mode - inline object
    if (this.options.compact && this.isSimpleObject(obj)) {
      return this.serializeInlineObject(obj);
    }

    // Normal mode - key-value per line with indentation
    const lines: string[] = [];

    for (const key of keys) {
      const value = obj[key];
      const line = this.serializeKeyValue(key, value);
      lines.push(line);
    }

    if (isTopLevel) {
      return lines.join('\n');
    }

    // Nested object - add newline prefix
    const indent = this.getIndent();
    return '\n' + lines.map(line => indent + this.indentStr + line).join('\n');
  }

  private serializeKeyValue(key: string, value: SoonValue): string {
    // Handle different value types
    if (value === null) {
      return `${key} null`;
    }

    if (typeof value === 'boolean' || typeof value === 'number') {
      return `${key} ${value}`;
    }

    if (typeof value === 'string') {
      return `${key} ${this.serializeString(value)}`;
    }

    if (value instanceof Date) {
      return `${key} ${this.serializeDate(value)}`;
    }

    if (value instanceof Uint8Array) {
      return `${key} ${this.serializeBinary(value)}`;
    }

    if (Array.isArray(value)) {
      // Check if table-eligible
      const tableCandidate = this.checkTableCandidate(value);
      if (tableCandidate.isTable && tableCandidate.rows.length > 0) {
        this.indentLevel++;
        const tableStr = this.serializeTable(tableCandidate);
        this.indentLevel--;
        return `${key} ${tableStr}`;
      }

      // Simple array - space separated
      const allSimple = value.every(
        item =>
          item === null ||
          typeof item === 'boolean' ||
          typeof item === 'number' ||
          (typeof item === 'string' && !this.needsQuoting(item))
      );

      if (allSimple && value.length > 0) {
        const items = value.map(item => this.serializeValue(item)).join(' ');
        return `${key} ${items}`;
      }

      // Array of objects - inline syntax
      if (this.isArrayOfSimpleObjects(value)) {
        this.indentLevel++;
        const arrayStr = this.serializeArrayOfInlineObjects(value as SoonObject[]);
        this.indentLevel--;
        return `${key}${arrayStr}`;
      }

      // Complex array
      if (value.length === 0) {
        return `${key}`;
      }

      const items = value.map(item => this.serializeValue(item)).join(' ');
      return `${key} ${items}`;
    }

    if (typeof value === 'object') {
      // Nested object
      this.indentLevel++;
      const objStr = this.serializeObject(value as SoonObject, false);
      this.indentLevel--;
      return `${key}${objStr}`;
    }

    return `${key} ${String(value)}`;
  }

  private isSimpleObject(obj: SoonObject): boolean {
    const keys = Object.keys(obj);
    if (keys.length > 4) return false;

    return keys.every(key => {
      const value = obj[key];
      return (
        value === null ||
        typeof value === 'boolean' ||
        typeof value === 'number' ||
        (typeof value === 'string' && !this.needsQuoting(value))
      );
    });
  }

  private getIndent(): string {
    return this.indentStr.repeat(this.indentLevel);
  }
}

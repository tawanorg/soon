/**
 * SOON - Streamable Object Notation Optimized
 * Main API entry point
 */

import { Lexer } from './lexer';
import { Parser } from './parser';
import { Evaluator } from './evaluator';
import { Serializer } from './serializer';
import {
  SoonValue,
  ParserOptions,
  SerializerOptions,
  SoonError,
} from './types';

/**
 * Parse SOON string to JavaScript value
 */
export function parse(source: string, options?: ParserOptions): SoonValue {
  try {
    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens, options);
    const ast = parser.parse();
    const evaluator = new Evaluator();
    return evaluator.evaluate(ast);
  } catch (error) {
    if (error instanceof SoonError) {
      throw error;
    }
    throw new SoonError(
      error instanceof Error ? error.message : String(error),
      0,
      0,
      source
    );
  }
}

/**
 * Serialize JavaScript value to SOON string
 */
export function stringify(value: SoonValue, options?: SerializerOptions): string {
  const serializer = new Serializer(options);
  return serializer.serialize(value);
}

/**
 * Validate SOON syntax without fully parsing
 */
export function validate(source: string): { valid: boolean; error?: SoonError } {
  try {
    parse(source);
    return { valid: true };
  } catch (error) {
    if (error instanceof SoonError) {
      return { valid: false, error };
    }
    return {
      valid: false,
      error: new SoonError(
        error instanceof Error ? error.message : String(error),
        0,
        0,
        source
      ),
    };
  }
}

/**
 * Convert JSON to SOON
 */
export function fromJSON(json: string, options?: SerializerOptions): string {
  const value = JSON.parse(json);
  return stringify(value, options);
}

/**
 * Convert SOON to JSON
 */
export function toJSON(soon: string, options?: ParserOptions): string {
  const value = parse(soon, options);
  return JSON.stringify(value, null, 2);
}

// Re-export types and classes
export * from './types';
export { Lexer } from './lexer';
export { Parser } from './parser';
export { Evaluator } from './evaluator';
export { Serializer } from './serializer';

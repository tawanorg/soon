/**
 * Core SOON type definitions
 */

/**
 * Valid SOON value types
 */
export type SoonValue =
  | null
  | boolean
  | number
  | string
  | Date
  | Uint8Array
  | SoonArray
  | SoonObject;

export interface SoonArray extends Array<SoonValue> {}

export interface SoonObject {
  [key: string]: SoonValue;
}


/**
 * Token types for lexical analysis
 */
export enum TokenType {
  // Literals
  NULL = 'NULL',
  BOOLEAN = 'BOOLEAN',
  NUMBER = 'NUMBER',
  STRING = 'STRING',
  DATE = 'DATE',
  BINARY = 'BINARY',

  // Identifiers
  IDENTIFIER = 'IDENTIFIER',

  // Delimiters
  COLON = 'COLON', // :
  OPEN_BRACE = 'OPEN_BRACE', // {
  CLOSE_BRACE = 'CLOSE_BRACE', // }
  OPEN_BRACKET = 'OPEN_BRACKET', // [
  CLOSE_BRACKET = 'CLOSE_BRACKET', // ]
  PIPE = 'PIPE', // |

  // Special
  ANCHOR = 'ANCHOR', // &name
  REFERENCE = 'REFERENCE', // *name
  TYPE_HINT = 'TYPE_HINT', // <type>
  NEWLINE = 'NEWLINE',
  INDENT = 'INDENT',
  DEDENT = 'DEDENT',
  EOF = 'EOF',
  COMMENT = 'COMMENT',
}

/**
 * Token with position information for error reporting
 */
export interface Token {
  type: TokenType;
  value: string;
  line: number;
  column: number;
  raw?: string; // Original text including quotes/escapes
}

/**
 * Position in source text
 */
export interface Position {
  line: number;
  column: number;
  offset: number;
}

/**
 * Abstract Syntax Tree node types
 */
export enum ASTNodeType {
  ROOT = 'ROOT',
  OBJECT = 'OBJECT',
  ARRAY = 'ARRAY',
  PROPERTY = 'PROPERTY',
  LITERAL = 'LITERAL',
  ANCHOR_DEF = 'ANCHOR_DEF',
  ANCHOR_REF = 'ANCHOR_REF',
  TYPE_HINT = 'TYPE_HINT',
}

/**
 * Base AST Node
 */
export interface ASTNode {
  type: ASTNodeType;
  position: Position;
}

export interface RootNode extends ASTNode {
  type: ASTNodeType.ROOT;
  body: ASTNode[];
}

export interface ObjectNode extends ASTNode {
  type: ASTNodeType.OBJECT;
  properties: PropertyNode[];
}

export interface ArrayNode extends ASTNode {
  type: ASTNodeType.ARRAY;
  elements: ASTNode[];
}

export interface PropertyNode extends ASTNode {
  type: ASTNodeType.PROPERTY;
  key: string;
  value: ASTNode;
}

export interface LiteralNode extends ASTNode {
  type: ASTNodeType.LITERAL;
  value: SoonValue;
  valueType: 'null' | 'boolean' | 'number' | 'string' | 'date' | 'binary';
}

export interface AnchorDefNode extends ASTNode {
  type: ASTNodeType.ANCHOR_DEF;
  name: string;
  value: ASTNode;
}

export interface AnchorRefNode extends ASTNode {
  type: ASTNodeType.ANCHOR_REF;
  name: string;
}

export interface TypeHintNode extends ASTNode {
  type: ASTNodeType.TYPE_HINT;
  hint: string;
  value: ASTNode;
}

/**
 * Parser options
 */
export interface ParserOptions {
  /** Allow duplicate keys (last wins) */
  allowDuplicateKeys?: boolean;
  /** Maximum nesting depth */
  maxDepth?: number;
  /** Strict mode (no type coercion) */
  strict?: boolean;
  /** Enable streaming mode */
  streaming?: boolean;
}

/**
 * Serializer options
 */
export interface SerializerOptions {
  /** Indentation (spaces) */
  indent?: number;
  /** Sort object keys */
  sortKeys?: boolean;
  /** Minimize whitespace */
  compact?: boolean;
  /** Use explicit type hints */
  explicitTypes?: boolean;
}

/**
 * Parse error with context
 */
export class SoonError extends Error {
  constructor(
    message: string,
    public readonly line: number,
    public readonly column: number,
    public readonly source?: string
  ) {
    super(message);
    this.name = 'SoonError';
    Object.setPrototypeOf(this, SoonError.prototype);
  }

  public toString(): string {
    const location = `at line ${this.line}, column ${this.column}`;
    if (this.source) {
      const lines = this.source.split('\n');
      const errorLine = lines[this.line - 1];
      const pointer = ' '.repeat(this.column - 1) + '^';
      return `${this.name}: ${this.message} ${location}\n${errorLine}\n${pointer}`;
    }
    return `${this.name}: ${this.message} ${location}`;
  }
}


/**
 * Streaming chunk event
 */
export interface SoonChunk {
  id?: string;
  data: SoonValue;
}


/**
 * Stream parser events
 */
export interface StreamEvents {
  chunk: (chunk: SoonChunk) => void;
  end: () => void;
  error: (error: SoonError) => void;
}

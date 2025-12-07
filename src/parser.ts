/**
 * SOON v2 Parser - Indentation-based parsing
 * No braces required - whitespace defines structure
 */

import {
  Token,
  TokenType,
  SoonError,
  ASTNode,
  RootNode,
  ObjectNode,
  ArrayNode,
  PropertyNode,
  LiteralNode,
  ASTNodeType,
  ParserOptions,
  Position,
  SoonValue,
} from './types';

export class Parser {
  private tokens: Token[];
  private current: number = 0;
  private depth: number = 0;
  private options: Required<ParserOptions>;

  constructor(tokens: Token[], options: ParserOptions = {}) {
    this.tokens = tokens;
    this.options = {
      allowDuplicateKeys: options.allowDuplicateKeys ?? false,
      maxDepth: options.maxDepth ?? 100,
      strict: options.strict ?? false,
      streaming: options.streaming ?? false,
    };
  }

  /**
   * Parse tokens into AST
   */
  public parse(): RootNode {
    const body: ASTNode[] = [];

    // Skip initial newlines
    this.skipNewlines();

    while (!this.isAtEnd()) {
      if (this.match(TokenType.EOF)) break;

      const node = this.parseTopLevel();
      if (node) {
        body.push(node);
      }

      this.skipNewlines();
    }

    // If single object, return it directly in body
    // Otherwise wrap multiple top-level items
    return {
      type: ASTNodeType.ROOT,
      position: { line: 1, column: 1, offset: 0 },
      body,
    };
  }

  private parseTopLevel(): ASTNode | null {
    this.skipNewlines();

    if (this.isAtEnd()) return null;

    // Check for streaming chunk
    if (this.check(TokenType.PIPE)) {
      return this.parseStreamingChunk();
    }

    // Parse key-value line
    if (this.check(TokenType.IDENTIFIER)) {
      return this.parseKeyValue();
    }

    // Parse literal value
    return this.parseLiteral();
  }

  /**
   * Parse a key-value pair
   * Syntax variations:
   * - `key value` -> simple key-value
   * - `key value1 value2 value3` -> key with array value
   * - `key` followed by INDENT -> key with nested object
   * - `key col1 col2 col3` followed by INDENT with rows -> table
   */
  private parseKeyValue(): PropertyNode {
    const keyToken = this.advance(); // consume identifier
    const key = keyToken.value;

    // Check what follows
    const lineTokens = this.collectLineTokens();

    // Case 1: Key alone on line, followed by INDENT = nested object
    if (lineTokens.length === 0 && this.check(TokenType.INDENT)) {
      this.advance(); // consume INDENT
      const value = this.parseIndentedBlock();
      return this.createProperty(keyToken, key, value);
    }

    // Case 2: Key with values on same line
    if (lineTokens.length > 0) {
      // Check if this is a table (has INDENT with data rows after)
      if (this.checkAhead(TokenType.NEWLINE, TokenType.INDENT)) {
        // Could be table or array of inline objects

        // If first value contains colon, it's array of inline objects
        if (this.hasInlineColon(lineTokens)) {
          const firstRow = this.parseInlineObject(lineTokens);
          this.skipNewlines();

          if (this.check(TokenType.INDENT)) {
            this.advance(); // consume INDENT
            const rows = this.parseArrayOfInlineObjects(firstRow);
            return this.createProperty(keyToken, key, rows);
          }

          // Single inline object
          return this.createProperty(keyToken, key, firstRow);
        }

        // Check if this looks like table headers (all identifiers)
        if (this.allIdentifiers(lineTokens)) {
          this.skipNewlines();
          if (this.check(TokenType.INDENT)) {
            this.advance(); // consume INDENT
            const table = this.parseTable(lineTokens);
            return this.createProperty(keyToken, key, table);
          }
        }
      }

      // Simple array or single value
      const value = this.parseLineValues(lineTokens);
      return this.createProperty(keyToken, key, value);
    }

    // Key with no value - treat as null or empty object marker
    return this.createProperty(keyToken, key, this.createLiteralNode(null, 'null', keyToken));
  }

  /**
   * Collect all tokens on the current line (until NEWLINE or EOF)
   */
  private collectLineTokens(): Token[] {
    const tokens: Token[] = [];
    while (
      !this.isAtEnd() &&
      !this.check(TokenType.NEWLINE) &&
      !this.check(TokenType.INDENT) &&
      !this.check(TokenType.DEDENT) &&
      !this.check(TokenType.EOF)
    ) {
      tokens.push(this.advance());
    }
    return tokens;
  }

  /**
   * Check if tokens contain inline colon syntax (key:value pairs)
   */
  private hasInlineColon(tokens: Token[]): boolean {
    for (let i = 0; i < tokens.length - 1; i++) {
      if (tokens[i + 1]?.type === TokenType.COLON) {
        return true;
      }
    }
    return tokens.some(t => t.type === TokenType.COLON);
  }

  /**
   * Check if all tokens are identifiers (for table header detection)
   */
  private allIdentifiers(tokens: Token[]): boolean {
    return tokens.every(t => t.type === TokenType.IDENTIFIER);
  }

  /**
   * Parse an indented block as an object
   */
  private parseIndentedBlock(): ObjectNode {
    this.depth++;
    this.checkDepth();

    const properties: PropertyNode[] = [];
    const seenKeys = new Set<string>();

    while (!this.check(TokenType.DEDENT) && !this.isAtEnd()) {
      this.skipNewlines();

      if (this.check(TokenType.DEDENT) || this.isAtEnd()) break;

      if (this.check(TokenType.IDENTIFIER)) {
        const prop = this.parseKeyValue();

        if (!this.options.allowDuplicateKeys && seenKeys.has(prop.key)) {
          throw this.error(`Duplicate key: ${prop.key}`, this.previous());
        }
        seenKeys.add(prop.key);
        properties.push(prop);
      } else {
        // Skip unexpected tokens
        this.advance();
      }

      this.skipNewlines();
    }

    // Consume DEDENT if present
    if (this.check(TokenType.DEDENT)) {
      this.advance();
    }

    this.depth--;

    return {
      type: ASTNodeType.OBJECT,
      position: { line: 0, column: 0, offset: 0 },
      properties,
    };
  }

  /**
   * Parse inline object from tokens: `name:Alice age:25`
   */
  private parseInlineObject(tokens: Token[]): ObjectNode {
    const properties: PropertyNode[] = [];
    let i = 0;

    while (i < tokens.length) {
      const keyToken = tokens[i];
      if (keyToken.type !== TokenType.IDENTIFIER) {
        i++;
        continue;
      }

      // Expect colon
      if (i + 1 < tokens.length && tokens[i + 1].type === TokenType.COLON) {
        i += 2; // skip key and colon

        // Get value
        if (i < tokens.length) {
          const valueToken = tokens[i];
          const value = this.tokenToLiteral(valueToken);
          properties.push(this.createProperty(keyToken, keyToken.value, value));
          i++;
        }
      } else {
        i++;
      }
    }

    return {
      type: ASTNodeType.OBJECT,
      position: this.getPosition(tokens[0] || this.peek()),
      properties,
    };
  }

  /**
   * Parse array of inline objects from indented block
   */
  private parseArrayOfInlineObjects(firstRow: ObjectNode): ArrayNode {
    const elements: ASTNode[] = [firstRow];

    while (!this.check(TokenType.DEDENT) && !this.isAtEnd()) {
      this.skipNewlines();
      if (this.check(TokenType.DEDENT) || this.isAtEnd()) break;

      const lineTokens = this.collectLineTokens();
      if (lineTokens.length > 0 && this.hasInlineColon(lineTokens)) {
        elements.push(this.parseInlineObject(lineTokens));
      }

      this.skipNewlines();
    }

    if (this.check(TokenType.DEDENT)) {
      this.advance();
    }

    return {
      type: ASTNodeType.ARRAY,
      position: { line: 0, column: 0, offset: 0 },
      elements,
    };
  }

  /**
   * Parse table data (headers already collected)
   * Each indented row becomes an object with header keys
   */
  private parseTable(headerTokens: Token[]): ArrayNode {
    const headers = headerTokens.map(t => t.value);
    const elements: ASTNode[] = [];

    while (!this.check(TokenType.DEDENT) && !this.isAtEnd()) {
      this.skipNewlines();
      if (this.check(TokenType.DEDENT) || this.isAtEnd()) break;

      const rowTokens = this.collectLineTokens();
      if (rowTokens.length > 0) {
        const rowObj = this.createTableRow(headers, rowTokens);
        elements.push(rowObj);
      }

      this.skipNewlines();
    }

    if (this.check(TokenType.DEDENT)) {
      this.advance();
    }

    return {
      type: ASTNodeType.ARRAY,
      position: this.getPosition(headerTokens[0]),
      elements,
    };
  }

  /**
   * Create object from table row
   */
  private createTableRow(headers: string[], valueTokens: Token[]): ObjectNode {
    const properties: PropertyNode[] = [];

    for (let i = 0; i < headers.length && i < valueTokens.length; i++) {
      const key = headers[i];
      const valueToken = valueTokens[i];
      const value = this.tokenToLiteral(valueToken);

      properties.push({
        type: ASTNodeType.PROPERTY,
        position: this.getPosition(valueToken),
        key,
        value,
      });
    }

    return {
      type: ASTNodeType.OBJECT,
      position: this.getPosition(valueTokens[0] || this.peek()),
      properties,
    };
  }

  /**
   * Parse values from line tokens
   * Single value -> LiteralNode
   * Multiple values -> ArrayNode
   */
  private parseLineValues(tokens: Token[]): ASTNode {
    if (tokens.length === 0) {
      return this.createLiteralNode(null, 'null', this.peek());
    }

    if (tokens.length === 1) {
      return this.tokenToLiteral(tokens[0]);
    }

    // Multiple values = array
    const elements = tokens.map(t => this.tokenToLiteral(t));
    return {
      type: ASTNodeType.ARRAY,
      position: this.getPosition(tokens[0]),
      elements,
    } as ArrayNode;
  }

  /**
   * Convert a single token to a LiteralNode
   */
  private tokenToLiteral(token: Token): LiteralNode {
    let value: SoonValue;
    let valueType: LiteralNode['valueType'];

    switch (token.type) {
      case TokenType.NULL:
        value = null;
        valueType = 'null';
        break;

      case TokenType.BOOLEAN:
        value = token.value === 'true';
        valueType = 'boolean';
        break;

      case TokenType.NUMBER:
        value =
          token.value.includes('.') ||
          token.value.includes('e') ||
          token.value.includes('E')
            ? parseFloat(token.value)
            : parseInt(token.value, 10);
        valueType = 'number';
        break;

      case TokenType.DATE:
        value = new Date(token.value);
        if (isNaN(value.getTime())) {
          throw this.error(`Invalid date: ${token.value}`, token);
        }
        valueType = 'date';
        break;

      case TokenType.STRING:
      case TokenType.IDENTIFIER:
      default:
        value = token.value;
        valueType = 'string';
        break;
    }

    return this.createLiteralNode(value, valueType, token);
  }

  private createLiteralNode(
    value: SoonValue,
    valueType: LiteralNode['valueType'],
    token: Token
  ): LiteralNode {
    return {
      type: ASTNodeType.LITERAL,
      position: this.getPosition(token),
      value,
      valueType,
    };
  }

  private createProperty(keyToken: Token, key: string, value: ASTNode): PropertyNode {
    return {
      type: ASTNodeType.PROPERTY,
      position: this.getPosition(keyToken),
      key,
      value,
    };
  }

  private parseStreamingChunk(): ASTNode {
    this.advance(); // consume |
    // Skip optional chunk ID
    if (this.check(TokenType.IDENTIFIER)) {
      this.advance();
    }
    if (this.check(TokenType.PIPE)) {
      this.advance(); // consume closing |
    }

    this.skipNewlines();

    if (this.check(TokenType.INDENT)) {
      this.advance();
      return this.parseIndentedBlock();
    }

    return this.parseTopLevel() || this.createLiteralNode(null, 'null', this.peek());
  }

  private parseLiteral(): LiteralNode {
    const token = this.advance();
    return this.tokenToLiteral(token);
  }

  private checkDepth(): void {
    if (this.depth >= this.options.maxDepth) {
      throw this.error(
        `Maximum nesting depth exceeded: ${this.options.maxDepth}`,
        this.peek()
      );
    }
  }

  private skipNewlines(): void {
    while (this.match(TokenType.NEWLINE)) {}
  }

  private match(...types: TokenType[]): boolean {
    for (const type of types) {
      if (this.check(type)) {
        this.advance();
        return true;
      }
    }
    return false;
  }

  private check(type: TokenType): boolean {
    if (this.current >= this.tokens.length) return false;
    return this.peek().type === type;
  }

  private checkAhead(...types: TokenType[]): boolean {
    let pos = this.current;

    // Skip current newlines
    while (pos < this.tokens.length && this.tokens[pos].type === TokenType.NEWLINE) {
      pos++;
    }

    for (const type of types) {
      if (pos >= this.tokens.length) return false;
      if (this.tokens[pos].type !== type) return false;
      pos++;
    }

    return true;
  }

  private advance(): Token {
    if (this.current < this.tokens.length) this.current++;
    return this.previous();
  }

  private isAtEnd(): boolean {
    return this.current >= this.tokens.length || this.peek().type === TokenType.EOF;
  }

  private peek(): Token {
    if (this.current >= this.tokens.length) {
      return { type: TokenType.EOF, value: '', line: 0, column: 0 };
    }
    return this.tokens[this.current];
  }

  private previous(): Token {
    return this.tokens[Math.max(0, this.current - 1)];
  }

  private getPosition(token: Token): Position {
    return {
      line: token.line,
      column: token.column,
      offset: 0,
    };
  }

  private error(message: string, token: Token): SoonError {
    return new SoonError(message, token.line, token.column);
  }
}

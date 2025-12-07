/**
 * SOON v2 Lexer - Indentation-based tokenization
 * Optimized for whitespace-only structure (no braces/brackets required)
 */

import { Token, TokenType, SoonError } from './types';

export class Lexer {
  private source: string;
  private position: number = 0;
  private line: number = 1;
  private column: number = 1;
  private indentStack: number[] = [0];
  private pendingDedents: number = 0;
  private atLineStart: boolean = true;

  constructor(source: string) {
    this.source = source;
  }

  /**
   * Tokenize entire source into token array
   */
  public tokenize(): Token[] {
    const tokens: Token[] = [];
    let token: Token | null;

    while ((token = this.nextToken()) !== null) {
      if (token.type !== TokenType.COMMENT) {
        tokens.push(token);
      }
      if (token.type === TokenType.EOF) break;
    }

    return tokens;
  }

  /**
   * Get next token from source
   */
  public nextToken(): Token | null {
    // Emit pending dedents first
    if (this.pendingDedents > 0) {
      this.pendingDedents--;
      return this.createToken(TokenType.DEDENT, '');
    }

    // Handle line start indentation
    if (this.atLineStart) {
      this.atLineStart = false;
      const indentToken = this.handleIndentation();
      if (indentToken) return indentToken;
    }

    this.skipInlineWhitespace();

    if (this.isAtEnd()) {
      // Emit remaining dedents at EOF
      if (this.indentStack.length > 1) {
        this.indentStack.pop();
        return this.createToken(TokenType.DEDENT, '');
      }
      return this.createToken(TokenType.EOF, '');
    }

    const char = this.peek();

    // Comments
    if (char === '#') {
      return this.scanComment();
    }

    // Newlines
    if (char === '\n') {
      this.advance();
      this.line++;
      this.column = 1;
      this.atLineStart = true;
      return this.createToken(TokenType.NEWLINE, '\n');
    }

    // Skip carriage return
    if (char === '\r') {
      this.advance();
      return this.nextToken();
    }

    // Colon - only used for inline key:value pairs
    if (char === ':') {
      return this.createToken(TokenType.COLON, this.advance());
    }

    // Streaming chunk markers
    if (char === '|') {
      return this.createToken(TokenType.PIPE, this.advance());
    }

    // Quoted string
    if (char === '"') {
      return this.scanQuotedString();
    }

    // Numbers (including negative)
    if (this.isDigit(char) || (char === '-' && this.isDigit(this.peekNext()))) {
      return this.scanNumber();
    }

    // Identifiers, keywords, and unquoted strings
    if (this.isIdentifierStart(char) || char === '-' || char === '/' || char === '.') {
      return this.scanWord();
    }

    throw this.error(`Unexpected character: '${char}'`);
  }

  /**
   * Handle indentation at line start
   * Returns INDENT, DEDENT, or null (same level)
   */
  private handleIndentation(): Token | null {
    let indent = 0;

    // Count spaces at line start
    while (this.peek() === ' ') {
      indent++;
      this.advance();
    }

    // Skip empty lines and comment-only lines
    if (this.peek() === '\n' || this.peek() === '#' || this.isAtEnd()) {
      return null;
    }

    const currentIndent = this.indentStack[this.indentStack.length - 1];

    if (indent > currentIndent) {
      // Deeper indentation - push new level
      this.indentStack.push(indent);
      return this.createToken(TokenType.INDENT, ' '.repeat(indent));
    } else if (indent < currentIndent) {
      // Shallower indentation - may need multiple dedents
      while (
        this.indentStack.length > 1 &&
        this.indentStack[this.indentStack.length - 1] > indent
      ) {
        this.indentStack.pop();
        this.pendingDedents++;
      }

      // Emit first dedent, rest will be emitted in subsequent calls
      if (this.pendingDedents > 0) {
        this.pendingDedents--;
        return this.createToken(TokenType.DEDENT, '');
      }
    }

    // Same indentation level - no token needed
    return null;
  }

  private scanComment(): Token {
    this.advance(); // skip #
    let text = '';
    while (!this.isAtEnd() && this.peek() !== '\n') {
      text += this.advance();
    }
    return this.createToken(TokenType.COMMENT, text.trim());
  }

  private scanQuotedString(): Token {
    this.advance(); // skip opening "
    let value = '';
    let raw = '"';

    while (!this.isAtEnd() && this.peek() !== '"') {
      if (this.peek() === '\\') {
        raw += this.advance();
        if (this.isAtEnd()) break;
        const escaped = this.advance();
        raw += escaped;
        value += this.handleEscape(escaped);
      } else if (this.peek() === '\n') {
        throw this.error('Unterminated string (newline in string)');
      } else {
        const char = this.advance();
        raw += char;
        value += char;
      }
    }

    if (this.isAtEnd()) {
      throw this.error('Unterminated string');
    }

    this.advance(); // skip closing "
    raw += '"';

    const token = this.createToken(TokenType.STRING, value);
    token.raw = raw;
    return token;
  }

  private handleEscape(char: string): string {
    switch (char) {
      case 'n': return '\n';
      case 't': return '\t';
      case 'r': return '\r';
      case '"': return '"';
      case '\\': return '\\';
      default: return char;
    }
  }

  private scanNumber(): Token {
    let text = '';

    // Optional negative sign
    if (this.peek() === '-') {
      text += this.advance();
    }

    // Integer part
    while (this.isDigit(this.peek())) {
      text += this.advance();
    }

    // Decimal part
    if (this.peek() === '.' && this.isDigit(this.peekNext())) {
      text += this.advance(); // .
      while (this.isDigit(this.peek())) {
        text += this.advance();
      }
    }

    // Scientific notation
    if (this.peek() === 'e' || this.peek() === 'E') {
      text += this.advance();
      if (this.peek() === '+' || this.peek() === '-') {
        text += this.advance();
      }
      while (this.isDigit(this.peek())) {
        text += this.advance();
      }
    }

    // If followed by word char, treat as identifier/string
    if (this.isWordChar(this.peek())) {
      while (this.isWordChar(this.peek())) {
        text += this.advance();
      }
      return this.createToken(TokenType.STRING, text);
    }

    return this.createToken(TokenType.NUMBER, text);
  }

  private scanWord(): Token {
    let text = '';

    // Scan word characters (more permissive for SOON v2)
    while (this.isWordChar(this.peek())) {
      text += this.advance();
    }

    // Check for keywords
    if (text === 'true' || text === 'false') {
      return this.createToken(TokenType.BOOLEAN, text);
    }
    if (text === 'null') {
      return this.createToken(TokenType.NULL, text);
    }

    // Check for ISO date pattern (basic detection)
    if (this.isISODate(text)) {
      return this.createToken(TokenType.DATE, text);
    }

    // Could be identifier or string value - parser will determine
    return this.createToken(TokenType.IDENTIFIER, text);
  }

  private isISODate(text: string): boolean {
    // Basic ISO 8601 patterns
    // YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS or YYYY-MM-DDTHH:MM:SSZ
    return /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:\d{2})?)?$/.test(text);
  }

  private skipInlineWhitespace(): void {
    // Only skip spaces and tabs, NOT newlines
    while (!this.isAtEnd()) {
      const char = this.peek();
      if (char === ' ' || char === '\t') {
        this.advance();
      } else {
        break;
      }
    }
  }

  private isDigit(char: string): boolean {
    return char >= '0' && char <= '9';
  }

  private isIdentifierStart(char: string): boolean {
    return (char >= 'a' && char <= 'z') ||
           (char >= 'A' && char <= 'Z') ||
           char === '_';
  }

  private isWordChar(char: string): boolean {
    // SOON v2: More permissive - allows paths, emails, URLs, etc.
    return (char >= 'a' && char <= 'z') ||
           (char >= 'A' && char <= 'Z') ||
           (char >= '0' && char <= '9') ||
           char === '_' ||
           char === '-' ||
           char === '.' ||
           char === '/' ||
           char === '@' ||
           char === '+';
  }

  private peek(): string {
    if (this.isAtEnd()) return '\0';
    return this.source[this.position];
  }

  private peekNext(): string {
    if (this.position + 1 >= this.source.length) return '\0';
    return this.source[this.position + 1];
  }

  private advance(): string {
    const char = this.source[this.position];
    this.position++;
    this.column++;
    return char;
  }

  private isAtEnd(): boolean {
    return this.position >= this.source.length;
  }

  private createToken(type: TokenType, value: string): Token {
    return {
      type,
      value,
      line: this.line,
      column: Math.max(1, this.column - value.length),
    };
  }

  private error(message: string): SoonError {
    return new SoonError(message, this.line, this.column, this.source);
  }
}

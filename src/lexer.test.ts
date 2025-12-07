import { describe, it, expect } from 'vitest';
import { Lexer } from './lexer';
import { TokenType } from './types';

describe('Lexer', () => {
  it('should tokenize basic literals', () => {
    const lexer = new Lexer('true false null 42 3.14');
    const tokens = lexer.tokenize();

    expect(tokens[0].type).toBe(TokenType.BOOLEAN);
    expect(tokens[0].value).toBe('true');
    expect(tokens[1].type).toBe(TokenType.BOOLEAN);
    expect(tokens[1].value).toBe('false');
    expect(tokens[2].type).toBe(TokenType.NULL);
    expect(tokens[2].value).toBe('null');
    expect(tokens[3].type).toBe(TokenType.NUMBER);
    expect(tokens[3].value).toBe('42');
    expect(tokens[4].type).toBe(TokenType.NUMBER);
    expect(tokens[4].value).toBe('3.14');
  });

  it('should tokenize strings', () => {
    const lexer = new Lexer('hello "world with spaces" test-value');
    const tokens = lexer.tokenize();

    expect(tokens[0].type).toBe(TokenType.IDENTIFIER);
    expect(tokens[0].value).toBe('hello');
    expect(tokens[1].type).toBe(TokenType.STRING);
    expect(tokens[1].value).toBe('world with spaces');
    expect(tokens[2].type).toBe(TokenType.IDENTIFIER);
    expect(tokens[2].value).toBe('test-value');
  });

  it('should handle escape sequences', () => {
    const lexer = new Lexer('"line1\\nline2\\ttab\\\\"');
    const tokens = lexer.tokenize();

    expect(tokens[0].type).toBe(TokenType.STRING);
    expect(tokens[0].value).toBe('line1\nline2\ttab\\');
  });

  it('should tokenize colons', () => {
    const lexer = new Lexer('name:value key:123');
    const tokens = lexer.tokenize();

    expect(tokens[0].type).toBe(TokenType.IDENTIFIER);
    expect(tokens[0].value).toBe('name');
    expect(tokens[1].type).toBe(TokenType.COLON);
    expect(tokens[2].type).toBe(TokenType.IDENTIFIER);
    expect(tokens[2].value).toBe('value');
  });

  it('should tokenize pipes for streaming', () => {
    const lexer = new Lexer('|chunk1| |data|');
    const tokens = lexer.tokenize();

    expect(tokens[0].type).toBe(TokenType.PIPE);
    expect(tokens[1].type).toBe(TokenType.IDENTIFIER);
    expect(tokens[2].type).toBe(TokenType.PIPE);
  });

  it('should skip comments', () => {
    const lexer = new Lexer('key:value # this is a comment');
    const tokens = lexer.tokenize().filter(t => t.type !== TokenType.COMMENT);

    expect(tokens.length).toBe(4); // IDENTIFIER, COLON, IDENTIFIER, EOF
  });

  it('should track line and column numbers', () => {
    const lexer = new Lexer('line1\nline2');
    const tokens = lexer.tokenize();

    expect(tokens[0].line).toBe(1);
    expect(tokens[1].line).toBe(2);
  });

  it('should handle scientific notation', () => {
    const lexer = new Lexer('1.5e10 2E-5');
    const tokens = lexer.tokenize();

    expect(tokens[0].type).toBe(TokenType.NUMBER);
    expect(tokens[0].value).toBe('1.5e10');
    expect(tokens[1].type).toBe(TokenType.NUMBER);
    expect(tokens[1].value).toBe('2E-5');
  });

  it('should handle indentation', () => {
    const lexer = new Lexer('parent\n  child value');
    const tokens = lexer.tokenize();

    expect(tokens[0].type).toBe(TokenType.IDENTIFIER);
    expect(tokens[0].value).toBe('parent');
    expect(tokens[1].type).toBe(TokenType.NEWLINE);
    expect(tokens[2].type).toBe(TokenType.INDENT);
    expect(tokens[3].type).toBe(TokenType.IDENTIFIER);
  });

  it('should handle dedentation', () => {
    const lexer = new Lexer('parent\n  child\nsibling');
    const tokens = lexer.tokenize();

    const dedentTokens = tokens.filter(t => t.type === TokenType.DEDENT);
    expect(dedentTokens.length).toBeGreaterThan(0);
  });
});

import { describe, it, expect } from 'vitest';
import { Lexer } from './lexer';
import { Parser } from './parser';
import { ASTNodeType } from './types';

describe('Parser', () => {
  it('should parse literals', () => {
    const lexer = new Lexer('true');
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();

    expect(ast.type).toBe(ASTNodeType.ROOT);
    expect(ast.body.length).toBe(1);
    expect(ast.body[0].type).toBe(ASTNodeType.LITERAL);
  });

  it('should parse key-value pairs', () => {
    const source = `name John
age 30`;
    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();

    expect(ast.body.length).toBe(2);
    expect(ast.body[0].type).toBe(ASTNodeType.PROPERTY);
    const prop = ast.body[0] as any;
    expect(prop.key).toBe('name');
  });

  it('should parse nested objects with indentation', () => {
    const source = `user
  name John
  age 30`;
    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();

    expect(ast.body[0].type).toBe(ASTNodeType.PROPERTY);
    const prop = ast.body[0] as any;
    expect(prop.key).toBe('user');
    expect(prop.value.type).toBe(ASTNodeType.OBJECT);
    expect(prop.value.properties.length).toBe(2);
  });

  it('should parse arrays as space-separated values', () => {
    const source = `tags web mobile api`;
    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();

    expect(ast.body[0].type).toBe(ASTNodeType.PROPERTY);
    const prop = ast.body[0] as any;
    expect(prop.key).toBe('tags');
    expect(prop.value.type).toBe(ASTNodeType.ARRAY);
    expect(prop.value.elements.length).toBe(3);
  });

  it('should parse deeply nested structures', () => {
    const source = `user
  profile
    address
      city NYC`;
    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();

    expect(ast.body[0].type).toBe(ASTNodeType.PROPERTY);
    const user = ast.body[0] as any;
    expect(user.value.properties[0].value.properties[0].value.properties[0].key).toBe('city');
  });

  it('should handle maximum depth', () => {
    // Create deeply nested structure
    const source = `a
  b
    c
      d
        e
          f 1`;
    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens, { maxDepth: 3 });

    expect(() => parser.parse()).toThrow();
  });
});

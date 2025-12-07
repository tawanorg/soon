/**
 * SOON Evaluator - Converts AST to JavaScript values
 * Handles anchor resolution and type coercion
 */

import {
  ASTNode,
  ASTNodeType,
  RootNode,
  ObjectNode,
  ArrayNode,
  PropertyNode,
  LiteralNode,
  AnchorDefNode,
  AnchorRefNode,
  SoonValue,
  SoonObject,
  SoonError,
} from './types';

export class Evaluator {
  private anchors: Map<string, SoonValue> = new Map();

  /**
   * Evaluate AST to JavaScript value
   */
  public evaluate(node: ASTNode): SoonValue {
    switch (node.type) {
      case ASTNodeType.ROOT:
        return this.evaluateRoot(node as RootNode);
      case ASTNodeType.OBJECT:
        return this.evaluateObject(node as ObjectNode);
      case ASTNodeType.ARRAY:
        return this.evaluateArray(node as ArrayNode);
      case ASTNodeType.LITERAL:
        return this.evaluateLiteral(node as LiteralNode);
      case ASTNodeType.ANCHOR_DEF:
        return this.evaluateAnchorDef(node as AnchorDefNode);
      case ASTNodeType.ANCHOR_REF:
        return this.evaluateAnchorRef(node as AnchorRefNode);
      default:
        throw new SoonError(
          `Unknown AST node type: ${(node as any).type}`,
          node.position.line,
          node.position.column
        );
    }
  }

  private evaluateRoot(node: RootNode): SoonValue {
    if (node.body.length === 0) {
      return null;
    }

    if (node.body.length === 1) {
      return this.evaluate(node.body[0]);
    }

    // Multiple top-level nodes -> object
    const result: SoonObject = {};
    for (const child of node.body) {
      if (child.type === ASTNodeType.PROPERTY) {
        const prop = child as PropertyNode;
        result[prop.key] = this.evaluate(prop.value);
      } else if (child.type === ASTNodeType.ANCHOR_DEF) {
        const anchor = child as AnchorDefNode;
        result[anchor.name] = this.evaluate(anchor.value);
      } else {
        // Non-property at root level, use index
        const index = node.body.indexOf(child);
        result[String(index)] = this.evaluate(child);
      }
    }
    return result;
  }

  private evaluateObject(node: ObjectNode): SoonObject {
    const result: SoonObject = {};

    for (const prop of node.properties) {
      const value = this.evaluate(prop.value);
      result[prop.key] = value;
    }

    return result;
  }

  private evaluateArray(node: ArrayNode): SoonValue[] {
    return node.elements.map(element => this.evaluate(element));
  }

  private evaluateLiteral(node: LiteralNode): SoonValue {
    return node.value;
  }

  private evaluateAnchorDef(node: AnchorDefNode): SoonValue {
    const value = this.evaluate(node.value);
    this.anchors.set(node.name, value);
    return value;
  }

  private evaluateAnchorRef(node: AnchorRefNode): SoonValue {
    const value = this.anchors.get(node.name);
    if (value === undefined) {
      throw new SoonError(
        `Undefined anchor: ${node.name}`,
        node.position.line,
        node.position.column
      );
    }
    // Deep clone to prevent mutation
    return this.deepClone(value);
  }

  private deepClone(value: SoonValue): SoonValue {
    if (value === null || typeof value !== 'object') {
      return value;
    }

    if (value instanceof Date) {
      return new Date(value);
    }

    if (value instanceof Uint8Array) {
      return new Uint8Array(value);
    }

    if (Array.isArray(value)) {
      return value.map(item => this.deepClone(item));
    }

    const result: SoonObject = {};
    for (const [key, val] of Object.entries(value)) {
      result[key] = this.deepClone(val);
    }
    return result;
  }
}

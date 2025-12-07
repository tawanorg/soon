/**
 * SOON Streaming Parser
 * Parses SOON incrementally for large documents and streaming APIs
 */

import { EventEmitter } from 'events';
import { Lexer } from '../lexer';
import { Parser } from '../parser';
import { Evaluator } from '../evaluator';
import {
  SoonChunk,
  SoonError,
  ParserOptions,
  StreamEvents,
} from '../types';

/**
 * Streaming SOON parser
 * Parses chunks as they arrive, emitting events
 */
export class StreamParser extends EventEmitter {
  private buffer: string = '';
  private chunkId: number = 0;
  private options: ParserOptions;
  private ended: boolean = false;

  constructor(options: ParserOptions = {}) {
    super();
    this.options = { ...options, streaming: true };
  }

  /**
   * Write data to the parser
   */
  public write(data: string): void {
    if (this.ended) {
      throw new Error('Cannot write to ended stream');
    }

    this.buffer += data;
    this.processBuffer();
  }

  /**
   * End the stream
   */
  public end(): void {
    if (this.ended) return;
    this.ended = true;

    // Process any remaining buffer
    if (this.buffer.trim().length > 0) {
      this.processBuffer(true);
    }

    this.emit('end');
  }

  private processBuffer(force: boolean = false): void {
    // Look for complete chunks (delimited by |chunk|)
    const chunkPattern = /\|([^|]*)\|([^|]+?)(?=\||$)/g;
    let match;
    let lastIndex = 0;

    while ((match = chunkPattern.exec(this.buffer)) !== null) {
      const [fullMatch, id, content] = match;
      lastIndex = match.index + fullMatch.length;

      try {
        const lexer = new Lexer(content);
        const tokens = lexer.tokenize();
        const parser = new Parser(tokens, this.options);
        const ast = parser.parse();
        const evaluator = new Evaluator();
        const data = evaluator.evaluate(ast);

        const chunk: SoonChunk = {
          id: id || String(this.chunkId++),
          data,
        };

        this.emit('chunk', chunk);
      } catch (error) {
        if (error instanceof SoonError) {
          this.emit('error', error);
        } else {
          this.emit('error', new SoonError(
            error instanceof Error ? error.message : String(error),
            0,
            0
          ));
        }
      }
    }

    // Remove processed data from buffer
    if (lastIndex > 0) {
      this.buffer = this.buffer.slice(lastIndex);
    }

    // If forcing (end of stream), try to parse remaining buffer
    if (force && this.buffer.trim().length > 0) {
      try {
        const lexer = new Lexer(this.buffer);
        const tokens = lexer.tokenize();
        const parser = new Parser(tokens, this.options);
        const ast = parser.parse();
        const evaluator = new Evaluator();
        const data = evaluator.evaluate(ast);

        const chunk: SoonChunk = {
          id: String(this.chunkId++),
          data,
        };

        this.emit('chunk', chunk);
        this.buffer = '';
      } catch (error) {
        // Ignore incomplete data at end
        if (!(error instanceof SoonError)) {
          this.emit('error', new SoonError(
            error instanceof Error ? error.message : String(error),
            0,
            0
          ));
        }
      }
    }
  }

  /**
   * Type-safe event listener
   */
  public on<K extends keyof StreamEvents>(
    event: K,
    listener: StreamEvents[K]
  ): this {
    return super.on(event, listener as any);
  }

  /**
   * Type-safe event emitter
   */
  public emit<K extends keyof StreamEvents>(
    event: K,
    ...args: Parameters<StreamEvents[K]>
  ): boolean {
    return super.emit(event, ...args);
  }
}

/**
 * Create a streaming parser
 */
export function createStreamParser(options?: ParserOptions): StreamParser {
  return new StreamParser(options);
}

/**
 * Parse a stream (async iterator)
 */
export async function parseStream(
  stream: AsyncIterable<string>,
  options?: ParserOptions
): Promise<SoonChunk[]> {
  const parser = new StreamParser(options);
  const chunks: SoonChunk[] = [];

  return new Promise((resolve, reject) => {
    parser.on('chunk', chunk => chunks.push(chunk));
    parser.on('error', reject);
    parser.on('end', () => resolve(chunks));

    (async () => {
      try {
        for await (const data of stream) {
          parser.write(data);
        }
        parser.end();
      } catch (error) {
        reject(error);
      }
    })();
  });
}

// Re-export streaming types
export { SoonChunk, StreamEvents } from '../types';

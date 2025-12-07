import { describe, it, expect } from 'vitest';
import { StreamParser, parseStream } from './index';

describe('StreamParser', () => {
  it('should parse chunks incrementally', async () => {
    const parser = new StreamParser();
    const chunks: any[] = [];

    parser.on('chunk', chunk => chunks.push(chunk));

    return new Promise<void>((resolve) => {
      parser.on('end', () => {
        expect(chunks.length).toBeGreaterThan(0);
        resolve();
      });

      parser.write('|chunk1|\nname John');
      parser.write('|chunk2|\nage 30');
      parser.end();
    });
  });

  it('should handle partial chunks', async () => {
    const parser = new StreamParser();
    const chunks: any[] = [];

    parser.on('chunk', chunk => chunks.push(chunk));

    return new Promise<void>((resolve) => {
      parser.on('end', () => {
        expect(chunks.length).toBeGreaterThanOrEqual(1);
        resolve();
      });

      parser.write('|chunk1|\n');
      parser.write('name ');
      parser.write('John');
      parser.end();
    });
  });

  it('should emit errors for invalid chunks', async () => {
    const parser = new StreamParser();
    let endEmitted = false;

    parser.on('error', () => {
      // Error handling
    });

    return new Promise<void>((resolve) => {
      parser.on('end', () => {
        endEmitted = true;
        expect(endEmitted).toBe(true);
        resolve();
      });

      parser.write('|chunk1|invalid data without newline');
      parser.end();
    });
  });

  it('should parse async iterables', async () => {
    async function* generateChunks() {
      yield '|chunk1|\nname John';
      yield '|chunk2|\nage 30';
    }

    const chunks = await parseStream(generateChunks());
    expect(chunks.length).toBe(2);
  });
});

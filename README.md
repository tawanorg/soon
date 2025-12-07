# SOON - Streamable Object Notation Optimized

A modern, token-efficient serialization format optimized for LLM applications, streaming APIs, and human readability.

## Features

- **Token Efficient** - ~10-50% fewer tokens than JSON, reducing LLM API costs
- **Streaming-First** - Parse incrementally without buffering entire documents
- **Human-Friendly** - Clean, readable indentation-based syntax
- **Type-Safe** - Full TypeScript support with strict type definitions
- **Zero Dependencies** - Lightweight and fast

## Installation

**From GitHub Packages:**
```bash
npm install @tawanorg/soon
```

**From npm:**
```bash
npm install @tawanjs/soon
```

## Quick Start

```typescript
import { parse, stringify } from '@tawanorg/soon';

// Parse SOON to JavaScript
const config = parse(`
name my-app
version 1.0.0
debug true
settings
  timeout 30
  retries 3
`);

// Serialize JavaScript to SOON
const soon = stringify({
  name: 'my-app',
  version: '1.0.0',
  features: ['auth', 'api', 'database']
});
```

## Syntax

### Key-Value Pairs

```
name John
age 30
active true
```

### Nested Objects (Indentation-Based)

```
user
  name John
  profile
    city NYC
    country USA
```

### Arrays (Space-Separated)

```
tags web mobile api
numbers 1 2 3 4 5
```

### Inline Objects

```
users
  name:Alice age:25
  name:Bob age:30
```

### Tabular Data

```
users name   age city
  Alice  25  NYC
  Bob    30  LA
```

## API Reference

### `parse(source: string, options?: ParserOptions): SoonValue`

Parse a SOON string into a JavaScript value.

```typescript
const data = parse('name John\nage 30');
// { name: 'John', age: 30 }
```

**Options:**
- `allowDuplicateKeys` - Allow duplicate keys (default: false)
- `maxDepth` - Maximum nesting depth (default: 100)
- `strict` - Strict parsing mode (default: false)

### `stringify(value: SoonValue, options?: SerializerOptions): string`

Serialize a JavaScript value to SOON string.

```typescript
const soon = stringify({ name: 'John', age: 30 });
// name John
// age 30
```

**Options:**
- `indent` - Indentation spaces (default: 2)
- `sortKeys` - Sort object keys (default: false)
- `compact` - Minimize whitespace (default: false)

### `validate(source: string): { valid: boolean; error?: SoonError }`

Validate SOON syntax without fully parsing.

```typescript
const result = validate('name John');
if (result.valid) {
  console.log('Valid SOON');
}
```

### `fromJSON(json: string): string`

Convert JSON string to SOON.

```typescript
const soon = fromJSON('{"name":"John","age":30}');
```

### `toJSON(soon: string): string`

Convert SOON string to JSON.

```typescript
const json = toJSON('name John\nage 30');
```

## Streaming API

```typescript
import { StreamParser, parseStream } from '@tawanorg/soon/stream';

// Event-based streaming
const parser = new StreamParser();

parser.on('chunk', chunk => {
  console.log('Received:', chunk.data);
});

parser.on('end', () => {
  console.log('Stream complete');
});

parser.write('|chunk1|\nname John');
parser.write('|chunk2|\nage 30');
parser.end();

// Async iterator
async function* generateData() {
  yield '|chunk1|\nname John';
  yield '|chunk2|\nage 30';
}

const chunks = await parseStream(generateData());
```

## Why SOON?

### vs JSON

| Feature | JSON | SOON |
|---------|------|------|
| Token count | 100% | ~50-90% |
| Human readable | Medium | High |
| Streaming | No | Yes |
| Comments | No | Yes |

### vs YAML

| Feature | YAML | SOON |
|---------|------|------|
| Deterministic | No | Yes |
| Complexity | High | Low |
| Streaming | No | Yes |
| Error recovery | Poor | Good |

## TypeScript

Full TypeScript support included:

```typescript
import { SoonValue, SoonObject, SoonArray, SoonError } from '@tawanorg/soon';

const config: SoonObject = {
  name: 'MyApp',
  version: '1.0.0',
};
```

## License

MIT

# Development Guide

Comprehensive guide for contributors to the Lagoon MCP Server project.

## Table of Contents

- [Setup](#setup)
- [Architecture](#architecture)
- [Development Workflow](#development-workflow)
- [Testing](#testing)
- [Code Quality](#code-quality)
- [Contributing Guidelines](#contributing-guidelines)
- [Tool Development](#tool-development)
- [Troubleshooting](#troubleshooting)

---

## Setup

### Prerequisites

- **Node.js**: 18+ (20+ recommended)
- **pnpm**: 8+ (install via `npm install -g pnpm`)
- **TypeScript**: 5.x (installed as dev dependency)
- **GraphQL Backend**: Access to Lagoon API endpoint

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/lagoon-mcp.git
cd lagoon-mcp

# Install dependencies
npm install

# Build TypeScript
npm run build

# Run tests
npm test
```

### Environment Configuration

Create a `.env` file in the project root:

```bash
# GraphQL Backend
GRAPHQL_ENDPOINT=https://api.lagoon.finance/graphql

# Environment
NODE_ENV=development

# Logging (optional)
LOG_LEVEL=info
```

### IDE Setup

**VS Code** (recommended extensions):
- ESLint
- Prettier
- TypeScript and JavaScript Language Features

**Settings** (`.vscode/settings.json`):
```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.tsdk": "node_modules/typescript/lib"
}
```

---

## Architecture

### Project Structure

```
lagoon-mcp/
├── src/
│   ├── cache/           # Caching layer with TTL configuration
│   ├── config/          # Configuration management
│   ├── graphql/         # GraphQL client and queries
│   ├── prompts/         # MCP prompt templates
│   ├── resources/       # MCP resources (schema, glossary)
│   ├── tools/           # MCP tool implementations
│   ├── types/           # TypeScript type definitions
│   ├── utils/           # Shared utilities
│   └── server.ts        # MCP server entry point
├── tests/               # Test suites
├── docs/                # Documentation
└── package.json         # Project metadata
```

### Core Components

#### 1. MCP Server ([src/server.ts](../src/server.ts))

The main entry point using the modern `McpServer` API:

- **Tool Registration**: 12 tools with type-safe handlers
- **Resource Registration**: GraphQL schema, DeFi glossary
- **Prompt Registration**: Financial analysis guidance
- **Auto-capability Management**: Automatic capability detection

#### 2. Tool System ([src/tools/](../src/tools/))

Each tool follows this pattern:

```typescript
/**
 * Tool implementation with caching and validation
 */
export async function executeToolName(
  input: ToolNameInput
): Promise<CallToolResult> {
  try {
    // 1. Validate input (Zod schema)
    const validated = toolNameInputSchema.parse(input);

    // 2. Check cache
    const cached = cache.get<ResultType>(cacheKey);
    if (cached) return formatCached(cached);

    // 3. Execute query/logic
    const data = await graphqlClient.request(QUERY, variables);

    // 4. Process results
    const processed = processData(data);

    // 5. Cache results
    cache.set(cacheKey, processed, cacheTTL.toolName);

    // 6. Return formatted result
    return formatResult(processed);
  } catch (error) {
    return handleToolError(error, 'tool_name');
  }
}
```

**Key Design Patterns**:

- **Type Safety**: Zod schemas + TypeScript for input validation
- **Caching Strategy**: TTL-based caching with consistent key generation
- **Error Handling**: Centralized error handling with user-friendly messages
- **GraphQL Fragments**: Reusable fragments for consistent data fetching

#### 3. Type Safety System ([src/utils/tool-handler.ts](../src/utils/tool-handler.ts))

Eliminates unsafe type assertions with generic handlers:

```typescript
/**
 * Type-safe tool handler factory
 */
export function createToolHandler<TOutput, TInput = TOutput>(
  handler: (input: TOutput) => Promise<CallToolResult>,
  schema: ZodSchema<TOutput, any, TInput>
): (args: unknown) => Promise<CallToolResult>
```

**Benefits**:
- Runtime validation via Zod
- Compile-time type safety via TypeScript
- Handles schemas with default values correctly
- Consistent error formatting

#### 4. Caching System ([src/cache/index.ts](../src/cache/index.ts))

In-memory caching with intelligent TTL configuration:

**TTL Selection Criteria**:
1. **Data Volatility**: Frequency of underlying data changes
2. **User Expectations**: Expected data freshness
3. **API Load Impact**: Balance between freshness and performance
4. **Data Type**: Static vs dynamic vs user-specific

**Cache Key Patterns**:
```typescript
// Entity-based
vault:${address}:${chainId}

// User-specific
portfolio:${userAddress}

// Query-based
search:${filterHash}
transactions:${address}:${chainId}:${filterHash}:${pagination}

// Static
schema:latest
```

#### 5. GraphQL Client ([src/graphql/client.ts](../src/graphql/client.ts))

Configured with:
- Retry logic (3 attempts, exponential backoff)
- Timeout handling (30 seconds)
- Error transformation
- Health check endpoint

---

## Development Workflow

### Adding a New Tool

1. **Create Tool File** (`src/tools/my-tool.ts`):

```typescript
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { graphqlClient } from '../graphql/client.js';
import { myToolInputSchema, MyToolInput } from '../utils/validators.js';
import { handleToolError } from '../utils/tool-error-handler.js';
import { cache, cacheTTL } from '../cache/index.js';

const MY_TOOL_QUERY = `
  query MyToolQuery($param: String!) {
    data(param: $param) {
      field1
      field2
    }
  }
`;

export async function executeMyTool(input: MyToolInput): Promise<CallToolResult> {
  try {
    const validated = myToolInputSchema.parse(input);

    const cacheKey = `my_tool:${validated.param}`;
    const cached = cache.get<DataType>(cacheKey);
    if (cached) {
      return {
        content: [{ type: 'text', text: formatResult(cached) }],
        isError: false,
      };
    }

    const data = await graphqlClient.request(MY_TOOL_QUERY, {
      param: validated.param,
    });

    cache.set(cacheKey, data, cacheTTL.myTool);

    return {
      content: [{ type: 'text', text: formatResult(data) }],
      isError: false,
    };
  } catch (error) {
    return handleToolError(error, 'my_tool');
  }
}
```

2. **Add Validation Schema** (`src/utils/validators.ts`):

```typescript
export const myToolInputSchema = z.object({
  param: z.string().min(1, 'Parameter required'),
  optionalParam: z.number().optional(),
});

export type MyToolInput = z.infer<typeof myToolInputSchema>;
```

3. **Register in Server** (`src/server.ts`):

```typescript
// Create handler
const myToolHandler = createToolHandler(executeMyTool, myToolInputSchema);

// Register tool
server.registerTool(
  'my_tool',
  {
    description: 'Detailed tool description with use cases',
    inputSchema: {
      param: myToolInputSchema.shape.param,
      optionalParam: myToolInputSchema.shape.optionalParam,
    },
  },
  myToolHandler
);
```

4. **Add to Tool Registry** (`src/tools/index.ts`):

```typescript
export const tools: Tool[] = [
  // ... existing tools
  {
    name: 'my_tool',
    description: 'Same description as server registration',
    inputSchema: zodToJsonSchema(myToolInputSchema) as Tool['inputSchema'],
  },
];

const toolHandlers: Record<string, (args: unknown) => Promise<CallToolResult>> = {
  // ... existing handlers
  my_tool: createToolHandler(executeMyTool, myToolInputSchema),
};
```

5. **Write Tests** (`tests/tools/my-tool.test.ts`):

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { executeMyTool } from '../../src/tools/my-tool.js';

describe('my_tool', () => {
  it('should validate input', async () => {
    const result = await executeMyTool({ param: '' });
    expect(result.isError).toBe(true);
  });

  it('should execute successfully', async () => {
    const result = await executeMyTool({ param: 'valid' });
    expect(result.isError).toBe(false);
  });
});
```

6. **Add Cache TTL** (`src/cache/index.ts`):

```typescript
export const cacheTTL = {
  // ... existing TTLs
  myTool: 600, // 10 minutes - explain selection criteria
} as const;
```

---

## Testing

### Test Structure

```
tests/
├── tools/              # Tool-specific unit tests
├── utils/              # Utility function tests
└── integration/        # End-to-end tests (future)
```

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
pnpm test tests/tools/my-tool.test.ts

# Watch mode
npm test:watch

# Coverage report
npm test:coverage
```

### Writing Tests

**Test Organization**:
```typescript
describe('tool_name', () => {
  describe('validation', () => {
    it('should reject invalid input', async () => {
      // Test validation errors
    });
  });

  describe('execution', () => {
    it('should return expected results', async () => {
      // Test successful execution
    });

    it('should handle errors gracefully', async () => {
      // Test error handling
    });
  });

  describe('caching', () => {
    it('should cache results', async () => {
      // Test caching behavior
    });
  });
});
```

**Best Practices**:
- Test validation edge cases
- Test error handling paths
- Mock external API calls when appropriate
- Test caching behavior
- Use descriptive test names

---

## Code Quality

### Quality Standards

Run all quality checks before committing:

```bash
# Run all checks
npm run check:all

# Individual checks
npm run lint          # ESLint
npm run format:check  # Prettier
npm run typecheck     # TypeScript
npm run test          # Vitest
```

### ESLint Configuration

**Key Rules**:
- TypeScript strict mode enabled
- No unsafe type assertions (`as never`)
- Consistent naming conventions
- Import ordering enforced

**Auto-fix**:
```bash
npm run lint:fix
```

### Prettier Configuration

**Style**:
- Single quotes
- 2-space indentation
- 100-character line length
- Trailing commas (ES5)
- Semicolons required

**Auto-format**:
```bash
npm run format:fix
```

### TypeScript Configuration

**Strict Mode**:
- `strict: true`
- `noUncheckedIndexedAccess: true`
- `noImplicitAny: true`
- `strictNullChecks: true`

### Pre-commit Checklist

- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes
- [ ] `npm run format:check` passes
- [ ] `npm run test` passes
- [ ] New code has tests
- [ ] Documentation updated

---

## Contributing Guidelines

### Git Workflow

1. **Branch Naming**:
   ```
   feature/tool-name
   fix/bug-description
   docs/update-readme
   refactor/improve-caching
   ```

2. **Commit Messages**:
   ```
   feat: Add vault comparison tool
   fix: Handle null values in price history
   docs: Update development guide
   refactor: Improve type safety in handlers
   test: Add tests for search-vaults
   ```

3. **Pull Request Process**:
   - Create feature branch from `main`
   - Make changes with clear commits
   - Run quality checks (`pnpm check:all`)
   - Create PR with description of changes
   - Wait for CI to pass
   - Request review
   - Address feedback
   - Merge when approved

### Code Review Guidelines

**What Reviewers Look For**:
- Type safety (no `as never` assertions)
- Input validation with Zod
- Proper error handling
- Caching implementation
- Test coverage
- Documentation updates
- Consistent code style

---

## Tool Development

### Tool Categories

1. **Data Fetching Tools**: `get_vault_data`, `get_user_portfolio`
   - Focus on caching strategy
   - Handle pagination
   - Format for readability

2. **Search/Filter Tools**: `search_vaults`, `get_transactions`
   - Support advanced filtering
   - Implement efficient cache keys
   - Handle large result sets

3. **Analysis Tools**: `analyze_risk`, `predict_yield`
   - Computation-intensive operations
   - Longer cache TTLs
   - Clear methodology documentation

4. **Utility Tools**: `query_graphql`, `export_data`
   - Flexible interfaces
   - Minimal caching (or none)
   - Handle multiple output formats

### Performance Optimization

**Token Efficiency**:
- Use markdown tables for data
- Avoid verbose explanations
- Format numbers consistently
- Use emojis for visual indicators

**Query Optimization**:
- Use GraphQL fragments
- Request only needed fields
- Implement pagination
- Batch related queries

**Caching Strategy**:
- Choose appropriate TTLs
- Use consistent cache keys
- Handle cache invalidation
- Monitor cache hit rates

---

## Troubleshooting

### Common Issues

#### TypeScript Errors

**Issue**: `Type 'X' is not assignable to type 'Y'`

**Solution**: Check Zod schema types match handler function types. Ensure using `createToolHandler` correctly.

#### Build Failures

**Issue**: `TS2345: Argument of type...`

**Solution**: Run `pnpm typecheck` for detailed errors. Common causes:
- Missing type exports
- Incorrect generic parameters
- Schema/type mismatches

#### Test Failures

**Issue**: Tests fail unexpectedly

**Solution**: Check for:
- API endpoint availability
- Cache state contamination
- Mock data accuracy
- Async timing issues

#### Cache Issues

**Issue**: Stale data returned

**Solution**:
- Verify TTL configuration
- Check cache key generation
- Clear cache: `cache.flushAll()`

#### GraphQL Errors

**Issue**: Query fails with syntax error

**Solution**:
- Validate query syntax
- Check field availability in schema
- Verify variable types
- Test query in GraphQL playground

### Debug Mode

Enable detailed logging:

```bash
# In .env
LOG_LEVEL=debug

# Or via environment variable
LOG_LEVEL=debug pnpm dev
```

### Getting Help

- **Issues**: GitHub Issues for bugs and feature requests
- **Discussions**: GitHub Discussions for questions
- **Documentation**: Check `/docs` for guides
- **Code**: Reference existing tools as examples

---

## Additional Resources

- [MCP SDK Documentation](https://github.com/anthropics/model-context-protocol)
- [Zod Documentation](https://zod.dev/)
- [GraphQL Best Practices](https://graphql.org/learn/best-practices/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Vitest Documentation](https://vitest.dev/)

---

## License

This project follows the main repository license. See [LICENSE](../LICENSE) for details.

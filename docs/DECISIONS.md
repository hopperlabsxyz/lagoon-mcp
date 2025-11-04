# Lagoon MCP - Key Technical Decisions

## Architecture Decisions Record (ADR)

This document records all major technical decisions made during the planning phase of the Lagoon MCP project.

---

## Decision 1: TypeScript Over Python

**Status**: Accepted

**Context**:
- MCP SDK available in both Python and TypeScript
- Backend is built with NestJS (TypeScript)
- Team has existing TypeScript expertise
- Need to integrate with GraphQL API

**Decision**:
Use TypeScript for MCP implementation.

**Rationale**:
1. **Type Sharing**: Can auto-generate TypeScript types from GraphQL schema
2. **Team Expertise**: Development team already proficient in TypeScript
3. **Tooling**: Best-in-class GraphQL libraries (graphql-request, graphql-codegen)
4. **Consistency**: Matches backend stack for easier debugging and contributions
5. **Type Safety**: End-to-end type safety from GraphQL → MCP → Claude

**Consequences**:
- ✅ Faster development with existing knowledge
- ✅ Better type safety throughout stack
- ✅ Can share type definitions if needed
- ⚠️ Slightly more complex build setup than Python
- ⚠️ Requires TypeScript compilation step

**Alternatives Considered**:
- Python: Simpler for data processing, but less type-safe and team unfamiliar

---

## Decision 2: Data Retrieval Focus (Not Report Generation)

**Status**: Accepted

**Context**:
- MCP could either provide raw data or generate formatted reports
- Claude is excellent at data analysis and report formatting
- Report formats highly variable based on user needs
- Adding report generation increases complexity significantly

**Decision**:
MCP focuses solely on data retrieval; Claude handles all report generation.

**Rationale**:
1. **Separation of Concerns**: MCP = data access, Claude = analysis/presentation
2. **Flexibility**: Users can request any report format they want
3. **Simpler Implementation**: Reduces MCP complexity by 40-50%
4. **Faster Development**: Can ship MVP 2-3 weeks earlier
5. **Claude's Strengths**: Leverages Claude's natural abilities in data analysis
6. **Maintainability**: Easier to update data access than report templates

**Consequences**:
- ✅ Faster time to market (2-3 weeks saved)
- ✅ More flexible report formats
- ✅ Easier to maintain and extend
- ✅ Users get customized reports
- ⚠️ Higher Claude context usage
- ⚠️ Requires Claude to understand DeFi concepts (addressed with prompts)

**Alternatives Considered**:
- Full Report Generation: Would take 5-8 weeks to implement, less flexible
- Hybrid Approach: Complex, adds maintenance burden

---

## Decision 3: MCP Prompts Over Claude Skills

**Status**: Accepted

**Context**:
- Need to provide Claude with DeFi domain knowledge
- Claude Skills are user-installed marketplace capabilities
- MCP Prompts are server-provided guidance
- Both can embed knowledge and guide behavior

**Decision**:
Use MCP Prompts and Resources for domain knowledge, not Claude Skills.

**Rationale**:
1. **Architectural Fit**: Prompts are the MCP-native way to guide Claude
2. **Distribution**: Prompts come with the MCP, Skills are separate installs
3. **Simplicity**: One installation (MCP) vs two (MCP + Skill)
4. **Control**: Server controls prompt content vs user controls skills
5. **Integration**: Prompts can reference specific tools and resources

**Consequences**:
- ✅ Simpler user experience (one installation)
- ✅ Guaranteed availability (bundled with MCP)
- ✅ Server-controlled guidance content
- ✅ Tight integration with tools
- ⚠️ Cannot be shared across other MCPs (Skills can be)

**Alternatives Considered**:
- Claude Skills: Would require separate marketplace distribution, more complex for users

---

## Decision 4: In-Memory Caching with node-cache

**Status**: Accepted

**Context**:
- Need caching to reduce backend load and improve response times
- Vault data is relatively static (changes infrequently)
- MCP runs as single process per user
- Options: Redis (distributed), node-cache (in-memory), no caching

**Decision**:
Use node-cache for in-memory caching with TTL.

**Rationale**:
1. **Simplicity**: Zero setup, no additional infrastructure
2. **Performance**: Fastest possible cache access
3. **Sufficient**: Single-user MCP doesn't need distributed cache
4. **TTL Support**: Built-in TTL for automatic invalidation
5. **Resource Efficient**: Minimal memory footprint (max 1000 entries)

**Cache TTL Strategy**:
- Vault data: 15 minutes (relatively static)
- User portfolios: 5 minutes (more dynamic)
- Search results: 10 minutes (balance between freshness and performance)
- Performance data: 30 minutes (historical, less time-sensitive)
- Schema: 24 hours (rarely changes)

**Consequences**:
- ✅ Simple implementation
- ✅ Fast cache access
- ✅ No additional infrastructure needed
- ⚠️ Cache not shared across MCP instances
- ⚠️ Lost on MCP restart (acceptable for this use case)

**Alternatives Considered**:
- Redis: Overkill for single-user MCP, adds deployment complexity
- No Caching: Poor performance, unnecessary backend load

---

## Decision 5: graphql-request Over Apollo Client

**Status**: Accepted

**Context**:
- Need a GraphQL client for backend communication
- Options: Apollo Client (full-featured), graphql-request (lightweight), urql (middle ground)
- MCP doesn't need subscriptions, complex state management, or UI integrations

**Decision**:
Use graphql-request as the GraphQL client.

**Rationale**:
1. **Lightweight**: Only ~5KB vs Apollo's ~50KB+
2. **Simple API**: Perfect for server-side request/response pattern
3. **Type-Safe**: Works excellently with TypeScript
4. **No Overhead**: No cache, no subscriptions, no unnecessary features
5. **Fast**: Minimal abstraction over `fetch`

**Consequences**:
- ✅ Smaller bundle size
- ✅ Simpler codebase
- ✅ Faster execution
- ✅ Less to learn and maintain
- ⚠️ No built-in retry logic (implement manually if needed)
- ⚠️ No built-in caching (using node-cache instead)

**Alternatives Considered**:
- Apollo Client: Too heavyweight, designed for frontend apps
- urql: More features than needed, adds complexity

---

## Decision 6: NPM Distribution

**Status**: Accepted

**Context**:
- MCP needs to be distributed to users
- Options: npm, GitHub releases, manual installation
- Target users are developers familiar with npm

**Decision**:
Distribute via npm registry as `@yourorg/lagoon-mcp`.

**Rationale**:
1. **Familiar**: Developers already use npm daily
2. **Easy Updates**: `npm update` for new versions
3. **Versioning**: npm handles semantic versioning automatically
4. **Discovery**: Searchable on npmjs.com
5. **Standards**: Follows Node.js package conventions

**Distribution Flow**:
1. Local development/testing
2. GitHub repository for collaboration
3. npm publication for user installation
4. Users install via `npm install -g @yourorg/lagoon-mcp`

**Consequences**:
- ✅ Easy installation (`npm install -g`)
- ✅ Simple updates (`npm update -g`)
- ✅ Version management built-in
- ✅ Discoverable on npm
- ⚠️ Requires npm account and publication workflow

**Alternatives Considered**:
- GitHub Releases: Manual download, harder to update
- Docker: Overkill for a Node.js package

---

## Decision 7: Zod for Runtime Validation

**Status**: Accepted

**Context**:
- Need to validate tool inputs at runtime
- TypeScript provides compile-time types but no runtime validation
- Options: Zod, io-ts, class-validator, manual validation

**Decision**:
Use Zod for all tool input validation.

**Rationale**:
1. **Type Inference**: Automatically creates TypeScript types from schemas
2. **Excellent DX**: Clear error messages and intuitive API
3. **Lightweight**: Minimal runtime overhead
4. **Composable**: Easy to build complex validation schemas
5. **Community**: Large ecosystem and active maintenance

**Consequences**:
- ✅ Type-safe validation with inference
- ✅ Clear validation error messages
- ✅ Easy to maintain validation schemas
- ✅ Prevents invalid data from reaching handlers
- ⚠️ Adds small runtime overhead (negligible for this use case)

**Alternatives Considered**:
- io-ts: More functional, steeper learning curve
- class-validator: Requires classes, more boilerplate
- Manual validation: Error-prone, no type inference

---

## Decision 8: Vitest for Testing

**Status**: Accepted

**Context**:
- Need testing framework for TypeScript/ESM project
- Options: Jest, Vitest, Mocha, AVA
- Project uses modern ESM modules

**Decision**:
Use Vitest as the testing framework.

**Rationale**:
1. **ESM Native**: First-class ESM support (Jest requires configuration)
2. **Fast**: Uses Vite for instant module transformation
3. **Compatible**: Jest-like API for easy transition
4. **TypeScript**: Native TypeScript support
5. **Modern**: Built for modern JavaScript ecosystem

**Consequences**:
- ✅ Fast test execution
- ✅ No ESM configuration needed
- ✅ Great TypeScript support
- ✅ Familiar API (Jest-compatible)
- ⚠️ Smaller ecosystem than Jest (but growing rapidly)

**Alternatives Considered**:
- Jest: Requires complex ESM configuration
- Mocha: Requires more setup and plugins

---

## Decision 9: graphql-codegen for Type Generation

**Status**: Accepted

**Context**:
- Need TypeScript types that match backend GraphQL schema
- Options: Manual type writing, graphql-codegen, apollo cli
- Backend schema can change over time

**Decision**:
Use GraphQL Code Generator (@graphql-codegen) for automatic type generation.

**Rationale**:
1. **Auto-Generation**: Types generated from schema, not manually written
2. **Always in Sync**: Run `npm run codegen` when schema changes
3. **Zero Errors**: Generated types guaranteed to match schema
4. **Customizable**: Can configure scalar mappings (BigInt → string)
5. **Plugin Ecosystem**: Supports TypeScript operations, resolvers, etc.

**Configuration**:
```yaml
schema: 'http://localhost:3001/query'
generates:
  ./src/types/generated.ts:
    plugins:
      - 'typescript'
      - 'typescript-operations'
    config:
      scalars:
        BigInt: 'string'
        Address: 'string'
        Hex: 'string'
```

**Consequences**:
- ✅ Types always match backend schema
- ✅ Automatic updates when schema changes
- ✅ Catches breaking changes immediately
- ✅ Reduces manual work and errors
- ⚠️ Requires running codegen after schema updates

**Alternatives Considered**:
- Manual Types: Error-prone, out-of-sync risk
- Apollo CLI: Less flexible, more opinionated

---

## Decision 10: Stdio Transport for MCP

**Status**: Accepted

**Context**:
- MCP supports stdio and SSE (Server-Sent Events) transports
- stdio: Communication via stdin/stdout
- SSE: HTTP-based communication
- Claude Desktop uses stdio by default

**Decision**:
Use stdio transport for MCP communication.

**Rationale**:
1. **Claude Desktop Default**: Expected by Claude Desktop
2. **Simplicity**: No HTTP server needed
3. **Security**: Process-level isolation
4. **Performance**: Direct process communication
5. **Standard**: Recommended approach for local MCPs

**Consequences**:
- ✅ Works with Claude Desktop out of the box
- ✅ Simple implementation
- ✅ Secure by default
- ⚠️ Not accessible over network (not needed for this use case)

**Alternatives Considered**:
- SSE Transport: Would enable remote access, but not needed

---

## Decision 11: No Authentication in MCP

**Status**: Accepted

**Context**:
- Backend GraphQL API is public (no authentication)
- MCP runs locally on user's machine
- Could add API keys for future backend auth

**Decision**:
No authentication in MCP (matches backend).

**Rationale**:
1. **Backend Match**: Backend doesn't require auth
2. **Simplicity**: Reduces setup friction
3. **Local Execution**: MCP runs on user's machine
4. **Future-Proof**: Can add if backend adds auth later

**Consequences**:
- ✅ Simple setup (no API keys)
- ✅ Matches backend architecture
- ⚠️ Will need update if backend adds auth

**Alternatives Considered**:
- Add API Key Support: Premature, backend doesn't use it

---

## Decision 12: 5 Core Tools (MVP Scope)

**Status**: Accepted

**Context**:
- Could build 3-10+ tools for different use cases
- Need to balance coverage vs time to market
- Want to validate concept before building more

**Decision**:
MVP includes exactly 5 tools covering essential use cases.

**Tools**:
1. `query_graphql` - Power user direct query
2. `get_vault_data` - Vault details
3. `get_user_portfolio` - Portfolio analysis
4. `search_vaults` - Vault discovery
5. `get_vault_performance` - Historical analysis

**Rationale**:
1. **Coverage**: Covers 80% of common use cases
2. **Balanced**: Mix of simple and complex tools
3. **Validation**: Enough to validate MCP approach
4. **Achievable**: Can build in 4-5 weeks
5. **Extensible**: Easy to add more tools later

**Consequences**:
- ✅ Covers most use cases
- ✅ Achievable timeline
- ✅ Room for expansion
- ⚠️ Some advanced use cases require multiple tool calls

**Alternatives Considered**:
- 3 Tools: Insufficient coverage
- 10+ Tools: Too long to market, riskier

---

## Summary of Decisions

| Decision | Choice | Alternative(s) | Confidence |
|----------|--------|----------------|------------|
| Language | TypeScript | Python | High ✅ |
| Data vs Reports | Data Only | Full Reports | High ✅ |
| Knowledge System | MCP Prompts | Claude Skills | High ✅ |
| Caching | node-cache | Redis, None | High ✅ |
| GraphQL Client | graphql-request | Apollo Client | High ✅ |
| Distribution | npm | GitHub Releases | High ✅ |
| Validation | Zod | io-ts, class-validator | Medium ⚠️ |
| Testing | Vitest | Jest | Medium ⚠️ |
| Type Generation | graphql-codegen | Manual, Apollo CLI | High ✅ |
| Transport | stdio | SSE | High ✅ |
| Authentication | None | API Keys | High ✅ |
| Tool Count | 5 tools | 3-10 tools | Medium ⚠️ |

---

## Future Decision Points

Decisions to be made during implementation:

1. **Error Logging Strategy**: Where to log errors? (console.error vs file)
2. **Retry Logic**: Should failed GraphQL requests retry? How many times?
3. **Rate Limiting**: If backend adds rate limits, how to handle?
4. **Telemetry**: Should we collect anonymous usage stats?
5. **Advanced Features**: Streaming responses, query builder, exports?

---

## Revision History

| Date | Decision | Rationale |
|------|----------|-----------|
| 2025-11-04 | All decisions documented | Initial ADR creation |

This document will be updated as new decisions are made or existing decisions are revisited.

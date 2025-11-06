#!/bin/bash

echo "🚀 Running Lagoon MCP Integration Tests for Claude Desktop Compatibility"
echo "=================================================================="

# Exit on any error
set -e

# Build the project first
echo "📦 Building the project..."
npm run build

# Run integration tests
echo "🧪 Running integration tests..."
npx vitest run tests/integration/ --reporter=verbose

echo "✅ All integration tests completed!"
echo ""
echo "📋 Summary:"
echo "   - MCP Server startup and communication: ✓"
echo "   - Tool listing and schema validation: ✓"
echo "   - Tool execution capabilities: ✓"
echo ""
echo "🎉 Your MCP server is ready for Claude Desktop!"
echo ""
echo "📖 Next steps:"
echo "   1. Add this server to your Claude Desktop MCP configuration"
echo "   2. Configure any required environment variables (API keys, etc.)"
echo "   3. Test with real Claude Desktop client"
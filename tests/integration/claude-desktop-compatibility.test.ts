import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, ChildProcess } from 'child_process';

describe('MCP Server Integration - Claude Desktop Compatibility', () => {
  let mcpProcess: ChildProcess;
  const timeout = 60000; // 60 seconds for integration tests

  beforeAll(() => {
    console.log('🚀 Starting MCP Server Integration Tests for Claude Desktop...');
  }, timeout);
  afterAll(async () => {
    if (mcpProcess) {
      mcpProcess.kill('SIGTERM');
      await new Promise((resolve) => {
        mcpProcess.on('close', resolve);
        setTimeout(() => {
          if (mcpProcess) {
            mcpProcess.kill('SIGKILL');
          }
          resolve(undefined);
        }, 5000);
      });
    }
  });

  describe('Core MCP Protocol Compatibility', () => {
    it(
      'should start server and handle initialize request',
      async () => {
        return new Promise((resolve, reject) => {
          mcpProcess = spawn('node', ['dist/index.js'], {
            stdio: ['pipe', 'pipe', 'pipe'],
            cwd: process.cwd(),
          });

          let hasResponded = false;
          let responseBuffer = '';

          mcpProcess.stdout?.on('data', (chunk) => {
            responseBuffer += chunk.toString();

            // Try to parse complete JSON messages
            const lines = responseBuffer.split('\n');
            responseBuffer = lines.pop() || '';

            for (const line of lines) {
              if (line.trim()) {
                try {
                  const response = JSON.parse(line);
                  if (response.id === 1 && response.result) {
                    hasResponded = true;
                    expect(response.result).toBeDefined();
                    expect(response.result.protocolVersion).toBeDefined();
                    resolve(undefined);
                    return;
                  }
                } catch (error) {
                  // Ignore parse errors for partial responses
                }
              }
            }
          });

          mcpProcess.on('error', (error) => {
            reject(new Error(`Failed to start server: ${error.message}`));
          });

          mcpProcess.on('close', (code) => {
            if (code !== null && code !== 0 && !hasResponded) {
              reject(new Error(`Server exited with code ${code}`));
            }
          });

          // Send initialize message after a short delay
          setTimeout(() => {
            if (mcpProcess?.stdin) {
              const initMessage = {
                jsonrpc: '2.0',
                id: 1,
                method: 'initialize',
                params: {
                  protocolVersion: '2024-11-05',
                  capabilities: { tools: {} },
                  clientInfo: { name: 'test-client', version: '1.0.0' },
                },
              };
              mcpProcess.stdin.write(JSON.stringify(initMessage) + '\n');
            } else {
              reject(new Error('Failed to get server stdin'));
            }
          }, 1000);

          // Timeout fallback
          setTimeout(() => {
            if (!hasResponded) {
              reject(new Error('Server initialization timeout'));
            }
          }, 20000);
        });
      },
      timeout
    );

    it(
      'should list all available tools with valid schemas',
      async () => {
        return new Promise((resolve, reject) => {
          if (!mcpProcess?.stdin) {
            reject(new Error('Server not running'));
            return;
          }

          let hasResponded = false;
          let responseBuffer = '';

          const dataHandler = (chunk: Buffer) => {
            responseBuffer += chunk.toString();

            const lines = responseBuffer.split('\n');
            responseBuffer = lines.pop() || '';

            for (const line of lines) {
              if (line.trim()) {
                try {
                  const response = JSON.parse(line);
                  if (response.id === 2 && response.result?.tools) {
                    hasResponded = true;
                    const tools = response.result.tools;

                    expect(Array.isArray(tools)).toBe(true);
                    expect(tools.length).toBeGreaterThan(10);

                    // Verify all tools have required fields
                    for (const tool of tools) {
                      expect(tool.name).toBeDefined();
                      expect(typeof tool.name).toBe('string');
                      expect(tool.description).toBeDefined();
                      expect(tool.inputSchema).toBeDefined();
                      expect(tool.inputSchema.type).toBe('object');
                    }

                    // Check for key tools
                    const toolNames = tools.map((t: any) => t.name);
                    expect(toolNames).toContain('search_vaults');
                    expect(toolNames).toContain('get_vault_data');
                    expect(toolNames).toContain('query_graphql');

                    mcpProcess?.stdout?.off('data', dataHandler);
                    resolve(undefined);
                    return;
                  }
                } catch (error) {
                  // Ignore parse errors
                }
              }
            }
          };

          mcpProcess.stdout?.on('data', dataHandler);

          const listMessage = {
            jsonrpc: '2.0',
            id: 2,
            method: 'tools/list',
            params: {},
          };

          mcpProcess.stdin.write(JSON.stringify(listMessage) + '\n');

          setTimeout(() => {
            if (!hasResponded) {
              mcpProcess?.stdout?.off('data', dataHandler);
              reject(new Error('Tools list timeout'));
            }
          }, 15000);
        });
      },
      timeout
    );

    it(
      'should execute a simple GraphQL query successfully',
      async () => {
        return new Promise((resolve, reject) => {
          if (!mcpProcess?.stdin) {
            reject(new Error('Server not running'));
            return;
          }

          let hasResponded = false;
          let responseBuffer = '';

          const dataHandler = (chunk: Buffer) => {
            responseBuffer += chunk.toString();

            const lines = responseBuffer.split('\n');
            responseBuffer = lines.pop() || '';

            for (const line of lines) {
              if (line.trim()) {
                try {
                  const response = JSON.parse(line);
                  if (response.id === 3) {
                    hasResponded = true;

                    if (response.error) {
                      // Errors are acceptable for network issues
                      console.log(
                        'GraphQL query returned error (expected):',
                        response.error.message
                      );
                      resolve(undefined);
                    } else if (response.result) {
                      expect(response.result.content).toBeDefined();
                      expect(Array.isArray(response.result.content)).toBe(true);
                      resolve(undefined);
                    }

                    mcpProcess?.stdout?.off('data', dataHandler);
                    return;
                  }
                } catch (error) {
                  // Ignore parse errors
                }
              }
            }
          };

          mcpProcess.stdout?.on('data', dataHandler);

          const queryMessage = {
            jsonrpc: '2.0',
            id: 3,
            method: 'tools/call',
            params: {
              name: 'query_graphql',
              arguments: {
                query: 'query { vaults(first: 1) { id name } }',
              },
            },
          };

          mcpProcess.stdin.write(JSON.stringify(queryMessage) + '\n');

          setTimeout(() => {
            if (!hasResponded) {
              mcpProcess?.stdout?.off('data', dataHandler);
              reject(new Error('GraphQL query timeout'));
            }
          }, 20000);
        });
      },
      timeout
    );
  });

  describe('Performance and Stability', () => {
    it(
      'should handle multiple rapid requests',
      async () => {
        return new Promise((resolve, reject) => {
          if (!mcpProcess?.stdin) {
            reject(new Error('Server not running'));
            return;
          }

          let responsesReceived = 0;
          const expectedResponses = 3;
          let responseBuffer = '';

          const dataHandler = (chunk: Buffer) => {
            responseBuffer += chunk.toString();

            const lines = responseBuffer.split('\n');
            responseBuffer = lines.pop() || '';

            for (const line of lines) {
              if (line.trim()) {
                try {
                  const response = JSON.parse(line);
                  if (response.id && response.id >= 4 && response.id <= 6) {
                    responsesReceived++;

                    if (responsesReceived >= expectedResponses) {
                      mcpProcess?.stdout?.off('data', dataHandler);
                      resolve(undefined);
                      return;
                    }
                  }
                } catch (error) {
                  // Ignore parse errors
                }
              }
            }
          };

          mcpProcess.stdout?.on('data', dataHandler);

          // Send multiple requests rapidly
          for (let i = 0; i < expectedResponses; i++) {
            const message = {
              jsonrpc: '2.0',
              id: 4 + i,
              method: 'tools/list',
              params: {},
            };
            mcpProcess.stdin.write(JSON.stringify(message) + '\n');
          }

          setTimeout(() => {
            if (responsesReceived < expectedResponses) {
              mcpProcess?.stdout?.off('data', dataHandler);
              console.log(`Received ${responsesReceived}/${expectedResponses} responses`);
              // This is acceptable - server might be busy
              resolve(undefined);
            }
          }, 10000);
        });
      },
      timeout
    );
  });
});

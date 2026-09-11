import { McpServer } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import * as z from 'zod/v4';

const FORGE_URL = process.env.FORGE_URL || 'http://127.0.0.1:43117';
const FORGE_SECRET = process.env.FORGE_SECRET || '';
const VERSION = '1.2.0';

async function forge(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(FORGE_SECRET ? { 'x-forge-secret': FORGE_SECRET } : {}),
    ...(options.headers || {}),
  };
  const response = await fetch(`${FORGE_URL}${path}`, { ...options, headers });
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { text }; }
  if (!response.ok) throw new Error(data.error || `Forge HTTP ${response.status}`);
  return data;
}

function textResult(value) {
  return { content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }] };
}

function createServer() {
  const server = new McpServer({
    name: 'roblox-forge',
    version: VERSION,
  });

  server.registerTool('forge_health', {
    title: 'Forge Health',
    description: 'Read the complete ROBLOX FORGE bridge health, Studio heartbeat and managed process state.',
    annotations: { readOnlyHint: true, destructiveHint: false },
  }, async () => textResult(await forge('/api/health')));

  server.registerTool('project_info', {
    title: 'Project Info',
    description: 'Read the currently connected WORLDSHIFT project and Forge runtime information.',
    annotations: { readOnlyHint: true, destructiveHint: false },
  }, async () => textResult(await forge('/api/project')));

  server.registerTool('studio_state', {
    title: 'Studio State',
    description: 'Inspect the latest Roblox Studio snapshot: selection, active script, place identity and workspace structure.',
    annotations: { readOnlyHint: true, destructiveHint: false },
  }, async () => textResult(await forge('/api/studio/state')));

  server.registerTool('diagnostics', {
    title: 'Development Diagnostics',
    description: 'Run Forge diagnostics for Node.js, Rojo, Git, Codex, the WORLDSHIFT project and Studio Bridge.',
    annotations: { readOnlyHint: true, destructiveHint: false },
  }, async () => textResult(await forge('/api/diagnostics')));

  server.registerTool('read_project_file', {
    title: 'Read Project File',
    description: 'Read a UTF-8 file inside the connected WORLDSHIFT project. Paths are sandboxed to the project root.',
    inputSchema: z.object({ path: z.string().min(1).describe('Project-relative path') }),
    annotations: { readOnlyHint: true, destructiveHint: false },
  }, async ({ path }) => textResult(await forge('/api/project/file/read', { method: 'POST', body: JSON.stringify({ path }) })));

  server.registerTool('write_project_file', {
    title: 'Write Project File',
    description: 'Write a UTF-8 file inside the connected WORLDSHIFT project with optional optimistic concurrency protection.',
    inputSchema: z.object({
      path: z.string().min(1),
      content: z.string(),
      expectedSha256: z.string().optional(),
    }),
    annotations: { readOnlyHint: false, destructiveHint: true },
  }, async ({ path, content, expectedSha256 }) => textResult(await forge('/api/project/file/write', {
    method: 'POST',
    body: JSON.stringify({ path, content, expectedSha256 }),
  })));

  server.registerTool('forge_command', {
    title: 'Forge Command',
    description: 'Send an explicitly supported development command to the local Forge bridge.',
    inputSchema: z.object({
      type: z.enum(['ping', 'process_start', 'process_stop', 'process_input']),
      id: z.string().optional(),
      input: z.string().optional(),
    }),
    annotations: { readOnlyHint: false, destructiveHint: true },
  }, async ({ type, id, input }) => textResult(await forge('/api/command', {
    method: 'POST',
    body: JSON.stringify({ type, args: { id, input } }),
  })));

  return server;
}

serveStdio(createServer);
console.error(`[ROBLOX FORGE] MCP control plane ${VERSION} running against ${FORGE_URL}`);

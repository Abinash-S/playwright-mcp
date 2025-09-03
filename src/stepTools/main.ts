/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { startSession } from './startSession.js';
import { executeNext } from './executeNext.js';
import { retry } from './retry.js';
import { skip } from './skip.js';
import { status } from './status.js';
import { generateScript } from './generateScript.js';
import { Context } from './context.js';
import { toMcpTool } from './tool.js';
import * as mcpServer from '../mcp/server.js';
import { packageJSON } from '../utils/package.js';
import { BrowserServerBackend } from '../browserServerBackend.js';
import { contextFactory } from '../browserContextFactory.js';

import type { FullConfig } from '../config.js';
import type { Tool } from './tool.js';
import type { ServerBackend } from '../mcp/server.js';

export async function runStepTools(config: FullConfig) {
  // Ensure session saving is enabled
  if (!config.saveSession) {
    throw new Error('Step tools require session saving to be enabled. Use --save-session flag.');
  }

  const serverBackendFactory = {
    name: 'Playwright Step Tools',
    nameInConfig: 'playwright-steps',
    version: packageJSON.version,
    create: () => new StepToolsServerBackend(config)
  };
  await mcpServer.start(serverBackendFactory, config.server);
}

export class StepToolsServerBackend implements ServerBackend {
  private _config: FullConfig;
  private _context: Context | undefined;
  private _stepTools: Tool<any>[] = [startSession, executeNext, retry, skip, status, generateScript];
  private _browserBackend: BrowserServerBackend;

  constructor(config: FullConfig) {
    this._config = config;
    this._browserBackend = new BrowserServerBackend(config, contextFactory(config));
  }

  async initialize(server: mcpServer.Server, clientVersion: mcpServer.ClientVersion, roots: mcpServer.Root[]) {
    // Initialize browser backend for regular Playwright tools first
    await this._browserBackend.initialize(server, clientVersion, roots);
    
    // Initialize step tools context using the browser backend's session log
    const sessionLog = this._browserBackend.sessionLog;
    this._context = await Context.create(this._config, sessionLog);
  }

  async listTools(): Promise<mcpServer.Tool[]> {
    // Get step tools
    const stepTools = this._stepTools.map(tool => toMcpTool(tool.schema));
    
    // Get regular Playwright tools
    const browserTools = await this._browserBackend.listTools();
    
    // Combine both sets of tools
    return [...stepTools, ...browserTools];
  }

  async callTool(name: string, args: mcpServer.CallToolRequest['params']['arguments']): Promise<mcpServer.CallToolResult> {
    // Check if it's a step tool
    const stepTool = this._stepTools.find(tool => tool.schema.name === name);
    if (stepTool) {
      const parsedArguments = stepTool.schema.inputSchema.parse(args || {});
      return await stepTool.handle(this._context!, parsedArguments);
    }
    
    // Otherwise, delegate to browser backend for regular Playwright tools
    return await this._browserBackend.callTool(name, args);
  }

  serverClosed() {
    void this._context?.close();
    this._browserBackend.serverClosed();
  }
}

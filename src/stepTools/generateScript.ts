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

import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { defineTool } from './tool.js';

const generateScriptSchema = z.object({
  sessionId: z.string().describe('The ID of the session to generate script from'),
  outputFile: z.string().optional().describe('Optional output file path for the generated script'),
  includeComments: z.boolean().optional().default(true).describe('Whether to include comments in the generated script'),
  includeSnapshotActions: z.boolean().optional().default(false).describe('Whether to include snapshot actions in the script'),
});

export const generateScript = defineTool({
  schema: {
    name: 'step_generate_script',
    title: 'Generate Playwright script from session execution',
    description: 'Generate a clean Playwright script from successful session execution, filtering out retries and failed calls',
    inputSchema: generateScriptSchema,
    type: 'readOnly',
  },

  handle: async (context, params) => {
    try {
      const { sessionId, outputFile, includeComments, includeSnapshotActions } = params;
      
      // Try to get session from memory first
      let session = context.sessionLog.getStepSession(sessionId);
      
      // If not in memory, try to load from disk
      if (!session) {
        const sessionFolder = context.sessionLog.sessionFolder;
        const sessionFile = path.join(sessionFolder, `${sessionId}.steps.json`);
        
        if (fs.existsSync(sessionFile)) {
          const sessionData = await fs.promises.readFile(sessionFile, 'utf-8');
          session = JSON.parse(sessionData);
        } else {
          throw new Error(`Session ${sessionId} not found`);
        }
      }

      // Read the session.md log file to extract executed actions
      const sessionFolder = context.sessionLog.sessionFolder;
      const sessionLogFile = path.join(sessionFolder, 'session.md');
      
      if (!fs.existsSync(sessionLogFile)) {
        throw new Error(`Session log file not found: ${sessionLogFile}`);
      }

      const sessionLogContent = await fs.promises.readFile(sessionLogFile, 'utf-8');
      const script = await generatePlaywrightScript(sessionLogContent, session, includeComments, includeSnapshotActions);
      
      let outputMessage = '';
      
      if (outputFile) {
        // Write to file
        const resolvedOutputFile = path.resolve(outputFile);
        await fs.promises.writeFile(resolvedOutputFile, script);
        outputMessage = `\n\n**Script saved to:** ${resolvedOutputFile}`;
      }

      return {
        content: [
          {
            type: 'text',
            text: `### Generated Playwright Script\n\n` +
                  `**Session:** ${session.name || sessionId}\n` +
                  `**Total Actions:** ${script.split('\n').filter(line => line.trim().startsWith('await ')).length}\n` +
                  `**Generation Time:** ${new Date().toISOString()}\n` +
                  outputMessage + '\n\n' +
                  '```typescript\n' +
                  script +
                  '\n```'
          }
        ],
        isError: false,
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error generating script: ${error instanceof Error ? error.message : String(error)}`
          }
        ],
        isError: true,
      };
    }
  }
});

async function generatePlaywrightScript(
  sessionLogContent: string, 
  session: any, 
  includeComments: boolean,
  includeSnapshotActions: boolean
): Promise<string> {
  const lines: string[] = [];
  
  // Add script header
  lines.push(`import { test, expect } from '@playwright/test';`);
  lines.push('');
  
  if (includeComments && session.name) {
    lines.push(`// Generated from session: ${session.name}`);
    lines.push(`// Session ID: ${session.id}`);
    lines.push(`// Generated on: ${new Date().toISOString()}`);
    lines.push('');
  }
  
  lines.push(`test('${session.name || 'Generated Test'}', async ({ page }) => {`);
  
  // Parse the session log to extract successful tool calls
  const toolCalls = parseSessionLog(sessionLogContent);
  
  // Filter and process tool calls
  const successfulActions = filterSuccessfulActions(toolCalls, includeSnapshotActions);
  
  // Generate script lines from successful actions
  for (const action of successfulActions) {
    if (includeComments && action.description) {
      lines.push(`  // ${action.description}`);
    }
    
    // Add the actual Playwright code
    if (action.code) {
      const codeLines = action.code.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .map(line => `  ${line}`);
      lines.push(...codeLines);
    }
    lines.push('');
  }
  
  lines.push('});');
  
  return lines.join('\n');
}

interface ToolCall {
  toolName: string;
  args: Record<string, any>;
  code?: string;
  isError?: boolean;
  description?: string;
  timestamp?: number;
}

function parseSessionLog(content: string): ToolCall[] {
  const toolCalls: ToolCall[] = [];
  const sections = content.split('### Tool call:').slice(1); // Remove first empty section
  
  for (const section of sections) {
    const lines = section.split('\n');
    const toolName = lines[0].trim();
    
    let args: Record<string, any> = {};
    let code = '';
    let isError = false;
    
    // Parse the section
    let currentBlock = '';
    let inJsonBlock = false;
    let inCodeBlock = false;
    let jsonBuffer = '';
    let codeBuffer = '';
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      
      if (line.includes('- Args')) {
        currentBlock = 'args';
      } else if (line.includes('- Code')) {
        currentBlock = 'code';
      } else if (line.includes('- Error')) {
        isError = true;
        currentBlock = 'error';
      } else if (line.includes('- Result')) {
        currentBlock = 'result';
      } else if (line === '```json') {
        inJsonBlock = true;
        jsonBuffer = '';
      } else if (line === '```js' || line === '```') {
        if (currentBlock === 'code') {
          inCodeBlock = true;
          codeBuffer = '';
        } else if (inJsonBlock) {
          inJsonBlock = false;
          try {
            args = JSON.parse(jsonBuffer);
          } catch (e) {
            // Ignore parse errors
          }
        } else if (inCodeBlock) {
          inCodeBlock = false;
          code = codeBuffer.trim();
        }
      } else if (inJsonBlock) {
        jsonBuffer += line + '\n';
      } else if (inCodeBlock) {
        codeBuffer += line + '\n';
      }
    }
    
    if (toolName && !isError) {
      toolCalls.push({
        toolName,
        args,
        code,
        isError,
      });
    }
  }
  
  return toolCalls;
}

function filterSuccessfulActions(toolCalls: ToolCall[], includeSnapshotActions: boolean): ToolCall[] {
  const filtered: ToolCall[] = [];
  const seenActions = new Set<string>();
  
  for (const call of toolCalls) {
    // Skip error calls
    if (call.isError) {
      continue;
    }
    
    // Skip snapshot actions unless requested
    if (!includeSnapshotActions && call.toolName === 'browser_snapshot') {
      continue;
    }
    
    // Skip duplicate actions (handle retries)
    // Create a unique key for the action based on tool name and significant args
    const actionKey = createActionKey(call);
    if (seenActions.has(actionKey)) {
      continue;
    }
    
    // Only include actions that generate actual Playwright code
    if (call.code && call.code.trim() && call.code.includes('await ')) {
      seenActions.add(actionKey);
      filtered.push(call);
    }
  }
  
  return filtered;
}

function createActionKey(call: ToolCall): string {
  const { toolName, args } = call;
  
  // Create a normalized key based on the action type and target
  switch (toolName) {
    case 'browser_navigate':
      return `navigate:${args.url || ''}`;
    case 'browser_click':
      return `click:${args.ref || ''}:${args.element || ''}`;
    case 'browser_type':
      return `type:${args.ref || ''}:${args.element || ''}:${args.text || ''}`;
    case 'browser_fill_form':
      return `form:${JSON.stringify(args.fields || [])}`;
    case 'browser_select_option':
      return `select:${args.ref || ''}:${JSON.stringify(args.values || [])}`;
    case 'browser_press_key':
      return `key:${args.key || ''}`;
    case 'browser_wait_for':
      return `wait:${args.text || ''}:${args.time || ''}`;
    case 'browser_hover':
      return `hover:${args.ref || ''}:${args.element || ''}`;
    case 'browser_drag':
      return `drag:${args.startRef || ''}:${args.endRef || ''}`;
    case 'browser_file_upload':
      return `upload:${JSON.stringify(args.paths || [])}`;
    default:
      // For other actions, use tool name + serialized args
      return `${toolName}:${JSON.stringify(args)}`;
  }
}

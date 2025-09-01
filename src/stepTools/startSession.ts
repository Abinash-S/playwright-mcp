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

import { z } from 'zod';
import { defineTool } from './tool.js';

const startSessionSchema = z.object({
  steps: z.union([
    z.string().describe('Steps as markdown text or multiline string'),
    z.array(z.string()).describe('Steps as array of strings')
  ]).describe('The steps to execute, either as markdown/text or as an array of step descriptions'),
  name: z.string().optional().describe('Optional name for the session'),
  metadata: z.record(z.any()).optional().describe('Optional metadata for the session'),
});

export const startSession = defineTool({
  schema: {
    name: 'step_start_session',
    title: 'Start a new step-by-step automation session',
    description: 'Create a new session with a list of steps to execute sequentially. Steps can be provided as markdown text, multiline text, or an array of strings.',
    inputSchema: startSessionSchema,
    type: 'destructive',
  },

  handle: async (context, params) => {
    try {
      const session = await context.sessionLog.createStepSession(
        params.steps,
        params.name,
        params.metadata
      );

      const sessionInfo = {
        sessionId: session.id,
        name: session.name,
        status: session.status,
        totalSteps: session.steps.length,
        currentStepIndex: session.currentStepIndex,
        steps: session.steps.map((step: any) => ({
          id: step.id,
          description: step.description,
          status: step.status,
        })),
        createdAt: session.createdAt.toISOString(),
        metadata: session.metadata,
      };

      return {
        content: [
          {
            type: 'text',
            text: `### Session Created Successfully\n\n` +
                  `**Session ID:** ${session.id}\n` +
                  `**Name:** ${session.name || 'Unnamed'}\n` +
                  `**Total Steps:** ${session.steps.length}\n` +
                  `**Status:** ${session.status}\n\n` +
                  `### Steps:\n` +
                  session.steps.map((step: any, index: number) => 
                    `${index + 1}. **${step.id}** (${step.status}): ${step.description}`
                  ).join('\n') + '\n\n' +
                  `Use \`step_execute_next\` with session ID \`${session.id}\` to start execution.`
          },
          {
            type: 'text',
            text: JSON.stringify(sessionInfo, null, 2)
          }
        ],
        isError: false,
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `### Error Creating Session\n\n${error instanceof Error ? error.message : String(error)}`
          }
        ],
        isError: true,
      };
    }
  },
});

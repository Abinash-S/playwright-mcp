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

const executeNextSchema = z.object({
  sessionId: z.string().describe('The ID of the session to execute the next step for'),
});

export const executeNext = defineTool({
  schema: {
    name: 'step_execute_next',
    title: 'Execute the next step in a session',
    description: 'Execute the next pending step in the specified session. If the current step failed, it will be re-executed.',
    inputSchema: executeNextSchema,
    type: 'destructive',
  },

  handle: async (context, params) => {
    try {
      // Get the session and find the next step to execute
      const session = context.sessionLog.getStepSession(params.sessionId);
      if (!session) {
        return {
          content: [{ type: 'text', text: `### Error\n\nSession not found: ${params.sessionId}` }],
          isError: true,
        };
      }

      const nextStep = session.steps.find((step: any) => step.status === 'pending');
      if (!nextStep) {
        const allCompleted = session.steps.every((step: any) => step.status === 'completed' || step.status === 'skipped');
        const statusMessage = allCompleted ? 'All steps completed!' : 'No pending steps found.';
        
        return {
          content: [{ 
            type: 'text', 
            text: `### Session Status\n\n${statusMessage}\n\nUse step_status to see full session details.`
          }],
          isError: false,
        };
      }

      const completedCount = session.steps.filter((s: any) => s.status === 'completed' || s.status === 'skipped').length;
      const progressText = `Progress: ${completedCount}/${session.steps.length} steps completed`;

      return {
        content: [
          {
            type: 'text',
            text: `### Next Step Ready for Execution\n\n` +
                  `**Step:** ${nextStep.description}\n` +
                  `**Step ID:** ${nextStep.id}\n` +
                  `**Session ID:** ${params.sessionId}\n` +
                  `**Status:** Ready to execute\n` +
                  `${progressText}\n\n` +
                  `**Instructions:** Execute this step manually using the regular browser automation tools:\n` +
                  `- Use browser_navigate, browser_click, browser_type, etc.\n` +
                  `- When done, use step_status to check progress\n` +
                  `- Use step_retry if the step fails\n` +
                  `- Use step_skip to skip this step if needed`
          }
        ],
        isError: false,
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `### Error\n\nFailed to get next step: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  },
});

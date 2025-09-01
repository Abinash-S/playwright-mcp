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

const retrySchema = z.object({
  sessionId: z.string().describe('The ID of the session'),
  stepId: z.string().optional().describe('The ID of the specific step to retry. If not provided, retries the current failed step.'),
});

export const retry = defineTool({
  schema: {
    name: 'step_retry',
    title: 'Retry a failed step',
    description: 'Reset a failed step to pending status so it can be executed again. If no stepId is provided, retries the current failed step.',
    inputSchema: retrySchema,
    type: 'destructive',
  },

  handle: async (context, params) => {
    try {
      const session = context.sessionLog.getStepSession(params.sessionId);
      if (!session) {
        return {
          content: [{ type: 'text', text: `### Error\n\nSession not found: ${params.sessionId}` }],
          isError: true,
        };
      }

      let stepId = params.stepId;
      if (!stepId) {
        // Find the current failed step
        const failedStep = session.steps.find((step: any) => step.status === 'failed');
        if (!failedStep) {
          return {
            content: [{ type: 'text', text: `### Error\n\nNo failed step found to retry in session ${params.sessionId}` }],
            isError: true,
          };
        }
        stepId = failedStep.id;
      }

      const success = context.sessionLog.resetStepToPending(params.sessionId, stepId!);
      if (!success) {
        return {
          content: [{ type: 'text', text: `### Error\n\nFailed to reset step ${stepId} for retry` }],
          isError: true,
        };
      }

      const step = session.steps.find((s: any) => s.id === stepId);
      const completedCount = session.steps.filter((s: any) => s.status === 'completed' || s.status === 'skipped').length;
      const progressText = `Progress: ${completedCount}/${session.steps.length} steps completed`;

      return {
        content: [
          {
            type: 'text',
            text: `### Step Reset for Retry\n\n` +
                  `✅ **Step reset to pending status**\n` +
                  `**Step:** ${step?.description || 'Unknown'}\n` +
                  `**Step ID:** ${stepId}\n` +
                  `**Session ID:** ${params.sessionId}\n` +
                  `**Status:** Pending\n` +
                  `${progressText}\n\n` +
                  `Use \`step_execute_next\` to retry this step.`
          }
        ],
        isError: false,
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `### Error\n\nFailed to retry step: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  },
});

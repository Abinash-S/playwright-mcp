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

const skipSchema = z.object({
  sessionId: z.string().describe('The ID of the session'),
  stepId: z.string().optional().describe('The ID of the specific step to skip. If not provided, skips the current step.'),
});

export const skip = defineTool({
  schema: {
    name: 'step_skip',
    title: 'Skip a step',
    description: 'Mark a step as skipped and move to the next step. If no stepId is provided, skips the current step.',
    inputSchema: skipSchema,
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
        // Find the current pending or failed step
        const currentStep = session.steps.find((step: any) => step.status === 'pending' || step.status === 'failed');
        if (!currentStep) {
          return {
            content: [{ type: 'text', text: `### Error\n\nNo step found to skip in session ${params.sessionId}` }],
            isError: true,
          };
        }
        stepId = currentStep.id;
      }

      const success = context.sessionLog.markStepSkipped(params.sessionId, stepId!, 'Manually skipped');
      if (!success) {
        return {
          content: [{ type: 'text', text: `### Error\n\nFailed to skip step ${stepId}` }],
          isError: true,
        };
      }

      const step = session.steps.find((s: any) => s.id === stepId);
      const completedCount = session.steps.filter((s: any) => s.status === 'completed' || s.status === 'skipped').length;
      const progressText = `Progress: ${completedCount}/${session.steps.length} steps completed`;
      
      const nextStep = session.steps.find((s: any) => s.status === 'pending');
      const nextStepText = nextStep ? `\n\n**Next Step:** ${nextStep.description}` : '';

      const sessionComplete = session.steps.every((s: any) => s.status === 'completed' || s.status === 'skipped');
      const sessionStatusText = sessionComplete ? '\n\n🎉 **Session completed successfully!**' : '';

      return {
        content: [
          {
            type: 'text',
            text: `### Step Skipped\n\n` +
                  `⏭️ **Step skipped successfully**\n` +
                  `**Step:** ${step?.description || 'Unknown'}\n` +
                  `**Step ID:** ${stepId}\n` +
                  `**Session ID:** ${params.sessionId}\n` +
                  `**Status:** Skipped\n` +
                  `${progressText}` +
                  nextStepText +
                  sessionStatusText +
                  (!sessionComplete ? '\n\nUse `step_execute_next` to continue with the next step.' : '')
          }
        ],
        isError: false,
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `### Error\n\nFailed to skip step: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  },
});

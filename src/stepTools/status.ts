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

const statusSchema = z.object({
  sessionId: z.string().optional().describe('The ID of the session to get status for. If not provided, lists all sessions.'),
});

export const status = defineTool({
  schema: {
    name: 'step_status',
    title: 'Get session status',
    description: 'Get the detailed status of a specific session or list all sessions if no ID is provided.',
    inputSchema: statusSchema,
    type: 'readOnly',
  },

  handle: async (context, params) => {
    try {
      if (params.sessionId) {
        // Get specific session status
        const { session, currentStep, nextStep } = context.sessionLog.getStepSessionStatus(params.sessionId);
        
        const completedSteps = session.steps.filter((s: any) => s.status === 'completed' || s.status === 'skipped').length;
        const failedSteps = session.steps.filter((s: any) => s.status === 'failed').length;
        const progressText = `Progress: ${completedSteps}/${session.steps.length} steps completed${failedSteps > 0 ? `, ${failedSteps} failed` : ''}`;

        const stepsDetails = session.steps.map((step: any, index: number) => {
          const statusIcon = step.status === 'completed' ? '✅' :
                           step.status === 'failed' ? '❌' :
                           step.status === 'skipped' ? '⏭️' :
                           step.status === 'running' ? '🔄' : '⏸️';
          
          const duration = step.duration ? ` (${step.duration}ms)` : '';
          const currentIndicator = currentStep && step.id === currentStep.id ? ' ← **CURRENT**' : '';
          
          return `${index + 1}. ${statusIcon} **${step.id}** (${step.status})${duration}${currentIndicator}\n   ${step.description}`;
        }).join('\n\n');

        const currentStepText = currentStep ? 
          `\n\n**Current Step:** ${currentStep.description} (${currentStep.status})` : '';
        
        const nextStepText = nextStep ? 
          `**Next Step:** ${nextStep.description}` : '';

        return {
          content: [
            {
              type: 'text',
              text: `### Session Status\n\n` +
                    `**Session ID:** ${session.id}\n` +
                    `**Name:** ${session.name || 'Unnamed'}\n` +
                    `**Status:** ${session.status}\n` +
                    `${progressText}\n` +
                    `**Created:** ${session.createdAt.toISOString()}\n` +
                    `**Updated:** ${session.updatedAt.toISOString()}\n` +
                    (session.completedAt ? `**Completed:** ${session.completedAt.toISOString()}\n` : '') +
                    currentStepText +
                    (nextStepText ? `\n${nextStepText}` : '') +
                    `\n\n### Steps Detail:\n\n${stepsDetails}`
            },
            {
              type: 'text',
              text: JSON.stringify({ session, currentStep, nextStep }, null, 2)
            }
          ],
          isError: false,
        };
      } else {
        // List all sessions
        const sessions = context.sessionLog.getAllStepSessions();
        
        if (sessions.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: `### No Sessions Found\n\nNo step sessions have been created yet. Use \`step_start_session\` to create a new session.`
              }
            ],
            isError: false,
          };
        }

        const sessionsList = sessions.map(session => {
          const completedSteps = session.steps.filter((s: any) => s.status === 'completed' || s.status === 'skipped').length;
          const failedSteps = session.steps.filter((s: any) => s.status === 'failed').length;
          const progressText = `${completedSteps}/${session.steps.length} completed${failedSteps > 0 ? `, ${failedSteps} failed` : ''}`;
          
          const statusIcon = session.status === 'completed' ? '✅' :
                           session.status === 'failed' ? '❌' :
                           session.status === 'running' ? '🔄' : '⏸️';

          return `${statusIcon} **${session.id}** (${session.status})\n` +
                 `   Name: ${session.name || 'Unnamed'}\n` +
                 `   Progress: ${progressText}\n` +
                 `   Updated: ${session.updatedAt.toISOString()}`;
        }).join('\n\n');

        return {
          content: [
            {
              type: 'text',
              text: `### All Sessions\n\n${sessionsList}\n\n` +
                    `Use \`step_status\` with a specific session ID to get detailed information.`
            },
            {
              type: 'text',
              text: JSON.stringify(sessions.map(s => ({
                id: s.id,
                name: s.name,
                status: s.status,
                totalSteps: s.steps.length,
                completedSteps: s.steps.filter((step: any) => step.status === 'completed' || step.status === 'skipped').length,
                updatedAt: s.updatedAt.toISOString()
              })), null, 2)
            }
          ],
          isError: false,
        };
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `### Error Getting Status\n\n${error instanceof Error ? error.message : String(error)}`
          }
        ],
        isError: true,
      };
    }
  },
});

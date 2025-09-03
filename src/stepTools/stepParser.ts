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

import type { ParsedSteps } from './types.js';

export class StepParser {
  static parseSteps(input: string | string[]): ParsedSteps {
    if (Array.isArray(input)) {
      return {
        steps: input.map((description, index) => ({
          description: description.trim(),
        })),
      };
    }

    // Check if the input string is a JSON array
    if (typeof input === 'string') {
      const trimmedInput = input.trim();
      if (trimmedInput.startsWith('[') && trimmedInput.endsWith(']')) {
        try {
          const parsedArray = JSON.parse(trimmedInput);
          if (Array.isArray(parsedArray)) {
            return {
              steps: parsedArray.map((description) => ({
                description: String(description).trim(),
              })),
            };
          }
        } catch (error) {
          // If JSON parsing fails, fall through to markdown parsing
        }
      }
    }

    // Handle markdown format
    const lines = input.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    const steps: ParsedSteps['steps'] = [];
    const metadata: Record<string, any> = {};

    let inCodeBlock = false;
    let codeBlockContent = '';
    let currentStep: string | null = null;

    for (const line of lines) {
      // Handle code blocks
      if (line.startsWith('```')) {
        if (inCodeBlock) {
          // End of code block
          if (currentStep) {
            steps.push({ description: `${currentStep}\n\`\`\`\n${codeBlockContent}\n\`\`\`` });
            currentStep = null;
          }
          codeBlockContent = '';
          inCodeBlock = false;
        } else {
          // Start of code block
          inCodeBlock = true;
        }
        continue;
      }

      if (inCodeBlock) {
        codeBlockContent += line + '\n';
        continue;
      }

      // Handle numbered lists (1., 2., etc.)
      const numberedMatch = line.match(/^(\d+)\.\s*(.+)$/);
      if (numberedMatch) {
        if (currentStep) {
          steps.push({ description: currentStep });
        }
        currentStep = numberedMatch[2];
        continue;
      }

      // Handle bullet points (-, *, +)
      const bulletMatch = line.match(/^[-*+]\s*(.+)$/);
      if (bulletMatch) {
        if (currentStep) {
          steps.push({ description: currentStep });
        }
        currentStep = bulletMatch[1];
        continue;
      }

      // Handle markdown headers as potential metadata
      const headerMatch = line.match(/^#{1,6}\s*(.+)$/);
      if (headerMatch) {
        metadata.title = headerMatch[1];
        continue;
      }

      // If we have a current step, append this line to it
      if (currentStep) {
        currentStep += ' ' + line;
      } else if (line.length > 0) {
        // Standalone line without list marker - treat as a step
        currentStep = line;
      }
    }

    // Add the last step if any
    if (currentStep) {
      steps.push({ description: currentStep });
    }

    // If no steps were found, treat the entire input as a single step
    if (steps.length === 0 && typeof input === 'string' && input.trim().length > 0) {
      steps.push({ description: input.trim() });
    }

    return {
      steps,
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
    };
  }
}

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

import type { Context } from '../loopTools/context.js';

export class StepExecutor {
  private context: Context;

  constructor(context: Context) {
    this.context = context;
  }

  async executeStep(stepDescription: string): Promise<{ success: boolean; result?: string; error?: string }> {
    try {
      const result = await this.context.runTask(stepDescription);
      
      // The runTask returns a CallToolResult which contains content array
      if (result.isError) {
        return {
          success: false,
          error: this.extractTextFromContent(result.content),
        };
      }

      return {
        success: true,
        result: this.extractTextFromContent(result.content),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private extractTextFromContent(content: any[]): string {
    if (!Array.isArray(content)) {
      return String(content);
    }

    return content
      .map(item => {
        if (typeof item === 'string') {
          return item;
        }
        if (typeof item === 'object' && item !== null) {
          if ('text' in item) {
            return item.text;
          }
          if ('type' in item && item.type === 'text' && 'text' in item) {
            return item.text;
          }
        }
        return String(item);
      })
      .join('\n')
      .trim();
  }
}

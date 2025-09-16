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

import * as fs from 'fs';
import * as path from 'path';

export interface ScriptStep {
  id: string;
  toolName: string;
  params: any;
  code: string;
  description: string;
  timestamp: number;
}

export class ScriptGenerator {
  private _isRecording: boolean = true;
  private _steps: ScriptStep[] = [];
  private _currentPage: string = '';
  private _outputDir: string;
  private _stepCounter: number = 0;

  constructor(outputDir: string = './output') {
    this._outputDir = outputDir;
    this._ensureOutputDirs();
  }

  private _ensureOutputDirs() {
    // Create main script output directory
    if (!fs.existsSync(this._outputDir)) {
      fs.mkdirSync(this._outputDir, { recursive: true });
    }
    
    // Create subdirectories for script-related output
    const subdirs = ['scripts', 'executions'];
    subdirs.forEach(subdir => {
      const dirPath = path.join(this._outputDir, subdir);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
    });
  }

  isRecording(): boolean {
    return this._isRecording;
  }

  startRecording(): void {
    this._isRecording = true;
  }

  stopRecording(): void {
    this._isRecording = false;
  }

  clear(): void {
    this._steps = [];
    this._stepCounter = 0;
    this._currentPage = '';
  }

  updateCurrentPage(url: string): void {
    this._currentPage = url;
  }

  addStep(toolName: string, params: any, code: string, description: string): void {
    if (!this._isRecording) return;

    const step: ScriptStep = {
      id: `step_${++this._stepCounter}`,
      toolName,
      params,
      code,
      description,
      timestamp: Date.now()
    };

    // Apply filtering to remove duplicates and retries
    if (this._shouldFilterStep(step)) {
      return;
    }

    this._steps.push(step);
  }

  private _shouldFilterStep(newStep: ScriptStep): boolean {
    if (this._steps.length === 0) return false;

    const recentSteps = this._steps.slice(-5); // Check last 5 steps
    const now = newStep.timestamp;

    // Filter duplicate actions within 10 seconds
    for (const existingStep of recentSteps) {
      if (now - existingStep.timestamp < 10000) { // 10 seconds
        // Same tool with similar params
        if (existingStep.toolName === newStep.toolName) {
          if (this._areSimilarParams(existingStep.params, newStep.params)) {
            return true; // Filter out duplicate
          }
        }
      }
    }

    // Filter obvious retries (same element, same action within short time)
    const lastStep = this._steps[this._steps.length - 1];
    if (lastStep && now - lastStep.timestamp < 5000) { // 5 seconds
      if (lastStep.toolName === newStep.toolName && 
          lastStep.params?.ref === newStep.params?.ref) {
        return true; // Filter retry on same element
      }
    }

    return false;
  }

  private _areSimilarParams(params1: any, params2: any): boolean {
    if (!params1 || !params2) return false;
    
    // For click actions, check element ref
    if (params1.ref && params2.ref) {
      return params1.ref === params2.ref;
    }

    // For type actions, check element and text
    if (params1.element && params2.element && params1.text && params2.text) {
      return params1.element === params2.element && params1.text === params2.text;
    }

    // For navigation, check URL
    if (params1.url && params2.url) {
      return params1.url === params2.url;
    }

    return false;
  }

  getStepCount(): number {
    return this._steps.length;
  }

  getLastSteps(count: number = 3): ScriptStep[] {
    return this._steps.slice(-count);
  }

  getScriptPreview(): string {
    return this._generateScript();
  }

  async exportScript(filename?: string): Promise<string> {
    const script = this._generateScript();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const defaultFilename = `generated-test-${timestamp}.spec.js`;
    const finalFilename = filename || defaultFilename;
    
    // Save scripts to the scripts subdirectory
    const scriptsDir = path.join(this._outputDir, 'scripts');
    const filePath = path.join(scriptsDir, finalFilename);

    await fs.promises.writeFile(filePath, script, 'utf8');
    return filePath;
  }

  async saveExecutionResult(scriptName: string, result: any): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const executionFilename = `execution-${scriptName}-${timestamp}.json`;
    
    // Save execution results to the executions subdirectory
    const executionsDir = path.join(this._outputDir, 'executions');
    const filePath = path.join(executionsDir, executionFilename);

    const executionData = {
      scriptName,
      timestamp: new Date().toISOString(),
      result,
      steps: this._steps.length,
      duration: result.duration || 'unknown'
    };

    await fs.promises.writeFile(filePath, JSON.stringify(executionData, null, 2), 'utf8');
    return filePath;
  }

  private _generateScript(): string {
    if (this._steps.length === 0) {
      return this._getEmptyScript();
    }

    const imports = `import { test, expect } from '@playwright/test';`;
    const testStart = `\ntest('Generated test case', async ({ page }) => {`;
    const testEnd = `});`;

    let body = '';
    
    for (const step of this._steps) {
      // Add comment for step description
      body += `\n  // ${step.description}\n`;
      
      // Add the code with proper indentation
      const indentedCode = step.code
        .split('\n')
        .map(line => line.trim() ? `  ${line}` : '')
        .join('\n');
      
      body += indentedCode;
      
      // Add spacing between steps
      body += '\n';
    }

    return `${imports}${testStart}${body}${testEnd}`;
  }

  private _getEmptyScript(): string {
    return `import { test, expect } from '@playwright/test';

test('Generated test case', async ({ page }) => {
  // No actions recorded yet
});`;
  }
}

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

import fs from 'fs/promises';
import path from 'path';
import * as javascript from './utils/codegen.js';
import { logUnhandledError } from './utils/log.js';

export interface ScriptStep {
  id: string;
  timestamp: number;
  toolName: string;
  toolArgs: Record<string, any>;
  code: string;
  isAssertion: boolean;
  isNavigation: boolean;
  isRetry: boolean;
  waitCondition?: string;
  description: string;
  page?: string; // URL context
}

export interface GeneratedScript {
  steps: ScriptStep[];
  imports: string[];
  setup: string[];
  cleanup: string[];
  finalScript: string;
}

export class ScriptGenerator {
  private _steps: ScriptStep[] = [];
  private _stepCounter = 0;
  private _lastStepsByType: Map<string, ScriptStep[]> = new Map();
  private _currentPage = '';
  private _outputDir: string;
  private _isRecording = true;

  constructor(outputDir: string) {
    this._outputDir = outputDir;
  }

  startRecording() {
    this._isRecording = true;
    this._steps = [];
    this._stepCounter = 0;
    this._lastStepsByType.clear();
  }

  stopRecording() {
    this._isRecording = false;
  }

  isRecording(): boolean {
    return this._isRecording;
  }

  addStep(toolName: string, toolArgs: Record<string, any>, code: string, description: string): string {
    if (!this._isRecording) {
      return '';
    }

    const stepId = `step_${++this._stepCounter}`;
    const timestamp = Date.now();
    
    const step: ScriptStep = {
      id: stepId,
      timestamp,
      toolName,
      toolArgs,
      code,
      isAssertion: this._isAssertionTool(toolName),
      isNavigation: this._isNavigationTool(toolName),
      isRetry: this._detectRetry(toolName, toolArgs),
      description,
      page: this._currentPage,
    };

    // Add intelligent wait conditions
    step.waitCondition = this._generateWaitCondition(step);

    // Track steps by type for retry detection
    if (!this._lastStepsByType.has(toolName)) {
      this._lastStepsByType.set(toolName, []);
    }
    this._lastStepsByType.get(toolName)!.push(step);

    // Keep only last 3 steps per type for retry detection
    const stepsOfType = this._lastStepsByType.get(toolName)!;
    if (stepsOfType.length > 3) {
      stepsOfType.shift();
    }

    this._steps.push(step);

    return stepId;
  }

  updateCurrentPage(url: string) {
    this._currentPage = url;
  }

  private _isAssertionTool(toolName: string): boolean {
    return toolName.startsWith('browser_verify_') || 
           toolName.includes('assert') || 
           toolName.includes('expect');
  }

  private _isNavigationTool(toolName: string): boolean {
    return toolName === 'browser_navigate' || 
           toolName === 'browser_navigate_back' ||
           toolName === 'browser_tabs';
  }

  private _detectRetry(toolName: string, toolArgs: Record<string, any>): boolean {
    const recentSteps = this._lastStepsByType.get(toolName) || [];
    
    // Check if this is a retry based on similar recent actions
    const recentSimilar = recentSteps.filter(step => 
      step.timestamp > Date.now() - 10000 && // Within last 10 seconds
      this._areSimilarArgs(step.toolArgs, toolArgs)
    );

    return recentSimilar.length > 0;
  }

  private _areSimilarArgs(args1: Record<string, any>, args2: Record<string, any>): boolean {
    // Check if arguments are similar (for retry detection)
    if (args1.ref && args2.ref && args1.ref === args2.ref) return true;
    if (args1.element && args2.element && args1.element === args2.element) return true;
    if (args1.url && args2.url && args1.url === args2.url) return true;
    
    return JSON.stringify(args1) === JSON.stringify(args2);
  }

  private _generateWaitCondition(step: ScriptStep): string | undefined {
    const { toolName, toolArgs } = step;

    switch (toolName) {
      case 'browser_click':
      case 'browser_type':
      case 'browser_fill_form':
        // Wait for element to be visible and enabled before interaction
        if (toolArgs.ref) {
          return `await expect(locator).toBeVisible();\n  await expect(locator).toBeEnabled();`;
        }
        break;
        
      case 'browser_navigate':
        // Wait for page load after navigation
        return `await page.waitForLoadState('networkidle');`;
        
      case 'browser_wait_for':
        // Already a wait condition, no additional wait needed
        return undefined;
        
      case 'browser_select_option':
        // Wait for select to be visible
        if (toolArgs.ref) {
          return `await expect(locator).toBeVisible();`;
        }
        break;
        
      case 'browser_file_upload':
        // Wait for file chooser
        return `await page.waitForEvent('filechooser');`;
        
      default:
        // For other tools that might change page state
        if (toolArgs.ref && (toolName.includes('click') || toolName.includes('type'))) {
          return `await expect(locator).toBeVisible();`;
        }
        break;
    }

    return undefined;
  }

  generateScript(): GeneratedScript {
    const filteredSteps = this._filterUnnecessarySteps(this._steps);
    const optimizedSteps = this._optimizeSteps(filteredSteps);
    
    const imports = this._generateImports();
    const setup = this._generateSetup();
    const cleanup = this._generateCleanup();
    
    const finalScript = this._generateFinalScript(optimizedSteps, imports, setup, cleanup);

    return {
      steps: optimizedSteps,
      imports,
      setup,
      cleanup,
      finalScript,
    };
  }

  private _filterUnnecessarySteps(steps: ScriptStep[]): ScriptStep[] {
    const filtered: ScriptStep[] = [];
    
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      
      // Skip retry steps
      if (step.isRetry) {
        continue;
      }
      
      // Skip redundant snapshots (keep only meaningful ones)
      if (step.toolName === 'browser_snapshot') {
        const nextStep = steps[i + 1];
        // Keep snapshot only if followed by interaction or assertion
        if (!nextStep || (!this._isInteractionTool(nextStep.toolName) && !nextStep.isAssertion)) {
          continue;
        }
      }
      
      // Skip redundant console message calls
      if (step.toolName === 'browser_console_messages') {
        // Only keep if it's the first one or after significant action
        const recentConsoleSteps = filtered.filter(s => 
          s.toolName === 'browser_console_messages' && 
          s.timestamp > step.timestamp - 30000
        );
        if (recentConsoleSteps.length > 0) {
          continue;
        }
      }
      
      filtered.push(step);
    }
    
    return filtered;
  }

  private _isInteractionTool(toolName: string): boolean {
    return ['browser_click', 'browser_type', 'browser_fill_form', 'browser_select_option', 
            'browser_drag', 'browser_press_key', 'browser_file_upload'].includes(toolName);
  }

  private _optimizeSteps(steps: ScriptStep[]): ScriptStep[] {
    const optimized: ScriptStep[] = [];
    
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const nextStep = steps[i + 1];
      
      // Combine multiple type operations on same element
      if (step.toolName === 'browser_type' && 
          nextStep && nextStep.toolName === 'browser_type' &&
          step.toolArgs.ref === nextStep.toolArgs.ref) {
        
        // Combine the text
        const combinedStep = { ...step };
        combinedStep.toolArgs = { ...step.toolArgs };
        combinedStep.toolArgs.text = step.toolArgs.text + nextStep.toolArgs.text;
        combinedStep.code = this._generateTypeCode(combinedStep.toolArgs);
        combinedStep.description = `Type "${combinedStep.toolArgs.text}" into ${step.toolArgs.element}`;
        
        optimized.push(combinedStep);
        i++; // Skip next step as it's been combined
        continue;
      }
      
      optimized.push(step);
    }
    
    return optimized;
  }

  private _generateTypeCode(toolArgs: Record<string, any>): string {
    const locatorCode = `page.locator('[data-testid="${toolArgs.ref}"]')`;
    return `await ${locatorCode}.fill(${javascript.quote(toolArgs.text)});`;
  }

  private _generateImports(): string[] {
    return [
      "import { test, expect } from '@playwright/test';",
    ];
  }

  private _generateSetup(): string[] {
    return [
      "test('Generated test case', async ({ page }) => {",
    ];
  }

  private _generateCleanup(): string[] {
    return [
      "});",
    ];
  }

  private _generateFinalScript(steps: ScriptStep[], imports: string[], setup: string[], cleanup: string[]): string {
    const lines: string[] = [];
    
    // Add imports
    lines.push(...imports);
    lines.push('');
    
    // Add setup
    lines.push(...setup);
    
    // Add steps
    let currentPage = '';
    for (const step of steps) {
      // Add page context comment if changed
      if (step.page && step.page !== currentPage) {
        lines.push(`  // Page: ${step.page}`);
        currentPage = step.page;
      }
      
      // Add description comment
      lines.push(`  // ${step.description}`);
      
      // Add wait condition if present
      if (step.waitCondition) {
        const waitLines = step.waitCondition.split('\n');
        for (const waitLine of waitLines) {
          if (waitLine.trim()) {
            lines.push(`  ${waitLine.trim()}`);
          }
        }
      }
      
      // Add the main code
      const codeLines = step.code.split('\n');
      for (const codeLine of codeLines) {
        if (codeLine.trim()) {
          lines.push(`  ${codeLine.trim()}`);
        }
      }
      
      lines.push('');
    }
    
    // Add cleanup
    lines.push(...cleanup);
    
    return lines.join('\n');
  }

  async exportScript(filename?: string): Promise<string> {
    const script = this.generateScript();
    const fileName = filename || `generated_test_${Date.now()}.spec.js`;
    const filePath = path.join(this._outputDir, fileName);
    
    try {
      await fs.writeFile(filePath, script.finalScript, 'utf8');
      return filePath;
    } catch (error) {
      logUnhandledError(error);
      throw new Error(`Failed to export script: ${error}`);
    }
  }

  getScriptPreview(): string {
    const script = this.generateScript();
    return script.finalScript;
  }

  getStepCount(): number {
    return this._steps.filter(s => !s.isRetry).length;
  }

  getLastSteps(count: number = 5): ScriptStep[] {
    return this._steps.slice(-count);
  }

  clear() {
    this._steps = [];
    this._stepCounter = 0;
    this._lastStepsByType.clear();
    this._currentPage = '';
  }
}
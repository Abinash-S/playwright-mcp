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
import { defineTabTool, defineTool } from './tool.js';
import * as javascript from '../utils/codegen.js';
import { generateLocator } from './utils.js';

const elementSchema = z.object({
  element: z.string().describe('Human-readable element description used to obtain permission to interact with the element'),
  ref: z.string().describe('Exact target element reference from the page snapshot'),
});

const clickSchema = elementSchema.extend({
  doubleClick: z.boolean().optional().describe('Whether to perform a double click instead of a single click'),
  button: z.enum(['left', 'right', 'middle']).optional().describe('Button to click, defaults to left'),
});

const click = defineTabTool({
  capability: 'core',
  schema: {
    name: 'browser_click',
    title: 'Click',
    description: 'Perform click on a web page',
    inputSchema: clickSchema,
    type: 'destructive',
  },

  handle: async (tab, params, response) => {
    response.setIncludeSnapshot();

    const locator = await tab.refLocator(params);
    const button = params.button;
    const buttonAttr = button ? `{ button: '${button}' }` : '';
    const isDoubleClick = params.doubleClick ?? false;

    // Generate clean script code
    const locatorCode = await generateLocator(locator);
    const actionCode = isDoubleClick ?
      `await page.${locatorCode}.dblclick(${buttonAttr});` :
      `await page.${locatorCode}.click(${buttonAttr});`;

    // Add to script generator if available
    if (tab.context?.scriptGenerator?.isRecording()) {
      const description = `${isDoubleClick ? 'Double-click' : 'Click'} on ${params.element}`;
      tab.context.scriptGenerator.addStep('browser_click', params, actionCode, description);
    }

    if (params.doubleClick)
      response.addCode(`await page.${locatorCode}.dblclick(${buttonAttr});`);
    else
      response.addCode(`await page.${locatorCode}.click(${buttonAttr});`);

    await tab.waitForCompletion(async () => {
      if (params.doubleClick)
        await locator.dblclick({ button });
      else
        await locator.click({ button });
    });
  },
});

const type = defineTabTool({
  capability: 'core',
  schema: {
    name: 'browser_type',
    title: 'Type text',
    description: 'Type text into editable element',
    inputSchema: elementSchema.extend({
      text: z.string().describe('Text to type into the element'),
      submit: z.boolean().optional().describe('Whether to submit entered text (press Enter after)'),
      slowly: z.boolean().optional().describe('Whether to type one character at a time. Useful for triggering key handlers in the page. By default entire text is filled in at once.'),
    }),
    type: 'destructive',
  },

  handle: async (tab, params, response) => {
    response.setIncludeSnapshot();

    const locator = await tab.refLocator(params);
    const locatorCode = await generateLocator(locator);

    // Generate clean script code
    const actionCode = params.slowly ?
      `await page.${locatorCode}.pressSequentially(${javascript.quote(params.text)});` :
      `await page.${locatorCode}.fill(${javascript.quote(params.text)});`;
    
    const submitCode = params.submit ? `\n  await page.${locatorCode}.press('Enter');` : '';
    const finalCode = actionCode + submitCode;

    // Add to script generator if available
    if (tab.context?.scriptGenerator?.isRecording()) {
      const description = `Type "${params.text}" into ${params.element}${params.submit ? ' and submit' : ''}`;
      tab.context.scriptGenerator.addStep('browser_type', params, finalCode, description);
    }

    response.addCode(finalCode);

    await tab.waitForCompletion(async () => {
      if (params.slowly)
        await locator.pressSequentially(params.text);
      else
        await locator.fill(params.text);
      
      if (params.submit)
        await locator.press('Enter');
    });
  },
});

const navigate = defineTool({
  capability: 'core',
  schema: {
    name: 'browser_navigate',
    title: 'Navigate to a URL',
    description: 'Navigate to a URL',
    inputSchema: z.object({
      url: z.string().describe('The URL to navigate to'),
    }),
    type: 'destructive',
  },

  handle: async (context, params, response) => {
    await context.ensureTab();
    response.setIncludeSnapshot();

    const navigateCode = `await page.goto(${javascript.quote(params.url)});`;
    const waitCode = `await page.waitForLoadState('networkidle');`;
    const fullCode = `${navigateCode}\n  ${waitCode}`;

    // Add to script generator
    if (context.scriptGenerator?.isRecording()) {
      context.scriptGenerator.updateCurrentPage(params.url);
      context.scriptGenerator.addStep('browser_navigate', params, fullCode, `Navigate to ${params.url}`);
    }

    response.addCode(fullCode);

    await context.currentTabOrDie().waitForCompletion(async () => {
      await context.currentTabOrDie().page.goto(params.url);
      await context.currentTabOrDie().page.waitForLoadState('networkidle');
    });
  },
});

const verifyElement = defineTabTool({
  capability: 'verify',
  schema: {
    name: 'browser_verify_element_visible',
    title: 'Verify element visible',
    description: 'Verify element is visible on the page',
    inputSchema: z.object({
      role: z.string().describe('ROLE of the element. Can be found in the snapshot like this: `- {ROLE} "Accessible Name":`'),
      accessibleName: z.string().describe('ACCESSIBLE_NAME of the element. Can be found in the snapshot like this: `- role "{ACCESSIBLE_NAME}"`'),
    }),
    type: 'readOnly',
  },

  handle: async (tab, params, response) => {
    const locator = tab.page.getByRole(params.role as any, { name: params.accessibleName });
    if (await locator.count() === 0) {
      response.addError(`Element with role "${params.role}" and accessible name "${params.accessibleName}" not found`);
      return;
    }

    const locatorCode = `page.getByRole(${javascript.escapeWithQuotes(params.role)}, { name: ${javascript.escapeWithQuotes(params.accessibleName)} })`;
    const assertionCode = `await expect(${locatorCode}).toBeVisible();`;

    // Add to script generator
    if (tab.context?.scriptGenerator?.isRecording()) {
      const description = `Verify that ${params.role} "${params.accessibleName}" is visible`;
      tab.context.scriptGenerator.addStep('browser_verify_element', params, assertionCode, description);
    }

    response.addCode(assertionCode);
    response.addResult('Done');
  },
});

const verifyText = defineTabTool({
  capability: 'verify',
  schema: {
    name: 'browser_verify_text_visible',
    title: 'Verify text visible',
    description: `Verify text is visible on the page. Prefer ${verifyElement.schema.name} if possible.`,
    inputSchema: z.object({
      text: z.string().describe('TEXT to verify. Can be found in the snapshot like this: `- role "Accessible Name": {TEXT}` or like this: `- text: {TEXT}`'),
    }),
    type: 'readOnly',
  },

  handle: async (tab, params, response) => {
    const locator = tab.page.getByText(params.text);
    if (await locator.count() === 0) {
      response.addError(`Text "${params.text}" not found`);
      return;
    }

    const locatorCode = `page.getByText(${javascript.escapeWithQuotes(params.text)})`;
    const assertionCode = `await expect(${locatorCode}).toBeVisible();`;

    // Add to script generator
    if (tab.context?.scriptGenerator?.isRecording()) {
      const description = `Verify that text "${params.text}" is visible`;
      tab.context.scriptGenerator.addStep('browser_verify_text', params, assertionCode, description);
    }

    response.addCode(assertionCode);
    response.addResult('Done');
  },
});

const waitFor = defineTool({
  capability: 'core',
  schema: {
    name: 'browser_wait_for',
    title: 'Wait for',
    description: 'Wait for text to appear or disappear or a specified time to pass',
    inputSchema: z.object({
      time: z.number().optional().describe('The time to wait in seconds'),
      text: z.string().optional().describe('The text to wait for'),
      textGone: z.string().optional().describe('The text to wait for to disappear'),
    }),
    type: 'readOnly',
  },

  handle: async (context, params, response) => {
    await context.ensureTab();
    
    let waitCode = '';
    let description = '';
    
    if (params.text) {
      const locatorCode = `page.getByText(${javascript.quote(params.text)})`;
      waitCode = `await expect(${locatorCode}).toBeVisible({ timeout: 30000 });`;
      description = `Wait for text "${params.text}" to appear`;
    } else if (params.textGone) {
      const locatorCode = `page.getByText(${javascript.quote(params.textGone)})`;
      waitCode = `await expect(${locatorCode}).toBeHidden({ timeout: 30000 });`;
      description = `Wait for text "${params.textGone}" to disappear`;
    } else if (params.time) {
      waitCode = `await page.waitForTimeout(${params.time * 1000});`;
      description = `Wait for ${params.time} seconds`;
    }
    
    if (waitCode) {
      // Add to script generator
      if (context.scriptGenerator?.isRecording()) {
        context.scriptGenerator.addStep('browser_wait_for', params, waitCode, description);
      }
      
      response.addCode(waitCode);
    }

    // Execute the wait
    const tab = context.currentTabOrDie();
    if (params.text) {
      await tab.page.getByText(params.text).waitFor({ state: 'visible', timeout: 30000 });
    } else if (params.textGone) {
      await tab.page.getByText(params.textGone).waitFor({ state: 'hidden', timeout: 30000 });
    } else if (params.time) {
      await tab.page.waitForTimeout(params.time * 1000);
    }
    
    response.addResult('Wait completed');
  },
});

// Script management tools
const exportScript = defineTool({
  capability: 'core',
  schema: {
    name: 'browser_export_script',
    title: 'Export Generated Script',
    description: 'Export the generated Playwright script to a file',
    inputSchema: z.object({
      filename: z.string().optional().describe('Custom filename for the exported script'),
      preview: z.boolean().optional().describe('Show preview instead of saving to file'),
    }),
    type: 'readOnly',
  },

  handle: async (context, params, response) => {
    if (!context.scriptGenerator) {
      response.addError('Script generator not available');
      return;
    }

    if (params.preview) {
      const preview = context.scriptGenerator.getScriptPreview();
      response.addResult('Generated Script Preview:');
      response.addCode(preview);
    } else {
      try {
        const filePath = await context.scriptGenerator.exportScript(params.filename);
        response.addResult(`Script exported successfully to: ${filePath}`);
        
        // Also show preview
        const preview = context.scriptGenerator.getScriptPreview();
        response.addCode(preview);
      } catch (error) {
        response.addError(`Failed to export script: ${error}`);
      }
    }
    
    const stepCount = context.scriptGenerator.getStepCount();
    response.addResult(`Total steps in script: ${stepCount}`);
  },
});

const scriptControl = defineTool({
  capability: 'core',
  schema: {
    name: 'browser_script_control',
    title: 'Control Script Generation',
    description: 'Start, stop, or clear the script generation',
    inputSchema: z.object({
      action: z.enum(['start', 'stop', 'clear', 'status']).describe('Action to perform on script generation'),
    }),
    type: 'readOnly',
  },

  handle: async (context, params, response) => {
    if (!context.scriptGenerator) {
      response.addError('Script generator not available');
      return;
    }

    switch (params.action) {
      case 'start':
        context.scriptGenerator.startRecording();
        response.addResult('Script generation started');
        break;
        
      case 'stop':
        context.scriptGenerator.stopRecording();
        response.addResult('Script generation stopped');
        break;
        
      case 'clear':
        context.scriptGenerator.clear();
        response.addResult('Script generation cleared');
        break;
        
      case 'status':
        const isRecording = context.scriptGenerator.isRecording();
        const stepCount = context.scriptGenerator.getStepCount();
        const lastSteps = context.scriptGenerator.getLastSteps(3);
        
        response.addResult(`Script generation: ${isRecording ? 'ACTIVE' : 'STOPPED'}`);
        response.addResult(`Total steps: ${stepCount}`);
        
        if (lastSteps.length > 0) {
          response.addResult('Last steps:');
          lastSteps.forEach((step, index) => {
            response.addResult(`  ${index + 1}. ${step.description}`);
          });
        }
        break;
    }
  },
});

export default [
  click,
  type,
  navigate,
  verifyElement,
  verifyText,
  waitFor,
  exportScript,
  scriptControl,
];
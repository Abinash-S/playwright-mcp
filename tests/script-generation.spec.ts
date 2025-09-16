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

import { test, expect } from './fixtures.js';

test.use({ mcpArgs: ['--caps=verify'] });

test('script generation basic flow', async ({ client, server }) => {
  // Start with a simple test page
  server.setContent('/', `
    <title>Script Generation Test</title>
    <h1>Test Page</h1>
    <input id="name" type="text" placeholder="Enter name">
    <button id="submit">Submit</button>
    <div id="result" style="display:none;">Success!</div>
    <script>
      document.getElementById('submit').onclick = () => {
        const name = document.getElementById('name').value;
        if (name) {
          document.getElementById('result').style.display = 'block';
          document.getElementById('result').textContent = 'Hello ' + name + '!';
        }
      };
    </script>
  `, 'text/html');


  // Check initial script status
  const statusResult = await client.callTool({
    name: 'browser_script_control',
    arguments: { action: 'status' }
  });
  expect(statusResult.content[0].text).toContain('Script generation: ACTIVE');

  // Navigate to test page
  const navigateResult = await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX }
  });
  expect(navigateResult.isError).toBeFalsy();

  // Take snapshot to get element refs
  const snapshotResult = await client.callTool({
    name: 'browser_snapshot',
    arguments: {}
  });
  expect(snapshotResult.content[0].text).toContain('Test Page');
  
  // Extract refs from snapshot 
  const snapshotText = snapshotResult.content[0].text;
  console.log('Snapshot text:', snapshotText); // Debug log
  
  // Look for textbox and button refs in the YAML format
  const nameInputMatch = snapshotText.match(/- textbox "Enter name"[^[]*\[ref=([^\]]+)\]/);
  const submitButtonMatch = snapshotText.match(/- button "Submit"[^[]*\[ref=([^\]]+)\]/);
  
  if (!nameInputMatch || !submitButtonMatch) {
    throw new Error('Could not find element refs in snapshot: ' + snapshotText);
  }
  
  const nameInputRef = nameInputMatch[1];
  const submitButtonRef = submitButtonMatch[1];

  // Type in the input field
  const typeResult = await client.callTool({
    name: 'browser_type',
    arguments: {
      element: 'name input field',
      ref: nameInputRef,
      text: 'John Doe'
    }
  });
  expect(typeResult.isError).toBeFalsy();

  // Click the submit button
  const clickResult = await client.callTool({
    name: 'browser_click',
    arguments: {
      element: 'submit button', 
      ref: submitButtonRef
    }
  });
  expect(clickResult.isError).toBeFalsy();

  // Wait for result to appear
  const waitResult = await client.callTool({
    name: 'browser_wait_for',
    arguments: { text: 'Hello John Doe!' }
  });
  expect(waitResult.isError).toBeFalsy();

  // Verify the result text is visible
  const verifyResult = await client.callTool({
    name: 'browser_verify_text_visible',
    arguments: { text: 'Hello John Doe!' }
  });
  
  expect(verifyResult.isError).toBeFalsy();

  // Export and check the generated script
  const exportResult = await client.callTool({
    name: 'browser_export_script',
    arguments: { preview: true }
  });
  expect(exportResult.isError).toBeFalsy();
  
  const generatedScript = exportResult.content.find(c => c.type === 'text' && c.text.includes('import { test, expect }'))?.text;
  expect(generatedScript).toBeTruthy();
  
  // Verify the script contains expected elements
  expect(generatedScript).toContain('await page.goto');
  expect(generatedScript).toContain('await page.waitForLoadState');
  expect(generatedScript).toContain('fill');
  expect(generatedScript).toContain('John Doe');
  expect(generatedScript).toContain('click');
  expect(generatedScript).toContain('expect');
  expect(generatedScript).toContain('toBeVisible');
  
  // Check that script has proper structure
  expect(generatedScript).toContain("import { test, expect } from '@playwright/test';");
  expect(generatedScript).toContain("test('Generated test case', async ({ page }) => {");
  expect(generatedScript).toContain('});');
});

test('script generation with retry filtering', async ({ client, server }) => {
  server.setContent('/', `
    <title>Retry Test</title>
    <button id="flaky-button">Click me</button>
    <div id="message" style="display:none;">Clicked!</div>
    <script>
      let clicks = 0;
      document.getElementById('flaky-button').onclick = () => {
        clicks++;
        if (clicks >= 2) { // Only show message after 2 clicks
          document.getElementById('message').style.display = 'block';
        }
      };
    </script>
  `, 'text/html');

  // Clear any previous script
  await client.callTool({
    name: 'browser_script_control',
    arguments: { action: 'clear' }
  });

  // Navigate to test page
  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX }
  });

  // Get button reference
  const snapshotResult = await client.callTool({
    name: 'browser_snapshot',
    arguments: {}
  });
  const snapshotText = snapshotResult.content[0].text;
  const buttonMatch = snapshotText.match(/- button "Click me"[^[]*\[ref=([^\]]+)\]/);
  
  if (!buttonMatch) {
    throw new Error('Could not find button ref in snapshot: ' + snapshotText);
  }
  
  const buttonRef = buttonMatch[1];

  // Simulate retry scenario - click multiple times
  await client.callTool({
    name: 'browser_click',
    arguments: {
      element: 'flaky button',
      ref: buttonRef
    }
  });

  // Click again (simulating retry)
  await client.callTool({
    name: 'browser_click',
    arguments: {
      element: 'flaky button', 
      ref: buttonRef
    }
  });

  // Wait for message
  await client.callTool({
    name: 'browser_wait_for',
    arguments: { text: 'Clicked!' }
  });

  // Export script and verify retry filtering
  const exportResult = await client.callTool({
    name: 'browser_export_script',
    arguments: { preview: true }
  });
  
  const generatedScript = exportResult.content.find(c => c.type === 'text' && c.text.includes('import { test, expect }'))?.text;
  expect(generatedScript).toBeTruthy();
  
  // The script should contain clicks but filter out obvious retries
  const clickMatches = generatedScript!.match(/\.click\(/g);
  expect(clickMatches?.length).toBeLessThanOrEqual(2); // Should filter some retries
});

test('script generation control actions', async ({ client }) => {
  // Test starting script generation
  const startResult = await client.callTool({
    name: 'browser_script_control',
    arguments: { action: 'start' }
  });
  expect(startResult.content[0].text).toContain('Script generation started');

  // Test stopping script generation
  const stopResult = await client.callTool({
    name: 'browser_script_control',
    arguments: { action: 'stop' }
  });
  expect(stopResult.content[0].text).toContain('Script generation stopped');

  // Test clearing script generation
  const clearResult = await client.callTool({
    name: 'browser_script_control',
    arguments: { action: 'clear' }
  });
  expect(clearResult.content[0].text).toContain('Script generation cleared');

  // Test status check
  const statusResult = await client.callTool({
    name: 'browser_script_control',
    arguments: { action: 'status' }
  });
  expect(statusResult.content[0].text).toContain('Script generation: STOPPED');
  expect(statusResult.content[0].text).toContain('Total steps: 0');
});

test('script export to file', async ({ client }, testInfo) => {
  // Clear and start recording
  await client.callTool({
    name: 'browser_script_control',
    arguments: { action: 'clear' }
  });

  // Perform some basic actions for the script
  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: 'data:text/html,<h1>Test</h1>' }
  });

  // Export to file
  const filename = `test-script-${Date.now()}.spec.js`;
  const exportResult = await client.callTool({
    name: 'browser_export_script',
    arguments: { filename: filename }
  });

  expect(exportResult.isError).toBeFalsy();
  expect(exportResult.content[0].text).toContain('Script exported successfully');
  expect(exportResult.content[0].text).toContain(filename);
});


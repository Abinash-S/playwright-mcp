# Live Script Generation Feature

## Overview

The Playwright MCP now includes a powerful **Live Script Generation** feature that creates clean, executable Playwright test scripts while you interact with the browser. This addresses the missing gap of script recording during execution.

## Key Features

### 🚀 **Intelligent Script Generation**
- **Real-time Code Generation**: Generates clean Playwright code as you perform actions
- **Smart Retry Filtering**: Automatically filters out unnecessary retry attempts and redundant actions
- **Proper Wait Conditions**: Adds intelligent wait conditions and assertions for robust tests
- **Clean Output**: Produces production-ready test scripts with proper structure

### 🎯 **Advanced Filtering**
- **Duplicate Detection**: Removes duplicate actions on the same elements
- **Retry Elimination**: Filters out obvious retry attempts within time windows
- **Redundant Step Removal**: Eliminates unnecessary snapshots and console calls
- **Action Optimization**: Combines multiple type operations on the same element

### ✅ **Comprehensive Assertions**
- **Element Visibility**: Automatic assertions for element visibility
- **Text Verification**: Smart text verification with proper locators
- **State Validation**: Element state and value assertions
- **Wait Conditions**: Intelligent waiting for page states and elements

## Usage

### Basic Workflow

1. **Start Recording** (automatically active by default)
```javascript
await client.callTool({
  name: 'browser_script_control',
  arguments: { action: 'start' }
});
```

2. **Perform Browser Actions**
```javascript
// Navigate
await client.callTool({
  name: 'browser_navigate',
  arguments: { url: 'https://example.com' }
});

// Type text
await client.callTool({
  name: 'browser_type',
  arguments: {
    element: 'search input',
    ref: 'input-ref',
    text: 'Playwright'
  }
});

// Click button
await client.callTool({
  name: 'browser_click',
  arguments: {
    element: 'search button',
    ref: 'button-ref'
  }
});

// Verify results
await client.callTool({
  name: 'browser_verify_text_visible',
  arguments: { text: 'Search Results' }
});
```

3. **Export Generated Script**
```javascript
// Preview script
await client.callTool({
  name: 'browser_export_script',
  arguments: { preview: true }
});

// Save to file
await client.callTool({
  name: 'browser_export_script',
  arguments: { filename: 'my-test.spec.js' }
});
```

### Control Commands

#### Check Status
```javascript
await client.callTool({
  name: 'browser_script_control',
  arguments: { action: 'status' }
});
```

#### Stop Recording
```javascript
await client.callTool({
  name: 'browser_script_control',
  arguments: { action: 'stop' }
});
```

#### Clear Script
```javascript
await client.callTool({
  name: 'browser_script_control',
  arguments: { action: 'clear' }
});
```

## Generated Script Structure

### Input Actions
```javascript
// Navigate to page
await page.goto('https://example.com');
await page.waitForLoadState('networkidle');

// Type text with proper waiting
await expect(page.locator('#search-input')).toBeVisible();
await expect(page.locator('#search-input')).toBeEditable();
await page.locator('#search-input').fill('Playwright');

// Click with wait conditions
await expect(page.locator('#search-btn')).toBeVisible();
await expect(page.locator('#search-btn')).toBeEnabled();
await page.locator('#search-btn').click();
```

### Verification/Assertions
```javascript
// Text verification
await expect(page.getByText('Search Results')).toBeVisible();

// Element verification
await expect(page.getByRole('button', { name: 'Submit' })).toBeVisible();

// Wait conditions
await expect(page.getByText('Loading...')).toBeHidden({ timeout: 30000 });
```

### Complete Example
```javascript
import { test, expect } from '@playwright/test';

test('Generated test case', async ({ page }) => {
  // Navigate to page
  await page.goto('https://example.com');
  await page.waitForLoadState('networkidle');

  // Search functionality
  await expect(page.locator('#search-input')).toBeVisible();
  await expect(page.locator('#search-input')).toBeEditable();
  await page.locator('#search-input').fill('Playwright');

  await expect(page.locator('#search-btn')).toBeVisible();
  await expect(page.locator('#search-btn')).toBeEnabled();
  await page.locator('#search-btn').click();

  // Verify results
  await expect(page.getByText('Search Results')).toBeVisible();
  await expect(page.getByText('Playwright')).toBeVisible();
});
```

## Technical Architecture

### Core Components

#### ScriptGenerator Class
- **Purpose**: Central script generation and management
- **Features**: Step tracking, retry detection, code optimization
- **Output**: Clean, executable Playwright scripts

#### Enhanced Tools
- **browser_click**: Click with script generation
- **browser_type**: Text input with script generation  
- **browser_navigate**: Navigation with script generation
- **browser_verify_***: Verification tools with assertions
- **browser_wait_for**: Smart waiting with script generation

#### Script Management Tools
- **browser_script_control**: Start/stop/clear/status control
- **browser_export_script**: Export and preview functionality

### Integration Points

1. **Context Integration**: ScriptGenerator integrated into Context class
2. **Tool Enhancement**: All core tools enhanced with script generation
3. **Session Management**: Coordinated with existing session logging
4. **Output Management**: Clean file output with timestamp-based naming

## Benefits

### For Developers
- ✅ **Faster Test Creation**: Generate tests while exploring functionality
- ✅ **Better Test Quality**: Automatic wait conditions and assertions
- ✅ **Reduced Manual Work**: No need to write test boilerplate from scratch
- ✅ **Learning Tool**: See how actions translate to Playwright code

### For QA Teams
- ✅ **Easy Test Recording**: Record user flows as executable tests
- ✅ **Regression Testing**: Quickly create tests for bug scenarios
- ✅ **Documentation**: Scripts serve as documentation of user flows
- ✅ **Consistency**: Standardized test patterns and wait conditions

### For AI Workflows
- ✅ **Executable Artifacts**: Every AI browser session produces runnable tests
- ✅ **Reproducible Scenarios**: Generated scripts can recreate exact scenarios
- ✅ **Quality Assurance**: Built-in assertions ensure test reliability
- ✅ **Integration Ready**: Scripts compatible with existing CI/CD pipelines

## Configuration

### Output Directory
Scripts are exported to the configured output directory:
```javascript
// Default: ./output
// Configurable via --output-dir or config file
```

### Script Generation Control
- **Auto-start**: Script generation starts automatically with new contexts
- **Manual Control**: Full start/stop/clear control via tools
- **Session Integration**: Coordinates with existing session logging

## Best Practices

### 1. **Action Grouping**
Perform related actions together to generate cohesive script sections:
```javascript
// Good: Grouped login actions
navigate → type username → type password → click login → verify success
```

### 2. **Strategic Verification**
Add verification steps at key points:
```javascript
// After navigation
browser_verify_text_visible: "Welcome"

// After form submission  
browser_verify_text_visible: "Success"
```

### 3. **Wait Management**
Use explicit waits for dynamic content:
```javascript
// Wait for loading to complete
browser_wait_for: { textGone: "Loading..." }

// Wait for results
browser_wait_for: { text: "Search Results" }
```

### 4. **Script Export Timing**
Export scripts at logical completion points:
- After completing a user flow
- Before major navigation changes
- At the end of exploration sessions

## Troubleshooting

### Common Issues

#### Script Not Recording
```javascript
// Check status
browser_script_control: { action: "status" }

// Restart if needed
browser_script_control: { action: "start" }
```

#### Duplicate Actions in Script
- The system automatically filters most duplicates
- Manual retries within 10 seconds are detected and filtered
- Similar actions on same elements are combined when possible

#### Missing Wait Conditions
- System adds wait conditions automatically for most interactions
- Use `browser_wait_for` for complex timing scenarios
- Verify elements are visible before interaction

## Future Enhancements

### Planned Features
- **Visual Regression**: Screenshot comparisons in generated scripts
- **Data-Driven Tests**: Parameterized test generation
- **Advanced Selectors**: Smart selector strategy selection
- **Script Templates**: Customizable script templates and patterns
- **Parallel Generation**: Support for multi-tab script generation

This live script generation feature transforms the Playwright MCP from a simple automation tool into a comprehensive test creation platform, addressing the key gap of script recording during execution.
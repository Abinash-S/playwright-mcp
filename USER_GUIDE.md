# Playwright MCP - Comprehensive User Guide

## Table of Contents

1. [Overview](#overview)
2. [Installation](#installation)
3. [Configuration](#configuration)
4. [Operation Modes](#operation-modes)
5. [Available Tools](#available-tools)
6. [Step Tools Feature](#step-tools-feature)
7. [Usage Examples](#usage-examples)
8. [Advanced Features](#advanced-features)
9. [Troubleshooting](#troubleshooting)
10. [Best Practices](#best-practices)

## Overview

Playwright MCP is a Model Context Protocol (MCP) server that provides browser automation capabilities using [Playwright](https://playwright.dev). It enables Large Language Models (LLMs) to interact with web pages through structured accessibility snapshots rather than visual processing.

### Key Benefits

- **Fast and Lightweight**: Uses Playwright's accessibility tree instead of pixel-based input
- **LLM-Friendly**: Operates on structured data, no vision models required
- **Deterministic**: Avoids ambiguity common with screenshot-based approaches
- **Cross-Platform**: Supports Chrome, Firefox, Safari/WebKit across Windows, macOS, and Linux
- **Flexible**: Multiple operation modes for different use cases

### System Requirements

- **Node.js**: 18.0 or newer
- **Operating System**: Windows, macOS, or Linux
- **MCP Client**: VS Code, Cursor, Windsurf, Claude Desktop, Goose, or any MCP-compatible client
- **Memory**: At least 2GB RAM for browser operations
- **Display**: Optional (supports headless mode)

## Installation

### Quick Start

The simplest way to get started is with the standard configuration:

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["@playwright/mcp@latest"]
    }
  }
}
```

### Client-Specific Installation

<details>
<summary><b>VS Code / VS Code Insiders</b></summary>

**One-Click Install:**
- [Install in VS Code](https://insiders.vscode.dev/redirect?url=vscode%3Amcp%2Finstall%3F%257B%2522name%2522%253A%2522playwright%2522%252C%2522command%2522%253A%2522npx%2522%252C%2522args%2522%253A%255B%2522%2540playwright%252Fmcp%2540latest%2522%255D%257D)
- [Install in VS Code Insiders](https://insiders.vscode.dev/redirect?url=vscode-insiders%3Amcp%2Finstall%3F%257B%2522name%2522%253A%2522playwright%2522%252C%2522command%2522%253A%2522npx%2522%252C%2522args%2522%253A%255B%2522%2540playwright%252Fmcp%2540latest%2522%255D%257D)

**CLI Installation:**
```bash
code --add-mcp '{"name":"playwright","command":"npx","args":["@playwright/mcp@latest"]}'
```

</details>

<details>
<summary><b>Cursor</b></summary>

**One-Click Install:**
[![Install MCP Server](https://cursor.com/deeplink/mcp-install-dark.svg)](cursor://anysphere.cursor-deeplink/mcp/install?name=Playwright&config=eyJjb21tYW5kIjoibnB4IEBwbGF5d3JpZ2h0L21jcEBsYXRlc3QifQ%3D%3D)

**Manual Installation:**
1. Go to `Cursor Settings` → `MCP` → `Add new MCP Server`
2. Name: `Playwright`
3. Command: `npx @playwright/mcp@latest`

</details>

<details>
<summary><b>Claude Desktop</b></summary>

Add to your Claude Desktop configuration file:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["@playwright/mcp@latest"]
    }
  }
}
```

</details>

<details>
<summary><b>Other Clients</b></summary>

- **Goose**: [One-click install](https://block.github.io/goose/extension?cmd=npx&arg=%40playwright%2Fmcp%40latest&id=playwright&name=Playwright)
- **LM Studio**: [Add MCP Server](https://lmstudio.ai/install-mcp?name=playwright&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyJAcGxheXdyaWdodC9tY3BAbGF0ZXN0Il19)
- **Windsurf**: Follow [MCP documentation](https://docs.windsurf.com/windsurf/cascade/mcp)

</details>

## Configuration

### Command Line Options

Playwright MCP supports extensive configuration through command-line arguments:

#### Browser Configuration
- `--browser <browser>`: Browser engine (`chrome`, `firefox`, `webkit`, `msedge`)
- `--headless`: Run in headless mode (no GUI)
- `--device <device>`: Emulate specific device (e.g., "iPhone 15")
- `--executable-path <path>`: Custom browser executable path
- `--user-data-dir <path>`: Browser profile directory

#### Network & Security
- `--allowed-origins <origins>`: Semicolon-separated allowed origins
- `--blocked-origins <origins>`: Semicolon-separated blocked origins
- `--proxy-server <proxy>`: Proxy server URL
- `--proxy-bypass <bypass>`: Domains to bypass proxy
- `--ignore-https-errors`: Ignore SSL certificate errors
- `--no-sandbox`: Disable browser sandbox (Linux containers)

#### Features & Capabilities
- `--caps <caps>`: Enable additional capabilities (`vision`, `pdf`)
- `--isolated`: Use in-memory profiles (no persistence)
- `--save-session`: Save session logs and state
- `--save-trace`: Save Playwright execution traces
- `--step-tools`: Enable step-by-step automation mode

#### Server Options
- `--port <port>`: Run as HTTP server on specified port
- `--host <host>`: Bind to specific host (default: localhost)
- `--output-dir <path>`: Directory for output files

### Configuration File

For complex setups, use a JSON configuration file:

```bash
npx @playwright/mcp@latest --config path/to/config.json
```

#### Example Configuration File

```json
{
  "browser": {
    "browserName": "chrome",
    "headless": false,
    "launchOptions": {
      "channel": "chrome",
      "args": ["--start-maximized"]
    },
    "contextOptions": {
      "viewport": { "width": 1920, "height": 1080 },
      "userAgent": "Custom User Agent"
    }
  },
  "server": {
    "port": 3001,
    "host": "localhost"
  },
  "capabilities": ["vision", "pdf"],
  "network": {
    "allowedOrigins": ["https://example.com"],
    "blockedOrigins": ["https://ads.example.com"]
  },
  "saveSession": true,
  "outputDir": "./playwright-sessions"
}
```

### User Profiles

#### Persistent Profile (Default)
Maintains login state and settings between sessions:
- **Windows**: `%USERPROFILE%\AppData\Local\ms-playwright\mcp-{channel}-profile`
- **macOS**: `~/Library/Caches/ms-playwright/mcp-{channel}-profile`
- **Linux**: `~/.cache/ms-playwright/mcp-{channel}-profile`

#### Isolated Profile
Each session starts fresh:
```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": [
        "@playwright/mcp@latest",
        "--isolated",
        "--storage-state=path/to/initial-state.json"
      ]
    }
  }
}
```

## Operation Modes

### 1. Standard Mode (Default)

Basic browser automation with all core tools:

```bash
npx @playwright/mcp@latest
```

**Available Tools**: 21 core browser automation tools
**Use Cases**: General web automation, testing, data extraction

### 2. Step Tools Mode

Enhanced mode with step-by-step automation capabilities:

```bash
npx @playwright/mcp@latest --step-tools
```

**Available Tools**: 26 tools (21 browser + 5 step management)
**Use Cases**: Complex multi-step workflows, guided automation, resumable tasks

### 3. Loop Tools Mode

AI-driven autonomous automation:

```bash
npx @playwright/mcp@latest --loop-tools
```

**Requirements**: OpenAI API key or Anthropic API key
**Use Cases**: Autonomous web navigation, complex problem-solving

### 4. Extension Mode

Connect to existing browser sessions:

```bash
npx @playwright/mcp@latest --extension
```

**Requirements**: Playwright MCP Bridge browser extension
**Use Cases**: Work with existing login sessions, debugging

### 5. HTTP Server Mode

Run as standalone HTTP server:

```bash
npx @playwright/mcp@latest --port 3001
```

**Use Cases**: Remote access, containerized deployments, CI/CD

## Available Tools

### Core Automation Tools (21 tools)

#### Navigation & Page Management
- `browser_navigate`: Navigate to URLs
- `browser_navigate_back`: Go back in browser history
- `browser_close`: Close current page/browser
- `browser_resize`: Resize browser window
- `browser_tabs`: Manage multiple tabs

#### Element Interaction
- `browser_click`: Click elements (single/double click)
- `browser_type`: Type text into fields
- `browser_hover`: Hover over elements
- `browser_drag`: Drag and drop between elements
- `browser_select_option`: Select dropdown options
- `browser_fill_form`: Fill multiple form fields

#### Information Gathering
- `browser_snapshot`: Capture accessibility tree (recommended)
- `browser_take_screenshot`: Take visual screenshots
- `browser_console_messages`: Get browser console logs
- `browser_network_requests`: List network requests

#### Advanced Actions
- `browser_evaluate`: Execute JavaScript
- `browser_file_upload`: Upload files
- `browser_handle_dialog`: Handle alert/confirm dialogs
- `browser_press_key`: Press keyboard keys
- `browser_wait_for`: Wait for conditions

#### Browser Management
- `browser_install`: Install browser binaries

### Optional Capability Tools

#### Vision Tools (--caps=vision)
- `browser_mouse_click_xy`: Click at coordinates
- `browser_mouse_move_xy`: Move mouse to coordinates
- `browser_mouse_drag_xy`: Drag between coordinates

#### PDF Tools (--caps=pdf)
- `browser_pdf_save`: Save page as PDF

### Step Management Tools (--step-tools)

When using `--step-tools` mode, you get 5 additional tools for managing complex workflows:

- `step_start_session`: Create new automation session with step list
- `step_execute_next`: Execute the next pending step
- `step_retry`: Retry a failed step
- `step_skip`: Skip a step and move to next
- `step_status`: Get current session status

**Note**: In step-tools mode, you get **both** the 21 core browser tools **and** the 5 step management tools, for a total of 26 available tools.

## Step Tools Feature

The Step Tools feature is designed for complex, multi-step automation workflows that may need to be paused, resumed, or debugged.

### How It Works

1. **Session Creation**: Define a list of automation steps
2. **Step Execution**: Execute steps one by one with full control
3. **State Management**: Track progress, handle failures, resume from any point
4. **Logging**: Comprehensive session logs for debugging

### Step Input Formats

Step Tools support multiple input formats for maximum flexibility:

#### Markdown Numbered Lists
```markdown
# Login to a website

1. Navigate to https://example.com
2. Click on the login button
3. Fill in username field
4. Fill in password field
5. Click submit button
6. Verify successful login
```

#### Markdown Bullet Points
```markdown
- Open the website homepage
- Search for a product
- Add product to cart
- Proceed to checkout
- Complete the purchase
```

#### Array Format
```json
[
  "Navigate to https://example.com",
  "Click on the login button", 
  "Fill in username and password",
  "Submit the login form",
  "Navigate to the dashboard",
  "Extract important data",
  "Generate a report"
]
```

#### Mixed Content with Code Blocks
```markdown
1. Navigate to the page
2. Execute some JavaScript:
   ```javascript
   console.log('Hello World');
   ```
3. Continue with next step
```

### Example Workflow

```javascript
// 1. Start a session with markdown steps
step_start_session({
  "steps": "# E-commerce Automation\n\n1. Navigate to https://example-shop.com\n2. Click on the login button\n3. Fill in username and password\n4. Submit the login form\n5. Search for 'laptop computers'\n6. Add first result to cart\n7. Proceed to checkout",
  "name": "E-commerce Purchase Flow",
  "metadata": {
    "url": "https://example-shop.com",
    "type": "purchase_flow"
  }
})

// 2. Execute steps one by one with the returned session ID
step_execute_next({ "sessionId": "session-1234567890-abc123" })  // Executes: "Navigate to https://example-shop.com"
step_execute_next({ "sessionId": "session-1234567890-abc123" })  // Executes: "Click on the login button"

// 3. If a step fails, you can retry or skip
step_retry({ "sessionId": "session-1234567890-abc123" })         // Retry the last failed step
step_skip({ "sessionId": "session-1234567890-abc123" })          // Skip current step and move to next

// 4. Check progress anytime
step_status({ "sessionId": "session-1234567890-abc123" })        // Shows current step, completed steps, remaining steps

// 5. List all sessions
step_status({})  // Shows all active sessions
```

### Benefits of Step Tools

- **Resumability**: Continue from where you left off
- **Debugging**: Inspect state at each step with detailed logs
- **Error Handling**: Retry failed steps without starting over
- **Progress Tracking**: Clear visibility into workflow progress
- **Session Persistence**: Sessions are saved to disk and can be resumed later
- **Comprehensive Logging**: All step events are logged alongside browser actions
- **Browser Tool Integration**: Use all 21 standard browser tools within step workflows
- **Multiple Sessions**: Manage multiple concurrent automation sessions

### Session Output Structure

When using step tools, your output directory will contain comprehensive logging:

```
output/
├── session-1703123456789/
│   ├── session.md                           # Complete session log with step events
│   ├── session-1703123456789-abc123.steps.json  # Step session data
│   ├── 001.snapshot.yml                     # Browser snapshots for each action
│   ├── 002.snapshot.yml
│   └── ...
```

### Step Status Tracking

Steps progress through these states:
- **pending**: Not yet started
- **running**: Currently executing
- **completed**: Successfully finished
- **failed**: Execution failed
- **skipped**: Manually skipped

Sessions have these states:
- **created**: Session created, ready to start
- **running**: Steps are being executed
- **paused**: Session paused (typically due to failure)
- **completed**: All steps finished
- **failed**: Session failed and cannot continue

## Usage Examples

### Basic Web Automation

```javascript
// Navigate to a website
browser_navigate({ url: "https://example.com" })

// Take a snapshot to see the page structure
browser_snapshot()

// Click on a login button (using ref from snapshot)
browser_click({
  element: "Login button",
  ref: "button[data-testid='login']"
})

// Fill in a form
browser_fill_form({
  fields: [
    { element: "Email field", ref: "input[type='email']", text: "user@example.com" },
    { element: "Password field", ref: "input[type='password']", text: "password123" }
  ]
})

// Submit the form
browser_press_key({ key: "Enter" })
```

### Data Extraction

```javascript
// Navigate to data source
browser_navigate({ url: "https://data-source.com" })

// Extract data using JavaScript
browser_evaluate({
  function: `() => {
    const rows = Array.from(document.querySelectorAll('table tr'));
    return rows.map(row => {
      const cells = Array.from(row.querySelectorAll('td'));
      return cells.map(cell => cell.textContent.trim());
    });
  }`
})
```

### File Operations

```javascript
// Upload files
browser_file_upload({
  paths: ["/path/to/document.pdf", "/path/to/image.jpg"]
})

// Download as PDF
browser_pdf_save({
  filename: "report-2024.pdf"
})
```

### Multi-Step Workflow with Step Tools

```javascript
// 1. Define complex workflow with array format
step_start_session({
  "steps": [
    "Navigate to the e-commerce site",
    "Search for 'laptop computers'",
    "Filter results by price range $500-$1000", 
    "Sort by customer ratings",
    "Extract top 10 product details",
    "Compare specifications",
    "Generate comparison report"
  ],
  "name": "Product Research Automation",
  "metadata": {
    "category": "research",
    "target_site": "e-commerce"
  }
})

// 2. Execute step by step with full control (use the returned sessionId)
step_execute_next({ "sessionId": "session-1234567890-abc123" })  // Navigation
step_status({ "sessionId": "session-1234567890-abc123" })        // Check progress
step_execute_next({ "sessionId": "session-1234567890-abc123" })  // Search

// 3. Handle failures gracefully
if (step_fails) {
  step_retry({ "sessionId": "session-1234567890-abc123" })       // Try again
  // OR
  step_skip({ "sessionId": "session-1234567890-abc123" })        // Skip and continue
}

// 4. Continue until completion
// The session automatically tracks which steps are done, failed, or pending
```

### Combining Step Tools with Browser Tools

Step Tools work seamlessly with all browser automation tools:

```javascript
// Start a session
step_start_session({
  "steps": "1. Navigate to login page\n2. Take screenshot\n3. Fill login form\n4. Submit and verify",
  "name": "Login Test with Screenshots"
})

// Execute first step - this uses browser_navigate internally
step_execute_next({ "sessionId": "session-123" })

// Take manual actions between steps if needed
browser_take_screenshot({ "filename": "before-login.png" })
browser_snapshot()  // Get current page state

// Continue with next step
step_execute_next({ "sessionId": "session-123" })
```

## Advanced Features

### Browser Extension Integration

Connect to your existing browser session:

1. Install the Playwright MCP Bridge extension
2. Run with `--extension` flag
3. Work with existing login sessions and browser state

### Remote Browser Connection

Connect to remote browser instances:

```bash
# Connect to remote Chrome DevTools
npx @playwright/mcp@latest --cdp-endpoint ws://remote-host:9222
```

### Container Deployment

```dockerfile
# Use official Playwright image
FROM mcr.microsoft.com/playwright/mcp

# Your app setup
COPY . /app
WORKDIR /app

EXPOSE 3001
CMD ["npx", "@playwright/mcp@latest", "--port", "3001", "--headless"]
```

### CI/CD Integration

```yaml
# GitHub Actions example
- name: Run Playwright MCP Tests
  run: |
    npm install @playwright/mcp@latest
    npx @playwright/mcp@latest --headless --save-trace
```

### Programmatic Usage

```javascript
import { createConnection } from '@playwright/mcp';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';

const connection = await createConnection({
  browser: { launchOptions: { headless: true } }
});

// Use connection with your MCP client
```

## Troubleshooting

### Common Issues

#### Browser Installation Problems

```bash
# Install browsers manually
npx playwright install
npx playwright install-deps

# Or use the tool
browser_install()
```

#### Permission Errors (Linux)

```bash
# Add to your config
"args": ["@playwright/mcp@latest", "--no-sandbox"]
```

#### Display Issues (Linux/Containers)

```bash
# For headless operation
"args": ["@playwright/mcp@latest", "--headless"]

# For headed operation with virtual display
export DISPLAY=:99
Xvfb :99 -screen 0 1024x768x24 &
```

#### Memory Issues

```bash
# Reduce memory usage
"args": [
  "@playwright/mcp@latest",
  "--browser=chrome",
  "--isolated",
  "--headless"
]
```

#### Network Connectivity

```bash
# Configure proxy
"args": [
  "@playwright/mcp@latest",
  "--proxy-server=http://proxy:8080",
  "--proxy-bypass=localhost,127.0.0.1"
]
```

### Debug Mode

Enable detailed logging:

```bash
# Set debug environment
DEBUG=pw:mcp:* npx @playwright/mcp@latest

# Or in configuration
env: {
  "DEBUG": "pw:mcp:*"
}
```

### Session Logs

Enable session logging for troubleshooting:

```bash
npx @playwright/mcp@latest --save-session --output-dir ./debug-logs
```

## Best Practices

### Performance Optimization

1. **Use Headless Mode**: Faster execution in production
2. **Optimize Selectors**: Use stable, unique element references
3. **Batch Operations**: Combine multiple actions when possible
4. **Clean Up**: Close tabs and sessions when done

### Security Considerations

1. **Limit Origins**: Use `--allowed-origins` for restricted access
2. **Sandbox Environment**: Use `--isolated` for untrusted content
3. **Network Filtering**: Block unnecessary domains with `--blocked-origins`
4. **Credential Management**: Use environment variables for sensitive data

### Reliability

1. **Wait Strategies**: Use `browser_wait_for` for dynamic content
2. **Error Handling**: Implement retry logic with step tools
3. **State Validation**: Take snapshots to verify page state
4. **Graceful Degradation**: Handle missing elements appropriately

### Development Workflow

1. **Start with Snapshots**: Always take a snapshot to understand page structure
2. **Use Step Tools**: For complex workflows requiring debugging
3. **Save Sessions**: Enable session saving during development
4. **Test Incrementally**: Build automation step by step

### Maintenance

1. **Update Regularly**: Keep Playwright MCP updated
2. **Monitor Logs**: Review session logs for issues
3. **Version Control**: Store configuration files in version control
4. **Documentation**: Document complex workflows and selectors

---

## Support and Resources

- **GitHub Repository**: [microsoft/playwright-mcp](https://github.com/microsoft/playwright-mcp)
- **Playwright Documentation**: [playwright.dev](https://playwright.dev)
- **MCP Protocol**: [modelcontextprotocol.io](https://modelcontextprotocol.io)
- **Issue Reporting**: Use GitHub Issues for bugs and feature requests

---

This comprehensive guide should help you get the most out of Playwright MCP. Whether you're doing simple web automation or complex multi-step workflows, Playwright MCP provides the tools and flexibility to accomplish your goals efficiently and reliably.

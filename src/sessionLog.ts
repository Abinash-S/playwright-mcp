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

import fs from 'fs';
import path from 'path';

import { Response } from './response.js';
import { logUnhandledError } from './utils/log.js';
import { outputFile  } from './config.js';

import type { FullConfig } from './config.js';
import type * as actions from './actions.js';
import type { Tab, TabSnapshot } from './tab.js';

type LogEntry = {
  timestamp: number;
  toolCall?: {
    toolName: string;
    toolArgs: Record<string, any>;
    result: string;
    isError?: boolean;
  };
  userAction?: actions.Action;
  code: string;
  tabSnapshot?: TabSnapshot;
  stepEvent?: {
    type: 'session_created' | 'step_started' | 'step_completed' | 'step_failed' | 'step_skipped' | 'session_completed';
    sessionId?: string;
    stepId?: string;
    data?: any;
  };
};

export class SessionLog {
  private _folder: string;
  private _file: string;
  private _ordinal = 0;
  private _pendingEntries: LogEntry[] = [];
  private _sessionFileQueue = Promise.resolve();
  private _flushEntriesTimeout: NodeJS.Timeout | undefined;
  private _stepSessions = new Map<string, any>();

  constructor(sessionFolder: string) {
    this._folder = sessionFolder;
    this._file = path.join(this._folder, 'session.md');
  }

  get sessionFolder(): string {
    return this._folder;
  }

  static async create(config: FullConfig, rootPath: string | undefined): Promise<SessionLog> {
    // Create session in the sessions subdirectory
    const baseSessionFolder = await outputFile(config, rootPath, `session-${Date.now()}`);
    const sessionFolder = path.join(path.dirname(baseSessionFolder), 'sessions', path.basename(baseSessionFolder));
    await fs.promises.mkdir(sessionFolder, { recursive: true });
    // eslint-disable-next-line no-console
    console.error(`Session: ${sessionFolder}`);
    return new SessionLog(sessionFolder);
  }

  logResponse(response: Response) {
    const entry: LogEntry = {
      timestamp: performance.now(),
      toolCall: {
        toolName: response.toolName,
        toolArgs: response.toolArgs,
        result: response.result(),
        isError: response.isError(),
      },
      code: response.code(),
      tabSnapshot: response.tabSnapshot(),
    };
    this._appendEntry(entry);
  }

  logUserAction(action: actions.Action, tab: Tab, code: string, isUpdate: boolean) {
    code = code.trim();
    if (isUpdate) {
      const lastEntry = this._pendingEntries[this._pendingEntries.length - 1];
      if (lastEntry.userAction?.name === action.name) {
        lastEntry.userAction = action;
        lastEntry.code = code;
        return;
      }
    }
    if (action.name === 'navigate') {
      // Already logged at this location.
      const lastEntry = this._pendingEntries[this._pendingEntries.length - 1];
      if (lastEntry?.tabSnapshot?.url === action.url)
        return;
    }
    const entry: LogEntry = {
      timestamp: performance.now(),
      userAction: action,
      code,
      tabSnapshot: {
        url: tab.page.url(),
        title: '',
        ariaSnapshot: action.ariaSnapshot || '',
        modalStates: [],
        consoleMessages: [],
        downloads: [],
      },
    };
    this._appendEntry(entry);
  }

  private _appendEntry(entry: LogEntry) {
    this._pendingEntries.push(entry);
    if (this._flushEntriesTimeout)
      clearTimeout(this._flushEntriesTimeout);
    this._flushEntriesTimeout = setTimeout(() => this._flushEntries(), 1000);
  }

  private async _flushEntries() {
    clearTimeout(this._flushEntriesTimeout);
    const entries = this._pendingEntries;
    this._pendingEntries = [];
    const lines: string[] = [''];

    for (const entry of entries) {
      const ordinal = (++this._ordinal).toString().padStart(3, '0');
      if (entry.toolCall) {
        lines.push(
            `### Tool call: ${entry.toolCall.toolName}`,
            `- Args`,
            '```json',
            JSON.stringify(entry.toolCall.toolArgs, null, 2),
            '```',
        );
        if (entry.toolCall.result) {
          lines.push(
              entry.toolCall.isError ? `- Error` : `- Result`,
              '```',
              entry.toolCall.result,
              '```',
          );
        }
      }

      if (entry.userAction) {
        const actionData = { ...entry.userAction } as any;
        delete actionData.ariaSnapshot;
        delete actionData.selector;
        delete actionData.signals;

        lines.push(
            `### User action: ${entry.userAction.name}`,
            `- Args`,
            '```json',
            JSON.stringify(actionData, null, 2),
            '```',
        );
      }

      if (entry.code) {
        lines.push(
            `- Code`,
            '```js',
            entry.code,
            '```');
      }

      if (entry.tabSnapshot) {
        const fileName = `${ordinal}.snapshot.yml`;
        fs.promises.writeFile(path.join(this._folder, fileName), entry.tabSnapshot.ariaSnapshot).catch(logUnhandledError);
        lines.push(`- Snapshot: ${fileName}`);
      }

      lines.push('', '');
    }

    this._sessionFileQueue = this._sessionFileQueue.then(() => fs.promises.appendFile(this._file, lines.join('\n')));
  }

  // Step Tools Methods
  async createStepSession(steps: string | string[], name?: string, metadata?: Record<string, any>): Promise<any> {
    const { StepParser } = await import('./stepTools/stepParser.js');
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const parsedSteps = StepParser.parseSteps(steps);
    
    const stepList: any[] = parsedSteps.steps.map((step: any, index: number) => ({
      id: `${sessionId}-step-${index + 1}`,
      description: step.description,
      status: 'pending',
    }));

    const session: any = {
      id: sessionId,
      name,
      status: 'created',
      steps: stepList,
      currentStepIndex: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: { ...parsedSteps.metadata, ...metadata },
    };

    this._stepSessions.set(sessionId, session);
    
    // Log session creation
    this._appendEntry({
      timestamp: performance.now(),
      stepEvent: {
        type: 'session_created',
        sessionId: session.id,
        data: {
          name: session.name,
          totalSteps: session.steps.length,
          steps: session.steps.map((s: any) => ({ id: s.id, description: s.description })),
          metadata: session.metadata,
        }
      },
      code: '',
    });

    // Save step session to disk
    const stepsFile = path.join(this._folder, `${sessionId}.steps.json`);
    fs.promises.writeFile(stepsFile, JSON.stringify(session, null, 2)).catch(logUnhandledError);

    return session;
  }

  getStepSession(sessionId: string): any | undefined {
    return this._stepSessions.get(sessionId);
  }

  markStepSkipped(sessionId: string, stepId: string, reason?: string): boolean {
    const session = this._stepSessions.get(sessionId);
    if (!session) return false;

    const step = session.steps.find((s: any) => s.id === stepId);
    if (!step) return false;

    step.status = 'skipped';
    step.skippedAt = new Date();
    step.skipReason = reason;
    session.updatedAt = new Date();

    // Log step skip
    this._appendEntry({
      timestamp: performance.now(),
      stepEvent: {
        type: 'step_skipped',
        sessionId: session.id,
        stepId: step.id,
        data: { reason }
      },
      code: '',
    });

    // Check if session is complete
    const allDone = session.steps.every((s: any) => s.status === 'completed' || s.status === 'skipped');
    if (allDone) {
      session.status = 'completed';
      this._appendEntry({
        timestamp: performance.now(),
        stepEvent: {
          type: 'session_completed',
          sessionId: session.id,
          data: { totalSteps: session.steps.length }
        },
        code: '',
      });
    }

    // Save updated session
    this._saveStepSession(session);
    return true;
  }

  resetStepToPending(sessionId: string, stepId: string): boolean {
    const session = this._stepSessions.get(sessionId);
    if (!session) return false;

    const step = session.steps.find((s: any) => s.id === stepId);
    if (!step) return false;

    step.status = 'pending';
    step.error = undefined;
    step.failedAt = undefined;
    session.status = 'running';
    session.updatedAt = new Date();

    // Save updated session
    this._saveStepSession(session);
    return true;
  }

  private _saveStepSession(session: any): void {
    const stepsFile = path.join(this._folder, `${session.id}.steps.json`);
    fs.promises.writeFile(stepsFile, JSON.stringify(session, null, 2)).catch(logUnhandledError);
  }

  getAllStepSessions(): any[] {
    return Array.from(this._stepSessions.values()).sort((a: any, b: any) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  getStepSessionStatus(sessionId: string): { session: any; currentStep?: any; nextStep?: any } {
    const session = this._stepSessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const currentStep = session.steps.find((step: any) => step.status === 'pending' || step.status === 'failed');
    const nextStep = session.steps.find((step: any) => step.status === 'pending');

    return { session, currentStep, nextStep };
  }

  deleteStepSession(sessionId: string): boolean {
    const deleted = this._stepSessions.delete(sessionId);
    if (deleted) {
      // Also delete the session file
      const stepsFile = path.join(this._folder, `${sessionId}.steps.json`);
      fs.promises.unlink(stepsFile).catch(() => {}); // Ignore errors
    }
    return deleted;
  }
}

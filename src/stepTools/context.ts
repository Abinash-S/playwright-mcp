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

import { SessionLog } from '../sessionLog.js';
import type { FullConfig } from '../config.js';

export class Context {
  readonly sessionLog: SessionLog;
  private _config: FullConfig;

  constructor(config: FullConfig, sessionLog: SessionLog) {
    this._config = config;
    this.sessionLog = sessionLog;
  }

  static async create(config: FullConfig, existingSessionLog?: SessionLog): Promise<Context> {
    let sessionLog = existingSessionLog;
    
    // Create session log only if not provided and session saving is enabled
    if (!sessionLog && config.saveSession) {
      sessionLog = await SessionLog.create(config, undefined);
    }
    
    if (!sessionLog) {
      throw new Error('Session logging must be enabled for step tools. Use --save-session flag.');
    }

    const context = new Context(config, sessionLog);
    return context;
  }

  async close() {
    // Simple cleanup - no external resources to close
  }
}

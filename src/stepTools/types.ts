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

export type StepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export type Step = {
  id: string;
  description: string;
  status: StepStatus;
  result?: string;
  error?: string;
  executedAt?: Date;
  duration?: number;
};

export type SessionStatus = 'created' | 'running' | 'paused' | 'completed' | 'failed';

export type StepSession = {
  id: string;
  name?: string;
  status: SessionStatus;
  steps: Step[];
  currentStepIndex: number;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  metadata?: Record<string, any>;
};

export type StepResult = {
  success: boolean;
  stepId: string;
  sessionId: string;
  result?: string;
  error?: string;
  duration: number;
  nextStepId?: string;
  sessionStatus: SessionStatus;
  totalSteps: number;
  completedSteps: number;
};

export type ParsedSteps = {
  steps: Omit<Step, 'id' | 'status' | 'executedAt' | 'duration'>[];
  metadata?: Record<string, any>;
};

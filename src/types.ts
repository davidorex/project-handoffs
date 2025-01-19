export interface NextStep {
  id: string;
  projectId: string;
  title: string;
  description: string;
  status: 'open' | 'in-progress' | 'completed' | 'blocked';
  priority: 'core-critical' | 'full-required' | 'enhancement';
  parentStepId?: string;
  dependencies: string[];
  created: string;
  lastModified: string;
}

export interface WorkingSession {
  id: string;
  nextStepId: string;
  startTime: string;
  endTime?: string;
  progressNotes: string[];
  blockers: string[];
  decisions: string[];
}

export interface Handoff {
  id: string;
  sessionId: string;
  completedWork: string;
  codeState: string;
  environmentState: string;
  unresolvedIssues: string[];
  newNextSteps: string[];
  timestamp: string;
}

export interface ProjectMetadata {
  id: string;
  name: string;
  description: string;
  created: string;
  lastAccessed: string;
}
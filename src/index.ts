#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { HANDOFF_TEMPLATES } from './templates.js';
import { NextStep, WorkingSession, Handoff, ProjectMetadata } from './types.js';
import { ProjectError } from './errors.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_STORAGE_DIR = path.join(__dirname, 'project_data');

interface ProjectData {
  nextSteps: NextStep[];
  workingSessions: WorkingSession[];
  handoffs: Handoff[];
}

class ProjectManager {
  private metadataPath: string;

  constructor() {
    this.metadataPath = path.join(BASE_STORAGE_DIR, 'projects.json');
  }

  private async ensureStorageExists(): Promise<void> {
    try {
      await fs.mkdir(BASE_STORAGE_DIR, { recursive: true });
      try {
        await fs.access(this.metadataPath);
      } catch {
        await fs.writeFile(this.metadataPath, JSON.stringify({ projects: [] }, null, 2));
      }
    } catch (error) {
      throw new ProjectError(`Failed to initialize storage: ${error}`, 'system');
    }
  }

  private async loadMetadata(): Promise<ProjectMetadata[]> {
    await this.ensureStorageExists();
    try {
      const data = await fs.readFile(this.metadataPath, 'utf-8');
      return JSON.parse(data).projects;
    } catch (error) {
      throw new ProjectError(`Failed to load metadata: ${error}`, 'system');
    }
  }

  private async saveMetadata(projects: ProjectMetadata[]): Promise<void> {
    try {
      await fs.writeFile(this.metadataPath, JSON.stringify({ projects }, null, 2));
    } catch (error) {
      throw new ProjectError(`Failed to save metadata: ${error}`, 'system');
    }
  }

  private async loadProjectData(projectId: string): Promise<ProjectData> {
    try {
      const dataPath = path.join(BASE_STORAGE_DIR, `${projectId}.json`);
      try {
        const data = await fs.readFile(dataPath, 'utf-8');
        return JSON.parse(data);
      } catch (error) {
        if ((error as any).code === 'ENOENT') {
          return { nextSteps: [], workingSessions: [], handoffs: [] };
        }
        throw error;
      }
    } catch (error) {
      throw new ProjectError(`Failed to load project data: ${error}`, projectId);
    }
  }

  private async saveProjectData(projectId: string, data: ProjectData): Promise<void> {
    try {
      const dataPath = path.join(BASE_STORAGE_DIR, `${projectId}.json`);
      await fs.writeFile(dataPath, JSON.stringify(data, null, 2));
    } catch (error) {
      throw new ProjectError(`Failed to save project data: ${error}`, projectId);
    }
  }

  private validateTemplate(type: string, data: Record<string, any>): void {
    const template = HANDOFF_TEMPLATES[type];
    if (!template) return; // Non-templated types are valid

    const missingFields = template.fields
      .filter(field => field.required)
      .filter(field => {
        const fieldName = field.name.toLowerCase().replace(/\s+/g, '_');
        return !data[fieldName] && !data[field.name];
      });

    if (missingFields.length > 0) {
      throw new ProjectError(
        `Missing required fields for ${type}: ${missingFields.map(f => f.name).join(', ')}`,
        data.projectId || 'validation'
      );
    }
  }

  async createProject(name: string, description: string): Promise<ProjectMetadata> {
    const projects = await this.loadMetadata();
    const id = name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    
    if (projects.some(p => p.id === id)) {
      throw new ProjectError('Project with this name already exists', id);
    }

    const newProject: ProjectMetadata = {
      id,
      name,
      description,
      created: new Date().toISOString(),
      lastAccessed: new Date().toISOString()
    };

    projects.push(newProject);
    await this.saveMetadata(projects);
    await this.saveProjectData(id, { nextSteps: [], workingSessions: [], handoffs: [] });
    
    return newProject;
  }

  async deleteProject(projectId: string): Promise<void> {
    const projects = await this.loadMetadata();
    const projectIndex = projects.findIndex(p => p.id === projectId);
    
    if (projectIndex === -1) {
      throw new ProjectError('Project not found', projectId);
    }

    // Remove project metadata
    projects.splice(projectIndex, 1);
    await this.saveMetadata(projects);

    // Delete project data file
    try {
      await fs.unlink(path.join(BASE_STORAGE_DIR, `${projectId}.json`));
    } catch (error) {
      console.error(`Failed to delete project data file: ${error}`);
    }
  }

  async createNextStep(projectId: string, step: Omit<NextStep, 'id' | 'created' | 'lastModified'>): Promise<NextStep> {
    this.validateTemplate('next_step', step);
    
    const data = await this.loadProjectData(projectId);
    
    const newStep: NextStep = {
      ...step,
      id: `step_${Date.now()}`,
      created: new Date().toISOString(),
      lastModified: new Date().toISOString(),
    };

    // Validate dependencies exist
    if (step.dependencies?.length) {
      const missingDeps = step.dependencies.filter(
        depId => !data.nextSteps.some(s => s.id === depId)
      );
      if (missingDeps.length > 0) {
        throw new ProjectError(`Dependencies not found: ${missingDeps.join(', ')}`, projectId);
      }
    }

    data.nextSteps.push(newStep);
    await this.saveProjectData(projectId, data);
    return newStep;
  }

  async startWorkingSession(projectId: string, nextStepId: string): Promise<WorkingSession> {
    const data = await this.loadProjectData(projectId);
    
    const step = data.nextSteps.find(s => s.id === nextStepId);
    if (!step) {
      throw new ProjectError(`Next step not found: ${nextStepId}`, projectId);
    }
    if (step.status !== 'open') {
      throw new ProjectError(`Next step is not open: ${nextStepId}`, projectId);
    }
    
    step.status = 'in-progress';
    step.lastModified = new Date().toISOString();

    const session: WorkingSession = {
      id: `session_${Date.now()}`,
      nextStepId,
      startTime: new Date().toISOString(),
      progressNotes: [],
      blockers: [],
      decisions: []
    };

    data.workingSessions.push(session);
    await this.saveProjectData(projectId, data);
    return session;
  }

  async createHandoff(
    projectId: string,
    sessionId: string,
    handoff: Omit<Handoff, 'id' | 'sessionId' | 'timestamp'>
  ): Promise<Handoff> {
    this.validateTemplate('handoff', handoff);
    
    const data = await this.loadProjectData(projectId);
    
    const session = data.workingSessions.find(s => s.id === sessionId);
    if (!session) {
      throw new ProjectError(`Session not found: ${sessionId}`, projectId);
    }
    if (session.endTime) {
      throw new ProjectError(`Session already ended: ${sessionId}`, projectId);
    }

    const step = data.nextSteps.find(s => s.id === session.nextStepId);
    if (!step) {
      throw new ProjectError(`Associated next step not found: ${session.nextStepId}`, projectId);
    }

    session.endTime = new Date().toISOString();
    step.status = 'completed';
    step.lastModified = new Date().toISOString();

    const newHandoff: Handoff = {
      ...handoff,
      id: `handoff_${Date.now()}`,
      sessionId,
      timestamp: new Date().toISOString()
    };

    data.handoffs.push(newHandoff);
    await this.saveProjectData(projectId, data);
    return newHandoff;
  }

  async getLatestNextSteps(projectId: string): Promise<NextStep[]> {
    const data = await this.loadProjectData(projectId);
    return data.nextSteps
      .filter(step => step.status === 'open')
      .sort((a, b) => {
        const priorityOrder = {
          'core-critical': 0,
          'full-required': 1,
          'enhancement': 2
        };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      });
  }

  async getNextStepHistory(projectId: string, stepId: string): Promise<{
    step: NextStep;
    session?: WorkingSession;
    handoff?: Handoff;
  }> {
    const data = await this.loadProjectData(projectId);
    
    const step = data.nextSteps.find(s => s.id === stepId);
    if (!step) {
      throw new ProjectError(`Next step not found: ${stepId}`, projectId);
    }

    const session = data.workingSessions.find(s => s.nextStepId === stepId);
    const handoff = session ? data.handoffs.find(h => h.sessionId === session.id) : undefined;

    return { step, session, handoff };
  }
}

const projectManager = new ProjectManager();

const server = new Server({
  name: "project-handoffs",
  version: "1.0.0",
}, {
  capabilities: {
    tools: {},
  },
});

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "list_templates",
        description: "List available templates for next steps, working sessions, and handoffs",
        inputSchema: {
          type: "object",
          properties: {}
        }
      },
      {
        name: "create_project",
        description: "Create a new project for tracking AI session handoffs",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string", description: "Project name" },
            description: { type: "string", description: "Project description" }
          },
          required: ["name", "description"]
        }
      },
      {
        name: "delete_project",
        description: "Delete a project and all its data",
        inputSchema: {
          type: "object",
          properties: {
            projectId: { type: "string", description: "Project identifier" }
          },
          required: ["projectId"]
        }
      },
      {
        name: "create_next_step",
        description: "Create a new next step in a project",
        inputSchema: {
          type: "object",
          properties: {
            projectId: { type: "string", description: "Project identifier" },
            title: { type: "string", description: "Brief title of the next step" },
            description: { type: "string", description: "Detailed description of work" },
            priority: { 
              type: "string",
              enum: ["core-critical", "full-required", "enhancement"],
              description: "Implementation priority level"
            },
            parentStepId: { type: "string", description: "ID of parent step if this is a substep" },
            dependencies: { 
              type: "array",
              items: { type: "string" },
              description: "IDs of steps that must be completed first"
            }
          },
          required: ["projectId", "title", "description", "priority"]
        }
      },
      {
        name: "start_working_session",
        description: "Start working on a next step",
        inputSchema: {
          type: "object",
          properties: {
            projectId: { type: "string", description: "Project identifier" },
            nextStepId: { type: "string", description: "ID of the next step to work on" }
          },
          required: ["projectId", "nextStepId"]
        }
      },
      {
        name: "create_handoff",
        description: "Complete a working session with handoff details",
        inputSchema: {
          type: "object",
          properties: {
            projectId: { type: "string", description: "Project identifier" },
            sessionId: { type: "string", description: "Working session ID" },
            completedWork: { type: "string", description: "Summary of completed work" },
            codeState: { type: "string", description: "Current state of codebase" },
            environmentState: { type: "string", description: "Development environment state" },
            unresolvedIssues: {
              type: "array",
              items: { type: "string" },
              description: "List of unresolved issues"
            },
            newNextSteps: {
              type: "array",
              items: { type: "string" },
              description: "List of new next steps identified"
            }
          },
          required: ["projectId", "sessionId", "completedWork", "codeState", "environmentState"]
        }
      },
      {
        name: "get_latest_next_steps",
        description: "Get open next steps ordered by priority",
        inputSchema: {
          type: "object",
          properties: {
            projectId: { type: "string", description: "Project identifier" }
          },
          required: ["projectId"]
        }
      },
      {
        name: "get_next_step_history",
        description: "Get complete history of a next step including session and handoff",
        inputSchema: {
          type: "object",
          properties: {
            projectId: { type: "string", description: "Project identifier" },
            stepId: { type: "string", description: "Next step ID" }
          },
          required: ["projectId", "stepId"]
        }
      }
    ]
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (!args) {
    throw new ProjectError(`No arguments provided for tool: ${name}`, 'system');
  }

  try {
    switch (name) {
      case "list_templates":
        return {
          content: [{
            type: "text",
            text: JSON.stringify(HANDOFF_TEMPLATES, null, 2)
          }]
        };

      case "create_project":
        const project = await projectManager.createProject(
          args.name as string,
          args.description as string
        );
        return {
          content: [{
            type: "text",
            text: JSON.stringify(project, null, 2)
          }]
        };

      case "delete_project":
        await projectManager.deleteProject(args.projectId as string);
        return {
          content: [{
            type: "text",
            text: "Project deleted successfully"
          }]
        };

      case "create_next_step":
        const step = await projectManager.createNextStep(
          args.projectId as string,
          {
            projectId: args.projectId as string,
            title: args.title as string,
            description: args.description as string,
            priority: args.priority as NextStep['priority'],
            parentStepId: args.parentStepId as string,
            dependencies: args.dependencies as string[] || [],
            status: 'open'
          }
        );
        return {
          content: [{
            type: "text",
            text: JSON.stringify(step, null, 2)
          }]
        };

      case "start_working_session":
        const session = await projectManager.startWorkingSession(
          args.projectId as string,
          args.nextStepId as string
        );
        return {
          content: [{
            type: "text",
            text: JSON.stringify(session, null, 2)
          }]
        };

      case "create_handoff":
        const handoff = await projectManager.createHandoff(
          args.projectId as string,
          args.sessionId as string,
          {
            completedWork: args.completedWork as string,
            codeState: args.codeState as string,
            environmentState: args.environmentState as string,
            unresolvedIssues: args.unresolvedIssues as string[] || [],
            newNextSteps: args.newNextSteps as string[] || []
          }
        );
        return {
          content: [{
            type: "text",
            text: JSON.stringify(handoff, null, 2)
          }]
        };

      case "get_latest_next_steps":
        const steps = await projectManager.getLatestNextSteps(args.projectId as string);
        return {
          content: [{
            type: "text",
            text: JSON.stringify(steps, null, 2)
          }]
        };

      case "get_next_step_history":
        const history = await projectManager.getNextStepHistory(
          args.projectId as string,
          args.stepId as string
        );
        return {
          content: [{
            type: "text",
            text: JSON.stringify(history, null, 2)
          }]
        };

      default:
        throw new ProjectError(`Unknown tool: ${name}`, 'system');
    }
  } catch (error) {
    if (error instanceof ProjectError) {
      throw error;
    }
    throw new ProjectError(`Unexpected error: ${error}`, 'system');
  }
});

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Project Handoffs MCP Server running on stdio");
}

main().catch((error: Error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
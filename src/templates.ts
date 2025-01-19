export interface TemplateField {
  name: string;
  description: string;
  required: boolean;
  format?: string;
}

export interface EntityTemplate {
  type: string;
  description: string;
  fields: TemplateField[];
}

export const HANDOFF_TEMPLATES: Record<string, EntityTemplate> = {
  next_step: {
    type: "next_step",
    description: "Defines next work to be done",
    fields: [
      {
        name: "title",
        description: "Brief title of the next step",
        required: true,
        format: "Title: ${title}"
      },
      {
        name: "description",
        description: "Detailed description of work",
        required: true,
        format: "Description: ${description}"
      },
      {
        name: "priority",
        description: "Implementation priority level",
        required: true,
        format: "Priority: ${priority}"
      },
      {
        name: "dependencies",
        description: "IDs of dependent next steps",
        required: false,
        format: "Dependencies: ${dependencies}"
      }
    ]
  },
  working_session: {
    type: "working_session",
    description: "Records AI working session details",
    fields: [
      {
        name: "progress",
        description: "Work completed in session",
        required: true,
        format: "Progress: ${progress}"
      },
      {
        name: "blockers",
        description: "Issues blocking progress",
        required: false,
        format: "Blockers: ${blockers}"
      },
      {
        name: "decisions",
        description: "Key decisions made",
        required: false,
        format: "Decisions: ${decisions}"
      }
    ]
  },
  handoff: {
    type: "handoff",
    description: "Session completion and handoff details",
    fields: [
      {
        name: "completed_work",
        description: "Summary of completed work",
        required: true,
        format: "Completed: ${completed}"
      },
      {
        name: "code_state",
        description: "Current state of codebase",
        required: true,
        format: "Code State: ${state}"
      },
      {
        name: "environment",
        description: "Development environment state",
        required: true,
        format: "Environment: ${env}"
      },
      {
        name: "unresolved",
        description: "Unresolved issues",
        required: false,
        format: "Unresolved: ${issues}"
      }
    ]
  }
};
export class ProjectError extends Error {
  constructor(message: string, public projectId: string) {
    super(`Project ${projectId}: ${message}`);
    this.name = 'ProjectError';
  }
}
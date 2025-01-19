import { ProjectError } from '../errors.js';

describe('ProjectError', () => {
  it('should create error with correct message format', () => {
    const error = new ProjectError('test message', 'test-project');
    expect(error.message).toBe('Project test-project: test message');
    expect(error.projectId).toBe('test-project');
    expect(error.name).toBe('ProjectError');
  });
});
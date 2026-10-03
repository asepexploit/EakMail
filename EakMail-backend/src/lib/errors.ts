/**
 * Error taxonomy. Services throw typed domain errors; the API layer maps them to HTTP.
 * PRD.md §9, .claude/instructions/backend-guide.md §8.
 */
export class AppError extends Error {
  constructor(
    message: string,
    readonly httpStatus: number,
    readonly code: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class NotFoundError extends AppError {
  constructor(what = 'Resource') {
    super(`${what} not found`, 404, 'NOT_FOUND');
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Invalid input') {
    super(message, 400, 'VALIDATION');
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflict') {
    super(message, 409, 'CONFLICT');
  }
}

/** Domain error raised inside workflow execution (surfaced in step logs). */
export class WorkflowError extends AppError {
  constructor(
    message: string,
    readonly nodeId?: string,
  ) {
    super(message, 422, 'WORKFLOW');
  }
}

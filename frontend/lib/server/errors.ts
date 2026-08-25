export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 500,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function asAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;

  console.error("Unexpected SmartCart API error", error);
  return new AppError(
    "INTERNAL_ERROR",
    "SmartCart could not complete that request. Please try again.",
    500,
  );
}

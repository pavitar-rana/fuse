export type ServiceError = Error & { status: number };

export const serviceError = (message: string, status: number): ServiceError =>
  Object.assign(new Error(message), { status });

export const isServiceError = (e: unknown): e is ServiceError =>
  e instanceof Error && typeof (e as ServiceError).status === "number";

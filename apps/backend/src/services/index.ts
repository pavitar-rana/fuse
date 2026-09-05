export const serviceError = (message: string, status: number) =>
  Object.assign(new Error(message), { status });

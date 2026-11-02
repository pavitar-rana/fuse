import type { ErrorRequestHandler } from "express";
import { isServiceError } from "../services/index.ts";

// Errors with a status (serviceError) are client-facing. Anything else is a
// bug or infra failure: log it, return a generic 500.
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (isServiceError(err)) {
    return res.status(err.status).json({ message: err.message });
  }
  if (err?.type === "entity.parse.failed") {
    return res.status(400).json({ message: "Invalid JSON body" });
  }
  console.error(`${req.method} ${req.originalUrl} failed:`, err);
  res.status(500).json({ message: "Internal server error" });
};

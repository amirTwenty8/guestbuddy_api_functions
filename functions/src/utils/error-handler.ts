import {Response} from "express";
import {logger} from "firebase-functions";
import {HttpsError} from "firebase-functions/v2/https";
import {ErrorType} from "../types";

/**
 * Handle API errors and send appropriate response
 */
export const handleApiError = (res: Response, error: unknown): void => {
  logger.error("API Error:", error);

  if (error instanceof HttpsError) {
    const statusCode = getStatusCodeFromErrorCode(error.code);
    res.status(statusCode).json({
      success: false,
      error: error.message,
      code: error.code,
    });
    return;
  }

  // Handle unknown errors
  res.status(500).json({
    success: false,
    error: "Internal server error",
    code: ErrorType.SERVER,
  });
};

/**
 * Map Firebase error codes to HTTP status codes
 */
const getStatusCodeFromErrorCode = (code: string): number => {
  switch (code) {
  case "unauthenticated":
    return 401;
  case "permission-denied":
    return 403;
  case "not-found":
    return 404;
  case "already-exists":
    return 409;
  case "failed-precondition":
  case "invalid-argument":
    return 400;
  case "resource-exhausted":
    return 429;
  default:
    return 500;
  }
};

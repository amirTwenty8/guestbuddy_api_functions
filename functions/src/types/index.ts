import {DecodedIdToken} from "firebase-admin/auth";

/**
 * Extend Express Request interface to include user property
 */
declare global {
  namespace Express {
    interface Request {
      user?: DecodedIdToken;
    }
  }
}

/**
 * API Response interface
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * User interface
 */
export interface User {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

/**
 * Error types
 */
export enum ErrorType {
  AUTHENTICATION = "authentication_error",
  AUTHORIZATION = "authorization_error",
  VALIDATION = "validation_error",
  NOT_FOUND = "not_found_error",
  SERVER = "server_error",
}

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

/**
 * Landing Page interfaces
 */
export interface LandingPageCustomStyles {
  primaryColor: string;
  textColor: string;
  backgroundColor: string;
}

export interface CreateLandingPageRequest {
  title: string;
  description?: string;
  eventId?: string;
  guestCategoryId?: string;
  showTickets?: boolean;
  enableGuestRegistration?: boolean;
  isPasswordProtected?: boolean;
  password?: string;
  backgroundImageUrl?: string;
  customStyles?: LandingPageCustomStyles;
}

export interface LandingPage {
  id?: string;
  title: string;
  description: string;
  slug: string;
  eventId: string | null;
  guestCategoryId: string | null;
  showTickets: boolean;
  enableGuestRegistration: boolean;
  isPasswordProtected: boolean;
  password: string | null;
  backgroundImageUrl: string | null;
  customStyles: LandingPageCustomStyles;
  companyId: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
  views: number;
  conversions: number;
  url?: string; // Generated URL for the landing page
}

export interface PublicLandingPage {
  id: string;
  title: string;
  description: string;
  slug: string;
  eventId: string | null;
  showTickets: boolean;
  enableGuestRegistration: boolean;
  isPasswordProtected: boolean;
  backgroundImageUrl: string | null;
  customStyles: LandingPageCustomStyles;
  companyId: string;
  views: number;
}

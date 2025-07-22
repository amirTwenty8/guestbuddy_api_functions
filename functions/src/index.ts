/**
 * Main entry point for all Firebase Functions
 * This file imports and exports all API functions
 */

import {initializeApp} from "firebase-admin/app";

// Initialize Firebase Admin
initializeApp();

// Import API routes
import * as usersApi from "./api/users";
import * as authApi from "./api/auth";
import * as dataApi from "./api/data";
import * as storageApi from "./api/storage";
import * as eventsApi from "./api/events";
import * as guestsApi from "./api/guests";

// Export all functions
export const users = usersApi.users;
export const createUserProfile = usersApi.createUserProfile;

export const verifyToken = authApi.verifyToken;
export const revokeUserSessions = authApi.revokeUserSessions;
export const createAccount = authApi.createAccount;

export const data = dataApi.data;
export const batchUpdateItems = dataApi.batchUpdateItems;

export const getUploadSignedUrl = storageApi.getUploadSignedUrl;
export const getDownloadSignedUrl = storageApi.getDownloadSignedUrl;
export const deleteFile = storageApi.deleteFile;

// Events API
export const createEvent = eventsApi.createEvent;
export const updateEvent = eventsApi.updateEvent;
export const deleteEvent = eventsApi.deleteEvent;

// Guests API
export const addGuest = guestsApi.addGuest;
export const addMultipleGuests = guestsApi.addMultipleGuests;
export const saveGuestDraft = guestsApi.saveGuestDraft;
export const clearGuestDraft = guestsApi.clearGuestDraft;

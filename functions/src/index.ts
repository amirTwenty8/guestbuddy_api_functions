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
import * as tablesApi from "./api/tables";
import * as notificationsApi from "./api/notifications";
import * as landingPagesApi from "./api/landing-pages";
import * as cardsApi from "./api/cards";
import * as layoutsApi from "./api/layouts";

// Export all functions
export const users = usersApi.users;
export const createUserProfile = usersApi.createUserProfile;
export const addUserToCompany = usersApi.addUserToCompany;
export const editUserInCompany = usersApi.editUserInCompany;
export const removeUserFromCompany = usersApi.removeUserFromCompany;

export const verifyToken = authApi.verifyToken;
export const revokeUserSessions = authApi.revokeUserSessions;
export const createAccount = authApi.createAccount;
export const verifyEmail = authApi.verifyEmail; // Added for verifyEmail API
export const resendVerificationEmail = authApi.resendVerificationEmail; // Added for resendVerificationEmail API

export const data = dataApi.data;
export const batchUpdateItems = dataApi.batchUpdateItems;

export const getUploadSignedUrl = storageApi.getUploadSignedUrl;
export const getDownloadSignedUrl = storageApi.getDownloadSignedUrl;
export const deleteFile = storageApi.deleteFile;

// Events API
export const createEvent = eventsApi.createEvent;
export const updateEvent = eventsApi.updateEvent;
export const deleteEvent = eventsApi.deleteEvent;
export const createEventTicket = eventsApi.createEventTicket;
export const updateEventTicket = eventsApi.updateEventTicket;
export const removeEventTicket = eventsApi.removeEventTicket;

// Cards API
export const createClubCard = cardsApi.createClubCard;
export const updateClubCard = cardsApi.updateClubCard;
export const deleteClubCard = cardsApi.deleteClubCard;

// Layouts API
export const createTableLayout = layoutsApi.createTableLayout;
export const updateTableLayout = layoutsApi.updateTableLayout;
export const deleteTableLayout = layoutsApi.deleteTableLayout;

// Guests API
export const addGuest = guestsApi.addGuest;
export const addMultipleGuests = guestsApi.addMultipleGuests;
export const saveGuestDraft = guestsApi.saveGuestDraft;
export const clearGuestDraft = guestsApi.clearGuestDraft;
export const updateGuest = guestsApi.updateGuest;
export const checkInGuest = guestsApi.checkInGuest;
export const deleteGuest = guestsApi.deleteGuest;

// Tables API
export const bookTable = tablesApi.bookTable;
export const checkExistingUser = tablesApi.checkExistingUser;
export const updateTable = tablesApi.updateTable;
export const cancelReservation = tablesApi.cancelReservation;
export const resellTable = tablesApi.resellTable;

// Notifications API
export const sendSmsNotification = notificationsApi.sendSmsNotification;

// Landing Pages API
export const landingPages = landingPagesApi.landingPages;

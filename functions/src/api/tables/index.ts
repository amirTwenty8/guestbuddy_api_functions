import {onCall} from "firebase-functions/v2/https";

import {getFirestore, FieldValue} from "firebase-admin/firestore";
import * as Joi from "joi";
import {v4 as uuidv4} from "uuid";

// Get Firestore instance
const db = getFirestore();

// Validation schema for table booking
const bookTableSchema = Joi.object({
  companyId: Joi.string().required(),
  eventId: Joi.string().required(),
  tableId: Joi.string().required(), // Use table document ID instead of layoutName + tableName
  tableName: Joi.string().required(), // Required to identify the specific table within the layout
  // Guest information
  guestName: Joi.string().required().min(1).max(100),
  phoneNumber: Joi.string().required().pattern(/^\+[1-9]\d{1,14}$/), // E.164 format
  email: Joi.string().email().optional().allow(''),
  // Table details
  nrOfGuests: Joi.number().integer().min(1).required(),
  tableLimit: Joi.number().integer().min(0).optional().default(0),
  tableSpent: Joi.number().integer().min(0).optional().default(0),
  tableTimeFrom: Joi.string().optional().allow(''),
  tableTimeTo: Joi.string().optional().allow(''),
  comment: Joi.string().optional().allow(''),
  // Optional existing user ID (if booking for existing guest)
  existingUserId: Joi.string().optional().allow(''),
  // Optional existing user ID (if booking for existing guest)
  userId: Joi.string().optional().allow(''),
  // Name of user making the booking
  tableBookedBy: Joi.string().optional().allow(''),
});

// Type definitions
interface BookTableData {
  companyId: string;
  eventId: string;
  tableId: string; // Use table document ID instead of layoutName + tableName
  tableName: string; // Required to identify the specific table within the layout
  guestName: string;
  phoneNumber: string;
  email?: string;
  nrOfGuests: number;
  tableLimit?: number;
  tableSpent?: number;
  tableTimeFrom?: string;
  tableTimeTo?: string;
  comment?: string;
  existingUserId?: string;
  userId?: string; // Optional existing user ID (if booking for existing guest)
  tableBookedBy?: string; // Name of user making the booking
}

interface UserData {
  userFirstName: string;
  userLastName: string;
  phoneNumber: string;
  e164Number: string;
  userEmail: string;
  userActive: boolean;
  businessMode: boolean;
  emailVerified: boolean;
  totalSpent: number;
  lastSpent: number;
  lastUpdated: FieldValue;
  createdAt: FieldValue;
}

interface GuestData {
  userId: string;
  name: string;
  email: string;
  phoneNumber: string;
  totalSpent: number;
  lastSpent: number;
  lastUpdated: FieldValue;
  eventSpending: Record<string, any>;
  visitedGenres?: Record<string, any>;
}

/**
 * Book a table for an event
 * This function handles:
 * 1. Creating or finding existing user
 * 2. Booking the table
 * 3. Updating guest spending data
 * 4. Updating table summary
 */
export const bookTable = onCall({
  enforceAppCheck: false,
}, async (request) => {
  try {
    // Check if caller is authenticated
    if (!request.auth) {
      return {
        success: false,
        error: "Unauthorized",
      };
    }

    const data = request.data as BookTableData;

    // Validate input data
    const {error} = bookTableSchema.validate(data);
    if (error) {
      return {
        success: false,
        error: `Validation error: ${error.message}`,
      };
    }

    // Get current user info for logging
    const currentUser = request.auth;
    const userName = data.tableBookedBy || `${currentUser.token.name || 'Unknown User'}`;

    // Parse guest name into first and last name
    const nameParts = data.guestName.trim().split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';

    // User ID must be provided - no automatic lookup
    if (!data.userId) {
      return {
        success: false,
        error: "userId is required. Use checkExistingUser first to find existing users.",
      };
    }

    let userId = data.userId;
    let userData: any;
    
    // Check if this is a new user creation (userId starts with 'new_')
    if (data.userId.startsWith('new_')) {
      // Create new user
      userId = uuidv4();
      
      const newUserData: UserData = {
        userFirstName: firstName,
        userLastName: lastName,
        phoneNumber: data.phoneNumber.replace(/^\+/, ''),
        e164Number: data.phoneNumber,
        userEmail: data.email || '',
        userActive: false,
        businessMode: false,
        emailVerified: false,
        totalSpent: data.tableSpent || 0,
        lastSpent: data.tableSpent || 0,
        lastUpdated: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
      };

      await db.collection('users').doc(userId).set(newUserData);
      console.log(`Created new user: ${userId}`);
      
      // Set userData for the new user
      userData = newUserData;
    } else {
      // Verify the provided userId exists
      const userDoc = await db.collection('users').doc(userId).get();
      if (!userDoc.exists) {
        return {
          success: false,
          error: "Provided userId not found. Please use checkExistingUser first.",
        };
      }

      console.log(`Using confirmed existing user: ${userId}`);
      userData = userDoc.data();
    }

    // Get event genre data for guest tracking
    const eventDoc = await db.collection('companies')
      .doc(data.companyId)
      .collection('events')
      .doc(data.eventId)
      .get();

    let eventGenres: string[] = [];
    if (eventDoc.exists) {
      const eventData = eventDoc.data();
      console.log('Event data keys:', Object.keys(eventData || {}));
      console.log('Event data:', eventData);
      
      // Check for different possible field names
      if (eventData?.eventGenre && Array.isArray(eventData.eventGenre)) {
        // Extract genre names from objects with id and name properties
        eventGenres = eventData.eventGenre.map((genre: any) => genre.name).filter(Boolean);
        console.log('Found eventGenre:', eventData.eventGenre);
        console.log('Extracted genre names:', eventGenres);
      } else if (eventData?.eventGenres && Array.isArray(eventData.eventGenres)) {
        // Extract genre names from objects with id and name properties
        eventGenres = eventData.eventGenres.map((genre: any) => genre.name).filter(Boolean);
        console.log('Found eventGenres:', eventData.eventGenres);
        console.log('Extracted genre names:', eventGenres);
      } else if (eventData?.genres && Array.isArray(eventData.genres)) {
        // Extract genre names from objects with id and name properties
        eventGenres = eventData.genres.map((genre: any) => genre.name).filter(Boolean);
        console.log('Found genres:', eventData.genres);
        console.log('Extracted genre names:', eventGenres);
      } else {
        console.log('No genres found in event data');
      }
    }

    // Prepare company-specific genre counts
    const companySpecificGenres: Record<string, any> = {};
    console.log('Processing eventGenres:', eventGenres);
    for (const genre of eventGenres) {
      // Ensure genre is a string and not empty
      if (genre && typeof genre === 'string' && genre.trim() !== '') {
        companySpecificGenres[genre] = {nrOfTimes: 1};
        console.log(`Added genre: ${genre}`);
      } else {
        console.log(`Skipped invalid genre:`, genre);
      }
    }
    console.log('Final companySpecificGenres:', companySpecificGenres);

    // Get the specific layout document (tableId is actually the layout document ID)
    console.log(`Looking for layout document: companies/${data.companyId}/events/${data.eventId}/table_lists/${data.tableId}`);
    
    const layoutDoc = await db.collection('companies')
      .doc(data.companyId)
      .collection('events')
      .doc(data.eventId)
      .collection('table_lists')
      .doc(data.tableId) // This is the layout document ID
      .get();

    console.log(`Layout document exists: ${layoutDoc.exists}`);
    if (layoutDoc.exists) {
      console.log(`Layout data keys: ${Object.keys(layoutDoc.data() || {})}`);
    }

    if (!layoutDoc.exists) {
      return {
        success: false,
        error: "Layout not found",
      };
    }

    const layoutData = layoutDoc.data();
    const items = layoutData?.items || [];

    // Find the table by tableName in the items array
    const tableIndex = items.findIndex((item: any) => item.tableName === data.tableName);
    
    if (tableIndex === -1) {
      return {
        success: false,
        error: `Table "${data.tableName}" not found in layout`,
      };
    }

    const tableData = items[tableIndex];
    const layoutName = layoutData?.layoutName || data.tableId; // Use layout document ID as fallback
    const tableName = tableData?.tableName || data.tableName;



    // Prepare log entry for the table - use user data when available
    const logEntry = {
      action: "booked",
      changes: {
        id: data.tableName,
        name: userData ? `${userData.userFirstName} ${userData.userLastName}`.trim() : data.guestName,
        e164Number: userData ? userData.e164Number : data.phoneNumber,
        phoneNr: userData ? userData.phoneNumber : data.phoneNumber.replace(/^\+/, ''),
        nrOfGuests: data.nrOfGuests,
        timeFrom: data.tableTimeFrom || '',
        timeTo: data.tableTimeTo || '',
        userId: userId,
        tableBookedBy: userName,
        sendSmsConfirmation: false, // You can add this to the request if needed
        sendSmsReminder: false, // You can add this to the request if needed
      },
      timestamp: new Date().toISOString(),
      userName: userName,
    };

    // Prepare updated table data - use user data when available, fallback to request data
    const updatedTableData = {
      ...tableData, // Keep existing table properties
      name: userData ? `${userData.userFirstName} ${userData.userLastName}`.trim() : data.guestName,
      phoneNr: userData ? userData.phoneNumber : data.phoneNumber.replace(/^\+/, ''), // Use user's phone number
      e164Number: userData ? userData.e164Number : data.phoneNumber, // Use user's E.164 number
      tableEmail: userData ? userData.userEmail : (data.email || ''), // Use user's email
      nrOfGuests: data.nrOfGuests, // Keep request data for table-specific info
      tableLimit: data.tableLimit || 0,
      tableSpent: data.tableSpent || 0,
      tableCheckedIn: 0,
      tableTimeFrom: data.tableTimeFrom || '',
      tableTimeTo: data.tableTimeTo || '',
      comment: data.comment || '',
      tableBookedBy: userName,
      userId: userId,
      // Add the log entry to the table's logs array
      logs: [...(tableData.logs || []), logEntry],
    };

    // Update the specific table in the items array
    items[tableIndex] = updatedTableData;

    // Update the specific layout document with the modified items array
    await db.collection('companies')
      .doc(data.companyId)
      .collection('events')
      .doc(data.eventId)
      .collection('table_lists')
      .doc(data.tableId) // Update the specific layout document
      .update({
        items: items
      });

    // Update table summary (inside table_lists collection)
    await db.collection('companies')
      .doc(data.companyId)
      .collection('events')
      .doc(data.eventId)
      .collection('table_lists')
      .doc('tableSummary')
      .set({
        totalBooked: FieldValue.increment(1),
        totalGuests: FieldValue.increment(data.nrOfGuests),
        totalTableLimit: FieldValue.increment(data.tableLimit || 0),
        totalTableSpent: FieldValue.increment(data.tableSpent || 0),
        lastUpdated: FieldValue.serverTimestamp(),
      }, {merge: true});

    // Prepare guest data for company collection
    const guestData: GuestData = {
      userId: userId,
      name: userData ? `${userData.userFirstName} ${userData.userLastName}`.trim() : data.guestName,
      email: userData ? userData.userEmail : (data.email || ''),
      phoneNumber: userData ? userData.phoneNumber : data.phoneNumber.replace(/^\+/, ''),
      totalSpent: data.tableSpent || 0,
      lastSpent: data.tableSpent || 0,
      lastUpdated: FieldValue.serverTimestamp(),
      eventSpending: {
        [data.eventId]: {
          spent: data.tableSpent || 0,
          lastUpdated: FieldValue.serverTimestamp(),
        }
      },
    };

    // Add genres if available
    if (Object.keys(companySpecificGenres).length > 0) {
      guestData.visitedGenres = companySpecificGenres;
    }

    // Update or create guest in company collection
    await db.collection('companies')
      .doc(data.companyId)
      .collection('guests')
      .doc(userId)
      .set(guestData, {merge: true});

    // Update user spending data
    await db.collection('users')
      .doc(userId)
      .set({
        totalSpent: FieldValue.increment(data.tableSpent || 0),
        lastSpent: data.tableSpent || 0,
        lastUpdated: FieldValue.serverTimestamp(),
        eventSpending: {
          [data.eventId]: {
            spent: data.tableSpent || 0,
            lastUpdated: FieldValue.serverTimestamp(),
          }
        },
        visitedGenres: companySpecificGenres,
      }, {merge: true});



    return {
      success: true,
      message: "Table booked successfully",
      data: {
        tableId: data.tableId,
        tableName: tableName,
        layoutName: layoutName,
        userId: userId,
        // Show the actual data that was saved to the database
        guestName: updatedTableData.name,
        phoneNumber: updatedTableData.e164Number,
        localPhoneNumber: updatedTableData.phoneNr,
        email: updatedTableData.tableEmail,
        nrOfGuests: updatedTableData.nrOfGuests,
        tableLimit: updatedTableData.tableLimit,
        tableSpent: updatedTableData.tableSpent,
        tableTimeFrom: updatedTableData.tableTimeFrom,
        tableTimeTo: updatedTableData.tableTimeTo,
        comment: updatedTableData.comment,
        bookedBy: userName,
        // Show whether we used existing user data or created new user
        userDataUsed: userData ? {
          userFirstName: userData.userFirstName,
          userLastName: userData.userLastName,
          userEmail: userData.userEmail,
          userPhoneNumber: userData.phoneNumber,
          userE164Number: userData.e164Number,
        } : null,
      },
    };

  } catch (error: any) {
    console.error("Error booking table:", error);
    
    return {
      success: false,
      error: "Failed to book table. Please try again.",
    };
  }
}); 

// Type for existing user data
interface ExistingUserData {
  userId: string;
  userFirstName: string;
  userLastName: string;
  userEmail: string;
  phoneNumber: string;
  e164Number: string;
}

/**
 * Check if a user exists with the given phone number
 * This allows the client to confirm user choice before booking
 */
export const checkExistingUser = onCall({
  enforceAppCheck: false,
}, async (request) => {
  try {
    // Check if caller is authenticated
    if (!request.auth) {
      return {
        success: false,
        error: "Unauthorized",
      };
    }

    const {phoneNumber, email} = request.data;

    if (!phoneNumber && !email) {
      return {
        success: false,
        error: "Either phone number or email is required",
      };
    }

    let existingUser = null;

    // Try to find existing user by phone number (if provided)
    if (phoneNumber) {
      const e164Query = await db.collection('users')
        .where('e164Number', '==', phoneNumber)
        .limit(1)
        .get();

      const phoneQuery = await db.collection('users')
        .where('phoneNumber', '==', phoneNumber.replace(/^\+/, ''))
        .limit(1)
        .get();

      if (e164Query.docs.length > 0) {
        const userDoc = e164Query.docs[0];
        existingUser = {
          userId: userDoc.id,
          ...userDoc.data()
        } as ExistingUserData;
        console.log(`Found existing user by E.164: ${userDoc.id}`);
      } else if (phoneQuery.docs.length > 0) {
        const userDoc = phoneQuery.docs[0];
        existingUser = {
          userId: userDoc.id,
          ...userDoc.data()
        } as ExistingUserData;
        console.log(`Found existing user by phone: ${userDoc.id}`);
      }
    }

    // Try to find existing user by email (if provided and no user found by phone)
    if (!existingUser && email) {
      const emailQuery = await db.collection('users')
        .where('userEmail', '==', email)
        .limit(1)
        .get();

      if (emailQuery.docs.length > 0) {
        const userDoc = emailQuery.docs[0];
        existingUser = {
          userId: userDoc.id,
          ...userDoc.data()
        } as ExistingUserData;
        console.log(`Found existing user by email: ${userDoc.id}`);
      }
    }

    if (existingUser) {
      return {
        success: true,
        message: "Existing user found",
        requiresUserChoice: true,
        existingUser: {
          userId: existingUser.userId,
          name: `${existingUser.userFirstName} ${existingUser.userLastName}`.trim(),
          email: existingUser.userEmail || '',
          phoneNumber: existingUser.phoneNumber,
          e164Number: existingUser.e164Number,
        },
        choices: [
          `A - Use existing user: ${existingUser.userFirstName} ${existingUser.userLastName}`,
          "B - Cancel and change phone number"
        ]
      };
    } else {
      return {
        success: true,
        message: "No existing user found",
        requiresUserChoice: false,
        existingUser: null,
        choices: []
      };
    }

  } catch (error: any) {
    console.error("Error checking existing user:", error);
    
    return {
      success: false,
      error: "Failed to check existing user. Please try again.",
    };
  }
}); 
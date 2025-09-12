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

    // ⚠️ RACE CONDITION CHECK: Verify table is still available
    // Check if table is already booked (name field indicates booking status)
    const isTableAlreadyBooked = tableData?.name && tableData.name.trim() !== '';
    
    if (isTableAlreadyBooked) {
      return {
        success: false,
        error: `Table "${data.tableName}" has already been booked by another guest. Please refresh and try a different table.`,
        alreadyBookedBy: tableData.name,
        tableBookedBy: tableData.tableBookedBy,
      };
    }



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

    // Use transaction to prevent race conditions during booking
    const layoutRef = db.collection('companies')
      .doc(data.companyId)
      .collection('events')
      .doc(data.eventId)
      .collection('table_lists')
      .doc(data.tableId);

    await db.runTransaction(async (transaction) => {
      // Re-read the layout document inside the transaction
      const transactionLayoutDoc = await transaction.get(layoutRef);
      
      if (!transactionLayoutDoc.exists) {
        throw new Error('Layout document not found');
      }

      const transactionLayoutData = transactionLayoutDoc.data();
      const transactionItems = transactionLayoutData?.items || [];
      
      // Find the table again in the fresh data
      const transactionTableIndex = transactionItems.findIndex((item: any) => item.tableName === data.tableName);
      
      if (transactionTableIndex === -1) {
        throw new Error(`Table "${data.tableName}" not found in layout`);
      }

      const transactionTableData = transactionItems[transactionTableIndex];
      
      // ⚠️ FINAL RACE CONDITION CHECK: Verify table is STILL available
      const isStillAvailable = !transactionTableData?.name || transactionTableData.name.trim() === '';
      
      if (!isStillAvailable) {
        throw new Error(`Table "${data.tableName}" was just booked by another guest: ${transactionTableData.name}`);
      }

      // Safe to book - update the table in the items array
      transactionItems[transactionTableIndex] = updatedTableData;
      
      // Update the layout document with the modified items array
      transaction.update(layoutRef, {
        items: transactionItems
      });
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

// Validation schema for table update
const updateTableSchema = Joi.object({
  companyId: Joi.string().required(),
  eventId: Joi.string().required(),
  layoutId: Joi.string().required(),
  tableName: Joi.string().required(),
  userId: Joi.string().optional(), // Optional for guest updates
  // Table data fields - using correct database field names
  name: Joi.string().optional(),
  phoneNr: Joi.string().optional(),
  e164Number: Joi.string().optional(),
  nrOfGuests: Joi.number().optional(),
  comment: Joi.string().optional(),
  tableLimit: Joi.number().optional(),
  tableSpent: Joi.number().optional(),
  tableCheckedIn: Joi.number().optional(),
  tableTimeFrom: Joi.string().optional(),
  tableTimeTo: Joi.string().optional(),
  tableBookedBy: Joi.string().optional(),
  tableEmail: Joi.string().optional(),
  tableStaff: Joi.string().optional(),
  action: Joi.string().default('updated'),
});

// Type definitions
interface UpdateTableData {
  companyId: string;
  eventId: string;
  layoutId: string;
  tableName: string;
  userId?: string;
  // Table data fields - using correct database field names
  name?: string;
  phoneNr?: string;
  e164Number?: string;
  nrOfGuests?: number;
  comment?: string;
  tableLimit?: number;
  tableSpent?: number;
  tableCheckedIn?: number;
  tableTimeFrom?: string;
  tableTimeTo?: string;
  tableBookedBy?: string;
  tableEmail?: string;
  tableStaff?: string;
  action?: string;
}

/**
 * Update table summary statistics incrementally based on changes made to a specific table
 * @param companyId Company ID
 * @param eventId Event ID
 * @param changesMap Object containing the changes made to the table
 * @param originalTable The original table data before changes
 */
async function updateTableSummaryIncremental(
  companyId: string, 
  eventId: string, 
  changesMap: Record<string, any>, 
  originalTable: any
) {
  try {
    const tableListsRef = db.collection('companies')
      .doc(companyId)
      .collection('events')
      .doc(eventId)
      .collection('table_lists');

    const tableSummaryRef = tableListsRef.doc('tableSummary');
    
    // Calculate incremental changes
    const increments: Record<string, number> = {};
    
    // Handle booking status changes
    const wasBooked = originalTable.name || originalTable.tableBookedBy;
    const isNowBooked = changesMap.name !== undefined ? changesMap.name : (changesMap.tableBookedBy !== undefined ? changesMap.tableBookedBy : wasBooked);
    
    if (!wasBooked && isNowBooked) {
      increments.totalBooked = 1; // Table became booked
    } else if (wasBooked && !isNowBooked) {
      increments.totalBooked = -1; // Table became unbooked
    }
    
    // Handle numeric field changes
    const numericFields = ['tableCheckedIn', 'nrOfGuests', 'tableLimit', 'tableSpent'];
    const summaryFields = ['totalCheckedIn', 'totalGuests', 'totalTableLimit', 'totalTableSpent'];
    
    numericFields.forEach((field, index) => {
      if (changesMap[field] !== undefined) {
        const oldValue = originalTable[field] || 0;
        const newValue = changesMap[field] || 0;
        const difference = newValue - oldValue;
        
        if (difference !== 0) {
          increments[summaryFields[index]] = difference;
        }
      }
    });
    
    // Only update if there are actual changes
    if (Object.keys(increments).length > 0) {
      const updateData: Record<string, any> = {
        lastUpdated: FieldValue.serverTimestamp(),
      };
      
      // Add incremental updates
      Object.entries(increments).forEach(([field, increment]) => {
        updateData[field] = FieldValue.increment(increment);
      });
      
      await tableSummaryRef.update(updateData);
      
      console.log('Table summary updated incrementally:', increments);
    } else {
      console.log('No summary changes needed');
    }

  } catch (error) {
    console.error('Error updating table summary incrementally:', error);
    // Don't throw error - summary update failure shouldn't break the main function
  }
}

/**
 * Update table summary statistics based on ALL layouts in the event
 * @param companyId Company ID
 * @param eventId Event ID
 */
async function updateTableSummary(companyId: string, eventId: string) {
  try {
    // Get reference to table_lists collection
    const tableListsRef = db.collection('companies')
      .doc(companyId)
      .collection('events')
      .doc(eventId)
      .collection('table_lists');

    // Get all layout documents
    const layoutsSnapshot = await tableListsRef.get();
    
    // Calculate summary statistics across ALL layouts
    let totalBooked = 0;
    let totalCheckedIn = 0;
    let totalGuests = 0;
    let totalTableLimit = 0;
    let totalTableSpent = 0;
    let totalTables = 0;

    // Process each layout document
    layoutsSnapshot.docs.forEach((layoutDoc: any) => {
      if (layoutDoc.exists && layoutDoc.id !== 'tableSummary') {
        const layoutData = layoutDoc.data();
        const tables = layoutData?.items || [];

        tables.forEach((table: any) => {
          // Count booked tables (tables with a name or bookedBy)
          if (table.name || table.tableBookedBy) {
            totalBooked++;
          }

          // Sum up all numeric values
          totalCheckedIn += table.tableCheckedIn || 0;
          totalGuests += table.nrOfGuests || 0;
          totalTableLimit += table.tableLimit || 0;
          totalTableSpent += table.tableSpent || 0;
          totalTables++;
        });
      }
    });

    // Update the tableSummary document (separate document in table_lists collection)
    await tableListsRef.doc('tableSummary').set({
      lastUpdated: FieldValue.serverTimestamp(),
      totalBooked: totalBooked,
      totalCheckedIn: totalCheckedIn,
      totalGuests: totalGuests,
      totalTableLimit: totalTableLimit,
      totalTableSpent: totalTableSpent,
      totalTables: totalTables,
    }, { merge: true });

    console.log('Table summary updated for all layouts:', {
      totalBooked,
      totalCheckedIn,
      totalGuests,
      totalTableLimit,
      totalTableSpent,
      totalTables,
    });

  } catch (error) {
    console.error('Error updating table summary:', error);
    // Don't throw error - summary update failure shouldn't break the main function
  }
}

/**
 * Update table information after booking
 * This function handles:
 * 1. Updating table data in the table_lists collection
 * 2. Logging changes with user information and timestamp
 * 3. Updating user spending information if userId is provided
 * 4. Updating company guest spending information
 */
export const updateTable = onCall({
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

    const data = request.data as UpdateTableData;

    // Validate input data
    const {error} = updateTableSchema.validate(data);
    if (error) {
      return {
        success: false,
        error: `Validation error: ${error.message}`,
      };
    }

    // Get current user info for logging
    const currentUser = request.auth;
    const userId = currentUser.uid;
    const userData = currentUser.token;
    
    // Get user name from token or fetch from Firestore
    let userName = userData.name || userData.displayName || userId;
    
    // If we only have the ID, try to get the user's name from Firestore
    if (userName === userId) {
      try {
        const userDoc = await db.collection('users').doc(userId).get();
        if (userDoc.exists) {
          const userDocData = userDoc.data();
          const firstName = userDocData?.userFirstName || '';
          const lastName = userDocData?.userLastName || '';
          userName = `${firstName} ${lastName}`.trim();
          if (userName === '') {
            userName = userId; // Fallback to ID if no name found
          }
        }
      } catch (error) {
        console.warn('Failed to fetch user name from Firestore:', error);
        userName = userId; // Fallback to ID
      }
    }

    // Get the table_lists document
    const tableListsRef = db.collection('companies')
      .doc(data.companyId)
      .collection('events')
      .doc(data.eventId)
      .collection('table_lists')
      .doc(data.layoutId);

    const tableListsDoc = await tableListsRef.get();

    if (!tableListsDoc.exists) {
      return {
        success: false,
        error: "Table layout not found",
      };
    }

    const tableListsData = tableListsDoc.data();
    const tables = tableListsData?.items || [];

    // Find the specific table to update
    let tableIndex = -1;
    let table: any = null;

    for (let i = 0; i < tables.length; i++) {
      if (tables[i].tableName === data.tableName) {
        tableIndex = i;
        table = tables[i];
        break;
      }
    }

    if (tableIndex === -1 || !table) {
      return {
        success: false,
        error: "Table not found",
      };
    }

    // Create a map of only changed fields
    const changesMap: Record<string, any> = {};
    const updatedTable = { ...table };

    // Check each field for changes
    const fieldsToCheck = [
      'name', 'phoneNr', 'e164Number', 'nrOfGuests', 'comment', 'tableLimit',
      'tableSpent', 'tableCheckedIn', 'tableTimeFrom', 'tableTimeTo', 'tableBookedBy', 
      'tableEmail', 'tableStaff'
    ];

    fieldsToCheck.forEach(field => {
      if (data[field as keyof UpdateTableData] !== undefined) {
        const oldValue = table[field];
        const newValue = data[field as keyof UpdateTableData];
        
        // Compare values (handle different types)
        if (oldValue?.toString() !== newValue?.toString()) {
          changesMap[field] = newValue;
          updatedTable[field] = newValue;
        }
      }
    });

    // Only proceed if there are actual changes
    if (Object.keys(changesMap).length === 0) {
      return {
        success: true,
        message: "No changes detected",
        data: {
          tableName: data.tableName,
          changes: {},
        },
      };
    }

    // Initialize logs array if it doesn't exist
    let existingLogs = table.logs || [];
    if (!Array.isArray(existingLogs)) {
      existingLogs = [];
    }

    // Create new log entry with current timestamp
    const newLog = {
      action: data.action || 'updated',
      userName: userName,
      timestamp: new Date().toISOString(),
      changes: changesMap,
    };

    // Add new log to existing logs
    existingLogs.push(newLog);
    updatedTable.logs = existingLogs;

    // Update the table in the array
    tables[tableIndex] = updatedTable;

    // Update the table_lists document
    await tableListsRef.update({
      items: tables,
    });

    // Update table summary statistics incrementally based on changes
    await updateTableSummaryIncremental(data.companyId, data.eventId, changesMap, table);

    // Update user spending information if userId is provided and spent amount changed
    if (data.userId && changesMap.tableSpent !== undefined) {
      const newSpent = changesMap.tableSpent;
      const oldSpent = table.tableSpent || 0;
      const spentDifference = newSpent - oldSpent;

      if (spentDifference !== 0) {
        // Update user's event spending (map field on user document)
        const userRef = db.collection('users').doc(data.userId);
        const userDoc = await userRef.get();

        if (userDoc.exists) {
          const userData = userDoc.data();
          const currentEventSpent = userData?.eventSpending?.[data.eventId]?.spent || 0;

          // Update the specific event in the eventSpending map
          await userRef.update({
            [`eventSpending.${data.eventId}.spent`]: currentEventSpent + spentDifference,
            [`eventSpending.${data.eventId}.lastUpdated`]: FieldValue.serverTimestamp(),
            totalSpent: (userData?.totalSpent || 0) + spentDifference,
            lastSpent: newSpent,
          });
        }

        // Update company guest spending (document in companies/{companyId}/guests/{userId})
        const companyGuestRef = db.collection('companies')
          .doc(data.companyId)
          .collection('guests')
          .doc(data.userId);

        const companyGuestDoc = await companyGuestRef.get();

        if (companyGuestDoc.exists) {
          const companyGuestData = companyGuestDoc.data();
          const currentEventSpent = companyGuestData?.eventSpending?.[data.eventId]?.spent || 0;
          const currentTotalSpent = companyGuestData?.totalSpent || 0;

          await companyGuestRef.update({
            [`eventSpending.${data.eventId}.spent`]: currentEventSpent + spentDifference,
            [`eventSpending.${data.eventId}.lastUpdated`]: FieldValue.serverTimestamp(),
            totalSpent: currentTotalSpent + spentDifference,
            lastSpent: newSpent,
            lastUpdated: FieldValue.serverTimestamp(),
          });
        } else {
          // Create new company guest record
          await companyGuestRef.set({
            eventSpending: {
              [data.eventId]: {
                spent: spentDifference,
                lastUpdated: FieldValue.serverTimestamp(),
              }
            },
            totalSpent: spentDifference,
            lastSpent: newSpent,
            lastUpdated: FieldValue.serverTimestamp(),
            userId: data.userId,
          });
        }
      }
    }

    // Update visitedGenres when guests are checked in (actual attendance)
    if (data.userId && changesMap.tableCheckedIn !== undefined) {
      const newCheckedIn = changesMap.tableCheckedIn;
      const oldCheckedIn = table.tableCheckedIn || 0;
      
      console.log(`Checking visitedGenres update: userId=${data.userId}, newCheckedIn=${newCheckedIn}, oldCheckedIn=${oldCheckedIn}`);
      
      // Only update visitedGenres if guests are being checked in (not checked out)
      if (newCheckedIn > oldCheckedIn) {
        console.log('Guests are being checked in, updating visitedGenres...');
        
        // Get event genres
        const eventDoc = await db.collection('companies')
          .doc(data.companyId)
          .collection('events')
          .doc(data.eventId)
          .get();

        console.log(`Event document exists: ${eventDoc.exists}`);
        
        if (eventDoc.exists) {
          const eventData = eventDoc.data();
          console.log('Event data keys:', Object.keys(eventData || {}));
          console.log('Event data:', eventData);
          
          // Check both possible field names for genres
          const eventGenres = eventData?.eventGenre || eventData?.genres || [];
          console.log('Event genres found:', eventGenres);
          
          // Prepare company-specific genre counts with event tracking
          const companySpecificGenres: Record<string, any> = {};
          for (const genre of eventGenres) {
            // Handle both string genres and object genres with id/name
            let genreName = '';
            if (typeof genre === 'string' && genre.trim() !== '') {
              genreName = genre.trim();
            } else if (genre && typeof genre === 'object' && genre.name) {
              genreName = genre.name;
            }
            
            if (genreName) {
              companySpecificGenres[genreName] = {
                nrOfTimes: 1,
                eventIds: [data.eventId]  // Track which events they've attended
              };
              console.log(`Added genre: ${genreName} for event: ${data.eventId}`);
            } else {
              console.log(`Skipped invalid genre:`, genre);
            }
          }
          
          console.log('Final companySpecificGenres:', companySpecificGenres);

          if (Object.keys(companySpecificGenres).length > 0) {
            console.log('Updating visitedGenres for user and company guest...');
            
            // Update user's visitedGenres
            const userRef = db.collection('users').doc(data.userId);
            const userDoc = await userRef.get();

            if (userDoc.exists) {
              const userData = userDoc.data();
              const existingGenres = userData?.visitedGenres || {};
              console.log('User existing genres:', existingGenres);
              
              // Merge existing genres with new ones, checking for duplicate events
              const mergedGenres = {...existingGenres};
              for (const [genre, newData] of Object.entries(companySpecificGenres)) {
                console.log(`Processing genre: ${genre}, newData:`, newData);
                
                if (mergedGenres[genre]) {
                  console.log(`Existing genre data:`, mergedGenres[genre]);
                  
                  // Check if user has already attended this event for this genre
                  const existingEventIds = mergedGenres[genre].eventIds || [];
                  console.log(`Existing event IDs for ${genre}:`, existingEventIds);
                  
                  if (!existingEventIds.includes(data.eventId)) {
                    // New event for this genre, increment count and add event ID
                    const currentNrOfTimes = parseInt(mergedGenres[genre].nrOfTimes) || 0;
                    const newNrOfTimes = parseInt(newData.nrOfTimes) || 1;
                    const totalNrOfTimes = currentNrOfTimes + newNrOfTimes;
                    
                    mergedGenres[genre].nrOfTimes = totalNrOfTimes;
                    mergedGenres[genre].eventIds = [...existingEventIds, data.eventId];
                    console.log(`Incremented ${genre} to ${totalNrOfTimes} (new event: ${data.eventId})`);
                  } else {
                    console.log(`User already attended ${genre} at event ${data.eventId}, skipping increment`);
                  }
                } else {
                  // New genre, add it
                  mergedGenres[genre] = {
                    nrOfTimes: parseInt(newData.nrOfTimes) || 1,
                    eventIds: newData.eventIds || [data.eventId]
                  };
                  console.log(`Added new genre: ${genre} with event ${data.eventId}`);
                }
                
                console.log(`Final merged data for ${genre}:`, mergedGenres[genre]);
              }
              
              console.log('User merged genres:', mergedGenres);

              await userRef.update({
                visitedGenres: mergedGenres,
              });
              console.log('User visitedGenres updated successfully');
            } else {
              console.log('User document not found');
            }

            // Update company guest's visitedGenres
            const companyGuestRef = db.collection('companies')
              .doc(data.companyId)
              .collection('guests')
              .doc(data.userId);

            const companyGuestDoc = await companyGuestRef.get();

            if (companyGuestDoc.exists) {
              const companyGuestData = companyGuestDoc.data();
              const existingGenres = companyGuestData?.visitedGenres || {};
              console.log('Company guest existing genres:', existingGenres);
              
              // Merge existing genres with new ones, checking for duplicate events
              const mergedGenres = {...existingGenres};
              for (const [genre, newData] of Object.entries(companySpecificGenres)) {
                console.log(`Processing genre: ${genre}, newData:`, newData);
                
                if (mergedGenres[genre]) {
                  console.log(`Existing genre data:`, mergedGenres[genre]);
                  
                  // Check if user has already attended this event for this genre
                  const existingEventIds = mergedGenres[genre].eventIds || [];
                  console.log(`Existing event IDs for ${genre}:`, existingEventIds);
                  
                  if (!existingEventIds.includes(data.eventId)) {
                    // New event for this genre, increment count and add event ID
                    const currentNrOfTimes = parseInt(mergedGenres[genre].nrOfTimes) || 0;
                    const newNrOfTimes = parseInt(newData.nrOfTimes) || 1;
                    const totalNrOfTimes = currentNrOfTimes + newNrOfTimes;
                    
                    mergedGenres[genre].nrOfTimes = totalNrOfTimes;
                    mergedGenres[genre].eventIds = [...existingEventIds, data.eventId];
                    console.log(`Incremented ${genre} to ${totalNrOfTimes} (new event: ${data.eventId})`);
                  } else {
                    console.log(`User already attended ${genre} at event ${data.eventId}, skipping increment`);
                  }
                } else {
                  // New genre, add it
                  mergedGenres[genre] = {
                    nrOfTimes: parseInt(newData.nrOfTimes) || 1,
                    eventIds: newData.eventIds || [data.eventId]
                  };
                  console.log(`Added new genre: ${genre} with event ${data.eventId}`);
                }
                
                console.log(`Final merged data for ${genre}:`, mergedGenres[genre]);
              }
              
              console.log('Company guest merged genres:', mergedGenres);

              await companyGuestRef.update({
                visitedGenres: mergedGenres,
              });
              console.log('Company guest visitedGenres updated successfully');
            } else {
              console.log('Company guest document not found, creating new one...');
              // Create new company guest record with visitedGenres
              await companyGuestRef.set({
                visitedGenres: companySpecificGenres,
                userId: data.userId,
              }, {merge: true});
              console.log('New company guest document created with visitedGenres');
            }
          } else {
            console.log('No valid genres found to update');
          }
        } else {
          console.log('Event document not found');
        }
      } else {
        console.log('No check-in increase detected, skipping visitedGenres update');
      }
    } else {
      console.log('No userId or tableCheckedIn change detected, skipping visitedGenres update');
    }

    return {
      success: true,
      message: "Table updated successfully",
      data: {
        tableName: data.tableName,
        layoutId: data.layoutId,
        changes: changesMap,
        updatedBy: userName,
        updatedAt: new Date().toISOString(),
        logsCount: existingLogs.length,
      },
    };

  } catch (error: any) {
    console.error("Error updating table:", error);
    
    return {
      success: false,
      error: `Failed to update table: ${error.message}`,
    };
  }
});

// Validation schema for cancel reservation
const cancelReservationSchema = Joi.object({
  companyId: Joi.string().required(),
  eventId: Joi.string().required(),
  layoutId: Joi.string().required(),
  tableName: Joi.string().required(),
});

// Type definitions for cancel reservation
interface CancelReservationData {
  companyId: string;
  eventId: string;
  layoutId: string;
  tableName: string;
}

/**
 * Cancel a table reservation
 * This function:
 * 1. Removes guest data from the table (userId, name, phone, email, nrOfGuests, tableLimit)
 * 2. Keeps other fields like staff, comment, etc.
 * 3. Removes the event from user's eventSpending
 * 4. Removes the event from company guest's eventSpending
 * 5. Updates tableSummary to reflect the cancellation
 */
export const cancelReservation = onCall({
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

    const data = request.data as CancelReservationData;

    // Validate input data
    const {error} = cancelReservationSchema.validate(data);
    if (error) {
      return {
        success: false,
        error: `Validation error: ${error.message}`,
      };
    }

    // Get current user info for logging
    const currentUser = request.auth;
    const userName = `${currentUser.token.name || 'Unknown User'}`;

    // Get the table layout document
    const tableListsRef = db.collection('companies')
      .doc(data.companyId)
      .collection('events')
      .doc(data.eventId)
      .collection('table_lists')
      .doc(data.layoutId);

    const tableListsDoc = await tableListsRef.get();

    if (!tableListsDoc.exists) {
      return {
        success: false,
        error: "Table layout not found",
      };
    }

    const tableListsData = tableListsDoc.data();
    const items = tableListsData?.items || [];

    // Find the specific table
    let table: any = null;
    let tableIndex = -1;

    for (let i = 0; i < items.length; i++) {
      if (items[i].tableName === data.tableName) {
        table = items[i];
        tableIndex = i;
        break;
      }
    }

    if (!table) {
      return {
        success: false,
        error: "Table not found",
      };
    }

    // Check if table has a reservation to cancel
    if (!table.userId) {
      return {
        success: false,
        error: "Table is not reserved",
      };
    }

    // Store the data we're removing for logging and spending updates
    const removedData = {
      userId: table.userId,
      name: table.name,
      phoneNr: table.phoneNr,
      e164Number: table.e164Number,
      tableEmail: table.tableEmail,
      nrOfGuests: table.nrOfGuests,
      tableLimit: table.tableLimit,
      tableSpent: table.tableSpent || 0,
    };

    // Remove all data except staff from table
    const updatedTable = {
      ...table,
      userId: null,
      name: null,
      phoneNr: null,
      e164Number: null,
      tableEmail: null,
      nrOfGuests: null,
      tableLimit: null,
      tableSpent: null,
      tableCheckedIn: null,
      tableTimeFrom: null,
      tableTimeTo: null,
      tableBookedBy: null,
      comment: null,
    };
    
    // Only add tableStaff if it has a value (not undefined)
    if (table.tableStaff !== undefined) {
      updatedTable.tableStaff = table.tableStaff;
    }

    // Create log entry
    const newLog = {
      action: "reservation cancelled",
      userName: userName,
      timestamp: new Date().toISOString(),
      changes: {
        removed: {
          userId: removedData.userId,
          name: removedData.name,
          phoneNr: removedData.phoneNr,
          e164Number: removedData.e164Number,
          tableEmail: removedData.tableEmail,
          nrOfGuests: removedData.nrOfGuests,
          tableLimit: removedData.tableLimit,
          tableSpent: removedData.tableSpent,
          comment: table.comment,
        }
      }
    };

    // Add log to table
    const existingLogs = updatedTable.logs || [];
    updatedTable.logs = [...existingLogs, newLog];

    // Update the table in the items array
    items[tableIndex] = updatedTable;

    // Update the table layout document
    await tableListsRef.update({
      items: items
    });

    // Update table summary to reflect the cancellation
    await updateTableSummary(data.companyId, data.eventId);

    // Remove event from user's eventSpending if userId exists
    if (removedData.userId) {
      const userRef = db.collection('users').doc(removedData.userId);
      const userDoc = await userRef.get();

      if (userDoc.exists) {
        const userData = userDoc.data();
        const currentEventSpent = userData?.eventSpending?.[data.eventId]?.spent || 0;

        // Remove the event from eventSpending map
        const updatedEventSpending = { ...userData?.eventSpending };
        delete updatedEventSpending[data.eventId];

        // Calculate new total spent
        const newTotalSpent = (userData?.totalSpent || 0) - currentEventSpent;

        await userRef.update({
          eventSpending: updatedEventSpending,
          totalSpent: Math.max(0, newTotalSpent), // Ensure it doesn't go negative
          lastSpent: userData?.lastSpent || 0,
        });
      }

      // Remove event from company guest's eventSpending
      const companyGuestRef = db.collection('companies')
        .doc(data.companyId)
        .collection('guests')
        .doc(removedData.userId);

      const companyGuestDoc = await companyGuestRef.get();

      if (companyGuestDoc.exists) {
        const companyGuestData = companyGuestDoc.data();
        const currentEventSpent = companyGuestData?.eventSpending?.[data.eventId]?.spent || 0;

        // Remove the event from eventSpending map
        const updatedEventSpending = { ...companyGuestData?.eventSpending };
        delete updatedEventSpending[data.eventId];

        // Calculate new total spent
        const newTotalSpent = (companyGuestData?.totalSpent || 0) - currentEventSpent;

        await companyGuestRef.update({
          eventSpending: updatedEventSpending,
          totalSpent: Math.max(0, newTotalSpent), // Ensure it doesn't go negative
          lastSpent: companyGuestData?.lastSpent || 0,
        });
      }
    }

    return {
      success: true,
      message: "Reservation cancelled successfully",
      data: {
        tableName: data.tableName,
        layoutId: data.layoutId,
        cancelledBy: userName,
        cancelledAt: new Date().toISOString(),
        removedData: removedData,
        logsCount: updatedTable.logs.length,
      }
    };

  } catch (error: any) {
    console.error("Error cancelling reservation:", error);
    return {
      success: false,
      error: `Failed to cancel reservation: ${error.message}`,
    };
  }
});

// Validation schema for resell table
const resellTableSchema = Joi.object({
  companyId: Joi.string().required(),
  eventId: Joi.string().required(),
  layoutId: Joi.string().required(),
  tableName: Joi.string().required(),
});

// Type definitions for resell table
interface ResellTableData {
  companyId: string;
  eventId: string;
  layoutId: string;
  tableName: string;
}

/**
 * Re-sell a table during an event
 * This function:
 * 1. Removes guest data from the table (userId, name, phone, email, nrOfGuests, tableLimit)
 * 2. Keeps other fields like staff, comment, etc.
 * 3. Does NOT remove event from user's or company guest's eventSpending
 * 4. Does NOT update tableSummary (keeps existing data)
 */
export const resellTable = onCall({
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

    const data = request.data as ResellTableData;

    // Validate input data
    const {error} = resellTableSchema.validate(data);
    if (error) {
      return {
        success: false,
        error: `Validation error: ${error.message}`,
      };
    }

    // Get current user info for logging
    const currentUser = request.auth;
    const userName = `${currentUser.token.name || 'Unknown User'}`;

    // Get the table layout document
    const tableListsRef = db.collection('companies')
      .doc(data.companyId)
      .collection('events')
      .doc(data.eventId)
      .collection('table_lists')
      .doc(data.layoutId);

    const tableListsDoc = await tableListsRef.get();

    if (!tableListsDoc.exists) {
      return {
        success: false,
        error: "Table layout not found",
      };
    }

    const tableListsData = tableListsDoc.data();
    const items = tableListsData?.items || [];

    // Find the specific table
    let table: any = null;
    let tableIndex = -1;

    for (let i = 0; i < tableListsData?.items?.length || 0; i++) {
      if (items[i].tableName === data.tableName) {
        table = items[i];
        tableIndex = i;
        break;
      }
    }

    if (!table) {
      return {
        success: false,
        error: "Table not found",
      };
    }

    // Check if table has a reservation to resell
    if (!table.userId) {
      return {
        success: false,
        error: "Table is not reserved",
      };
    }

    // Store the data we're removing for logging
    const removedData = {
      userId: table.userId,
      name: table.name,
      phoneNr: table.phoneNr,
      e164Number: table.e164Number,
      tableEmail: table.tableEmail,
      nrOfGuests: table.nrOfGuests,
      tableLimit: table.tableLimit,
      tableSpent: table.tableSpent || 0,
    };

    // Remove all data except staff from table
    const updatedTable = {
      ...table,
      userId: null,
      name: null,
      phoneNr: null,
      e164Number: null,
      tableEmail: null,
      nrOfGuests: null,
      tableLimit: null,
      tableSpent: null,
      tableCheckedIn: null,
      tableTimeFrom: null,
      tableTimeTo: null,
      tableBookedBy: null,
      comment: null,
    };
    
    // Only add tableStaff if it has a value (not undefined)
    if (table.tableStaff !== undefined) {
      updatedTable.tableStaff = table.tableStaff;
    }

    // Create log entry
    const newLog = {
      action: "table resold",
      userName: userName,
      timestamp: new Date().toISOString(),
      changes: {
        removed: {
          userId: removedData.userId,
          name: removedData.name,
          phoneNr: removedData.phoneNr,
          e164Number: removedData.e164Number,
          tableEmail: removedData.tableEmail,
          nrOfGuests: removedData.nrOfGuests,
          tableLimit: removedData.tableLimit,
          tableSpent: removedData.tableSpent,
          comment: table.comment,
        }
      }
    };

    // Add log to table
    const existingLogs = updatedTable.logs || [];
    updatedTable.logs = [...existingLogs, newLog];

    // Update the table in the items array
    items[tableIndex] = updatedTable;

    // Update the table layout document
    await tableListsRef.update({
      items: items
    });

    // Note: We do NOT update tableSummary or remove eventSpending data
    // This keeps the historical data intact for the event

    return {
      success: true,
      message: "Table resold successfully",
      data: {
        tableName: data.tableName,
        layoutId: data.layoutId,
        resoldBy: userName,
        resoldAt: new Date().toISOString(),
        removedData: removedData,
        logsCount: updatedTable.logs.length,
        note: "Event spending data and table summary remain unchanged for historical tracking",
      }
    };

  } catch (error: any) {
    console.error("Error reselling table:", error);
    return {
      success: false,
      error: `Failed to resell table: ${error.message}`,
    };
  }
});

// Move/Swap Table Schema
const moveTableSchema = Joi.object({
  companyId: Joi.string().required(),
  eventId: Joi.string().required(),
  sourceLayoutId: Joi.string().required(),
  sourceTableName: Joi.string().required(),
  destinationLayoutId: Joi.string().required(),
  destinationTableName: Joi.string().required(),
});

/**
 * Move or swap table bookings between different tables
 * This function handles:
 * 1. Moving a booking to an empty table
 * 2. Swapping bookings between two occupied tables
 * 3. Staff members stay at their original table locations
 * 4. Proper logging and summary updates
 * 5. Validation of source and destination tables
 */
export const moveTable = onCall({
  enforceAppCheck: false,
}, async (request) => {
  try {
    console.log('🚀 moveTable function STARTED');
    
    if (!request.auth) {
      return {
        success: false,
        error: "Unauthorized",
      };
    }

    // Extract and validate data
    const data = request.data;
    const { error } = moveTableSchema.validate(data);
    if (error) {
      return {
        success: false,
        error: `Validation error: ${error.message}`,
      };
    }

    // Get current user info
    const currentUser = request.auth;
    let userName = 'Unknown User';
    
    try {
      const currentUserDoc = await db.collection('users').doc(currentUser.uid).get();
      if (currentUserDoc.exists) {
        const userData = currentUserDoc.data();
        userName = `${userData?.userFirstName || ''} ${userData?.userLastName || ''}`.trim() || 'Unknown User';
      }
    } catch (error) {
      console.log('Could not fetch current user name:', error);
    }

    // Validate company and event exist
    const companyRef = db.collection('companies').doc(data.companyId);
    const companyDoc = await companyRef.get();
    if (!companyDoc.exists) {
      return { success: false, error: "Company not found" };
    }

    const eventRef = companyRef.collection('events').doc(data.eventId);
    const eventDoc = await eventRef.get();
    if (!eventDoc.exists) {
      return { success: false, error: "Event not found" };
    }

    // Get source layout document
    const sourceLayoutRef = eventRef.collection('table_lists').doc(data.sourceLayoutId);
    const sourceLayoutDoc = await sourceLayoutRef.get();
    if (!sourceLayoutDoc.exists) {
      return { 
        success: false, 
        error: `Source layout ${data.sourceLayoutId} not found` 
      };
    }

    const sourceLayoutData = sourceLayoutDoc.data();
    const sourceItems = sourceLayoutData?.items || [];
    
    // Find source table in items array
    const sourceTableIndex = sourceItems.findIndex((item: any) => item.tableName === data.sourceTableName);
    if (sourceTableIndex === -1) {
      return { 
        success: false, 
        error: `Source table ${data.sourceTableName} not found in layout ${data.sourceLayoutId}` 
      };
    }

    const sourceTableData = sourceItems[sourceTableIndex];
    
    // Check if source table has a booking
    const isSourceBooked = sourceTableData?.name && sourceTableData.name.trim() !== '';
    if (!isSourceBooked) {
      return {
        success: false,
        error: "Source table has no booking to move"
      };
    }

    // Get destination layout document (could be same as source)
    let destLayoutRef, destLayoutDoc, destLayoutData, destItems;
    if (data.destinationLayoutId === data.sourceLayoutId) {
      // Same layout - reuse the data we already have
      destLayoutRef = sourceLayoutRef;
      destLayoutDoc = sourceLayoutDoc;
      destLayoutData = sourceLayoutData;
      destItems = sourceItems;
    } else {
      // Different layout - fetch it
      destLayoutRef = eventRef.collection('table_lists').doc(data.destinationLayoutId);
      destLayoutDoc = await destLayoutRef.get();
      if (!destLayoutDoc.exists) {
        return { 
          success: false, 
          error: `Destination layout ${data.destinationLayoutId} not found` 
        };
      }
      destLayoutData = destLayoutDoc.data();
      destItems = destLayoutData?.items || [];
    }
    
    // Find destination table in items array
    const destTableIndex = destItems.findIndex((item: any) => item.tableName === data.destinationTableName);
    if (destTableIndex === -1) {
      return { 
        success: false, 
        error: `Destination table ${data.destinationTableName} not found in layout ${data.destinationLayoutId}` 
      };
    }

    const destTableData = destItems[destTableIndex];
    
    // Check if destination table is occupied
    const isDestBooked = destTableData?.name && destTableData.name.trim() !== '';
    
    // Prepare move details for logging
    const moveDetails = {
      fromTable: data.sourceTableName,
      fromLayout: data.sourceLayoutId,
      toTable: data.destinationTableName,
      toLayout: data.destinationLayoutId,
      isSwap: !!isDestBooked, // Ensure boolean value, not undefined
      timestamp: new Date().toISOString(), // Use regular timestamp instead of FieldValue.serverTimestamp()
    };

    // Store original staff assignments
    const sourceStaff = sourceTableData?.tableStaff || '';
    const destStaff = destTableData?.tableStaff || '';

    if (isDestBooked) {
      // SWAP OPERATION: Both tables are occupied
      console.log('🔄 Performing table swap operation');

      // Create updated items arrays for both layouts
      const updatedSourceItems = [...sourceItems];
      const updatedDestItems = data.destinationLayoutId === data.sourceLayoutId ? updatedSourceItems : [...destItems];

      // Prepare log entries for both tables
      const sourceLogEntry = {
        action: "table_swapped",
        changes: {
          swappedWith: data.destinationTableName,
          swappedWithLayout: data.destinationLayoutId,
          originalGuest: sourceTableData?.name || '',
          newGuest: destTableData?.name || '',
        },
        timestamp: new Date().toISOString(),
        userName: userName,
      };

      const destLogEntry = {
        action: "table_swapped",
        changes: {
          swappedWith: data.sourceTableName,
          swappedWithLayout: data.sourceLayoutId,
          originalGuest: destTableData?.name || '',
          newGuest: sourceTableData?.name || '',
        },
        timestamp: new Date().toISOString(),
        userName: userName,
      };

      // Prepare data for swapping (preserve table names and staff)
      const sourceBookingData = {
        ...destTableData,
        tableStaff: sourceStaff, // Source staff stays at source
        tableName: data.sourceTableName,
        tableSwappedWith: data.destinationTableName,
        tableSwappedWithLayout: data.destinationLayoutId,
        logs: [...(sourceTableData.logs || []), sourceLogEntry], // Add to logs array
        moveDetails: {
          ...moveDetails,
          swappedWith: destTableData?.name || 'unknown guest',
        }
      };
      
      const destBookingData = {
        ...sourceTableData,
        tableStaff: destStaff, // Destination staff stays at destination
        tableName: data.destinationTableName,
        tableSwappedWith: data.sourceTableName,
        tableSwappedWithLayout: data.sourceLayoutId,
        logs: [...(destTableData.logs || []), destLogEntry], // Add to logs array
        moveDetails: {
          ...moveDetails,
          swappedWith: sourceTableData?.name || 'unknown guest',
        }
      };

      // Update the items arrays
      updatedSourceItems[sourceTableIndex] = sourceBookingData;
      updatedDestItems[destTableIndex] = destBookingData;

      // Perform the swap in a batch
      const batch = db.batch();
      
      // Update source layout
      batch.update(sourceLayoutRef, { items: updatedSourceItems });
      
      // Update destination layout if different
      if (data.destinationLayoutId !== data.sourceLayoutId) {
        batch.update(destLayoutRef, { items: updatedDestItems });
      }

      await batch.commit();

      return {
        success: true,
        message: `Tables swapped successfully between ${data.sourceTableName} and ${data.destinationTableName}`,
        data: {
          operation: 'swap',
          sourceTable: data.sourceTableName,
          destinationTable: data.destinationTableName,
          sourceGuest: sourceTableData.name,
          destinationGuest: destTableData.name,
          swappedBy: userName,
          timestamp: new Date().toISOString(),
        }
      };

    } else {
      // MOVE OPERATION: Destination table is empty
      console.log('➡️ Performing table move operation');

      // Create updated items arrays for both layouts
      const updatedSourceItems = [...sourceItems];
      const updatedDestItems = data.destinationLayoutId === data.sourceLayoutId ? updatedSourceItems : [...destItems];

      // Prepare log entries for both tables
      const sourceMoveLogEntry = {
        action: "table_cleared_for_move",
        changes: {
          movedTo: data.destinationTableName,
          movedToLayout: data.destinationLayoutId,
          guestName: sourceTableData?.name || '',
        },
        timestamp: new Date().toISOString(),
        userName: userName,
      };

      const destMoveLogEntry = {
        action: "table_moved_here",
        changes: {
          movedFrom: data.sourceTableName,
          movedFromLayout: data.sourceLayoutId,
          guestName: sourceTableData?.name || '',
        },
        timestamp: new Date().toISOString(),
        userName: userName,
      };

      // Clear source table but keep staff and table structure
      const clearedSourceData = {
        ...sourceTableData,
        name: '',
        phoneNr: '',
        tableEmail: '',
        nrOfGuests: 0,
        tableBookedBy: '',
        tableCheckedIn: 0,
        tableLimit: 0,
        tableSpent: 0,
        tableTimeFrom: '',
        tableTimeTo: '',
        tableStaff: sourceStaff || '', // Keep original staff at source
        comment: '',
        tableName: data.sourceTableName,
        userId: null,
        tableMovedTo: data.destinationTableName,
        tableMovedToLayout: data.destinationLayoutId,
        logs: [...(sourceTableData.logs || []), sourceMoveLogEntry], // Add to logs array
      };

      // Move booking to destination (preserve table name and destination staff)
      const movedBookingData = {
        ...sourceTableData,
        tableStaff: destStaff || '', // Keep destination staff at destination
        tableName: data.destinationTableName,
        tableMovedFrom: data.sourceTableName,
        tableMovedFromLayout: data.sourceLayoutId,
        logs: [...(destTableData.logs || []), destMoveLogEntry], // Add to logs array
        moveDetails: moveDetails,
      };

      // Update the items arrays
      updatedSourceItems[sourceTableIndex] = clearedSourceData;
      updatedDestItems[destTableIndex] = movedBookingData;

      // Perform the move in a batch
      const batch = db.batch();
      
      // Update source layout
      batch.update(sourceLayoutRef, { items: updatedSourceItems });
      
      // Update destination layout if different
      if (data.destinationLayoutId !== data.sourceLayoutId) {
        batch.update(destLayoutRef, { items: updatedDestItems });
      }

      await batch.commit();

      // Update table summary (mainly for consistency)
      await updateTableSummary(data.companyId, data.eventId);

      return {
        success: true,
        message: `Table moved successfully from ${data.sourceTableName} to ${data.destinationTableName}`,
        data: {
          operation: 'move',
          sourceTable: data.sourceTableName,
          destinationTable: data.destinationTableName,
          guestName: sourceTableData.name,
          movedBy: userName,
          timestamp: new Date().toISOString(),
        }
      };
    }

  } catch (error: any) {
    console.error("Error moving/swapping table:", error);
    return {
      success: false,
      error: `Failed to move table: ${error.message}`,
    };
  }
});


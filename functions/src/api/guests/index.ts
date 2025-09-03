import {onCall} from "firebase-functions/v2/https";
import {getFirestore, FieldValue} from "firebase-admin/firestore";
import * as Joi from "joi";
import {v4 as uuidv4} from "uuid";

// Get Firestore instance
const db = getFirestore();

// Type definitions
interface GuestLog {
  action: string;
  userId: string;
  userName: string;
  timestamp: Date;
  changes: Record<string, any>;
}

interface Guest {
  guestId: string;
  guestName: string;
  normalGuests: number;
  freeGuests: number;
  normalCheckedIn: number;
  freeCheckedIn: number;
  comment: string;
  categories: string[];
  logs: GuestLog[];
}

// Validation schema for adding a guest
const addGuestSchema = Joi.object({
  eventId: Joi.string().required(),
  companyId: Joi.string().required(),
  guestListId: Joi.string().optional().default('main'), // Guest list document ID, defaults to 'main'
  guestName: Joi.string().required().min(1).max(100),
  normalGuests: Joi.number().integer().min(0).default(0),
  freeGuests: Joi.number().integer().min(0).default(0),
  comment: Joi.string().optional().max(500).default(''),
  categories: Joi.array().items(Joi.string()).optional().default([]),
  selectedUserId: Joi.string().optional(), // Optional: if user was selected from search
});

// Validation schema for adding multiple guests
const addMultipleGuestsSchema = Joi.object({
  eventId: Joi.string().required(),
  companyId: Joi.string().required(),
  guestListId: Joi.string().optional().default('main'), // Guest list document ID, defaults to 'main'
  guestsText: Joi.string().required().min(1),
});

// Validation schema for draft operations
const draftSchema = Joi.object({
  eventId: Joi.string().required(),
  draftText: Joi.string().optional(),
});

// Validation schema for updating a guest
const updateGuestSchema = Joi.object({
  eventId: Joi.string().required(),
  companyId: Joi.string().required(),
  guestListId: Joi.string().optional().default('main'), // Guest list document ID, defaults to 'main'
  guestId: Joi.string().required(),
  guestName: Joi.string().optional(),
  normalGuests: Joi.number().min(0).optional(),
  freeGuests: Joi.number().min(0).optional(),
  comment: Joi.string().optional(),
  categories: Joi.array().items(Joi.string()).optional(),
});

// Validation schema for checking in guests
const checkInGuestSchema = Joi.object({
  eventId: Joi.string().required(),
  companyId: Joi.string().required(),
  guestListId: Joi.string().optional().default('main'), // Guest list document ID, defaults to 'main'
  guestId: Joi.string().required(),
  normalIncrement: Joi.number().min(0).optional(),
  freeIncrement: Joi.number().min(0).optional(),
  normalCheckedIn: Joi.number().min(0).optional(),
  freeCheckedIn: Joi.number().min(0).optional(),
  action: Joi.string().valid('increment', 'set').required(),
});

/**
 * Add a guest to an event's guest list
 * This function handles:
 * 1. Validating the guest data
 * 2. Generating a unique guest ID
 * 3. Adding the guest to the specified guest list (defaults to 'main')
 * 4. Updating guest list summary statistics
 * 5. Adding the guest to company guests (if user was selected)
 * 
 * All operations are performed in a single transaction for data consistency
 */
export const addGuest = onCall({enforceAppCheck: false}, async (request) => {
  try {
    // Ensure user is authenticated
    if (!request.auth) {
      throw new Error("Unauthorized");
    }
    
    const userId = request.auth.uid;
    const userData = request.auth.token;
    
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
    
    // Validate request data
    const {
      eventId,
      companyId,
      guestListId,
      guestName,
      normalGuests,
      freeGuests,
      comment,
      categories,
      selectedUserId,
    } = request.data;

    // Validate input data
    const {error} = addGuestSchema.validate(request.data);
    if (error) {
      return {
        success: false,
        error: `Validation error: ${error.message}`,
      };
    }

    // Validate that at least one guest type has a value
    if (normalGuests === 0 && freeGuests === 0) {
      return {
        success: false,
        error: "At least one guest type must have a value greater than 0",
      };
    }

    // Check if company exists
    const companyRef = db.collection('companies').doc(companyId);
    const companyDoc = await companyRef.get();
    
    if (!companyDoc.exists) {
      return {
        success: false,
        error: "Company not found",
      };
    }

    // Check if event exists
    const eventRef = db.collection('companies').doc(companyId).collection('events').doc(eventId);
    const eventDoc = await eventRef.get();
    
    if (!eventDoc.exists) {
      return {
        success: false,
        error: "Event not found",
      };
    }

    // Generate unique guest ID
    const guestId = uuidv4();

    // Prepare guest data
    const newGuest: Guest = {
      guestId,
      guestName,
      normalGuests: normalGuests || 0,
      freeGuests: freeGuests || 0,
      normalCheckedIn: 0,
      freeCheckedIn: 0,
      comment: comment || '',
      categories: categories || [],
      logs: [
        {
          action: 'created',
          userId,
          userName,
          timestamp: new Date(),
          changes: {
            guestName,
            normalGuests: normalGuests || 0,
            freeGuests: freeGuests || 0,
            comment: comment || '',
            categories: categories || [],
          },
        },
      ],
    };

    // Get guest list references
    const guestListRef = eventRef.collection('guest_lists').doc(guestListId);
    const guestListSummaryRef = eventRef.collection('guest_lists').doc('guestListSummary');
    const guestListLogRef = eventRef.collection('guest_lists').doc('guestlistLog');

    // Get current data before transaction (all reads first)
    const [guestListDoc, guestListLogDoc] = await Promise.all([
      guestListRef.get(),
      guestListLogRef.get(),
    ]);

    let currentGuestList: Guest[] = [];
    if (guestListDoc.exists) {
      const data = guestListDoc.data();
      currentGuestList = data?.guestList || [];
    }

    let currentLogs: any[] = [];
    if (guestListLogDoc.exists) {
      const data = guestListLogDoc.data();
      currentLogs = data?.logs || [];
    }

    // Prepare log entry with standardized format
    const logEntry = {
      addedAt: new Date().toISOString(),
      addedBy: userName,
      guestName: guestName,
      status: "added",
      userId: userId,
    };

    // Add new guest to the list
    currentGuestList.push(newGuest);
    currentLogs.push(logEntry);

    // Run all operations in a transaction (only writes)
    await db.runTransaction(async (transaction) => {
      // 1. Update guest list document - only update the array and timestamp, preserve other fields
      transaction.update(guestListRef, {
        guestList: currentGuestList,
        lastUpdated: FieldValue.serverTimestamp(),
      });

      // 2. Update guest list summary
      const totalGuests = (normalGuests || 0) + (freeGuests || 0);
      const totalNormalGuests = normalGuests || 0;
      const totalFreeGuests = freeGuests || 0;

      transaction.update(guestListSummaryRef, {
        totalGuests: FieldValue.increment(totalGuests),
        totalNormalGuests: FieldValue.increment(totalNormalGuests),
        totalFreeGuests: FieldValue.increment(totalFreeGuests),
        lastUpdated: FieldValue.serverTimestamp(),
      });

      // 3. Update guest list log
      transaction.set(guestListLogRef, {
        logs: currentLogs,
        lastUpdated: FieldValue.serverTimestamp(),
      });
    });

    // 6. Add guest to company guests (whether new or existing user)
    try {
      const userIdForCompanyGuests = selectedUserId || guestId; // Use selected user ID or generate new one
      await _addUserToCompanyGuests(companyId, eventId, userIdForCompanyGuests, guestName, selectedUserId ? 'existing' : 'new');
    } catch (error) {
      console.warn('Failed to add user to company guests:', error);
      // Don't fail the main operation for this
    }

    return {
      success: true,
      message: "Guest added successfully",
      data: {
        guestId,
        guestName,
        normalGuests: normalGuests || 0,
        freeGuests: freeGuests || 0,
        totalGuests: (normalGuests || 0) + (freeGuests || 0),
        addedBy: userName,
        addedAt: new Date().toISOString(),
        userIdForCompanyGuests: selectedUserId || guestId,
        userType: selectedUserId ? 'existing' : 'new',
        guestListId: guestListId,
      },
    };
  } catch (error) {
    console.error("Error adding guest:", error);
    return {
      success: false,
      error: "Failed to add guest",
    };
  }
});

/**
 * Add multiple guests to an event's guest list from text input
 * This function handles:
 * 1. Parsing text input in format: "FirstName LastName +free +paid"
 * 2. Creating multiple guest objects
 * 3. Adding all guests to the specified guest list (defaults to 'main')
 * 4. Updating guest list summary statistics
 * 5. Creating log entries for each guest
 * 
 * Format: "John Doe +2 +3" (2 free guests, 3 paid guests)
 * Format: "John Doe +0 +2" (0 free guests, 2 paid guests)
 */
export const addMultipleGuests = onCall({enforceAppCheck: false}, async (request) => {
  try {
    // Ensure user is authenticated
    if (!request.auth) {
      throw new Error("Unauthorized");
    }
    
    const userId = request.auth.uid;
    const userData = request.auth.token;
    
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
    
    // Validate request data
    const {
      eventId,
      companyId,
      guestListId,
      guestsText,
    } = request.data;

    // Validate input data
    const {error} = addMultipleGuestsSchema.validate(request.data);
    if (error) {
      return {
        success: false,
        error: `Validation error: ${error.message}`,
      };
    }

    // Check if company exists
    const companyRef = db.collection('companies').doc(companyId);
    const companyDoc = await companyRef.get();
    
    if (!companyDoc.exists) {
      return {
        success: false,
        error: "Company not found",
      };
    }

    // Check if event exists
    const eventRef = db.collection('companies').doc(companyId).collection('events').doc(eventId);
    const eventDoc = await eventRef.get();
    
    if (!eventDoc.exists) {
      return {
        success: false,
        error: "Event not found",
      };
    }

    // Parse guests from text
    const lines = guestsText.split('\n');
    const newGuests: Guest[] = [];
    let totalNormalGuests = 0;
    let totalFreeGuests = 0;

    for (const line of lines) {
      if (line.trim().isEmpty) continue;

      const parts = line.trim().split(' ');
      if (parts.length < 3) continue;

      // Find where the guest counts start (first + sign)
      const nameEndIndex = parts.findIndex((part: string) => part.startsWith('+'));
      if (nameEndIndex === -1) continue;

      // Extract name (everything before the first + sign)
      let name = parts.slice(0, nameEndIndex).join(' ');
      
      // Extract numbers (everything after + signs)
      const numbers = parts
        .slice(nameEndIndex)
        .filter((part: string) => part.startsWith('+'))
        .map((part: string) => parseInt(part.substring(1)) || 0);

      // Parse guest counts based on the format
      let freeGuests = 0;
      let paidGuests = 0;
      
      // Check if there's a number before the + signs (like "Sam Salehi 0 +2")
      if (nameEndIndex > 0) {
        const lastPartBeforePlus = parts[nameEndIndex - 1];
        if (!isNaN(parseInt(lastPartBeforePlus))) {
          // Format: "Name 0 +2" -> free: 0, paid: 2
          freeGuests = parseInt(lastPartBeforePlus);
          paidGuests = numbers.length > 0 ? numbers[0] : 0;
          // Remove the number from the name
          name = parts.slice(0, nameEndIndex - 1).join(' ');
        } else {
          // Format: "Name +2 +3" -> free: 2, paid: 3
          freeGuests = numbers.length > 0 ? numbers[0] : 0;
          paidGuests = numbers.length > 1 ? numbers[1] : 0;
        }
      } else {
        // Format: "Name +2 +3" -> free: 2, paid: 3
        freeGuests = numbers.length > 0 ? numbers[0] : 0;
        paidGuests = numbers.length > 1 ? numbers[1] : 0;
      }

      // Create guest if there's a name and at least one guest count > 0
      if (name && (freeGuests > 0 || paidGuests > 0)) {
        const guestId = uuidv4();
        
        newGuests.push({
          guestId,
          guestName: name,
          freeGuests,
          normalGuests: paidGuests,
          freeCheckedIn: 0,
          normalCheckedIn: 0,
          categories: [],
          comment: '',
          logs: [
            {
              action: 'created',
              userId,
              userName,
              timestamp: new Date(),
              changes: {
                guestName: name,
                normalGuests: paidGuests,
                freeGuests,
                comment: '',
                categories: [],
              },
            },
          ],
        });

        totalNormalGuests += paidGuests;
        totalFreeGuests += freeGuests;
      }
    }

    if (newGuests.length === 0) {
      return {
        success: false,
        error: "No valid guests found in the provided text",
      };
    }

    // Get guest list references
    const guestListRef = eventRef.collection('guest_lists').doc(guestListId);
    const guestListSummaryRef = eventRef.collection('guest_lists').doc('guestListSummary');
    const guestListLogRef = eventRef.collection('guest_lists').doc('guestlistLog');

    // Get current data before transaction (all reads first)
    const [guestListDoc, guestListLogDoc] = await Promise.all([
      guestListRef.get(),
      guestListLogRef.get(),
    ]);

    let currentGuestList: Guest[] = [];
    if (guestListDoc.exists) {
      const data = guestListDoc.data();
      currentGuestList = data?.guestList || [];
    }

    let currentLogs: any[] = [];
    if (guestListLogDoc.exists) {
      const data = guestListLogDoc.data();
      currentLogs = data?.logs || [];
    }

    // Prepare log entries for each guest
    const logEntries = newGuests.map(guest => ({
      addedAt: new Date().toISOString(),
      addedBy: userName,
      guestName: guest.guestName,
      status: "added",
      userId: userId,
    }));

    // Add new guests to the list
    currentGuestList.push(...newGuests);
    currentLogs.push(...logEntries);

    // Run all operations in a transaction (only writes)
    await db.runTransaction(async (transaction) => {
      // 1. Update guest list document - only update the array and timestamp, preserve other fields
      transaction.update(guestListRef, {
        guestList: currentGuestList,
        lastUpdated: FieldValue.serverTimestamp(),
      });

      // 2. Update guest list summary
      transaction.update(guestListSummaryRef, {
        totalGuests: FieldValue.increment(totalNormalGuests + totalFreeGuests),
        totalNormalGuests: FieldValue.increment(totalNormalGuests),
        totalFreeGuests: FieldValue.increment(totalFreeGuests),
        lastUpdated: FieldValue.serverTimestamp(),
      });

      // 3. Update guest list log
      transaction.set(guestListLogRef, {
        logs: currentLogs,
        lastUpdated: FieldValue.serverTimestamp(),
      });
    });

    return {
      success: true,
      message: "Multiple guests added successfully",
      data: {
        guestsAdded: newGuests.length,
        totalNormalGuests,
        totalFreeGuests,
        totalGuests: totalNormalGuests + totalFreeGuests,
        addedBy: userName,
        addedAt: new Date().toISOString(),
        guestNames: newGuests.map(g => g.guestName),
        guestListId: guestListId,
      },
    };
  } catch (error) {
    console.error("Error adding multiple guests:", error);
    return {
      success: false,
      error: "Failed to add multiple guests",
    };
  }
});

/**
 * Save a draft for multiple guests
 */
export const saveGuestDraft = onCall({enforceAppCheck: false}, async (request) => {
  try {
    // Ensure user is authenticated
    if (!request.auth) {
      throw new Error("Unauthorized");
    }
    
    const userId = request.auth.uid;
    
    // Validate request data
    const {
      eventId,
      draftText,
    } = request.data;

    // Validate input data
    const {error} = draftSchema.validate(request.data);
    if (error) {
      return {
        success: false,
        error: `Validation error: ${error.message}`,
      };
    }

    // Save draft to user's document
    await db.collection('users').doc(userId).update({
      [`guestListDrafts.${eventId}`]: draftText || '',
    });

    return {
      success: true,
      message: "Draft saved successfully",
      data: {
        eventId,
        savedAt: new Date().toISOString(),
      },
    };
  } catch (error) {
    console.error("Error saving draft:", error);
    return {
      success: false,
      error: "Failed to save draft",
    };
  }
});



/**
 * Clear a saved draft for multiple guests
 */
export const clearGuestDraft = onCall({enforceAppCheck: false}, async (request) => {
  try {
    // Ensure user is authenticated
    if (!request.auth) {
      throw new Error("Unauthorized");
    }
    
    const userId = request.auth.uid;
    
    // Validate request data
    const {
      eventId,
    } = request.data;

    // Validate input data
    const {error} = Joi.object({
      eventId: Joi.string().required(),
    }).validate(request.data);
    
    if (error) {
      return {
        success: false,
        error: `Validation error: ${error.message}`,
      };
    }

    // Clear draft from user's document
    await db.collection('users').doc(userId).update({
      [`guestListDrafts.${eventId}`]: FieldValue.delete(),
    });

    return {
      success: true,
      message: "Draft cleared successfully",
      data: {
        eventId,
        clearedAt: new Date().toISOString(),
      },
    };
  } catch (error) {
    console.error("Error clearing draft:", error);
    return {
      success: false,
      error: "Failed to clear draft",
    };
  }
});

/**
 * Update an existing guest in an event's guest list
 * This function handles:
 * 1. Updating guest details (name, counts, comment, categories)
 * 2. Calculating differences in guest counts
 * 3. Updating guest list summary statistics
 * 4. Creating log entries for changes
 * 5. Maintaining guest list integrity
 */
export const updateGuest = onCall({enforceAppCheck: false}, async (request) => {
  try {
    // Ensure user is authenticated
    if (!request.auth) {
      throw new Error("Unauthorized");
    }
    
    const userId = request.auth.uid;
    const userData = request.auth.token;
    
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
    
    // Validate request data
    const {
      eventId,
      companyId,
      guestListId,
      guestId,
      guestName,
      normalGuests,
      freeGuests,
      comment,
      categories,
    } = request.data;

    // Validate input data
    const {error} = updateGuestSchema.validate(request.data);
    if (error) {
      return {
        success: false,
        error: `Validation error: ${error.message}`,
      };
    }

    // Check if company exists
    const companyRef = db.collection('companies').doc(companyId);
    const companyDoc = await companyRef.get();
    
    if (!companyDoc.exists) {
      return {
        success: false,
        error: "Company not found",
      };
    }

    // Check if event exists
    const eventRef = db.collection('companies').doc(companyId).collection('events').doc(eventId);
    const eventDoc = await eventRef.get();
    
    if (!eventDoc.exists) {
      return {
        success: false,
        error: "Event not found",
      };
    }

    // Get guest list references
    const guestListRef = eventRef.collection('guest_lists').doc(guestListId);
    const guestListSummaryRef = eventRef.collection('guest_lists').doc('guestListSummary');
    const guestListLogRef = eventRef.collection('guest_lists').doc('guestlistLog');

    // Get current data before transaction (all reads first)
    const [guestListDoc, guestListLogDoc] = await Promise.all([
      guestListRef.get(),
      guestListLogRef.get(),
    ]);

    if (!guestListDoc.exists) {
      return {
        success: false,
        error: "Guest list not found",
      };
    }

    const data = guestListDoc.data();
    const currentGuestList: Guest[] = data?.guestList || [];
    
    // Find the guest to update
    const guestIndex = currentGuestList.findIndex(g => g.guestId === guestId);
    if (guestIndex === -1) {
      return {
        success: false,
        error: "Guest not found",
      };
    }

    const originalGuest = currentGuestList[guestIndex];
    
    // Calculate differences
    const normalGuestsDiff = (normalGuests ?? originalGuest.normalGuests) - originalGuest.normalGuests;
    const freeGuestsDiff = (freeGuests ?? originalGuest.freeGuests) - originalGuest.freeGuests;
    const totalGuestsDiff = normalGuestsDiff + freeGuestsDiff;

    // Prepare changes object for logging
    const changes: Record<string, any> = {};
    
    if (guestName !== undefined && guestName !== originalGuest.guestName) {
      changes.guestName = guestName;
    }
    if (normalGuests !== undefined && normalGuests !== originalGuest.normalGuests) {
      changes.normalGuests = normalGuests;
    }
    if (freeGuests !== undefined && freeGuests !== originalGuest.freeGuests) {
      changes.freeGuests = freeGuests;
    }
    if (comment !== undefined && comment !== originalGuest.comment) {
      changes.comment = comment;
    }
    if (categories !== undefined && JSON.stringify(categories) !== JSON.stringify(originalGuest.categories)) {
      changes.categories = categories;
    }

    // If no changes, return early
    if (Object.keys(changes).length === 0) {
      return {
        success: true,
        message: "No changes detected",
        data: {
          guestId,
          guestName: originalGuest.guestName,
          updatedAt: new Date().toISOString(),
        },
      };
    }

    // Update the guest object
    const updatedGuest: Guest = {
      ...originalGuest,
      guestName: guestName ?? originalGuest.guestName,
      normalGuests: normalGuests ?? originalGuest.normalGuests,
      freeGuests: freeGuests ?? originalGuest.freeGuests,
      comment: comment ?? originalGuest.comment,
      categories: categories ?? originalGuest.categories,
      logs: [
        ...originalGuest.logs,
        {
          action: 'updated',
          userId,
          userName,
          timestamp: new Date(),
          changes,
        },
      ],
    };

    // Update the guest in the list
    currentGuestList[guestIndex] = updatedGuest;

    // Prepare log entry for guestlistLog with standardized format
    const logEntry = {
      addedAt: new Date().toISOString(),
      addedBy: userName,
      guestName: updatedGuest.guestName,
      status: "updated",
      userId: userId,
    };

    let currentLogs: any[] = [];
    if (guestListLogDoc.exists) {
      const logData = guestListLogDoc.data();
      currentLogs = logData?.logs || [];
    }
    currentLogs.push(logEntry);

    // Run all operations in a transaction (only writes)
    await db.runTransaction(async (transaction) => {
      // 1. Update guest list document - only update the array and timestamp, preserve other fields
      transaction.update(guestListRef, {
        guestList: currentGuestList,
        lastUpdated: FieldValue.serverTimestamp(),
      });

      // 2. Update guest list summary (only if guest counts changed)
      if (totalGuestsDiff !== 0) {
        transaction.update(guestListSummaryRef, {
          totalGuests: FieldValue.increment(totalGuestsDiff),
          totalNormalGuests: FieldValue.increment(normalGuestsDiff),
          totalFreeGuests: FieldValue.increment(freeGuestsDiff),
          lastUpdated: FieldValue.serverTimestamp(),
        });
      }

      // 3. Update guest list log
      transaction.set(guestListLogRef, {
        logs: currentLogs,
        lastUpdated: FieldValue.serverTimestamp(),
      });
    });

    return {
      success: true,
      message: "Guest updated successfully",
      data: {
        guestId,
        guestName: updatedGuest.guestName,
        normalGuests: updatedGuest.normalGuests,
        freeGuests: updatedGuest.freeGuests,
        totalGuests: updatedGuest.normalGuests + updatedGuest.freeGuests,
        comment: updatedGuest.comment,
        categories: updatedGuest.categories,
        updatedBy: userName,
        updatedAt: new Date().toISOString(),
        changes: changes,
        summaryUpdated: totalGuestsDiff !== 0,
        guestListId: guestListId,
      },
    };
  } catch (error) {
    console.error("Error updating guest:", error);
    return {
      success: false,
      error: "Failed to update guest",
    };
  }
});

/**
 * Check in guests or edit check-in counts
 * This function handles:
 * 1. Incrementing check-in counts (for rapid tapping)
 * 2. Setting specific check-in counts (for manual editing)
 * 3. Updating guest list summary statistics
 * 4. Creating log entries for check-in actions
 * 5. Validating check-in limits
 */
export const checkInGuest = onCall({enforceAppCheck: false}, async (request) => {
  try {
    // Ensure user is authenticated
    if (!request.auth) {
      throw new Error("Unauthorized");
    }
    
    const userId = request.auth.uid;
    const userData = request.auth.token;
    
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
    
    // Validate request data
    const {
      eventId,
      companyId,
      guestListId,
      guestId,
      normalIncrement,
      freeIncrement,
      normalCheckedIn,
      freeCheckedIn,
      action,
    } = request.data;

    // Validate input data
    const {error} = checkInGuestSchema.validate(request.data);
    if (error) {
      return {
        success: false,
        error: `Validation error: ${error.message}`,
      };
    }

    // Check if company exists
    const companyRef = db.collection('companies').doc(companyId);
    const companyDoc = await companyRef.get();
    
    if (!companyDoc.exists) {
      return {
        success: false,
        error: "Company not found",
      };
    }

    // Check if event exists
    const eventRef = db.collection('companies').doc(companyId).collection('events').doc(eventId);
    const eventDoc = await eventRef.get();
    
    if (!eventDoc.exists) {
      return {
        success: false,
        error: "Event not found",
      };
    }

    // Get guest list references
    const guestListRef = eventRef.collection('guest_lists').doc(guestListId);
    const guestListSummaryRef = eventRef.collection('guest_lists').doc('guestListSummary');
    const guestListLogRef = eventRef.collection('guest_lists').doc('guestlistLog');

    // Get current log data before transaction
    const guestListLogDoc = await guestListLogRef.get();
    let currentLogs: any[] = [];
    if (guestListLogDoc.exists) {
      const logData = guestListLogDoc.data();
      currentLogs = logData?.logs || [];
    }

    // Run all operations in a transaction (reads and writes)
    const result = await db.runTransaction(async (transaction) => {
      // 1. Read current guest list data inside transaction
      const guestListDoc = await transaction.get(guestListRef);
      
      if (!guestListDoc.exists) {
        throw new Error("Guest list not found");
      }

      const data = guestListDoc.data();
      const currentGuestList: Guest[] = data?.guestList || [];
      
      // Find the guest to update
      const guestIndex = currentGuestList.findIndex(g => g.guestId === guestId);
      if (guestIndex === -1) {
        throw new Error("Guest not found");
      }

      const originalGuest = currentGuestList[guestIndex];
      
      // Calculate new check-in values based on action
      let newNormalCheckedIn: number;
      let newFreeCheckedIn: number;
      let normalDiff: number;
      let freeDiff: number;
      let totalDiff: number;
      let logAction: string;
      let changes: Record<string, any> = {};

      if (action === 'increment') {
        // Increment mode - add to existing values
        newNormalCheckedIn = originalGuest.normalCheckedIn + (normalIncrement || 0);
        newFreeCheckedIn = originalGuest.freeCheckedIn + (freeIncrement || 0);
        normalDiff = normalIncrement || 0;
        freeDiff = freeIncrement || 0;
        logAction = 'checked in';
        
        if (normalIncrement && normalIncrement > 0) {
          changes.normalCheckedIn = newNormalCheckedIn;
        }
        if (freeIncrement && freeIncrement > 0) {
          changes.freeCheckedIn = newFreeCheckedIn;
        }
      } else {
        // Set mode - directly set values
        newNormalCheckedIn = normalCheckedIn ?? originalGuest.normalCheckedIn;
        newFreeCheckedIn = freeCheckedIn ?? originalGuest.freeCheckedIn;
        normalDiff = newNormalCheckedIn - originalGuest.normalCheckedIn;
        freeDiff = newFreeCheckedIn - originalGuest.freeCheckedIn;
        logAction = 'edited check-in';
        
        if (normalCheckedIn !== undefined && normalCheckedIn !== originalGuest.normalCheckedIn) {
          changes.normalCheckedIn = newNormalCheckedIn;
        }
        if (freeCheckedIn !== undefined && freeCheckedIn !== originalGuest.freeCheckedIn) {
          changes.freeCheckedIn = newFreeCheckedIn;
        }
      }

      // Calculate total difference
      totalDiff = normalDiff + freeDiff;

      // Validate check-in limits
      if (newNormalCheckedIn > originalGuest.normalGuests) {
        throw new Error(`Cannot check in more than ${originalGuest.normalGuests} normal guests`);
      }

      if (newFreeCheckedIn > originalGuest.freeGuests) {
        throw new Error(`Cannot check in more than ${originalGuest.freeGuests} free guests`);
      }

      if (newNormalCheckedIn < 0 || newFreeCheckedIn < 0) {
        throw new Error("Check-in counts cannot be negative");
      }

      // If no changes, return early
      if (normalDiff === 0 && freeDiff === 0) {
        return {
          success: true,
          message: "No changes detected",
          data: {
            guestId,
            guestName: originalGuest.guestName,
            normalCheckedIn: originalGuest.normalCheckedIn,
            freeCheckedIn: originalGuest.freeCheckedIn,
            updatedAt: new Date().toISOString(),
          },
        };
      }

      // Update the guest object
      const updatedGuest: Guest = {
        ...originalGuest,
        normalCheckedIn: newNormalCheckedIn,
        freeCheckedIn: newFreeCheckedIn,
        logs: [
          ...originalGuest.logs,
          {
            action: logAction,
            userId,
            userName,
            timestamp: new Date(),
            changes,
          },
        ],
      };

      // Update the guest in the list
      currentGuestList[guestIndex] = updatedGuest;

      // Prepare log entry for guestlistLog
      const logEntry = {
        addedAt: new Date().toISOString(),
        addedBy: userName,
        guestName: updatedGuest.guestName,
        status: "checked_in",
        userId: userId,
      };
      currentLogs.push(logEntry);

      // 2. Update guest list document - only update the array and timestamp, preserve other fields
      transaction.update(guestListRef, {
        guestList: currentGuestList,
        lastUpdated: FieldValue.serverTimestamp(),
      });

      // 3. Update guest list summary
      if (totalDiff !== 0) {
        transaction.update(guestListSummaryRef, {
          totalCheckedIn: FieldValue.increment(totalDiff),
          normalGuestsCheckedIn: FieldValue.increment(normalDiff),
          freeGuestsCheckedIn: FieldValue.increment(freeDiff),
          lastUpdated: FieldValue.serverTimestamp(),
        });
      }

      // 4. Update guest list log
      transaction.set(guestListLogRef, {
        logs: currentLogs,
        lastUpdated: FieldValue.serverTimestamp(),
      });

      // Return the result data
      return {
        success: true,
        message: action === 'increment' ? "Guests checked in successfully" : "Check-in count updated successfully",
        data: {
          guestId,
          guestName: updatedGuest.guestName,
          normalCheckedIn: newNormalCheckedIn,
          freeCheckedIn: newFreeCheckedIn,
          totalCheckedIn: newNormalCheckedIn + newFreeCheckedIn,
          normalGuests: originalGuest.normalGuests,
          freeGuests: originalGuest.freeGuests,
          checkedInBy: userName,
          checkedInAt: new Date().toISOString(),
          action: action,
          changes: changes,
          summaryUpdated: totalDiff !== 0,
          guestListId: guestListId,
        },
      };
    });

    return result;
  } catch (error) {
    console.error("Error checking in guest:", error);
    return {
      success: false,
      error: "Failed to check in guest",
    };
  }
});

// Validation schema for deleting guests
const deleteGuestSchema = Joi.object({
  eventId: Joi.string().required(),
  companyId: Joi.string().required(),
  guestListId: Joi.string().optional().default('main'), // Guest list document ID, defaults to 'main'
  guestId: Joi.string().when('guestIds', {
    is: Joi.exist(),
    then: Joi.optional(),
    otherwise: Joi.required()
  }),
  guestIds: Joi.array().items(Joi.string()).optional(), // Array of guest IDs for bulk deletion
}).or('guestId', 'guestIds'); // Either guestId or guestIds must be provided

/**
 * Delete one or multiple guests from an event's guest list
 * This function handles:
 * 1. Validating the guest data
 * 2. Finding and removing guests from the specified guest list
 * 3. Updating guest list summary statistics
 * 4. Creating log entries for deletions
 * 5. Maintaining guest list integrity
 * 
 * All operations are performed in a single transaction for data consistency
 */
export const deleteGuest = onCall({enforceAppCheck: false}, async (request) => {
  try {
    // Ensure user is authenticated
    if (!request.auth) {
      throw new Error("Unauthorized");
    }
    
    const userId = request.auth.uid;
    const userData = request.auth.token;
    
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
    
    // Validate request data
    const {
      eventId,
      companyId,
      guestListId,
      guestId,
      guestIds,
    } = request.data;

    // Validate input data
    const {error} = deleteGuestSchema.validate(request.data);
    if (error) {
      return {
        success: false,
        error: `Validation error: ${error.message}`,
      };
    }

    // Check if company exists
    const companyRef = db.collection('companies').doc(companyId);
    const companyDoc = await companyRef.get();
    
    if (!companyDoc.exists) {
      return {
        success: false,
        error: "Company not found",
      };
    }

    // Check if event exists
    const eventRef = db.collection('companies').doc(companyId).collection('events').doc(eventId);
    const eventDoc = await eventRef.get();
    
    if (!eventDoc.exists) {
      return {
        success: false,
        error: "Event not found",
      };
    }

    // Get guest list references
    const guestListRef = eventRef.collection('guest_lists').doc(guestListId);
    const guestListSummaryRef = eventRef.collection('guest_lists').doc('guestListSummary');
    const guestListLogRef = eventRef.collection('guest_lists').doc('guestlistLog');

    // Get current data before transaction (all reads first)
    const [guestListDoc, guestListLogDoc] = await Promise.all([
      guestListRef.get(),
      guestListLogRef.get(),
    ]);

    if (!guestListDoc.exists) {
      return {
        success: false,
        error: "Guest list not found",
      };
    }

    const data = guestListDoc.data();
    const currentGuestList: Guest[] = data?.guestList || [];
    
    // Determine which guest IDs to delete
    const guestIdsToDelete = guestIds || [guestId];
    
    // Find guests to delete and calculate totals for summary update
    const guestsToDelete: Guest[] = [];
    let totalNormalGuestsToRemove = 0;
    let totalFreeGuestsToRemove = 0;
    let totalNormalCheckedInToRemove = 0;
    let totalFreeCheckedInToRemove = 0;
    
    for (const idToDelete of guestIdsToDelete) {
      const guestIndex = currentGuestList.findIndex(g => g.guestId === idToDelete);
      if (guestIndex !== -1) {
        const guest = currentGuestList[guestIndex];
        guestsToDelete.push(guest);
        totalNormalGuestsToRemove += guest.normalGuests;
        totalFreeGuestsToRemove += guest.freeGuests;
        totalNormalCheckedInToRemove += guest.normalCheckedIn;
        totalFreeCheckedInToRemove += guest.freeCheckedIn;
      }
    }

    if (guestsToDelete.length === 0) {
      return {
        success: false,
        error: "No guests found to delete",
      };
    }

    // Remove guests from the list
    const updatedGuestList = currentGuestList.filter(g => !guestIdsToDelete.includes(g.guestId));

    // Prepare log entries for deleted guests
    const logEntries = guestsToDelete.map(guest => ({
      addedAt: new Date().toISOString(),
      addedBy: userName,
      guestName: guest.guestName,
      status: "deleted",
      userId: userId,
    }));

    let currentLogs: any[] = [];
    if (guestListLogDoc.exists) {
      const logData = guestListLogDoc.data();
      currentLogs = logData?.logs || [];
    }
    currentLogs.push(...logEntries);

    // Run all operations in a transaction (only writes)
    await db.runTransaction(async (transaction) => {
      // 1. Update guest list document - only update the array and timestamp, preserve other fields
      transaction.update(guestListRef, {
        guestList: updatedGuestList,
        lastUpdated: FieldValue.serverTimestamp(),
      });

      // 2. Update guest list summary
      const totalGuestsToRemove = totalNormalGuestsToRemove + totalFreeGuestsToRemove;
      const totalCheckedInToRemove = totalNormalCheckedInToRemove + totalFreeCheckedInToRemove;

      transaction.update(guestListSummaryRef, {
        totalGuests: FieldValue.increment(-totalGuestsToRemove),
        totalNormalGuests: FieldValue.increment(-totalNormalGuestsToRemove),
        totalFreeGuests: FieldValue.increment(-totalFreeGuestsToRemove),
        totalCheckedIn: FieldValue.increment(-totalCheckedInToRemove),
        normalGuestsCheckedIn: FieldValue.increment(-totalNormalCheckedInToRemove),
        freeGuestsCheckedIn: FieldValue.increment(-totalFreeCheckedInToRemove),
        lastUpdated: FieldValue.serverTimestamp(),
      });

      // 3. Update guest list log
      transaction.set(guestListLogRef, {
        logs: currentLogs,
        lastUpdated: FieldValue.serverTimestamp(),
      });
    });

    return {
      success: true,
      message: guestsToDelete.length === 1 ? "Guest deleted successfully" : "Guests deleted successfully",
      data: {
        guestsDeleted: guestsToDelete.length,
        guestIds: guestIdsToDelete,
        guestNames: guestsToDelete.map(g => g.guestName),
        totalNormalGuestsRemoved: totalNormalGuestsToRemove,
        totalFreeGuestsRemoved: totalFreeGuestsToRemove,
        totalGuestsRemoved: totalNormalGuestsToRemove + totalFreeGuestsToRemove,
        totalCheckedInRemoved: totalNormalCheckedInToRemove + totalFreeCheckedInToRemove,
        deletedBy: userName,
        deletedAt: new Date().toISOString(),
        guestListId: guestListId,
      },
    };
  } catch (error) {
    console.error("Error deleting guest(s):", error);
    return {
      success: false,
      error: "Failed to delete guest(s)",
    };
  }
});

/**
 * Helper function to add a user to company guests with genre tracking
 */
async function _addUserToCompanyGuests(companyId: string, eventId: string, userId: string, guestName: string, userType: 'existing' | 'new') {
  try {
    let userName: string;
    let userEmail: string;
    let dateOfBirth: string;
    let userCity: string;

    if (userType === 'existing') {
      // Get user data from users collection for existing users
      const userDoc = await db.collection('users').doc(userId).get();
      if (!userDoc.exists) {
        console.warn('User not found for company guests:', userId);
        return;
      }

      const userData = userDoc.data();
      userName = `${userData?.userFirstName || ''} ${userData?.userLastName || ''}`.trim();
      userEmail = userData?.userEmail || '';
      dateOfBirth = userData?.birthDate || '';
      userCity = userData?.city || '';
    } else {
      // For new guests, use the provided guest name and empty/default values
      userName = guestName;
      userEmail = '';
      dateOfBirth = '';
      userCity = '';
    }

    // Get event genre data
    const eventDoc = await db.collection('companies').doc(companyId).collection('events').doc(eventId).get();
    let eventGenres: string[] = [];
    
    if (eventDoc.exists) {
      const data = eventDoc.data();
      if (data?.eventGenre && Array.isArray(data.eventGenre)) {
        // Handle both string array and object array formats
        eventGenres = data.eventGenre.map((genre: any) => {
          if (typeof genre === 'string') return genre;
          if (genre && typeof genre === 'object' && genre.name) return genre.name;
          return '';
        }).filter((genre: string) => genre.length > 0);
      }
    }

    // Prepare company-specific genre counts
    const companySpecificGenres: Record<string, {nrOfTimes: number}> = {};
    for (const genre of eventGenres) {
      if (genre.length > 0) {
        companySpecificGenres[genre] = {nrOfTimes: 1};
      }
    }

    // Reference to the user in company guests collection
    const companyGuestRef = db.collection('companies').doc(companyId).collection('guests').doc(userId);
    const guestDoc = await companyGuestRef.get();

    // Prepare guest data
    const guestData: any = {
      userId,
      name: userName,
      email: userEmail,
      dateOfBirth,
      city: userCity,
      lastUpdated: new Date(),
    };

    // Only add genres to the guest data if genres exist
    if (Object.keys(companySpecificGenres).length > 0) {
      if (guestDoc.exists) {
        // If the guest already exists, merge their genres
        const existingData = guestDoc.data();
        if (existingData?.visitedGenres && typeof existingData.visitedGenres === 'object') {
          const mergedGenres = {...existingData.visitedGenres};
          
          for (const [genre, newData] of Object.entries(companySpecificGenres)) {
            if (!mergedGenres[genre]) {
              mergedGenres[genre] = newData;
            } else {
              const currentCount = mergedGenres[genre].nrOfTimes || 0;
              mergedGenres[genre] = {nrOfTimes: currentCount + 1};
            }
          }
          
          guestData.visitedGenres = mergedGenres;
        } else {
          guestData.visitedGenres = companySpecificGenres;
        }
      } else {
        // New guest, just add the genres
        guestData.visitedGenres = companySpecificGenres;
      }
    }

    // Add or update guest data
    await companyGuestRef.set(guestData, {merge: true});
  } catch (error) {
    console.error('Error adding user to company guests:', error);
    throw error;
  }
} 
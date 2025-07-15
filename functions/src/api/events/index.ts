import {onCall} from "firebase-functions/v2/https";
import {getFirestore, FieldValue} from "firebase-admin/firestore";
import * as Joi from "joi";
import {v4 as uuidv4} from "uuid";

// Get Firestore instance
const db = getFirestore();

// Validation schema for event creation
const createEventSchema = Joi.object({
  eventId: Joi.string().optional(), // Make eventId optional, we'll generate one if not provided
  eventName: Joi.string().required().min(1).max(100),
  startDateTime: Joi.date().iso().required(),
  endDateTime: Joi.date().iso().required(),
  companyId: Joi.string().required(),
  tableLayouts: Joi.array().items(Joi.string()).optional().default([]),
  categories: Joi.array().items(Joi.string()).optional().default([]),
  clubCardIds: Joi.array().items(Joi.string()).optional().default([]),
  eventGenre: Joi.array().items(Joi.string()).optional().default([]),
});

// Type definitions
interface TableItem {
  id?: string;
  name?: string;
  nrOfGuests?: string;
  tableCheckedIn?: string;
  tableLimit?: string;
  tableSpent?: string;
  tableBookedBy?: string;
  [key: string]: any; // Allow other properties
}

interface LayoutData {
  items?: TableItem[];
  [key: string]: any; // Allow other properties
}

/**
 * Create a new event with all related data
 * This function handles:
 * 1. Creating the event document
 * 2. Creating table lists for each layout (if tableLayouts provided)
 * 3. Creating event tables with logs (if layouts exist)
 * 4. Updating table summary
 * 5. Creating guest list
 * 
 * All operations are performed in a single transaction for data consistency
 * 
 * Optional fields: tableLayouts, categories, clubCardIds, eventGenre
 */
export const createEvent = onCall({enforceAppCheck: false}, async (request) => {
  try {
    // Ensure user is authenticated
    if (!request.auth) {
      throw new Error("Unauthorized");
    }
    
    const userId = request.auth.uid;
    const userData = request.auth.token;
    const userName = userData.name || userId;
    
    // Validate request data
    const {
      eventId: providedEventId,
      eventName,
      startDateTime,
      endDateTime,
      companyId,
      tableLayouts,
      categories,
      clubCardIds,
      eventGenre,
    } = request.data;

    // Validate input data
    const {error} = createEventSchema.validate(request.data);
    if (error) {
      return {
        success: false,
        error: `Validation error: ${error.message}`,
      };
    }

    // Generate a unique event ID if not provided
    const eventId = providedEventId || uuidv4();

    // Check if company exists
    const companyRef = db.collection('companies').doc(companyId);
    const companyDoc = await companyRef.get();
    
    if (!companyDoc.exists) {
      return {
        success: false,
        error: "Company not found",
      };
    }

    // Convert dates to proper format
    const startDate = new Date(startDateTime);
    const endDate = new Date(endDateTime);
    
    // Prepare event data with default values to avoid undefined fields
    const eventData = {
      id: eventId, // This will be the UUID
      eventName,
      startDateTime: startDate,
      endDateTime: endDate,
      companyId,
      tableLayouts: tableLayouts || [],
      categories: categories || [],
      clubCardIds: clubCardIds || [],
      eventGenre: eventGenre || [],
      createdBy: userId,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    // Fetch layout data for all layouts (only if tableLayouts are provided)
    const layoutsData: Record<string, LayoutData> = {};
    if (tableLayouts && tableLayouts.length > 0) {
      for (const layoutName of tableLayouts) {
        const layoutSnapshot = await db
          .collection('companies')
          .doc(companyId)
          .collection('layouts')
          .doc(layoutName)
          .get();
        
        if (layoutSnapshot.exists) {
          layoutsData[layoutName] = layoutSnapshot.data() as LayoutData;
        } else {
          return {
            success: false,
            error: `Layout ${layoutName} not found`,
          };
        }
      }
    }

    // Check for existing singular table_list documents before transaction
    const eventRef = db
      .collection('companies')
      .doc(companyId)
      .collection('events')
      .doc(eventId);
    
    const singularTableListRef = eventRef.collection('table_list');
    const singularDocsSnapshot = await singularTableListRef.get();
    const singularDocsToDelete = singularDocsSnapshot.docs.map(doc => doc.ref);
    
    // Run all operations in a transaction
    await db.runTransaction(async (transaction) => {
      // 1. Create the event document
      transaction.set(eventRef, eventData);
      
      // Variables to track totals across all layouts
      let totalTables = 0;
      let totalGuests = 0;
      let totalCheckedIn = 0;
      let totalBooked = 0;
      let totalTableLimit = 0;
      let totalTableSpent = 0;
      
      // 2. Process each layout (only if tableLayouts are provided)
      if (tableLayouts && tableLayouts.length > 0) {
        for (const layoutName of tableLayouts) {
          const layoutData = layoutsData[layoutName];
          const items = layoutData?.items || [];
          
          if (items.length > 0) {
            // Add logs to each table
            const tablesWithLogs = items.map((table: TableItem) => {
              return {
                ...table,
                logs: [{
                  action: 'created',
                  userName: userName,
                  timestamp: new Date().toISOString(),
                  changes: {'status': 'Table created'},
                }],
              };
            });
            
            // Create table_lists document for this layout
            const tableListsRef = eventRef
              .collection('table_lists')
              .doc(layoutName);
            
            transaction.set(tableListsRef, {
              items: tablesWithLogs,
              lastUpdated: FieldValue.serverTimestamp(),
            });
            
            // Accumulate totals
            totalTables += items.length;
            for (const table of items) {
              totalGuests += parseInt(table.nrOfGuests || '0', 10) || 0;
              totalCheckedIn += parseInt(table.tableCheckedIn || '0', 10) || 0;
              totalTableLimit += parseInt(table.tableLimit || '0', 10) || 0;
              totalTableSpent += parseInt(table.tableSpent || '0', 10) || 0;
              
              if ((table.name && table.name.trim().length > 0) || 
                  (table.tableBookedBy && table.tableBookedBy.trim().length > 0)) {
                totalBooked++;
              }
            }
          }
        }
      }
      
      // 3. Delete any singular table_list documents (cleanup)
      singularDocsToDelete.forEach(docRef => {
        transaction.delete(docRef);
      });
      
      // 4. Update table summary
      const tableSummaryRef = eventRef
        .collection('table_lists')
        .doc('tableSummary');
      
      transaction.set(tableSummaryRef, {
        totalTables,
        totalGuests,
        totalCheckedIn,
        totalBooked,
        totalTableLimit,
        totalTableSpent,
        lastUpdated: FieldValue.serverTimestamp(),
      });
      
      // 5. Create guest list
      const guestListMainRef = eventRef
        .collection('guest_lists')
        .doc('main');
      
      transaction.set(guestListMainRef, {
        eventId,
        guestList: [],
        lastUpdated: FieldValue.serverTimestamp(),
      });
      
      // 6. Create guest list summary
      const guestListSummaryRef = eventRef
        .collection('guest_lists')
        .doc('guestListSummary');
      
      transaction.set(guestListSummaryRef, {
        totalGuests: 0,
        totalCheckedIn: 0,
        totalNormalGuests: 0,
        totalFreeGuests: 0,
        normalGuestsCheckedIn: 0,
        freeGuestsCheckedIn: 0,
        lastUpdated: FieldValue.serverTimestamp(),
      });
      
      // 7. Initialize guest list log
      const guestListLogRef = eventRef
        .collection('guest_lists')
        .doc('guestlistLog');
      
      transaction.set(guestListLogRef, {
        logs: [],
        lastUpdated: FieldValue.serverTimestamp(),
      });
    });
    
    return {
      success: true,
      message: "Event created successfully",
      data: {
        eventId, // Return the generated UUID
      },
    };
  } catch (error) {
    console.error("Error creating event:", error);
    return {
      success: false,
      error: "Failed to create event",
    };
  }
}); 
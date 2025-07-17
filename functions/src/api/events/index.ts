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
  tableLayouts: Joi.array().items(Joi.string()).optional().default([]), // Now expects layout IDs
  categories: Joi.array().items(Joi.string()).optional().default([]), // Now expects category IDs
  clubCardIds: Joi.array().items(Joi.string()).optional().default([]), // Already expects IDs
  eventGenre: Joi.array().items(Joi.string()).optional().default([]), // Now expects genre IDs
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

interface FetchedData {
  id: string;
  name: string;
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
 * Now accepts IDs instead of names for better data integrity
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
    
    // Fetch data for all IDs before the transaction
    const fetchedData: {
      tableLayouts: FetchedData[];
      categories: FetchedData[];
      clubCardIds: FetchedData[];
      eventGenre: FetchedData[];
    } = {
      tableLayouts: [],
      categories: [],
      clubCardIds: [],
      eventGenre: [],
    };

    // Fetch table layouts data
    if (tableLayouts && tableLayouts.length > 0) {
      for (const layoutId of tableLayouts) {
        const layoutDoc = await db
          .collection('companies')
          .doc(companyId)
          .collection('layouts')
          .doc(layoutId)
          .get();
        
        if (layoutDoc.exists) {
          const layoutData = layoutDoc.data();
          fetchedData.tableLayouts.push({
            id: layoutId,
            name: layoutData?.name || layoutId,
          });
        } else {
          return {
            success: false,
            error: `Table layout with ID ${layoutId} not found`,
          };
        }
      }
    }

    // Fetch categories data
    if (categories && categories.length > 0) {
      for (const categoryId of categories) {
        const categoryDoc = await db
          .collection('companies')
          .doc(companyId)
          .collection('categories')
          .doc(categoryId)
          .get();
        
        if (categoryDoc.exists) {
          const categoryData = categoryDoc.data();
          fetchedData.categories.push({
            id: categoryId,
            name: categoryData?.name || categoryId,
          });
        } else {
          return {
            success: false,
            error: `Category with ID ${categoryId} not found`,
          };
        }
      }
    }

    // Fetch club card data
    if (clubCardIds && clubCardIds.length > 0) {
      for (const clubCardId of clubCardIds) {
        const clubCardDoc = await db
          .collection('companies')
          .doc(companyId)
          .collection('clubCards')
          .doc(clubCardId)
          .get();
        
        if (clubCardDoc.exists) {
          const clubCardData = clubCardDoc.data();
          fetchedData.clubCardIds.push({
            id: clubCardId,
            name: clubCardData?.name || clubCardId,
          });
        } else {
          return {
            success: false,
            error: `Club card with ID ${clubCardId} not found`,
          };
        }
      }
    }

    // Fetch event genre data
    if (eventGenre && eventGenre.length > 0) {
      for (const genreId of eventGenre) {
        const genreDoc = await db
          .collection('companies')
          .doc(companyId)
          .collection('genres')
          .doc(genreId)
          .get();
        
        if (genreDoc.exists) {
          const genreData = genreDoc.data();
          fetchedData.eventGenre.push({
            id: genreId,
            name: genreData?.name || genreId,
          });
        } else {
          return {
            success: false,
            error: `Event genre with ID ${genreId} not found`,
          };
        }
      }
    }

    // Prepare event data with both IDs and names
    const eventData = {
      id: eventId, // This will be the UUID
      eventName,
      startDateTime: startDate,
      endDateTime: endDate,
      companyId,
      tableLayouts: fetchedData.tableLayouts,
      categories: fetchedData.categories,
      clubCardIds: fetchedData.clubCardIds,
      eventGenre: fetchedData.eventGenre,
      createdBy: userId,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    // Fetch layout data for all layouts (only if tableLayouts are provided)
    const layoutsData: Record<string, LayoutData> = {};
    if (fetchedData.tableLayouts.length > 0) {
      for (const layout of fetchedData.tableLayouts) {
        const layoutSnapshot = await db
          .collection('companies')
          .doc(companyId)
          .collection('layouts')
          .doc(layout.id)
          .get();
        
        if (layoutSnapshot.exists) {
          layoutsData[layout.id] = layoutSnapshot.data() as LayoutData;
        } else {
          return {
            success: false,
            error: `Layout ${layout.name} (ID: ${layout.id}) not found`,
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
      if (fetchedData.tableLayouts.length > 0) {
        for (const layout of fetchedData.tableLayouts) {
          const layoutData = layoutsData[layout.id];
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
            
            // Create table_lists document for this layout (use layout ID as document ID)
            const tableListsRef = eventRef
              .collection('table_lists')
              .doc(layout.id);
            
            transaction.set(tableListsRef, {
              items: tablesWithLogs,
              layoutName: layout.name, // Store the name for reference
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
        tableLayouts: fetchedData.tableLayouts,
        categories: fetchedData.categories,
        clubCardIds: fetchedData.clubCardIds,
        eventGenre: fetchedData.eventGenre,
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
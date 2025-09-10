import {onCall} from "firebase-functions/v2/https";
import {getFirestore, FieldValue, Timestamp} from "firebase-admin/firestore";
import * as Joi from "joi";
import {v4 as uuidv4} from "uuid";

// Get Firestore instance
const db = getFirestore();

// Validation schema for event creation
const createEventSchema = Joi.object({
  eventName: Joi.string().required().min(1).max(100),
  startDateTime: Joi.date().iso().required(),
  endDateTime: Joi.date().iso().required(),
  companyId: Joi.string().required(),
  tableLayouts: Joi.array().items(Joi.string()).optional().default([]), // Now expects layout IDs
  categories: Joi.array().items(Joi.string()).optional().default([]), // Now expects category IDs
  clubCardIds: Joi.array().items(Joi.string()).optional().default([]), // Already expects IDs
  eventGenre: Joi.array().items(Joi.string()).optional().default([]), // Now expects genre IDs
  additionalGuestLists: Joi.array().items(Joi.string().min(1).max(100)).optional().default([]), // Names for additional guest lists
  recurring: Joi.object({
    isRecurring: Joi.boolean().required(),
    recurringStartDate: Joi.date().iso().when('isRecurring', { is: true, then: Joi.required() }),
    recurringEndDate: Joi.date().iso().when('isRecurring', { is: true, then: Joi.required() }),
    daysOfWeek: Joi.array().items(Joi.number().integer().min(0).max(6)).when('isRecurring', { is: true, then: Joi.required() }), // 0 = Sunday, 1 = Monday, etc.
  }).optional(),
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

// Helper function to generate recurring event dates
function generateRecurringEventDates(
  startDate: Date,
  endDate: Date,
  recurringStartDate: Date,
  recurringEndDate: Date,
  daysOfWeek: number[]
): Array<{ startDateTime: Timestamp; endDateTime: Timestamp }> {
  const events: Array<{ startDateTime: Timestamp; endDateTime: Timestamp }> = [];
  
  // Extract the original time components (UTC)
  const originalStartHours = startDate.getUTCHours();
  const originalStartMinutes = startDate.getUTCMinutes();
  const originalStartSeconds = startDate.getUTCSeconds();
  const originalStartMilliseconds = startDate.getUTCMilliseconds();
  
  // Calculate the time difference between start and end times
  const timeDifference = endDate.getTime() - startDate.getTime();
  
  // Start from the recurring start date (UTC)
  let currentDate = new Date(recurringStartDate);
  
  // Continue until we reach the recurring end date
  while (currentDate <= recurringEndDate) {
    // Check if current date matches one of the specified days of the week
    if (daysOfWeek.includes(currentDate.getUTCDay())) {
      // Create the event start time by combining the current date with the original time
      const eventStartDateTime = new Date(Date.UTC(
        currentDate.getUTCFullYear(),
        currentDate.getUTCMonth(),
        currentDate.getUTCDate(),
        originalStartHours,
        originalStartMinutes,
        originalStartSeconds,
        originalStartMilliseconds
      ));
      
      // Create the event end time by adding the time difference
      const eventEndDateTime = new Date(eventStartDateTime.getTime() + timeDifference);
      
      events.push({
        startDateTime: Timestamp.fromMillis(eventStartDateTime.getTime()),
        endDateTime: Timestamp.fromMillis(eventEndDateTime.getTime()),
      });
    }
    
    // Move to the next day (UTC)
    currentDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000);
  }
  
  return events;
}

/**
 * Create a new event with all related data
 * This function handles:
 * 1. Creating the event document with auto-generated UUID
 * 2. Creating table lists for each layout (if tableLayouts provided)
 * 3. Creating event tables with logs (if layouts exist)
 * 4. Updating table summary
 * 5. Creating guest list
 * 
 * All operations are performed in a single transaction for data consistency
 * 
 * Event IDs are always auto-generated as UUIDs and cannot be provided
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
    
    // Extract data from request - handle both direct data and wrapped data
    let requestData: any;
    if (request.data && request.data.data) {
      // Data is wrapped in a "data" property
      requestData = request.data.data;
    } else {
      // Data is at root level
      requestData = request.data;
    }

    // Validate request data
    const {
      eventName,
      startDateTime,
      endDateTime,
      companyId,
      tableLayouts,
      categories,
      clubCardIds,
      eventGenre,
      additionalGuestLists,
      recurring,
    } = requestData;

    // Validate input data
    const {error} = createEventSchema.validate(requestData);
    if (error) {
      return {
        success: false,
        error: `Validation error: ${error.message}`,
      };
    }

    // Note: Event IDs are always auto-generated as UUIDs for each event

    // Check if company exists
    const companyRef = db.collection('companies').doc(companyId);
    const companyDoc = await companyRef.get();
    
    if (!companyDoc.exists) {
      return {
        success: false,
        error: "Company not found",
      };
    }

    // Convert dates to proper format and adjust for UTC+2 timezone
    // If user sends 22:00 UTC, they likely mean 22:00 in their local timezone (UTC+2)
    // So we need to subtract 2 hours to get the correct UTC time
    const startDate = new Date(startDateTime);
    const endDate = new Date(endDateTime);
    
    // Adjust for UTC+2 timezone (subtract 2 hours from the input)
    startDate.setUTCHours(startDate.getUTCHours() - 2);
    endDate.setUTCHours(endDate.getUTCHours() - 2);
    
    // Generate recurring events if specified
    let eventsToCreate: Array<{ 
      eventId: string; 
      startDateTime: Timestamp; 
      endDateTime: Timestamp; 
      eventName: string;
    }> = [];
    
    if (recurring && recurring.isRecurring) {
      const recurringStartDate = new Date(recurring.recurringStartDate);
      const recurringEndDate = new Date(recurring.recurringEndDate);
      
      // Generate all recurring event dates
      const recurringDates = generateRecurringEventDates(
        startDate,
        endDate,
        recurringStartDate,
        recurringEndDate,
        recurring.daysOfWeek
      );
      
      // Debug: Log the first few dates to see what's being generated
      console.log('Generated recurring dates (first 3):');
      recurringDates.slice(0, 3).forEach((dateInfo, index) => {
        console.log(`Event ${index + 1}:`);
        console.log(`  Start Timestamp: ${dateInfo.startDateTime.seconds}.${dateInfo.startDateTime.nanoseconds}`);
        console.log(`  End Timestamp: ${dateInfo.endDateTime.seconds}.${dateInfo.endDateTime.nanoseconds}`);
        console.log(`  Start: ${dateInfo.startDateTime.toDate().toISOString()} (UTC)`);
        console.log(`  End: ${dateInfo.endDateTime.toDate().toISOString()} (UTC)`);
        console.log(`  Start Local: ${dateInfo.startDateTime.toDate().toString()}`);
        console.log(`  End Local: ${dateInfo.endDateTime.toDate().toString()}`);
      });
      
      // Create event entries for each recurring date
      eventsToCreate = recurringDates.map((dateInfo, index) => ({
        eventId: uuidv4(),
        startDateTime: dateInfo.startDateTime,
        endDateTime: dateInfo.endDateTime,
        eventName: `${eventName} (${dateInfo.startDateTime.toDate().toLocaleDateString()})`,
      }));
    } else {
      // Single event
      eventsToCreate = [{
        eventId: uuidv4(),
        startDateTime: Timestamp.fromMillis(startDate.getTime()),
        endDateTime: Timestamp.fromMillis(endDate.getTime()),
        eventName: eventName,
      }];
    }
    
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
          .collection('cards')
          .doc(clubCardId)
          .get();
        
        if (clubCardDoc.exists) {
          const clubCardData = clubCardDoc.data();
          
          // Use the title field for club cards
          const cardName = clubCardData?.title || clubCardId;
          
          fetchedData.clubCardIds.push({
            id: clubCardId,
            name: cardName,
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

    // Prepare base event data (will be customized for each event)
    const baseEventData = {
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

    // Note: We no longer need to check for singular table_list documents 
    // since we're creating events with proper structure from the start
    
    // Run all operations in a transaction
    await db.runTransaction(async (transaction) => {
      // Create all events (single or recurring)
      for (const eventToCreate of eventsToCreate) {
        // 1. Create the event document
        const currentEventRef = db
          .collection('companies')
          .doc(companyId)
          .collection('events')
          .doc(eventToCreate.eventId);
        
        // Debug: Log what we're about to store
        console.log(`Storing event ${eventToCreate.eventId}:`);
        console.log(`  Start Timestamp: ${eventToCreate.startDateTime.seconds}.${eventToCreate.startDateTime.nanoseconds}`);
        console.log(`  End Timestamp: ${eventToCreate.endDateTime.seconds}.${eventToCreate.endDateTime.nanoseconds}`);
        console.log(`  Start: ${eventToCreate.startDateTime.toDate().toISOString()} (UTC)`);
        console.log(`  End: ${eventToCreate.endDateTime.toDate().toISOString()} (UTC)`);
        
        const currentEventData = {
          ...baseEventData,
          id: eventToCreate.eventId,
          eventName: eventToCreate.eventName,
          startDateTime: eventToCreate.startDateTime,
          endDateTime: eventToCreate.endDateTime,
          // Add recurring information if applicable
          ...(recurring && recurring.isRecurring ? {
            recurring: {
              isRecurring: true,
              recurringStartDate: new Date(recurring.recurringStartDate),
              recurringEndDate: new Date(recurring.recurringEndDate),
              daysOfWeek: recurring.daysOfWeek,
              originalEventName: eventName,
            }
          } : {}),
        };
        
        transaction.set(currentEventRef, currentEventData);
        
        // Variables to track totals across all layouts for this event
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
              // Filter only table items (exclude objects)
              const tableItems = items.filter((item: any) => item.type === 'ItemType.table');
              
              if (tableItems.length > 0) {
                // Add logs to each table
                const tablesWithLogs = tableItems.map((table: TableItem) => {
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
                const tableListsRef = currentEventRef
                  .collection('table_lists')
                  .doc(layout.id);
                
                transaction.set(tableListsRef, {
                  items: tablesWithLogs,
                  layoutName: layout.name, // Store the name for reference
                  lastUpdated: FieldValue.serverTimestamp(),
                });
                
                // Accumulate totals only for table items
                totalTables += tableItems.length;
                for (const table of tableItems) {
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
        }
        
        // 3. Update table summary for this event
        const tableSummaryRef = currentEventRef
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
        
        // 4. Create guest list
        const guestListMainRef = currentEventRef
          .collection('guest_lists')
          .doc('main');
        
        transaction.set(guestListMainRef, {
          eventId: eventToCreate.eventId,
          guestList: [],
          lastUpdated: FieldValue.serverTimestamp(),
        });
        
        // 5. Create additional guest lists if specified
        if (additionalGuestLists && additionalGuestLists.length > 0) {
          for (const guestListName of additionalGuestLists) {
            const additionalGuestListId = uuidv4();
            const additionalGuestListRef = currentEventRef
              .collection('guest_lists')
              .doc(additionalGuestListId);
            
            transaction.set(additionalGuestListRef, {
              eventId: eventToCreate.eventId,
              guestList: [],
              guestListName: guestListName, // Store the name in the document
              lastUpdated: FieldValue.serverTimestamp(),
            });
          }
        }
        
        // 6. Create guest list summary
        const guestListSummaryRef = currentEventRef
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
        const guestListLogRef = currentEventRef
          .collection('guest_lists')
          .doc('guestlistLog');
        
        transaction.set(guestListLogRef, {
          logs: [],
          lastUpdated: FieldValue.serverTimestamp(),
        });
      }
    });
    
    return {
      success: true,
      message: recurring && recurring.isRecurring 
        ? `Successfully created ${eventsToCreate.length} recurring events` 
        : "Event created successfully",
      data: {
        eventsCreated: eventsToCreate.length,
        events: eventsToCreate.map(event => ({
          eventId: event.eventId,
          eventName: event.eventName,
          startDateTime: event.startDateTime.toDate().toISOString(),
          endDateTime: event.endDateTime.toDate().toISOString(),
        })),
        tableLayouts: fetchedData.tableLayouts,
        categories: fetchedData.categories,
        clubCardIds: fetchedData.clubCardIds,
        eventGenre: fetchedData.eventGenre,
        additionalGuestLists: additionalGuestLists || [],
        recurring: recurring && recurring.isRecurring ? {
          isRecurring: true,
          recurringStartDate: recurring.recurringStartDate,
          recurringEndDate: recurring.recurringEndDate,
          daysOfWeek: recurring.daysOfWeek,
        } : null,
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

/**
 * Update an existing event with all related data
 * This function handles:
 * 1. Updating the event document
 * 2. Adding/removing table layouts based on changes
 * 3. Updating table summary statistics
 * 
 * All operations are performed in a single transaction for data consistency
 */
export const updateEvent = onCall({enforceAppCheck: false}, async (request) => {
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
      eventId,
      eventName,
      startDateTime,
      endDateTime,
      companyId,
      tableLayouts,
      categories,
      clubCardIds,
      eventGenre,
      additionalGuestLists,
    } = request.data;

    // Validation schema for event updates (all fields optional except eventId and companyId)
    const updateEventSchema = Joi.object({
      eventId: Joi.string().required(),
      eventName: Joi.string().optional().min(1).max(100),
      startDateTime: Joi.date().iso().optional(),
      endDateTime: Joi.date().iso().optional(),
      companyId: Joi.string().required(),
      tableLayouts: Joi.array().items(Joi.string()).optional(),
      categories: Joi.array().items(Joi.string()).optional(),
      clubCardIds: Joi.array().items(Joi.string()).optional(),
      eventGenre: Joi.array().items(Joi.string()).optional(),
      additionalGuestLists: Joi.array().items(Joi.string().min(1).max(100)).optional(), // Names for additional guest lists
    });

    // Validate input data
    const {error} = updateEventSchema.validate(request.data);
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

    // Get current event data to merge with updates
    const currentEventData = eventDoc.data();
    
    // Convert dates to proper format and adjust for UTC+2 timezone (only if provided)
    let startDate = startDateTime ? new Date(startDateTime) : currentEventData?.startDateTime;
    let endDate = endDateTime ? new Date(endDateTime) : currentEventData?.endDateTime;
    
    // Adjust for UTC+2 timezone (subtract 2 hours from the input) if dates were provided
    if (startDateTime) {
      startDate.setUTCHours(startDate.getUTCHours() - 2);
    }
    if (endDateTime) {
      endDate.setUTCHours(endDate.getUTCHours() - 2);
    }
    
    // Fetch data for all IDs before the transaction (only if provided)
    const fetchedData: {
      tableLayouts: FetchedData[];
      categories: FetchedData[];
      clubCardIds: FetchedData[];
      eventGenre: FetchedData[];
    } = {
      tableLayouts: tableLayouts ? [] : (currentEventData?.tableLayouts || []),
      categories: categories ? [] : (currentEventData?.categories || []),
      clubCardIds: clubCardIds ? [] : (currentEventData?.clubCardIds || []),
      eventGenre: eventGenre ? [] : (currentEventData?.eventGenre || []),
    };

    // Fetch table layouts data (only if provided)
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

    // Fetch categories data (only if provided)
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

    // Fetch club card data (only if provided)
    if (clubCardIds && clubCardIds.length > 0) {
      for (const clubCardId of clubCardIds) {
        const clubCardDoc = await db
          .collection('companies')
          .doc(companyId)
          .collection('cards')
          .doc(clubCardId)
          .get();
        
        if (clubCardDoc.exists) {
          const clubCardData = clubCardDoc.data();
          fetchedData.clubCardIds.push({
            id: clubCardId,
            name: clubCardData?.title || clubCardId,
          });
        } else {
          return {
            success: false,
            error: `Club card with ID ${clubCardId} not found`,
          };
        }
      }
    }

    // Fetch event genre data (only if provided)
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

    // Only process table layout changes if tableLayouts are provided
    let currentLayoutIds = new Set<string>();
    let layoutsToRemove: string[] = [];
    let layoutsToAdd: string[] = [];
    let currentTableListsRef: any;
    let currentTableListsSnapshot: any;
    
    if (tableLayouts !== undefined) {
      // Get current table layouts to calculate changes
      currentTableListsRef = eventRef.collection('table_lists');
      currentTableListsSnapshot = await currentTableListsRef.get();
      
      currentTableListsSnapshot.docs.forEach((doc: { id: string }) => {
        if (doc.id !== 'tableSummary') {
          currentLayoutIds.add(doc.id);
        }
      });

      const newLayoutIds = new Set(tableLayouts || []);
      
      // Calculate layouts to remove and add
      layoutsToRemove = Array.from(currentLayoutIds).filter((id) => !newLayoutIds.has(id as string)) as string[];
      layoutsToAdd = Array.from(newLayoutIds).filter((id) => !currentLayoutIds.has(id as string)) as string[];
    }

    // Fetch layout data for new layouts (only if tableLayouts are provided)
    const layoutsData: Record<string, LayoutData> = {};
    if (tableLayouts !== undefined && layoutsToAdd.length > 0) {
      for (const layoutId of layoutsToAdd) {
        const layoutSnapshot = await db
          .collection('companies')
          .doc(companyId)
          .collection('layouts')
          .doc(layoutId as string)
          .get();
        
        if (layoutSnapshot.exists) {
          layoutsData[layoutId as string] = layoutSnapshot.data() as LayoutData;
        } else {
          return {
            success: false,
            error: `Layout with ID ${layoutId} not found`,
          };
        }
      }
    }

    // Calculate table changes for removed layouts (only if tableLayouts are provided)
    let totalTablesChange = 0;
    let totalGuestsChange = 0;
    let totalCheckedInChange = 0;
    let totalBookedChange = 0;
    let totalTableLimitChange = 0;
    let totalTableSpentChange = 0;

    if (tableLayouts !== undefined) {
      for (const layoutId of layoutsToRemove) {
        const layoutDoc = currentTableListsSnapshot.docs.find((doc: { id: string }) => doc.id === layoutId);
        if (layoutDoc) {
          const layoutData = layoutDoc.data();
          const items = (layoutData?.items as TableItem[]) || [];
          
          // Filter only table items (exclude objects)
          const tableItems = items.filter((item: any) => item.type === 'ItemType.table');
          
          totalTablesChange -= tableItems.length;
          
          for (const table of tableItems) {
            totalGuestsChange -= parseInt((table.nrOfGuests as string) || '0', 10) || 0;
            totalCheckedInChange -= parseInt((table.tableCheckedIn as string) || '0', 10) || 0;
            totalTableLimitChange -= parseInt((table.tableLimit as string) || '0', 10) || 0;
            totalTableSpentChange -= parseInt((table.tableSpent as string) || '0', 10) || 0;
            
            if (((table.name as string) && (table.name as string).trim().length > 0) || 
                ((table.tableBookedBy as string) && (table.tableBookedBy as string).trim().length > 0)) {
              totalBookedChange--;
            }
          }
        }
      }

      // Calculate table changes for added layouts
      for (const layoutId of layoutsToAdd) {
        const layoutData = layoutsData[layoutId as keyof typeof layoutsData];
        const items = layoutData?.items || [];
        
        // Filter only table items (exclude objects)
        const tableItems = items.filter((item: any) => item.type === 'ItemType.table');
        
        totalTablesChange += tableItems.length;
        
        for (const table of tableItems) {
          totalGuestsChange += parseInt((table.nrOfGuests as string) || '0', 10) || 0;
          totalCheckedInChange += parseInt((table.tableCheckedIn as string) || '0', 10) || 0;
          totalTableLimitChange += parseInt((table.tableLimit as string) || '0', 10) || 0;
          totalTableSpentChange += parseInt((table.tableSpent as string) || '0', 10) || 0;
          
          if (((table.name as string) && (table.name as string).trim().length > 0) || 
              ((table.tableBookedBy as string) && (table.tableBookedBy as string).trim().length > 0)) {
            totalBookedChange++;
          }
        }
      }
    }

    // Prepare updated event data (only include provided fields)
    const updatedEventData: any = {
      updatedBy: userId,
      updatedAt: FieldValue.serverTimestamp(),
    };

    // Only include fields that were provided
    if (eventName !== undefined) updatedEventData.eventName = eventName;
    if (startDateTime !== undefined) updatedEventData.startDateTime = startDate;
    if (endDateTime !== undefined) updatedEventData.endDateTime = endDate;
    if (tableLayouts !== undefined) updatedEventData.tableLayouts = fetchedData.tableLayouts;
    if (categories !== undefined) updatedEventData.categories = fetchedData.categories;
    if (clubCardIds !== undefined) updatedEventData.clubCardIds = fetchedData.clubCardIds;
    if (eventGenre !== undefined) updatedEventData.eventGenre = fetchedData.eventGenre;

    // Run all operations in a transaction
    await db.runTransaction(async (transaction) => {
      // 1. Update the event document
      transaction.update(eventRef, updatedEventData);
      
      // 2. Process table layout changes (only if tableLayouts were provided)
      if (tableLayouts !== undefined) {
        // Remove old layouts
        for (const layoutId of layoutsToRemove) {
          transaction.delete(currentTableListsRef.doc(layoutId));
        }
        
        // Add new layouts
        for (const layoutId of layoutsToAdd) {
          const layoutData = layoutsData[layoutId as keyof typeof layoutsData];
          const items = layoutData?.items || [];
          
          // Filter only table items (exclude objects)
          const tableItems = items.filter((item: any) => item.type === 'ItemType.table');
          
          if (tableItems.length > 0) {
            // Add logs to each table
            const tablesWithLogs = tableItems.map((table: TableItem) => {
              return {
                ...table,
                logs: [{
                  action: 'added',
                  userName: userName,
                  timestamp: new Date().toISOString(),
                  changes: {'status': 'Table added during update'},
                }],
              };
            });
            
            transaction.set(currentTableListsRef.doc(layoutId as string), {
              items: tablesWithLogs,
              layoutName: layoutData?.name || layoutId,
              lastUpdated: FieldValue.serverTimestamp(),
            });
          }
        }
        
        // 3. Update table summary if there are changes
        if (totalTablesChange !== 0 || totalGuestsChange !== 0 || 
            totalCheckedInChange !== 0 || totalBookedChange !== 0 ||
            totalTableLimitChange !== 0 || totalTableSpentChange !== 0) {
          
          const tableSummaryRef = currentTableListsRef.doc('tableSummary');
          transaction.update(tableSummaryRef, {
            totalTables: FieldValue.increment(totalTablesChange),
            totalGuests: FieldValue.increment(totalGuestsChange),
            totalCheckedIn: FieldValue.increment(totalCheckedInChange),
            totalBooked: FieldValue.increment(totalBookedChange),
            totalTableLimit: FieldValue.increment(totalTableLimitChange),
            totalTableSpent: FieldValue.increment(totalTableSpentChange),
            lastUpdated: FieldValue.serverTimestamp(),
          });
        }
      }
      
      // 4. Process additional guest lists (only if additionalGuestLists were provided)
      if (additionalGuestLists !== undefined) {
        // Get current guest lists to see what exists
        const currentGuestListsRef = eventRef.collection('guest_lists');
        const currentGuestListsSnapshot = await currentGuestListsRef.get();
        
        // Find existing additional guest lists (exclude 'main', 'guestListSummary', 'guestlistLog')
        const existingAdditionalGuestLists = currentGuestListsSnapshot.docs
          .filter(doc => !['main', 'guestListSummary', 'guestlistLog'].includes(doc.id))
          .map(doc => ({ id: doc.id, name: doc.data()?.guestListName }));
        
        // Calculate which guest lists to add and remove
        const newGuestListNames = new Set(additionalGuestLists);
        const existingGuestListNames = new Set(existingAdditionalGuestLists.map(gl => gl.name));
        
        const guestListsToRemove = existingAdditionalGuestLists
          .filter(gl => !newGuestListNames.has(gl.name))
          .map(gl => gl.id);
        
        const guestListsToAdd = additionalGuestLists
          .filter((name: string) => !existingGuestListNames.has(name));
        
        // Remove old additional guest lists
        for (const guestListId of guestListsToRemove) {
          transaction.delete(currentGuestListsRef.doc(guestListId));
        }
        
        // Add new additional guest lists
        for (const guestListName of guestListsToAdd) {
          const additionalGuestListId = uuidv4();
          transaction.set(currentGuestListsRef.doc(additionalGuestListId), {
            eventId,
            guestList: [],
            guestListName: guestListName,
            lastUpdated: FieldValue.serverTimestamp(),
          });
        }
      }
    });
    
    // Prepare response data
    const responseData: any = {
      eventId,
    };

    // Only include fields that were updated
    if (eventName !== undefined) responseData.eventName = eventName;
    if (startDateTime !== undefined) responseData.startDateTime = startDate;
    if (endDateTime !== undefined) responseData.endDateTime = endDate;
    if (tableLayouts !== undefined) responseData.tableLayouts = fetchedData.tableLayouts;
    if (categories !== undefined) responseData.categories = fetchedData.categories;
    if (clubCardIds !== undefined) responseData.clubCardIds = fetchedData.clubCardIds;
    if (eventGenre !== undefined) responseData.eventGenre = fetchedData.eventGenre;
    if (additionalGuestLists !== undefined) responseData.additionalGuestLists = additionalGuestLists;

    // Only include changes if tableLayouts were provided
    if (tableLayouts !== undefined) {
      responseData.changes = {
        layoutsRemoved: layoutsToRemove,
        layoutsAdded: layoutsToAdd,
        tableChanges: {
          totalTablesChange,
          totalGuestsChange,
          totalCheckedInChange,
          totalBookedChange,
          totalTableLimitChange,
          totalTableSpentChange,
        },
      };
    }

    return {
      success: true,
      message: "Event updated successfully",
      data: responseData,
    };
  } catch (error) {
    console.error("Error updating event:", error);
    return {
      success: false,
      error: "Failed to update event",
    };
  }
}); 

/**
 * Delete an existing event and all its subcollections
 * This function handles:
 * 1. Deleting all documents in guest_lists subcollection
 * 2. Deleting all documents in table_lists subcollection
 * 3. Deleting the main event document
 * 
 * All operations are performed in a single transaction for data consistency
 */
export const deleteEvent = onCall({enforceAppCheck: false}, async (request) => {
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
      eventId,
      companyId,
    } = request.data;

    // Validation schema for event deletion
    const deleteEventSchema = Joi.object({
      eventId: Joi.string().required(),
      companyId: Joi.string().required(),
    });

    // Validate input data
    const {error} = deleteEventSchema.validate(request.data);
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

    // Get event data for logging
    const eventData = eventDoc.data();
    const eventName = eventData?.eventName || eventId;

    // Get all subcollection documents to delete
    const guestListsRef = eventRef.collection('guest_lists');
    const tableListsRef = eventRef.collection('table_lists');

    // Fetch all documents from subcollections
    const [guestListDocs, tableListDocs] = await Promise.all([
      guestListsRef.get(),
      tableListsRef.get(),
    ]);

    // Prepare batch operations
    const batch = db.batch();
    
    // Add all guest_lists documents to batch delete
    guestListDocs.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    // Add all table_lists documents to batch delete
    tableListDocs.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    // Add the main event document to batch delete
    batch.delete(eventRef);

    // Execute all deletions in a single batch
    await batch.commit();

    // Log the deletion (optional - you can add this to a separate collection if needed)
    console.log(`Event deleted by user ${userName} (${userId}): ${eventName} (${eventId}) in company ${companyId}`);
    console.log(`Deleted ${guestListDocs.docs.length} guest list documents and ${tableListDocs.docs.length} table list documents`);

    return {
      success: true,
      message: "Event deleted successfully",
      data: {
        eventId,
        eventName,
        deletedDocuments: {
          guestLists: guestListDocs.docs.length,
          tableLists: tableListDocs.docs.length,
          total: guestListDocs.docs.length + tableListDocs.docs.length + 1, // +1 for the main event document
        },
        deletedBy: userName,
        deletedAt: new Date().toISOString(),
      },
    };
  } catch (error) {
    console.error("Error deleting event:", error);
    return {
      success: false,
      error: "Failed to delete event",
    };
  }
}); 

// Validation schema for creating event ticket
const createEventTicketSchema = Joi.object({
  companyId: Joi.string().required(),
  eventId: Joi.string().required(),
  ticketData: Joi.object({
    totalTickets: Joi.number().integer().min(1).required(),
    ticketName: Joi.string().required(),
    ticketPrice: Joi.number().min(0).required(),
    ticketDescription: Joi.string().optional(),
    ticketImage: Joi.string().optional(),
    saleStartDate: Joi.string().isoDate().optional(),
    saleEndDate: Joi.string().isoDate().optional(),
    freeTicket: Joi.boolean().default(false),
    buyerPaysAdminFee: Joi.boolean().default(true),
    ticketCategory: Joi.string().optional(),
    maxTicketsPerUser: Joi.number().integer().min(1).optional(),
  }).required(),
});

// Type definitions for creating event ticket
interface CreateEventTicketData {
  companyId: string;
  eventId: string;
  ticketData: {
    totalTickets: number;
    ticketName: string;
    ticketPrice: number;
    ticketDescription?: string;
    ticketImage?: string;
    saleStartDate?: string;
    saleEndDate?: string;
    freeTicket?: boolean;
    buyerPaysAdminFee?: boolean;
    ticketCategory?: string;
    maxTicketsPerUser?: number;
  };
}

/**
 * Create a ticket for an event
 * This function:
 * 1. Creates a ticket document with the specified ID
 * 2. Initializes or updates the ticket summary
 * 3. Manages ticket counts and revenue tracking
 */
export const createEventTicket = onCall({
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

    // Extract data from request - handle both direct data and wrapped data
    let data: CreateEventTicketData;
    if (request.data && request.data.data) {
      // Data is wrapped in a "data" property
      data = request.data.data as CreateEventTicketData;
    } else {
      // Data is at root level
      data = request.data as CreateEventTicketData;
    }

    // Validate input data
    const {error} = createEventTicketSchema.validate(data);
    if (error) {
      return {
        success: false,
        error: `Validation error: ${error.message}`,
      };
    }

    // Get current user info for logging
    const currentUser = request.auth;
    let userName = 'Unknown User';
    
    // Try to get user name from Firestore
    try {
      const currentUserDoc = await db.collection('users').doc(currentUser.uid).get();
      if (currentUserDoc.exists) {
        const userData = currentUserDoc.data();
        userName = `${userData?.userFirstName || ''} ${userData?.userLastName || ''}`.trim() || 'Unknown User';
      }
    } catch (error) {
      console.log('Could not fetch current user name from Firestore:', error);
    }

    // Check if company exists
    const companyRef = db.collection('companies').doc(data.companyId);
    const companyDoc = await companyRef.get();

    if (!companyDoc.exists) {
      return {
        success: false,
        error: "Company not found",
      };
    }

    // Check if event exists
    const eventRef = db.collection('companies').doc(data.companyId).collection('events').doc(data.eventId);
    const eventDoc = await eventRef.get();

    if (!eventDoc.exists) {
      return {
        success: false,
        error: "Event not found",
      };
    }

    // Generate a unique ticket ID
    const ticketId = uuidv4();

    // Check if ticket already exists (shouldn't happen with UUID, but safety check)
    const ticketRef = db.collection('companies')
      .doc(data.companyId)
      .collection('events')
      .doc(data.eventId)
      .collection('event_tickets')
      .doc(ticketId);

    const ticketDoc = await ticketRef.get();

    if (ticketDoc.exists) {
      return {
        success: false,
        error: "Ticket with this ID already exists",
      };
    }

    // Initialize or update ticket summary
    const summaryRef = db.collection('companies')
      .doc(data.companyId)
      .collection('events')
      .doc(data.eventId)
      .collection('event_tickets')
      .doc('ticketSummary');

    const summaryDoc = await summaryRef.get();

    if (!summaryDoc.exists) {
      // Create new summary
      await summaryRef.set({
        totalNrTickets: data.ticketData.totalTickets,
        totalNrSoldTickets: 0,
        totalNrTicketsLeft: data.ticketData.totalTickets,
        totalTicketsRevenue: 0,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      console.log(`Created new ticket summary for event ${data.eventId}`);
    } else {
      // Update existing summary
      await summaryRef.update({
        totalNrTickets: FieldValue.increment(data.ticketData.totalTickets),
        totalNrTicketsLeft: FieldValue.increment(data.ticketData.totalTickets),
        updatedAt: FieldValue.serverTimestamp(),
      });
      console.log(`Updated ticket summary for event ${data.eventId}`);
    }

    // Create the ticket document
    const ticketData: any = {
      ...data.ticketData,
      id: ticketId,
      eventId: data.eventId,
      createdAt: FieldValue.serverTimestamp(),
      ticketsLeft: data.ticketData.totalTickets,
      tickets: [], // Initialize empty tickets array
      freeTicket: data.ticketData.freeTicket !== undefined ? data.ticketData.freeTicket : false,
      buyerPaysAdminFee: data.ticketData.buyerPaysAdminFee !== undefined ? data.ticketData.buyerPaysAdminFee : true,
      ticketCategory: data.ticketData.ticketCategory || null,
      maxTicketsPerUser: data.ticketData.maxTicketsPerUser || null,
    };

    // Convert date objects to Firestore timestamps if provided
    if (data.ticketData.saleStartDate) {
      ticketData.saleStartDate = new Date(data.ticketData.saleStartDate);
    }
    if (data.ticketData.saleEndDate) {
      ticketData.saleEndDate = new Date(data.ticketData.saleEndDate);
    }

    await ticketRef.set(ticketData);
    console.log(`Created ticket ${ticketId} for event ${data.eventId}`);

    // Log the action
    await db.collection('companies')
      .doc(data.companyId)
      .collection('events')
      .doc(data.eventId)
      .collection('activityLogs')
      .add({
        action: 'ticket_created',
        ticketId: ticketId,
        ticketName: data.ticketData.ticketName,
        totalTickets: data.ticketData.totalTickets,
        ticketPrice: data.ticketData.ticketPrice,
        createdBy: userName,
        timestamp: FieldValue.serverTimestamp(),
      });

    return {
      success: true,
      message: "Ticket created successfully",
      data: {
        ticketId: ticketId,
        eventId: data.eventId,
        companyId: data.companyId,
        ticketName: data.ticketData.ticketName,
        totalTickets: data.ticketData.totalTickets,
        ticketPrice: data.ticketData.ticketPrice,
        freeTicket: ticketData.freeTicket,
        buyerPaysAdminFee: ticketData.buyerPaysAdminFee,
        ticketCategory: ticketData.ticketCategory,
        maxTicketsPerUser: ticketData.maxTicketsPerUser,
        createdBy: userName,
        createdAt: new Date().toISOString(),
      }
    };

  } catch (error: any) {
    console.error("Error creating event ticket:", error);
    
    return {
      success: false,
      error: `Failed to create event ticket: ${error.message}`,
    };
  }
}); 

// Validation schema for updating event ticket
const updateEventTicketSchema = Joi.object({
  companyId: Joi.string().required(),
  eventId: Joi.string().required(),
  ticketId: Joi.string().required(),
  ticketData: Joi.object({
    totalTickets: Joi.number().integer().min(1).optional(),
    ticketName: Joi.string().optional(),
    ticketPrice: Joi.number().min(0).optional(),
    ticketDescription: Joi.string().optional(),
    ticketImage: Joi.string().optional(),
    saleStartDate: Joi.string().isoDate().optional(),
    saleEndDate: Joi.string().isoDate().optional(),
    freeTicket: Joi.boolean().optional(),
    buyerPaysAdminFee: Joi.boolean().optional(),
    ticketCategory: Joi.string().optional(),
    maxTicketsPerUser: Joi.number().integer().min(1).optional(),
  }).required(),
});

// Type definitions for updating event ticket
interface UpdateEventTicketData {
  companyId: string;
  eventId: string;
  ticketId: string;
  ticketData: {
    totalTickets?: number;
    ticketName?: string;
    ticketPrice?: number;
    ticketDescription?: string;
    ticketImage?: string;
    saleStartDate?: string;
    saleEndDate?: string;
    freeTicket?: boolean;
    buyerPaysAdminFee?: boolean;
    ticketCategory?: string;
    maxTicketsPerUser?: number;
  };
}

/**
 * Update an existing ticket for an event
 * This function:
 * 1. Validates the ticket exists
 * 2. Updates only the provided fields
 * 3. Adjusts ticket summary if totalTickets changes
 * 4. Logs the changes for audit trail
 */
export const updateEventTicket = onCall({
  enforceAppCheck: false,
}, async (request) => {
  try {
    console.log('updateEventTicket called with request:', {
      hasAuth: !!request.auth,
      hasData: !!request.data,
      dataKeys: request.data ? Object.keys(request.data) : [],
      rawData: request.data
    });

    // Check if caller is authenticated
    if (!request.auth) {
      return {
        success: false,
        error: "Unauthorized",
      };
    }

    // Extract data from request - handle both direct data and wrapped data
    let data: UpdateEventTicketData;
    if (request.data && request.data.data) {
      // Data is wrapped in a "data" property
      data = request.data.data as UpdateEventTicketData;
      console.log('Using wrapped data:', data);
    } else {
      // Data is at root level
      data = request.data as UpdateEventTicketData;
      console.log('Using root data:', data);
    }

    // Validate input data
    const {error} = updateEventTicketSchema.validate(data);
    if (error) {
      return {
        success: false,
        error: `Validation error: ${error.message}`,
      };
    }

    // Get current user info for logging
    const currentUser = request.auth;
    let userName = 'Unknown User';
    
    // Try to get user name from Firestore
    try {
      const currentUserDoc = await db.collection('users').doc(currentUser.uid).get();
      if (currentUserDoc.exists) {
        const userData = currentUserDoc.data();
        userName = `${userData?.userFirstName || ''} ${userData?.userLastName || ''}`.trim() || 'Unknown User';
      }
    } catch (error) {
      console.log('Could not fetch current user name from Firestore:', error);
    }

    // Check if company exists
    const companyRef = db.collection('companies').doc(data.companyId);
    const companyDoc = await companyRef.get();

    if (!companyDoc.exists) {
      return {
        success: false,
        error: "Company not found",
      };
    }

    // Check if event exists
    const eventRef = db.collection('companies').doc(data.companyId).collection('events').doc(data.eventId);
    const eventDoc = await eventRef.get();

    if (!eventDoc.exists) {
      return {
        success: false,
        error: "Event not found",
      };
    }

    // Check if ticket exists
    const ticketRef = db.collection('companies')
      .doc(data.companyId)
      .collection('events')
      .doc(data.eventId)
      .collection('event_tickets')
      .doc(data.ticketId);

    const ticketDoc = await ticketRef.get();

    if (!ticketDoc.exists) {
      return {
        success: false,
        error: "Ticket not found",
      };
    }

    const existingTicketData = ticketDoc.data();
    
    // Check if there are actual changes
    const changes: any = {};
    let hasChanges = false;
    let totalTicketsChanged = false;
    let oldTotalTickets = existingTicketData?.totalTickets || 0;

    // Check each field for changes
    Object.keys(data.ticketData).forEach(key => {
      const newValue = (data.ticketData as any)[key];
      const oldValue = existingTicketData?.[key];
      
      if (newValue !== undefined && newValue !== oldValue) {
        changes[key] = {
          from: oldValue,
          to: newValue
        };
        hasChanges = true;
        
        // Track if totalTickets is changing
        if (key === 'totalTickets') {
          totalTicketsChanged = true;
        }
      }
    });

    if (!hasChanges) {
      return {
        success: false,
        error: "No changes detected",
      };
    }

    // Prepare update data
    const updateData: any = {
      updatedAt: FieldValue.serverTimestamp(),
    };

    // Add changed fields to update data
    Object.keys(data.ticketData).forEach(key => {
      const newValue = (data.ticketData as any)[key];
      if (newValue !== undefined) {
        updateData[key] = newValue;
      }
    });

    // Convert date strings to Date objects if provided
    if (data.ticketData.saleStartDate) {
      updateData.saleStartDate = new Date(data.ticketData.saleStartDate);
    }
    if (data.ticketData.saleEndDate) {
      updateData.saleEndDate = new Date(data.ticketData.saleEndDate);
    }

    // Update the ticket
    await ticketRef.update(updateData);
    console.log(`Updated ticket ${data.ticketId} for event ${data.eventId}`);

    // Update ticket summary if totalTickets changed
    if (totalTicketsChanged) {
      const newTotalTickets = data.ticketData.totalTickets || 0;
      const ticketsSold = oldTotalTickets - (existingTicketData?.ticketsLeft || 0);
      const newTicketsLeft = Math.max(0, newTotalTickets - ticketsSold);

      const summaryRef = db.collection('companies')
        .doc(data.companyId)
        .collection('events')
        .doc(data.eventId)
        .collection('event_tickets')
        .doc('ticketSummary');

      await summaryRef.update({
        totalNrTickets: FieldValue.increment(newTotalTickets - oldTotalTickets),
        totalNrTicketsLeft: FieldValue.increment(newTicketsLeft - (existingTicketData?.ticketsLeft || 0)),
        updatedAt: FieldValue.serverTimestamp(),
      });

      // Update ticketsLeft on the ticket document
      await ticketRef.update({
        ticketsLeft: newTicketsLeft,
      });

      console.log(`Updated ticket summary for event ${data.eventId}`);
    }

    // Log the action
    await db.collection('companies')
      .doc(data.companyId)
      .collection('events')
      .doc(data.eventId)
      .collection('activityLogs')
      .add({
        action: 'ticket_updated',
        ticketId: data.ticketId,
        ticketName: existingTicketData?.ticketName || '',
        changes: changes,
        updatedBy: userName,
        timestamp: FieldValue.serverTimestamp(),
      });

    return {
      success: true,
      message: "Ticket updated successfully",
      data: {
        ticketId: data.ticketId,
        eventId: data.eventId,
        companyId: data.companyId,
        changes: changes,
        updatedBy: userName,
        updatedAt: new Date().toISOString(),
      }
    };

  } catch (error: any) {
    console.error("Error updating event ticket:", error);
    
    return {
      success: false,
      error: `Failed to update event ticket: ${error.message}`,
    };
  }
}); 

// Validation schema for removing event ticket
const removeEventTicketSchema = Joi.object({
  companyId: Joi.string().required(),
  eventId: Joi.string().required(),
  ticketId: Joi.string().required(),
});

// Type definitions for removing event ticket
interface RemoveEventTicketData {
  companyId: string;
  eventId: string;
  ticketId: string;
}

/**
 * Remove a ticket from an event
 * This function:
 * 1. Validates the ticket exists
 * 2. Removes the ticket document
 * 3. Updates the ticket summary to reflect the removal
 * 4. Logs the action for audit trail
 */
export const removeEventTicket = onCall({
  enforceAppCheck: false,
}, async (request) => {
  try {
    console.log('removeEventTicket called with request:', {
      hasAuth: !!request.auth,
      hasData: !!request.data,
      dataKeys: request.data ? Object.keys(request.data) : [],
      rawData: request.data
    });

    // Check if caller is authenticated
    if (!request.auth) {
      return {
        success: false,
        error: "Unauthorized",
      };
    }

    // Extract data from request - handle both direct data and wrapped data
    let data: RemoveEventTicketData;
    if (request.data && request.data.data) {
      // Data is wrapped in a "data" property
      data = request.data.data as RemoveEventTicketData;
      console.log('Using wrapped data:', data);
    } else {
      // Data is at root level
      data = request.data as RemoveEventTicketData;
      console.log('Using root data:', data);
    }

    // Validate input data
    const {error} = removeEventTicketSchema.validate(data);
    if (error) {
      return {
        success: false,
        error: `Validation error: ${error.message}`,
      };
    }

    // Get current user info for logging
    const currentUser = request.auth;
    let userName = 'Unknown User';
    
    // Try to get user name from Firestore
    try {
      const currentUserDoc = await db.collection('users').doc(currentUser.uid).get();
      if (currentUserDoc.exists) {
        const userData = currentUserDoc.data();
        userName = `${userData?.userFirstName || ''} ${userData?.userLastName || ''}`.trim() || 'Unknown User';
      }
    } catch (error) {
      console.log('Could not fetch current user name from Firestore:', error);
    }

    // Check if company exists
    const companyRef = db.collection('companies').doc(data.companyId);
    const companyDoc = await companyRef.get();

    if (!companyDoc.exists) {
      return {
        success: false,
        error: "Company not found",
      };
    }

    // Check if event exists
    const eventRef = db.collection('companies').doc(data.companyId).collection('events').doc(data.eventId);
    const eventDoc = await eventRef.get();

    if (!eventDoc.exists) {
      return {
        success: false,
        error: "Event not found",
      };
    }

    // Check if ticket exists and get its data
    const ticketRef = db.collection('companies')
      .doc(data.companyId)
      .collection('events')
      .doc(data.eventId)
      .collection('event_tickets')
      .doc(data.ticketId);

    const ticketDoc = await ticketRef.get();

    if (!ticketDoc.exists) {
      return {
        success: false,
        error: "Ticket not found",
      };
    }

    const ticketData = ticketDoc.data();
    const ticketName = ticketData?.ticketName || 'Unknown Ticket';
    const totalTickets = ticketData?.totalTickets || 0;
    const ticketsSold = totalTickets - (ticketData?.ticketsLeft || 0);
    const ticketsLeft = ticketData?.ticketsLeft || 0;

    // Check if tickets have been sold - prevent removal if so
    if (ticketsSold > 0) {
      return {
        success: false,
        error: `Cannot remove ticket "${ticketName}" because ${ticketsSold} tickets have been sold. Please handle sold tickets before removal.`,
        data: {
          ticketId: data.ticketId,
          ticketName: ticketName,
          totalTickets: totalTickets,
          ticketsSold: ticketsSold,
          ticketsLeft: ticketsLeft,
          ticketPrice: ticketData?.ticketPrice || 0,
        }
      };
    }

    // Delete the ticket document
    await ticketRef.delete();
    console.log(`Deleted ticket ${data.ticketId} for event ${data.eventId}`);

    // Update ticket summary
    const summaryRef = db.collection('companies')
      .doc(data.companyId)
      .collection('events')
      .doc(data.eventId)
      .collection('event_tickets')
      .doc('ticketSummary');

    const summaryDoc = await summaryRef.get();

    if (summaryDoc.exists) {
      // Update existing summary
      await summaryRef.update({
        totalNrTickets: FieldValue.increment(-totalTickets),
        totalNrSoldTickets: FieldValue.increment(-ticketsSold),
        totalNrTicketsLeft: FieldValue.increment(-ticketsLeft),
        totalTicketsRevenue: FieldValue.increment(-(ticketsSold * (ticketData?.ticketPrice || 0))),
        updatedAt: FieldValue.serverTimestamp(),
      });
      console.log(`Updated ticket summary for event ${data.eventId}`);
    } else {
      console.log(`No ticket summary found for event ${data.eventId}, skipping summary update`);
    }

    // Log the action
    await db.collection('companies')
      .doc(data.companyId)
      .collection('events')
      .doc(data.eventId)
      .collection('activityLogs')
      .add({
        action: 'ticket_removed',
        ticketId: data.ticketId,
        ticketName: ticketName,
        totalTickets: totalTickets,
        ticketsSold: ticketsSold,
        ticketsLeft: ticketsLeft,
        ticketPrice: ticketData?.ticketPrice || 0,
        removedBy: userName,
        timestamp: FieldValue.serverTimestamp(),
      });

    return {
      success: true,
      message: "Ticket removed successfully",
      data: {
        ticketId: data.ticketId,
        eventId: data.eventId,
        companyId: data.companyId,
        ticketName: ticketName,
        totalTickets: totalTickets,
        ticketsSold: ticketsSold,
        ticketsLeft: ticketsLeft,
        ticketPrice: ticketData?.ticketPrice || 0,
        removedBy: userName,
        removedAt: new Date().toISOString(),
      }
    };

  } catch (error: any) {
    console.error("Error removing event ticket:", error);
    
    return {
      success: false,
      error: `Failed to remove event ticket: ${error.message}`,
    };
  }
}); 


import {onCall} from "firebase-functions/v2/https";
import {getFirestore, FieldValue} from "firebase-admin/firestore";
import * as Joi from "joi";
import {v4 as uuidv4} from "uuid";

// Get Firestore instance
const db = getFirestore();

// Validation schema for creating club card
const createClubCardSchema = Joi.object({
  companyId: Joi.string().required(),
  title: Joi.string().required().min(1).max(100),
  description: Joi.string().optional().max(1000),
  imageUrl: Joi.string().optional(),
  validFrom: Joi.string().isoDate().optional(),
  validTo: Joi.string().isoDate().optional(),
  freeEntry: Joi.object({
    hours: Joi.number().min(0).max(23).optional(),
    minutes: Joi.number().min(0).max(59).optional(),
  }).optional(),
  events: Joi.array().items(Joi.string()).optional().default([]),
  numberOfCards: Joi.number().integer().min(1).max(1000).optional().default(1),
});

// Validation schema for updating club card
const updateClubCardSchema = Joi.object({
  companyId: Joi.string().required(),
  cardId: Joi.string().required(),
  title: Joi.string().optional().min(1).max(100),
  description: Joi.string().optional().max(1000),
  imageUrl: Joi.string().optional(),
  validFrom: Joi.string().isoDate().optional(),
  validTo: Joi.string().isoDate().optional(),
  freeEntry: Joi.object({
    hours: Joi.number().min(0).max(23).optional(),
    minutes: Joi.number().min(0).max(59).optional(),
  }).optional(),
  events: Joi.array().items(Joi.string()).optional(),
  generateCards: Joi.number().integer().min(1).max(1000).optional(), // Just for request, not stored in DB
});

// Validation schema for deleting club card
const deleteClubCardSchema = Joi.object({
  companyId: Joi.string().required(),
  cardId: Joi.string().required(),
});

// Validation schema for checking card generation status
const checkCardStatusSchema = Joi.object({
  companyId: Joi.string().required(),
  cardId: Joi.string().required(),
});

// Type definitions
interface CreateClubCardData {
  companyId: string;
  title: string;
  description?: string;
  imageUrl?: string;
  validFrom?: string;
  validTo?: string;
  freeEntry?: {
    hours?: number;
    minutes?: number;
  };
  events?: string[];
  numberOfCards?: number;
}

interface CardItem {
  active: boolean;
  guest: string;
  nrUsed: number;
  qrCode: string;
  status: string;
  uniqueId: string;
}

interface UpdateClubCardData {
  companyId: string;
  cardId: string;
  title?: string;
  description?: string;
  imageUrl?: string;
  validFrom?: string;
  validTo?: string;
  freeEntry?: {
    hours?: number;
    minutes?: number;
  };
  events?: string[];
  generateCards?: number; // Just for request, not stored in DB
}

interface DeleteClubCardData {
  companyId: string;
  cardId: string;
}

interface CheckCardStatusData {
  companyId: string;
  cardId: string;
}

/**
 * Generate a single card item (without QR code image)
 */
function generateSingleCard(companyId: string, cardId: string, cardNumber: number, totalCards: number): CardItem {
  const uniqueId = uuidv4();
  
  console.log(`Generated card ${cardNumber}/${totalCards}: ${uniqueId}`);
  
  return {
    active: false,
    guest: '',
    nrUsed: 0,
    qrCode: '', // Empty - will be generated later when needed
    status: 'unused',
    uniqueId: uniqueId,
  };
}


/**
 * Create a new club card for a company
 * This function:
 * 1. Validates the card data
 * 2. Creates the card document in the company's cards collection
 * 3. Logs the creation action
 */
export const createClubCard = onCall({
  enforceAppCheck: false,
}, async (request) => {
  try {
    console.log('createClubCard called with request:', {
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
    let data: CreateClubCardData;
    if (request.data && request.data.data) {
      // Data is wrapped in a "data" property
      data = request.data.data as CreateClubCardData;
      console.log('Using wrapped data:', data);
    } else {
      // Data is at root level
      data = request.data as CreateClubCardData;
      console.log('Using root data:', data);
    }

    // Validate input data
    const {error} = createClubCardSchema.validate(data);
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

    // Generate a specific UUID format for the card ID
    const cardId = uuidv4();

    // Generate items array based on numberOfCards
    const numberOfCards = data.numberOfCards || 1;
    const items: CardItem[] = [];
    
    console.log(`Generating ${numberOfCards} QR codes for club card...`);
    
    // Generate all cards instantly (no QR code images)
    console.log(`Generating ${numberOfCards} card items...`);
    
    for (let i = 0; i < numberOfCards; i++) {
      items.push(generateSingleCard(data.companyId, cardId, i + 1, numberOfCards));
    }
    
    console.log(`Generated ${items.length} card items instantly`);

    // Create the club card document
    const cardData: any = {
      title: data.title,
      description: data.description || '',
      imageUrl: data.imageUrl || '',
      validFrom: data.validFrom ? new Date(data.validFrom) : null,
      validTo: data.validTo ? new Date(data.validTo) : null,
      freeEntry: data.freeEntry || null,
      events: data.events || [],
      items: items,
      createdAt: FieldValue.serverTimestamp(),
    };

    await db.collection('companies')
      .doc(data.companyId)
      .collection('cards')
      .doc(cardId)
      .set(cardData);

    console.log(`Created club card ${cardId} for company ${data.companyId}`);

    // Log the action
    await db.collection('companies')
      .doc(data.companyId)
      .collection('activityLogs')
      .add({
        action: 'club_card_created',
        cardId: cardId,
        cardTitle: data.title,
        createdBy: userName,
        timestamp: FieldValue.serverTimestamp(),
      });

    return {
      success: true,
      message: "Club card created successfully",
      data: {
        cardId: cardId,
        companyId: data.companyId,
        title: data.title,
        description: data.description || '',
        imageUrl: data.imageUrl || '',
        validFrom: data.validFrom,
        validTo: data.validTo,
        freeEntry: data.freeEntry || null,
        events: data.events || [],
        items: items,
        createdBy: userName,
        createdAt: new Date().toISOString(),
      }
    };

  } catch (error: any) {
    console.error("Error creating club card:", error);
    
    return {
      success: false,
      error: `Failed to create club card: ${error.message}`,
    };
  }
});

/**
 * Update an existing club card
 * This function:
 * 1. Validates the card exists
 * 2. Updates only the provided fields
 * 3. Logs the changes for audit trail
 */
export const updateClubCard = onCall({
  enforceAppCheck: false,
}, async (request) => {
  try {
    console.log('🚀 updateClubCard function STARTED');
    console.log('Request details:', {
      hasAuth: !!request.auth,
      hasData: !!request.data,
      dataKeys: request.data ? Object.keys(request.data) : [],
      rawData: JSON.stringify(request.data, null, 2)
    });

    // Check if caller is authenticated
    if (!request.auth) {
      return {
        success: false,
        error: "Unauthorized",
      };
    }

    // Extract data from request - handle both direct data and wrapped data
    let data: UpdateClubCardData;
    if (request.data && request.data.data) {
      // Data is wrapped in a "data" property
      data = request.data.data as UpdateClubCardData;
      console.log('Using wrapped data:', data);
    } else {
      // Data is at root level
      data = request.data as UpdateClubCardData;
      console.log('Using root data:', data);
    }

    // Validate input data
    console.log('🔍 Validating data with schema...');
    const {error} = updateClubCardSchema.validate(data);
    if (error) {
      console.log('❌ Validation failed:', error.message);
      return {
        success: false,
        error: `Validation error: ${error.message}`,
      };
    }
    console.log('✅ Validation passed successfully');

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

    // Check if card exists
    const cardRef = db.collection('companies')
      .doc(data.companyId)
      .collection('cards')
      .doc(data.cardId);

    const cardDoc = await cardRef.get();

    if (!cardDoc.exists) {
      return {
        success: false,
        error: "Club card not found",
      };
    }

    const existingCardData = cardDoc.data();
    
    console.log('📊 Existing card data:', {
      hasItems: !!existingCardData?.items,
      itemsLength: existingCardData?.items?.length || 0,
      requestedGenerateCards: data.generateCards
    });
    
    console.log('🔍 Starting change detection...');
    // Check if there are actual changes
    const changes: any = {};
    let hasChanges = false;
    let needsNewCards = false;
    let additionalCards: CardItem[] = [];

    // Check each field for changes
    Object.keys(data).forEach(key => {
      if (key === 'companyId' || key === 'cardId' || key === 'generateCards') return; // Skip these fields
      
      const newValue = (data as any)[key];
      if (newValue !== undefined) {
        const oldValue = existingCardData?.[key];
        
        console.log(`Checking field "${key}": oldValue = ${oldValue} (${typeof oldValue}), newValue = ${newValue} (${typeof newValue})`);
        
        // Always consider it a change if newValue is provided and different from oldValue
        if (newValue !== oldValue) {
          changes[key] = {
            from: oldValue || null, // Convert undefined to null for Firestore
            to: newValue
          };
          hasChanges = true;
          console.log(`Field "${key}" changed: ${oldValue || 'undefined'} → ${newValue}`);
        }
      }
    });

    // Handle generateCards separately (not stored in DB, just for generating cards)
    if (data.generateCards && typeof data.generateCards === 'number') {
      const currentItemsCount = existingCardData?.items?.length || 0;
      if (data.generateCards > currentItemsCount) {
        needsNewCards = true;
        const cardsToAdd = data.generateCards - currentItemsCount;
        console.log(`Need to add ${cardsToAdd} more cards (from ${currentItemsCount} existing items to ${data.generateCards} total)`);
        hasChanges = true; // Consider this a change even if no other fields changed
      }
    }

    console.log('📋 Change detection results:', {
      hasChanges,
      needsNewCards,
      changes: Object.keys(changes),
      changesDetails: changes
    });

    if (!hasChanges) {
      console.log('❌ No changes detected - returning error');
      return {
        success: false,
        error: "No changes detected",
      };
    }
    
    console.log('✅ Changes detected - proceeding with update');

    // Prepare update data
    const updateData: any = {};

    // Generate additional cards if generateCards is specified
    if (needsNewCards) {
      const currentItems = existingCardData?.items || [];
      const targetCardCount = data.generateCards || 0;
      const cardsToAdd = targetCardCount - currentItems.length;
      
      console.log(`Generating ${cardsToAdd} additional QR codes (current: ${currentItems.length}, target: ${targetCardCount})...`);
      
      // Generate additional cards instantly (no QR code images)
      console.log(`Generating ${cardsToAdd} additional card items...`);
      
      for (let i = 0; i < cardsToAdd; i++) {
        additionalCards.push(generateSingleCard(data.companyId, data.cardId, currentItems.length + i + 1, targetCardCount));
      }
      
      console.log(`Generated ${additionalCards.length} additional card items instantly`);
      
      // Add new cards to existing items
      const updatedItems = [...currentItems, ...additionalCards];
      updateData.items = updatedItems;
      
      console.log(`Added ${cardsToAdd} new cards. Total cards now: ${updatedItems.length}`);
    }

    // Add changed fields to update data
    Object.keys(data).forEach(key => {
      if (key === 'companyId' || key === 'cardId') return; // Skip these fields
      
      const newValue = (data as any)[key];
      if (newValue !== undefined) {
        updateData[key] = newValue;
      }
    });

    // Convert date strings to Date objects if provided
    if (data.validFrom) {
      updateData.validFrom = new Date(data.validFrom);
    }
    if (data.validTo) {
      updateData.validTo = new Date(data.validTo);
    }

    // Update the card
    await cardRef.update(updateData);
    console.log(`Updated club card ${data.cardId} for company ${data.companyId}`);

    // Log the action
    await db.collection('companies')
      .doc(data.companyId)
      .collection('activityLogs')
      .add({
        action: 'club_card_updated',
        cardId: data.cardId,
        cardTitle: existingCardData?.title || '',
        changes: changes,
        updatedBy: userName,
        timestamp: FieldValue.serverTimestamp(),
      });

    return {
      success: true,
      message: "Club card updated successfully",
      data: {
        cardId: data.cardId,
        companyId: data.companyId,
        changes: changes,
        updatedBy: userName,
        updatedAt: new Date().toISOString(),
      }
    };

  } catch (error: any) {
    console.error("Error updating club card:", error);
    
    return {
      success: false,
      error: `Failed to update club card: ${error.message}`,
    };
  }
});

/**
 * Delete a club card from a company
 * This function:
 * 1. Validates the card exists
 * 2. Checks if the card is being used in any events
 * 3. Deletes the card document
 * 4. Logs the deletion action
 */
export const deleteClubCard = onCall({
  enforceAppCheck: false,
}, async (request) => {
  try {
    console.log('deleteClubCard called with request:', {
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
    let data: DeleteClubCardData;
    if (request.data && request.data.data) {
      // Data is wrapped in a "data" property
      data = request.data.data as DeleteClubCardData;
      console.log('Using wrapped data:', data);
    } else {
      // Data is at root level
      data = request.data as DeleteClubCardData;
      console.log('Using root data:', data);
    }

    // Validate input data
    const {error} = deleteClubCardSchema.validate(data);
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

    // Check if card exists and get its data
    const cardRef = db.collection('companies')
      .doc(data.companyId)
      .collection('cards')
      .doc(data.cardId);

    const cardDoc = await cardRef.get();

    if (!cardDoc.exists) {
      return {
        success: false,
        error: "Club card not found",
      };
    }

    const cardData = cardDoc.data();
    const cardTitle = cardData?.title || 'Unknown Card';
    const items = cardData?.items || [];
    const itemsCount = items.length;

    // Check if the card is being used in any events
    const eventsQuery = await db.collection('companies')
      .doc(data.companyId)
      .collection('events')
      .where('clubCardIds', 'array-contains', data.cardId)
      .limit(1)
      .get();

    if (!eventsQuery.empty) {
      return {
        success: false,
        error: `Cannot delete club card "${cardTitle}" because it is being used in events. Please remove it from all events first.`,
        data: {
          cardId: data.cardId,
          cardTitle: cardTitle,
          eventsCount: eventsQuery.size,
        }
      };
    }

    // No need to clean up QR code images since they're not stored in Firebase Storage
    console.log(`No QR code images to clean up (QR codes are generated on-demand)`);

    // Delete the card document
    await cardRef.delete();
    console.log(`Deleted club card ${data.cardId} for company ${data.companyId}`);

    // Log the action
    await db.collection('companies')
      .doc(data.companyId)
      .collection('activityLogs')
      .add({
        action: 'club_card_deleted',
        cardId: data.cardId,
        cardTitle: cardTitle,
        deletedBy: userName,
        timestamp: FieldValue.serverTimestamp(),
      });

    return {
      success: true,
      message: "Club card deleted successfully",
      data: {
        cardId: data.cardId,
        companyId: data.companyId,
        cardTitle: cardTitle,
        deletedBy: userName,
        deletedAt: new Date().toISOString(),
        itemsDeleted: itemsCount,
        qrCodeFilesDeleted: 0, // No QR code files stored
      }
    };

  } catch (error: any) {
    console.error("Error deleting club card:", error);
    
    return {
      success: false,
      error: `Failed to delete club card: ${error.message}`,
    };
  }
});

/**
 * Check the generation status of a club card
 * This function:
 * 1. Validates the card exists
 * 2. Returns the current generation status and progress
 */
export const checkCardGenerationStatus = onCall({
  enforceAppCheck: false,
}, async (request) => {
  try {
    console.log('checkCardGenerationStatus called with request:', {
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
    let data: CheckCardStatusData;
    if (request.data && request.data.data) {
      // Data is wrapped in a "data" property
      data = request.data.data as CheckCardStatusData;
      console.log('Using wrapped data:', data);
    } else {
      // Data is at root level
      data = request.data as CheckCardStatusData;
      console.log('Using root data:', data);
    }

    // Validate input data
    const {error} = checkCardStatusSchema.validate(data);
    if (error) {
      return {
        success: false,
        error: `Validation error: ${error.message}`,
      };
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

    // Check if card exists
    const cardRef = db.collection('companies')
      .doc(data.companyId)
      .collection('cards')
      .doc(data.cardId);

    const cardDoc = await cardRef.get();

    if (!cardDoc.exists) {
      return {
        success: false,
        error: "Club card not found",
      };
    }

    const cardData = cardDoc.data();
    const items = cardData?.items || [];
    const itemsCount = items.length;
    const generationStatus = cardData?.generationStatus || 'completed';
    const totalCardsRequested = cardData?.totalCardsRequested || itemsCount;
    const cardsGenerated = cardData?.cardsGenerated || itemsCount;

    return {
      success: true,
      message: "Card generation status retrieved successfully",
      data: {
        cardId: data.cardId,
        companyId: data.companyId,
        cardTitle: cardData?.title || '',
        generationStatus: generationStatus,
        totalCardsRequested: totalCardsRequested,
        cardsGenerated: cardsGenerated,
        itemsCount: itemsCount,
        progress: totalCardsRequested > 0 ? Math.round((cardsGenerated / totalCardsRequested) * 100) : 100,
        lastUpdated: cardData?.lastUpdated,
        completedAt: cardData?.completedAt,
        failedAt: cardData?.failedAt,
        error: cardData?.error,
      }
    };

  } catch (error: any) {
    console.error("Error checking card generation status:", error);
    
    return {
      success: false,
      error: `Failed to check card generation status: ${error.message}`,
    };
  }
});

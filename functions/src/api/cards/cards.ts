import {onCall} from "firebase-functions/v2/https";
import {getFirestore, FieldValue} from "firebase-admin/firestore";
import {getStorage} from "firebase-admin/storage";
import * as Joi from "joi";
import {v4 as uuidv4} from "uuid";
import * as QRCode from "qrcode";

// Get Firestore and Storage instances
const db = getFirestore();
const storage = getStorage();

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
    
    for (let i = 0; i < numberOfCards; i++) {
      const uniqueId = uuidv4();
      
      try {
        // Generate QR code as data URL
        const qrCodeDataUrl = await QRCode.toDataURL(uniqueId, {
          errorCorrectionLevel: 'M',
          type: 'image/png',
          margin: 1,
        });
        
        // Convert data URL to buffer
        const base64Data = qrCodeDataUrl.replace(/^data:image\/png;base64,/, '');
        const qrCodeBuffer = Buffer.from(base64Data, 'base64');
        
        // Upload to Firebase Storage
        const qrCodeFileName = `companies/${data.companyId}/cards/${cardId}/qrcodes/${uniqueId}.png`;
        const file = storage.bucket().file(qrCodeFileName);
        
        await file.save(qrCodeBuffer, {
          metadata: {
            contentType: 'image/png',
            metadata: {
              cardId: cardId,
              uniqueId: uniqueId,
              companyId: data.companyId,
            }
          }
        });
        
        // Make the file publicly accessible
        await file.makePublic();
        
        // Get the public URL
        const publicUrl = `https://storage.googleapis.com/${storage.bucket().name}/${qrCodeFileName}`;
        
        items.push({
          active: false,
          guest: '',
          nrUsed: 0,
          qrCode: publicUrl,
          status: 'unused',
          uniqueId: uniqueId,
        });
        
        console.log(`Generated QR code ${i + 1}/${numberOfCards}: ${uniqueId}`);
        
      } catch (error) {
        console.error(`Error generating QR code ${i + 1}:`, error);
        // Fallback to placeholder if QR generation fails
        items.push({
          active: false,
          guest: '',
          nrUsed: 0,
          qrCode: `https://firebasestorage.googleapis.com/v0/b/guestbuddy-test-3b36d.firebasestorage.app/o/companies/${data.companyId}/cards/${cardId}/qrcodes/${uniqueId}.png?alt=media&token=placeholder`,
          status: 'unused',
          uniqueId: uniqueId,
        });
      }
    }

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
      
      for (let i = 0; i < cardsToAdd; i++) {
        const uniqueId = uuidv4();
        
        try {
          // Generate QR code as data URL
          const qrCodeDataUrl = await QRCode.toDataURL(uniqueId, {
            errorCorrectionLevel: 'M',
            type: 'image/png',
            margin: 1,
          });
          
          // Convert data URL to buffer
          const base64Data = qrCodeDataUrl.replace(/^data:image\/png;base64,/, '');
          const qrCodeBuffer = Buffer.from(base64Data, 'base64');
          
          // Upload to Firebase Storage
          const qrCodeFileName = `companies/${data.companyId}/cards/${data.cardId}/qrcodes/${uniqueId}.png`;
          const file = storage.bucket().file(qrCodeFileName);
          
          await file.save(qrCodeBuffer, {
            metadata: {
              contentType: 'image/png',
              metadata: {
                cardId: data.cardId,
                uniqueId: uniqueId,
                companyId: data.companyId,
              }
            }
          });
          
          // Make the file publicly accessible
          await file.makePublic();
          
          // Get the public URL
          const publicUrl = `https://storage.googleapis.com/${storage.bucket().name}/${qrCodeFileName}`;
          
          additionalCards.push({
            active: false,
            guest: '',
            nrUsed: 0,
            qrCode: publicUrl,
            status: 'unused',
            uniqueId: uniqueId,
          });
          
          console.log(`Generated additional QR code ${i + 1}/${cardsToAdd}: ${uniqueId}`);
          
        } catch (error) {
          console.error(`Error generating additional QR code ${i + 1}:`, error);
          // Fallback to placeholder if QR generation fails
          additionalCards.push({
            active: false,
            guest: '',
            nrUsed: 0,
            qrCode: `https://firebasestorage.googleapis.com/v0/b/guestbuddy-test-3b36d.firebasestorage.app/o/companies/${data.companyId}/cards/${data.cardId}/qrcodes/${uniqueId}.png?alt=media&token=placeholder`,
            status: 'unused',
            uniqueId: uniqueId,
          });
        }
      }
      
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

    // Clean up QR code images from Firebase Storage
    console.log(`Cleaning up ${itemsCount} QR code images from Firebase Storage...`);
    let deletedFilesCount = 0;
    
    try {
      for (const item of items) {
        if (item.uniqueId && item.qrCode) {
          try {
            // Extract the file path from the QR code URL
            const qrCodeUrl = item.qrCode;
            let filePath = '';
            
            // Handle different URL formats
            if (qrCodeUrl.includes('storage.googleapis.com')) {
              // URL format: https://storage.googleapis.com/bucket-name/path/to/file
              const urlParts = qrCodeUrl.split('/');
              const bucketNameIndex = urlParts.findIndex((part: string) => part === 'storage.googleapis.com') + 1;
              if (bucketNameIndex < urlParts.length) {
                filePath = urlParts.slice(bucketNameIndex + 1).join('/');
              }
            } else if (qrCodeUrl.includes('firebasestorage.googleapis.com')) {
              // URL format: https://firebasestorage.googleapis.com/v0/b/bucket-name/o/path%2Fto%2Ffile?alt=media&token=...
              const match = qrCodeUrl.match(/\/o\/([^?]+)/);
              if (match) {
                filePath = decodeURIComponent(match[1]);
              }
            }
            
            if (filePath) {
              // Delete the QR code file from Firebase Storage
              const file = storage.bucket().file(filePath);
              await file.delete();
              deletedFilesCount++;
              console.log(`Deleted QR code file: ${filePath}`);
            } else {
              console.log(`Could not extract file path from URL: ${qrCodeUrl}`);
            }
          } catch (fileError) {
            console.error(`Error deleting QR code file for item ${item.uniqueId}:`, fileError);
            // Continue with other files even if one fails
          }
        }
      }
      
      console.log(`Successfully deleted ${deletedFilesCount} QR code files from Firebase Storage`);
    } catch (storageError) {
      console.error('Error during Firebase Storage cleanup:', storageError);
      // Continue with deletion even if storage cleanup fails
    }

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
        qrCodeFilesDeleted: deletedFilesCount,
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

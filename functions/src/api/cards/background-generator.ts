import {onCall} from "firebase-functions/v2/https";
import {getFirestore, FieldValue} from "firebase-admin/firestore";
import {getStorage} from "firebase-admin/storage";
import {v4 as uuidv4} from "uuid";
import * as QRCode from "qrcode";

// Get Firestore and Storage instances
const db = getFirestore();
const storage = getStorage();

interface CardItem {
  active: boolean;
  guest: string;
  nrUsed: number;
  qrCode: string;
  status: string;
  uniqueId: string;
}

/**
 * Generate a single card with QR code
 */
async function generateSingleCard(companyId: string, cardId: string, cardNumber: number, totalCards: number): Promise<CardItem> {
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
    const qrCodeFileName = `companies/${companyId}/cards/${cardId}/qrcodes/${uniqueId}.png`;
    const file = storage.bucket().file(qrCodeFileName);
    
    await file.save(qrCodeBuffer, {
      metadata: {
        contentType: 'image/png',
        metadata: {
          cardId: cardId,
          uniqueId: uniqueId,
          companyId: companyId,
        }
      }
    });
    
    // Make the file publicly accessible
    await file.makePublic();
    
    // Get the public URL
    const publicUrl = `https://storage.googleapis.com/${storage.bucket().name}/${qrCodeFileName}`;
    
    console.log(`Generated QR code ${cardNumber}/${totalCards}: ${uniqueId}`);
    
    return {
      active: false,
      guest: '',
      nrUsed: 0,
      qrCode: publicUrl,
      status: 'unused',
      uniqueId: uniqueId,
    };
    
  } catch (error) {
    console.error(`Error generating QR code ${cardNumber}:`, error);
    // Fallback to placeholder if QR generation fails
    return {
      active: false,
      guest: '',
      nrUsed: 0,
      qrCode: `https://firebasestorage.googleapis.com/v0/b/guestbuddy-test-3b36d.firebasestorage.app/o/companies/${companyId}/cards/${cardId}/qrcodes/${uniqueId}.png?alt=media&token=placeholder`,
      status: 'unused',
      uniqueId: uniqueId,
    };
  }
}

/**
 * Generate cards in background for large numbers
 */
export const generateCardsInBackground = onCall({
  enforceAppCheck: false,
  timeoutSeconds: 540, // 9 minutes timeout
  memory: "1GiB", // More memory for large operations
}, async (request) => {
  try {
    console.log('🚀 generateCardsInBackground STARTED');
    
    const { companyId, cardId, totalCards, cardTitle, userName, existingItems = [] } = request.data;
    
    console.log(`Starting background generation of ${totalCards} cards for ${cardId}`);
    
    const cardRef = db.collection('companies')
      .doc(companyId)
      .collection('cards')
      .doc(cardId);
    
    const batchSize = 25; // Process 25 cards at a time
    let generatedCount = 0;
    const allItems = [...existingItems]; // Start with existing items
    
    try {
      for (let batchStart = 0; batchStart < totalCards; batchStart += batchSize) {
        const batchEnd = Math.min(batchStart + batchSize, totalCards);
        const batchPromises: Promise<CardItem>[] = [];
        
        console.log(`Background batch ${Math.floor(batchStart / batchSize) + 1}: generating cards ${batchStart + 1}-${batchEnd}`);
        
        for (let i = batchStart; i < batchEnd; i++) {
          batchPromises.push(generateSingleCard(companyId, cardId, existingItems.length + i + 1, existingItems.length + totalCards));
        }
        
        // Wait for this batch to complete
        const batchResults = await Promise.all(batchPromises);
        allItems.push(...batchResults);
        generatedCount += batchResults.length;
        
        // Update progress in database
        await cardRef.update({
          items: allItems,
          cardsGenerated: existingItems.length + generatedCount,
          generationStatus: generatedCount >= totalCards ? 'completed' : 'in_progress',
          lastUpdated: FieldValue.serverTimestamp(),
        });
        
        console.log(`Background batch completed: ${generatedCount}/${totalCards} cards generated`);
        
        // Small delay between batches to prevent overwhelming the system
        if (generatedCount < totalCards) {
          await new Promise(resolve => setTimeout(resolve, 500)); // 0.5 second delay
        }
      }
      
      // Final update
      await cardRef.update({
        generationStatus: 'completed',
        completedAt: FieldValue.serverTimestamp(),
      });
      
      // Log completion
      await db.collection('companies')
        .doc(companyId)
        .collection('activityLogs')
        .add({
          action: 'club_card_generation_completed',
          cardId: cardId,
          cardTitle: cardTitle,
          totalCardsGenerated: generatedCount,
          completedBy: userName,
          timestamp: FieldValue.serverTimestamp(),
        });
      
      console.log(`✅ Background generation completed: ${generatedCount} cards generated for ${cardId}`);
      
      return {
        success: true,
        message: `Successfully generated ${generatedCount} cards`,
        data: {
          cardId: cardId,
          totalCardsGenerated: generatedCount,
          generationStatus: 'completed',
        }
      };
      
    } catch (error) {
      console.error(`Error in background generation for ${cardId}:`, error);
      
      // Update status to failed
      await cardRef.update({
        generationStatus: 'failed',
        error: (error as Error).message,
        failedAt: FieldValue.serverTimestamp(),
      });
      
      // Log failure
      await db.collection('companies')
        .doc(companyId)
        .collection('activityLogs')
        .add({
          action: 'club_card_generation_failed',
          cardId: cardId,
          cardTitle: cardTitle,
          error: (error as Error).message,
          failedBy: userName,
          timestamp: FieldValue.serverTimestamp(),
        });
      
      return {
        success: false,
        error: `Background generation failed: ${(error as Error).message}`,
      };
    }
    
  } catch (error) {
    console.error("Error in generateCardsInBackground:", error);
    return {
      success: false,
      error: `Failed to start background generation: ${(error as Error).message}`,
    };
  }
});

import {onCall} from "firebase-functions/v2/https";
import {defineSecret} from "firebase-functions/params";
import {getFirestore, FieldValue} from "firebase-admin/firestore";
import * as Joi from "joi";
import axios from "axios";

// Define secrets for 46elks API credentials
const elksApiUsername = defineSecret("ELKS_API_USERNAME");
const elksApiPassword = defineSecret("ELKS_API_PASSWORD");

// Get Firestore instance
const db = getFirestore();

// Validation schema for SMS notification
const sendSmsNotificationSchema = Joi.object({
  companyId: Joi.string().required(),
  eventId: Joi.string().required(),
  phoneNumber: Joi.string().required().pattern(/^\+[1-9]\d{1,14}$/), // E.164 format
  guestName: Joi.string().required(),
  tableName: Joi.string().required(),
  notificationType: Joi.string().valid('confirmation', 'reminder').required(),
  message: Joi.string().required().min(1), // Custom message from user, can be longer than 160 chars
  // Optional fields for different notification types
  eventName: Joi.string().optional(),
  eventDateTime: Joi.string().optional(), // ISO string
  timeFrom: Joi.string().optional(),
  reminderTime: Joi.string().optional(), // ISO string for scheduled reminders
});

// Type definitions
interface SendSmsNotificationData {
  companyId: string;
  eventId: string;
  phoneNumber: string;
  guestName: string;
  tableName: string;
  notificationType: 'confirmation' | 'reminder';
  message: string; // Custom message from user
  eventName?: string;
  eventDateTime?: string;
  timeFrom?: string;
  reminderTime?: string;
}



/**
 * Send SMS notification for booking confirmation or reminder
 * This function handles:
 * 1. Sending custom SMS messages provided by the user
 * 2. Scheduling reminders for future delivery
 * 3. Storing SMS notification records in the database
 * 
 * The message content is provided by the user to allow company-specific customization
 */
export const sendSmsNotification = onCall({
  enforceAppCheck: false,
  secrets: [elksApiUsername, elksApiPassword],
}, async (request) => {
  try {
    // Check if caller is authenticated
    if (!request.auth) {
      return {
        success: false,
        error: "Unauthorized",
      };
    }

    const data = request.data as SendSmsNotificationData;

    // Validate input data
    const {error} = sendSmsNotificationSchema.validate(data);
    if (error) {
      return {
        success: false,
        error: `Validation error: ${error.message}`,
      };
    }


    // Use the custom message provided by the user
    const message = data.message;
    let scheduledFor: Date | undefined;

    // If reminderTime is provided, schedule for that time
    if (data.notificationType === 'reminder' && data.reminderTime) {
      scheduledFor = new Date(data.reminderTime);
    }

    // Create SMS notification record
    const smsData: any = {
      companyId: data.companyId,
      eventId: data.eventId,
      phoneNumber: data.phoneNumber,
      guestName: data.guestName,
      tableName: data.tableName,
      notificationType: data.notificationType,
      message: message,
      status: scheduledFor ? 'pending' : 'sent',
      createdAt: FieldValue.serverTimestamp(),
    };

    // Only add scheduledFor if it has a value
    if (scheduledFor) {
      smsData.scheduledFor = scheduledFor;
    } else {
      smsData.sentAt = FieldValue.serverTimestamp();
    }

    // Save SMS notification to database
    const smsRef = await db.collection('companies')
      .doc(data.companyId)
      .collection('smsNotifications')
      .add(smsData);

    // If this is an immediate notification, attempt to send it
    if (!scheduledFor) {
      try {
        // Check if 46elks credentials are configured
        const username = elksApiUsername.value();
        const password = elksApiPassword.value();
        
        if (!username || !password) {
          throw new Error("46elks API credentials not configured");
        }

        // Get company details for sender ID
        const companyDoc = await db.collection('companies')
          .doc(data.companyId)
          .get();

        if (!companyDoc.exists) {
          throw new Error("Company not found");
        }

        const companyData = companyDoc.data();
        const senderId = companyData?.smsSenderId || 'GuestBuddy';

        // Prepare SMS request data
        const smsRequestData = {
          to: data.phoneNumber,
          from: senderId,
          message: message,
        };

        console.log('Sending SMS with data:', {
          to: data.phoneNumber,
          from: senderId,
          messageLength: message.length,
          username: username ? 'configured' : 'not configured',
          password: password ? 'configured' : 'not configured',
        });

        // Send SMS using 46elks API
        const smsResponse = await axios.post('https://api.46elks.com/a1/sms', smsRequestData, {
          auth: {
            username: username,
            password: password,
          },
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        });

        console.log('SMS sent successfully:', smsResponse.data);
        
        // Extract SMS parts information from 46elks response
        const smsParts = smsResponse.data?.parts || 1;
        const totalSmsCount = smsResponse.data?.total_cost ? Math.ceil(smsResponse.data.total_cost / 0.045) : 1; // Estimate based on cost
        
        // Update status to sent with SMS parts info
        const updateData: any = {
          status: 'sent',
          sentAt: FieldValue.serverTimestamp(),
          smsParts: smsParts,
          totalSmsCount: totalSmsCount,
        };
        
        await smsRef.update(updateData);

      } catch (smsError) {
        console.error('Error sending SMS:', smsError);
        
        // Get more detailed error information
        let errorMessage = 'Unknown SMS error';
        if (smsError instanceof Error) {
          errorMessage = smsError.message;
        } else if (typeof smsError === 'object' && smsError !== null) {
          // Handle axios error response
          if ('response' in smsError && smsError.response) {
            const response = smsError.response as any;
            errorMessage = `SMS API Error: ${response.status} - ${response.statusText}`;
            if (response.data) {
              errorMessage += ` - ${JSON.stringify(response.data)}`;
            }
          } else if ('request' in smsError) {
            errorMessage = 'SMS API request failed - no response received';
          } else {
            errorMessage = JSON.stringify(smsError);
          }
        }
        
        // Update status to failed
        const updateData: any = {
          status: 'failed',
          errorMessage: errorMessage,
        };
        
        await smsRef.update(updateData);

        return {
          success: false,
          error: `Failed to send SMS notification: ${errorMessage}`,
        };
      }
    }


    // Get the SMS document data for response
    const smsDoc = await smsRef.get();
    const smsDocData = smsDoc.data();

    // Prepare response data
    const responseData: any = {
      smsId: smsRef.id,
      phoneNumber: data.phoneNumber,
      guestName: data.guestName,
      tableName: data.tableName,
      notificationType: data.notificationType,
      message: message,
      status: scheduledFor ? 'pending' : 'sent',
    };

    // Only add fields that have values
    if (scheduledFor) {
      responseData.scheduledFor = scheduledFor.toISOString();
    } else {
      responseData.smsParts = smsDocData?.smsParts || 1;
      responseData.totalSmsCount = smsDocData?.totalSmsCount || 1;
    }

    return {
      success: true,
      message: data.notificationType === 'confirmation' 
        ? "SMS confirmation sent successfully"
        : scheduledFor 
          ? "SMS reminder scheduled successfully"
          : "SMS reminder sent successfully",
      data: responseData,
    };

  } catch (error: any) {
    console.error("Error sending SMS notification:", error);
    
    // Get more detailed error information
    let errorMessage = 'Unknown error occurred';
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'object' && error !== null) {
      errorMessage = JSON.stringify(error);
    }
    
    return {
      success: false,
      error: `Failed to send SMS notification: ${errorMessage}`,
    };
  }
});

// Note: For scheduling reminders, use sendSmsNotification with notificationType: 'reminder' and reminderTime 
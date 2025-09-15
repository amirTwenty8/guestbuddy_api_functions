import {onCall} from "firebase-functions/v2/https";
import {getAuth} from "firebase-admin/auth";
import {getFirestore, FieldValue} from "firebase-admin/firestore";
import {getStorage} from "firebase-admin/storage";
import * as Joi from "joi";
import {v4 as uuidv4} from "uuid";
import {defineSecret} from "firebase-functions/params";
import {sendVerificationEmail} from "../../utils/email-service";

// Define secrets
const smtpUser = defineSecret("SMTP_USER");
const smtpPass = defineSecret("SMTP_PASS");
const smtpHost = defineSecret("SMTP_HOST");
const smtpPort = defineSecret("SMTP_PORT");

// Get Auth, Firestore, and Storage instances
const auth = getAuth();
const db = getFirestore();
const storage = getStorage();

// Validation schema for company creation with admin
const createCompanyWithAdminSchema = Joi.object({
  // Company Information
  companyName: Joi.string().required().min(1).max(100),
  imageUrl: Joi.string().optional().allow(''), // Will be Firebase Storage URL
  venueImages: Joi.array().items(Joi.string()).optional().default([]), // Array of Firebase Storage URLs
  address: Joi.string().required().min(1).max(200),
  companyNumber: Joi.string().required().min(1).max(50), // VAT number
  country: Joi.string().required().min(1).max(100),
  description: Joi.string().optional().allow('').max(500),
  website: Joi.string().uri().optional().allow(''),
  
  // Admin User Information
  userFirstName: Joi.string().required().min(1).max(50),
  userLastName: Joi.string().required().min(1).max(50),
  userEmail: Joi.string().email().required(),
  phoneNumber: Joi.string().required().min(8).max(20), // Flexible phone number format
  birthDate: Joi.string().required().pattern(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD format
  city: Joi.string().required().min(1).max(100),
  password: Joi.string().required().min(8).max(128),
  
  // Terms
  terms: Joi.boolean().required().valid(true),
});

// Type definitions
interface CreateCompanyWithAdminData {
  // Company Information
  companyName: string;
  imageUrl?: string; // Firebase Storage URL for company logo
  venueImages?: string[]; // Array of Firebase Storage URLs for venue images
  address: string;
  companyNumber: string;
  country: string;
  description?: string;
  website?: string;
  
  // Admin User Information
  userFirstName: string;
  userLastName: string;
  userEmail: string;
  phoneNumber: string;
  birthDate: string;
  city: string;
  password: string;
  terms: boolean;
}

interface CompanyData {
  companyName: string;
  imageUrl: string;
  slug: string;
  currency: string;
  admins: string[];
  editors: string[];
  promotors: string[];
  staff: string[];
  tableStaff: string[];
  address: string;
  activeCustomer: boolean;
  companyNumber: string;
  country: string;
  description: string;
  openHours: Record<string, any>;
  venueImages: string[];
  website: string;
  createdAt: FieldValue;
  updatedAt: FieldValue;
}

interface UserData {
  businessMode: boolean;
  companyId: string[];
  e164Number: string;
  phoneNumber: string;
  userActive: boolean;
  userEmail: string;
  userFirstName: string;
  userLastName: string;
  birthDate: string;
  country: string;
  city: string;
  emailVerified: boolean;
  createdAt: FieldValue;
  updatedAt: FieldValue;
}

/**
 * Generate a short, readable company ID
 */
function generateCompanyId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 20; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Generate a random 6-digit verification code
 */
function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Create a verification code document in Firestore
 */
async function createVerificationCode(email: string, userId: string): Promise<string> {
  const code = generateVerificationCode();
  
  // Calculate expiration time (10 minutes from now)
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 10 * 60 * 1000); // 10 minutes in milliseconds
  
  const verificationCodeData = {
    code,
    email,
    userId,
    createdAt: FieldValue.serverTimestamp(),
    expiresAt: expiresAt, // Use calculated date, not serverTimestamp
    used: false,
  };
  
  // Store in verification_codes collection
  const verificationCodeRef = db.collection('verification_codes').doc(uuidv4());
  await verificationCodeRef.set(verificationCodeData);
  
  return code;
}

/**
 * Generate slug from company name
 */
function generateSlug(companyName: string): string {
  return companyName
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .trim();
}

/**
 * Upload image to Firebase Storage and return download URL
 */
async function uploadImageToStorage(
  imageData: string, // Base64 encoded image data
  path: string, // Storage path (e.g., 'companies/logos/image.jpg')
  contentType: string = 'image/jpeg'
): Promise<string> {
  try {
    // Convert base64 to buffer
    const imageBuffer = Buffer.from(imageData, 'base64');
    
    // Create file reference
    const file = storage.bucket().file(path);
    
    // Upload file
    await file.save(imageBuffer, {
      metadata: {
        contentType: contentType,
      },
    });
    
    // Make file public and get download URL
    await file.makePublic();
    
    // Return public URL
    return `https://storage.googleapis.com/${storage.bucket().name}/${path}`;
  } catch (error) {
    console.error('Error uploading image to storage:', error);
    throw new Error('Failed to upload image');
  }
}

/**
 * Format phone number to E.164 and local format
 */
function formatPhoneNumber(phoneNumber: string, country: string): {e164Number: string, localNumber: string} {
  // Remove any spaces, dashes, or parentheses
  let cleanNumber = phoneNumber.replace(/[\s\-\(\)]/g, '');
  
  // Define country calling codes
  const countryCallingCodes: Record<string, string> = {
    'Sweden': '+46',
    'Norway': '+47',
    'Denmark': '+45',
    'Finland': '+358',
    'United States': '+1',
    'United Kingdom': '+44',
    'Germany': '+49',
    'France': '+33',
    'Spain': '+34',
    'Italy': '+39',
    'Netherlands': '+31',
    'Belgium': '+32',
    'Austria': '+43',
    'Portugal': '+351',
    'Ireland': '+353',
    'Luxembourg': '+352',
    'Canada': '+1',
    'Australia': '+61',
    'Japan': '+81',
    'China': '+86',
    'India': '+91',
    'Brazil': '+55',
    'Mexico': '+52',
    'South Korea': '+82',
    'Singapore': '+65',
    'Hong Kong': '+852',
    'Switzerland': '+41',
    'New Zealand': '+64',
    'South Africa': '+27',
  };

  const countryCode = countryCallingCodes[country];
  
  if (cleanNumber.startsWith('+')) {
    // Already in E.164 format
    const e164Number = cleanNumber;
    
    // Extract local number (remove country code and add 0)
    if (countryCode && cleanNumber.startsWith(countryCode)) {
      const localNumber = '0' + cleanNumber.substring(countryCode.length);
      return { e164Number, localNumber };
    } else {
      // If country code doesn't match, return as is for local
      const localNumber = cleanNumber.startsWith('+') ? cleanNumber.substring(1) : cleanNumber;
      return { e164Number, localNumber };
    }
  } else {
    // Local format, need to add country code
    if (countryCode) {
      // Remove leading 0 if present before adding country code
      const numberWithoutZero = cleanNumber.startsWith('0') ? cleanNumber.substring(1) : cleanNumber;
      const e164Number = countryCode + numberWithoutZero;
      const localNumber = cleanNumber.startsWith('0') ? cleanNumber : '0' + cleanNumber;
      return { e164Number, localNumber };
    } else {
      // If country not found, assume it's already in the right format
      const e164Number = '+' + cleanNumber;
      const localNumber = cleanNumber.startsWith('0') ? cleanNumber : '0' + cleanNumber;
      return { e164Number, localNumber };
    }
  }
}

/**
 * Get currency based on country
 */
function getCurrencyByCountry(country: string): string {
  const currencyMap: Record<string, string> = {
    'Sweden': 'SEK',
    'Norway': 'NOK',
    'Denmark': 'DKK',
    'Finland': 'EUR',
    'United States': 'USD',
    'United Kingdom': 'GBP',
    'Germany': 'EUR',
    'France': 'EUR',
    'Spain': 'EUR',
    'Italy': 'EUR',
    'Netherlands': 'EUR',
    'Belgium': 'EUR',
    'Austria': 'EUR',
    'Portugal': 'EUR',
    'Ireland': 'EUR',
    'Luxembourg': 'EUR',
    'Canada': 'CAD',
    'Australia': 'AUD',
    'Japan': 'JPY',
    'China': 'CNY',
    'India': 'INR',
    'Brazil': 'BRL',
    'Mexico': 'MXN',
    'South Korea': 'KRW',
    'Singapore': 'SGD',
    'Hong Kong': 'HKD',
    'Switzerland': 'CHF',
    'New Zealand': 'NZD',
    'South Africa': 'ZAR',
  };
  
  return currencyMap[country] || 'USD'; // Default to USD if country not found
}

/**
 * Create a new company with admin user
 * This function handles:
 * 1. Validating the input data
 * 2. Checking if user already exists
 * 3. Creating or linking user account
 * 4. Creating company with proper field mapping
 * 5. Linking user to company as admin
 */
export const createCompanyWithAdmin = onCall({
  enforceAppCheck: false,
  secrets: [smtpUser, smtpPass, smtpHost, smtpPort],
}, async (request) => {
  try {
    // Validate request data
    const {
      companyName,
      imageUrl,
      venueImages,
      address,
      companyNumber,
      country,
      description,
      website,
      userFirstName,
      userLastName,
      userEmail,
      phoneNumber,
      birthDate,
      city,
      password,
      terms,
    } = request.data as CreateCompanyWithAdminData;

    // Validate input data
    const {error} = createCompanyWithAdminSchema.validate(request.data);
    if (error) {
      return {
        success: false,
        error: `Validation error: ${error.message}`,
      };
    }

    // Check if terms are accepted
    if (!terms) {
      return {
        success: false,
        error: "Terms and conditions must be accepted",
      };
    }

    // Validate age (must be at least 16)
    const birthDateObj = new Date(birthDate);
    const today = new Date();
    const age = today.getFullYear() - birthDateObj.getFullYear();
    const monthDiff = today.getMonth() - birthDateObj.getMonth();
    const dayDiff = today.getDate() - birthDateObj.getDate();
    
    const actualAge = monthDiff < 0 || (monthDiff == 0 && dayDiff < 0) ? age - 1 : age;
    
    if (actualAge < 16) {
      return {
        success: false,
        error: "You must be at least 16 years old to create a company",
      };
    }

    // Check if user already exists
    let userRecord: any = null;
    let isExistingUser = false;
    
    try {
      userRecord = await auth.getUserByEmail(userEmail);
      isExistingUser = true;
    } catch (error: any) {
      if (error.code !== 'auth/user-not-found') {
        throw error;
      }
      // User doesn't exist, we'll create a new one
    }

    // Generate company ID and slug
    const companyId = generateCompanyId();
    const slug = generateSlug(companyName);
    const currency = getCurrencyByCountry(country);
    
    // Format phone number
    const { e164Number, localNumber } = formatPhoneNumber(phoneNumber, country);

    // Handle image uploads (if provided)
    let finalImageUrl = imageUrl || '';
    let finalVenueImages: string[] = venueImages || [];

    // Upload company logo if provided
    if (imageUrl && imageUrl.startsWith('data:image/')) {
      try {
        const logoPath = `companies/logos/${companyId}-logo.jpg`;
        finalImageUrl = await uploadImageToStorage(imageUrl, logoPath);
      } catch (error) {
        console.error('Error uploading company logo:', error);
        return {
          success: false,
          error: "Failed to upload company logo",
        };
      }
    }

    // Upload venue images if provided
    if (venueImages && venueImages.length > 0) {
      try {
        finalVenueImages = [];
        for (let i = 0; i < venueImages.length; i++) {
          const venueImage = venueImages[i];
          if (venueImage.startsWith('data:image/')) {
            const venuePath = `companies/${companyId}/venueImages/venue-${i + 1}.jpg`;
            const uploadedUrl = await uploadImageToStorage(venueImage, venuePath);
            finalVenueImages.push(uploadedUrl);
          } else {
            // If it's already a URL, keep it as is
            finalVenueImages.push(venueImage);
          }
        }
      } catch (error) {
        console.error('Error uploading venue images:', error);
        return {
          success: false,
          error: "Failed to upload venue images",
        };
      }
    }

    // Use Firestore transaction for atomicity
    const result = await db.runTransaction(async (transaction) => {
      let userId: string;
      let userData: UserData;

      if (isExistingUser && userRecord) {
        // User exists, get their data and add company
        userId = userRecord.uid;
        const userDoc = await transaction.get(db.collection('users').doc(userId));
        
        if (!userDoc.exists) {
          throw new Error("User exists in Auth but not in Firestore");
        }
        
        const existingUserData = userDoc.data() as UserData;
        userData = {
          ...existingUserData,
          companyId: [...(existingUserData.companyId || []), companyId],
          businessMode: true, // Enable business mode
          userActive: true, // Activate user
          updatedAt: FieldValue.serverTimestamp(),
        };
        
        transaction.update(db.collection('users').doc(userId), userData as any);
      } else {
        // Create new user
        userId = uuidv4(); // Generate UUID for user document
        
        await auth.createUser({
          uid: userId, // Use the UUID as the Firebase Auth UID
          email: userEmail,
          password: password,
          displayName: `${userFirstName} ${userLastName}`,
          phoneNumber: e164Number,
          emailVerified: false,
        });

        // Prepare user data for Firestore
        userData = {
          businessMode: true,
          companyId: [companyId],
          e164Number: e164Number,
          phoneNumber: localNumber,
          userActive: true,
          userEmail: userEmail,
          userFirstName: userFirstName,
          userLastName: userLastName,
          birthDate: birthDate,
          country: country,
          city: city,
          emailVerified: false,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        };
        
        transaction.set(db.collection('users').doc(userId), userData as any);
      }

      // Create company data
      const companyData: CompanyData = {
        companyName: companyName,
        imageUrl: finalImageUrl,
        slug: slug,
        currency: currency,
        admins: [userId], // Add user as admin
        editors: [],
        promotors: [],
        staff: [],
        tableStaff: [],
        address: address,
        activeCustomer: false,
        companyNumber: companyNumber,
        country: country,
        description: description || '',
        openHours: {},
        venueImages: finalVenueImages,
        website: website || '',
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      };

      // Create company document
      transaction.set(db.collection('companies').doc(companyId), companyData);

      return {
        companyId,
        userId,
        isExistingUser,
      };
    });

    // Send email verification for new users
    let emailSent = false;
    let verificationCode = '';
    if (!result.isExistingUser) {
      try {
        // Generate and store verification code
        verificationCode = await createVerificationCode(userEmail, result.userId);
        console.log(`Generated verification code: ${verificationCode}`);
        
        // Send verification email with 6-digit code
        const userName = `${userFirstName} ${userLastName}`;
        emailSent = await sendVerificationEmail(
          userEmail, 
          verificationCode, 
          userName
        );
        
        console.log(`Verification email sent to ${userEmail}: ${emailSent ? 'Success' : 'Failed'}`);
      } catch (emailError) {
        console.error('Error sending verification email:', emailError);
        // Don't fail the entire operation if email sending fails
      }
    }

    return {
      success: true,
      message: isExistingUser 
        ? "Company created successfully and linked to existing user account"
        : emailSent 
          ? "Company and user account created successfully. Please check your email for the 6-digit verification code."
          : "Company and user account created successfully, but there was an issue sending the verification email. Please try the resend option.",
      data: {
        companyId: result.companyId,
        userId: result.userId,
        isExistingUser: result.isExistingUser,
        companyName: companyName,
        userEmail: userEmail,
        slug: slug,
        currency: currency,
        emailVerificationSent: emailSent,
        verificationCode: !result.isExistingUser ? verificationCode : undefined, // Include verification code for new users
      },
    };

  } catch (error: any) {
    console.error("Error creating company with admin:", error);
    
    // Handle specific Firebase Auth errors
    if (error.code === 'auth/email-already-exists') {
      return {
        success: false,
        error: "An account with this email already exists",
      };
    }
    
    if (error.code === 'auth/weak-password') {
      return {
        success: false,
        error: "Password is too weak. Please choose a stronger password",
      };
    }
    
    if (error.code === 'auth/invalid-email') {
      return {
        success: false,
        error: "Invalid email address format",
      };
    }

    return {
      success: false,
      error: "Failed to create company. Please try again.",
    };
  }
});

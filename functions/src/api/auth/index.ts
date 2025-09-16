import {onCall} from "firebase-functions/v2/https";
import {getAuth} from "firebase-admin/auth";
import {getFirestore, FieldValue, Timestamp} from "firebase-admin/firestore";
import * as Joi from "joi";
import {v4 as uuidv4} from "uuid";
import {defineSecret} from "firebase-functions/params";
import {sendVerificationEmail, sendResendVerificationEmail} from "../../utils/email-service";

// Define secrets
const smtpUser = defineSecret("SMTP_USER");
const smtpPass = defineSecret("SMTP_PASS");
const smtpHost = defineSecret("SMTP_HOST");
const smtpPort = defineSecret("SMTP_PORT");

// Get Auth and Firestore instances
const auth = getAuth();
const db = getFirestore();

// Validation schema for account creation
const createAccountSchema = Joi.object({
  firstName: Joi.string().required().min(1).max(50),
  lastName: Joi.string().required().min(1).max(50),
  email: Joi.string().email().required(),
  phoneNumber: Joi.string().required().pattern(/^\+[1-9]\d{1,14}$/), // E.164 format
  birthDate: Joi.string().required().pattern(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD format
  country: Joi.string().required().min(1).max(100),
  city: Joi.string().required().min(1).max(100),
  password: Joi.string().required().min(8).max(128),
  terms: Joi.boolean().required().valid(true), // Must accept terms
});

// Validation schema for email verification
const verifyEmailSchema = Joi.object({
  email: Joi.string().email().required(),
  verificationCode: Joi.string().required().length(6).pattern(/^\d{6}$/), // 6 digits only
});

// Validation schema for resend verification email
const resendVerificationEmailSchema = Joi.object({
  email: Joi.string().email().required(),
});

// Validation schema for checking email existence
const checkEmailExistsSchema = Joi.object({
  email: Joi.string().email().required(),
});

// Type definitions
interface CreateAccountData {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  birthDate: string;
  country: string;
  city: string;
  password: string;
  terms: boolean;
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
  terms: boolean;
  emailVerified: boolean;
  createdAt: FieldValue;
  updatedAt: FieldValue;
}

interface VerifyEmailData {
  email: string;
  verificationCode: string;
}

interface ResendVerificationEmailData {
  email: string;
}

interface CheckEmailExistsData {
  email: string;
}

interface VerificationCodeData {
  code: string;
  email: string;
  userId: string;
  createdAt: FieldValue;
  expiresAt: FieldValue;
  used: boolean;
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
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + 10);
  
  const verificationCodeData: VerificationCodeData = {
    code,
    email,
    userId,
    createdAt: FieldValue.serverTimestamp(),
    expiresAt: Timestamp.fromDate(expiresAt),
    used: false,
  };
  
  // Store in verification_codes collection
  const verificationCodeRef = db.collection('verification_codes').doc(uuidv4());
  await verificationCodeRef.set(verificationCodeData);
  
  return code;
}

/**
 * Validate a verification code
 */
async function validateVerificationCode(email: string, code: string): Promise<{valid: boolean; userId?: string; error?: string}> {
  try {
    console.log(`validateVerificationCode called with email: ${email}, code: ${code}`);
    
    // Query for the verification code - using a simpler query to avoid composite index requirements
    const verificationCodesRef = db.collection('verification_codes');
    const query = verificationCodesRef
      .where('email', '==', email)
      .where('code', '==', code)
      .limit(100); // Get all potential matches and filter in code
    
    console.log(`Executing Firestore query for verification codes`);
    const snapshot = await query.get();
    
    console.log(`Query returned ${snapshot.size} results`);
    
    if (snapshot.empty) {
      console.log(`No verification codes found for email: ${email}, code: ${code}`);
      return {valid: false, error: "Invalid verification code"};
    }
    
    // Find the most recent, unused verification code
    let validDoc = null;
    let latestTimestamp = new Date(0); // Start with oldest possible date
    
    console.log(`Processing ${snapshot.size} verification codes to find the most recent valid one`);
    
    for (const doc of snapshot.docs) {
      const data = doc.data() as VerificationCodeData;
      console.log(`Checking verification code document:`, {
        id: doc.id,
        email: data.email,
        code: data.code,
        used: data.used,
        userId: data.userId
      });
      
      // Skip if already used
      if (data.used === true) {
        console.log(`Skipping used verification code: ${doc.id}`);
        continue;
      }
      
      // Get timestamp
      const createdAt = data.createdAt as any;
      if (!createdAt) {
        console.log(`No createdAt timestamp for code: ${doc.id}`);
        continue;
      }
      
      const timestamp = createdAt.toDate();
      console.log(`Code ${doc.id} created at: ${timestamp.toISOString()}`);
      
      // Keep track of the most recent one
      if (timestamp > latestTimestamp) {
        console.log(`Found more recent code: ${doc.id}`);
        latestTimestamp = timestamp;
        validDoc = doc;
      }
    }
    
    if (!validDoc) {
      console.log(`No valid verification code found after processing all documents`);
      return {valid: false, error: "No valid verification code found"};
    }
    
    const doc = validDoc;
    const data = doc.data() as VerificationCodeData;
    
    // Check if code has expired
    const expiresAt = data.expiresAt as any;
    
    if (!expiresAt) {
      console.log(`No expiresAt field found for code document: ${doc.id}`);
      return {valid: false, error: "Invalid verification code format"};
    }
    
    const expiryDate = expiresAt.toDate();
    const now = new Date();
    console.log(`Code expires at: ${expiryDate.toISOString()}, current time: ${now.toISOString()}`);
    
    if (now > expiryDate) {
      console.log(`Verification code has expired`);
      return {valid: false, error: "Verification code has expired"};
    }
    
    // Mark code as used
    await doc.ref.update({
      used: true,
    });
    
    return {valid: true, userId: data.userId};
  } catch (error) {
    console.error("Error validating verification code:", error);
    return {valid: false, error: "Failed to validate verification code"};
  }
}

/**
 * Clean up expired verification codes
 */
async function cleanupExpiredVerificationCodes(): Promise<void> {
  try {
    const verificationCodesRef = db.collection('verification_codes');
    const cutoffTime = new Date(); // current time
    
    const query = verificationCodesRef
      .where('expiresAt', '<', Timestamp.fromDate(cutoffTime));
    
    const snapshot = await query.get();
    
    const batch = db.batch();
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    if (snapshot.docs.length > 0) {
      await batch.commit();
      console.log(`Cleaned up ${snapshot.docs.length} expired verification codes`);
    }
  } catch (error) {
    console.error("Error cleaning up expired verification codes:", error);
  }
}

/**
 * Verify email with verification code
 * This function handles:
 * 1. Validating the verification code format
 * 2. Checking if the email exists in Firebase Auth
 * 3. Verifying the email using Firebase Auth
 * 4. Updating user data in Firestore if needed
 */
export const verifyEmail = onCall({
  enforceAppCheck: false,
  secrets: [smtpUser, smtpPass, smtpHost, smtpPort],
}, async (request) => {
  try {
    const {email, verificationCode} = request.data as VerifyEmailData;

    // Validate input data
    const {error} = verifyEmailSchema.validate(request.data);
    if (error) {
      return {
        success: false,
        error: `Validation error: ${error.message}`,
      };
    }

    // Find the user by email
    let userRecord;
    try {
      userRecord = await auth.getUserByEmail(email);
    } catch (error: any) {
      if (error.code === 'auth/user-not-found') {
        return {
          success: false,
          error: "Email not found. Please check your email address.",
        };
      }
      throw error;
    }

    // Check if email is already verified
    if (userRecord.emailVerified) {
      return {
        success: true,
        message: "Email is already verified",
        data: {
          email: userRecord.email,
          emailVerified: true,
          uid: userRecord.uid,
        },
      };
    }

    // Validate the verification code
    console.log(`Attempting to validate code for email: ${email}, code: ${verificationCode}`);
    const validationResult = await validateVerificationCode(email, verificationCode);
    
    console.log(`Validation result:`, validationResult);
    
    if (!validationResult.valid) {
      return {
        success: false,
        error: validationResult.error || "Invalid verification code",
      };
    }
    
    // Verify that the user ID matches
    if (validationResult.userId !== userRecord.uid) {
      return {
        success: false,
        error: "Verification code does not match this account",
      };
    }
    
    // Log the successful verification
    console.log(`Email verification successful for ${email} with code: ${verificationCode}`);
    
    // Update the user's email verification status in Firebase Auth
    await auth.updateUser(userRecord.uid, {
      emailVerified: true,
    });

    // Update user data in Firestore to mark as verified
    const userRef = db.collection('users').doc(userRecord.uid);
    await userRef.update({
      userActive: true,
      emailVerified: true,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return {
      success: true,
      message: "Email verified successfully",
      data: {
        email: userRecord.email,
        emailVerified: true,
        uid: userRecord.uid,
      },
    };
  } catch (error) {
    console.error("Error verifying email:", error);
    return {
      success: false,
      error: "Failed to verify email. Please try again.",
    };
  }
});

/**
 * Resend verification email
 * This function handles:
 * 1. Validating the email format
 * 2. Checking if the email exists in Firebase Auth
 * 3. Sending a new verification email
 */
export const resendVerificationEmail = onCall({
  enforceAppCheck: false,
  secrets: [smtpUser, smtpPass, smtpHost, smtpPort],
}, async (request) => {
  try {
    const {email} = request.data as ResendVerificationEmailData;

    // Validate input data
    const {error} = resendVerificationEmailSchema.validate(request.data);
    if (error) {
      return {
        success: false,
        error: `Validation error: ${error.message}`,
      };
    }

    // Find the user by email
    let userRecord;
    try {
      userRecord = await auth.getUserByEmail(email);
    } catch (error: any) {
      if (error.code === 'auth/user-not-found') {
        return {
          success: false,
          error: "Email not found. Please check your email address.",
        };
      }
      throw error;
    }

    // Check if email is already verified
    if (userRecord.emailVerified) {
      return {
        success: true,
        message: "Email is already verified",
        data: {
          email: userRecord.email,
          emailVerified: true,
        },
      };
    }

    // Generate and store a new verification code
    const verificationCode = await createVerificationCode(email, userRecord.uid);
    
    // Get user data to get the name
    const userRef = db.collection('users').doc(userRecord.uid);
    const userDoc = await userRef.get();
    const userData = userDoc.data();
    const userName = userData ? `${userData.userFirstName} ${userData.userLastName}` : 'User';
    
    // Send resend verification email
    const emailSent = await sendResendVerificationEmail(
      email, 
      verificationCode, 
      userName, 
      smtpUser.value(), 
      smtpPass.value(),
      smtpHost.value(),
      smtpPort.value()
    );
    
    // Clean up expired verification codes (background task)
    cleanupExpiredVerificationCodes().catch(error => {
      console.error("Error cleaning up expired verification codes:", error);
    });
    
    return {
      success: true,
      message: emailSent 
        ? "New verification code sent successfully. Please check your email."
        : "There was an issue sending the verification email. Please try again.",
      data: {
        email: userRecord.email,
        emailVerified: false,
        verificationCode: process.env.NODE_ENV === 'development' ? verificationCode : undefined, // Only include in development
        emailSent: emailSent,
      },
    };
  } catch (error) {
    console.error("Error resending verification email:", error);
    return {
      success: false,
      error: "Failed to resend verification email. Please try again.",
    };
  }
});

/**
 * Create a new user account
 * This function handles:
 * 1. Validating the input data
 * 2. Creating a Firebase Auth user
 * 3. Saving additional user data to the users collection
 * 4. Setting up default values for business mode and company associations
 */
export const createAccount = onCall({
  enforceAppCheck: false,
  secrets: [smtpUser, smtpPass, smtpHost, smtpPort],
}, async (request) => {
  try {
    // Validate request data
    const {
      firstName,
      lastName,
      email,
      phoneNumber,
      birthDate,
      country,
      city,
      password,
      terms,
    } = request.data as CreateAccountData;

    // Validate input data
    const {error} = createAccountSchema.validate(request.data);
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
        error: "You must be at least 16 years old to create an account",
      };
    }

    // Check if user already exists in Firebase Auth
    try {
      const existingUser = await auth.getUserByEmail(email);
      if (existingUser) {
        return {
          success: false,
          error: "An account with this email already exists",
        };
      }
    } catch (error: any) {
      // User doesn't exist, which is what we want
      if (error.code !== 'auth/user-not-found') {
        throw error;
      }
    }

    // Check if user already exists in Firestore
    const usersRef = db.collection('users');
    const emailQuery = await usersRef.where('userEmail', '==', email).get();
    
    if (!emailQuery.empty) {
      return {
        success: false,
        error: "An account with this email already exists",
      };
    }

    // Create Firebase Auth user
    const userRecord = await auth.createUser({
      email: email,
      password: password,
      displayName: `${firstName} ${lastName}`,
      phoneNumber: phoneNumber,
      emailVerified: false,
    });

    // Extract local phone number based on country
    const getLocalPhoneNumber = (e164Number: string, country: string): string => {
      // Define country calling codes
      const countryCallingCodes: Record<string, string> = {
        'Albania': '+355',
        'Andorra': '+376',
        'Austria': '+43',
        'Belarus': '+375',
        'Belgium': '+32',
        'Bosnia and Herzegovina': '+387',
        'Bulgaria': '+359',
        'Croatia': '+385',
        'Czech Republic': '+420',
        'Denmark': '+45',
        'Estonia': '+372',
        'Finland': '+358',
        'France': '+33',
        'Germany': '+49',
        'Greece': '+30',
        'Hungary': '+36',
        'Iceland': '+354',
        'Ireland': '+353',
        'Italy': '+39',
        'Latvia': '+371',
        'Liechtenstein': '+423',
        'Lithuania': '+370',
        'Luxembourg': '+352',
        'Malta': '+356',
        'Moldova': '+373',
        'Monaco': '+377',
        'Montenegro': '+382',
        'Netherlands': '+31',
        'North Macedonia': '+389',
        'Norway': '+47',
        'Poland': '+48',
        'Portugal': '+351',
        'Romania': '+40',
        'Russia': '+7',
        'San Marino': '+378',
        'Serbia': '+381',
        'Slovakia': '+421',
        'Slovenia': '+386',
        'Spain': '+34',
        'Sweden': '+46',
        'Switzerland': '+41',
        'Ukraine': '+380',
        'United Kingdom': '+44',
        'Vatican City': '+379',
      };

      const countryCode = countryCallingCodes[country];
      if (!countryCode) {
        // If country not found, return the number without the + prefix
        return e164Number.startsWith('+') ? e164Number.substring(1) : e164Number;
      }

      // Remove the country code and add 0 prefix
      if (e164Number.startsWith(countryCode)) {
        const localNumber = e164Number.substring(countryCode.length);
        return `0${localNumber}`;
      }

      // If the country code doesn't match, return the number without the + prefix
      return e164Number.startsWith('+') ? e164Number.substring(1) : e164Number;
    };

    const localPhoneNumber = getLocalPhoneNumber(phoneNumber, country);

    // Prepare user data for Firestore
    const userData: UserData = {
      businessMode: false, // Default to personal account
      companyId: [], // Empty array by default
      e164Number: phoneNumber, // Full international format
      phoneNumber: localPhoneNumber, // Local format with 0 prefix
      userActive: true,
      userEmail: email,
      userFirstName: firstName,
      userLastName: lastName,
      birthDate: birthDate,
      country: country,
      city: city,
      terms: terms,
      emailVerified: false, // Email not verified initially
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    // Save user data to Firestore using the Firebase Auth UID
    await usersRef.doc(userRecord.uid).set(userData);

    // Generate and store verification code
    const verificationCode = await createVerificationCode(email, userRecord.uid);
    
    // Send verification email
    const userName = `${firstName} ${lastName}`;
    const emailSent = await sendVerificationEmail(
      email, 
      verificationCode, 
      userName, 
      smtpUser.value(), 
      smtpPass.value(),
      smtpHost.value(),
      smtpPort.value()
    );
    
    // Clean up expired verification codes (background task)
    cleanupExpiredVerificationCodes().catch(error => {
      console.error("Error cleaning up expired verification codes:", error);
    });

    return {
      success: true,
      message: emailSent 
        ? "Account created successfully. Please check your email for verification code."
        : "Account created successfully, but there was an issue sending the verification email. Please try the resend option.",
      data: {
        userId: userRecord.uid,
        email: userRecord.email,
        displayName: userRecord.displayName,
        verificationCode: process.env.NODE_ENV === 'development' ? verificationCode : undefined, // Only include in development
        emailSent: emailSent,
      },
    };
  } catch (error: any) {
    console.error("Error creating account:", error);
    
    // Handle specific Firebase Auth errors
    if (error.code === 'auth/email-already-exists') {
      return {
        success: false,
        error: "An account with this email already exists",
      };
    } else if (error.code === 'auth/invalid-email') {
      return {
        success: false,
        error: "Invalid email address",
      };
    } else if (error.code === 'auth/weak-password') {
      return {
        success: false,
        error: "Password is too weak. Please choose a stronger password",
      };
    } else if (error.code === 'auth/invalid-phone-number') {
      return {
        success: false,
        error: "Invalid phone number format",
      };
    }
    
    return {
      success: false,
      error: "Failed to create account. Please try again.",
    };
  }
});

/**
 * Verify authentication token
 * This function verifies that a token is valid
 * Useful for client applications to check auth status
 */
export const verifyToken = onCall({enforceAppCheck: true}, async (request) => {
  try {
    // Check if token exists
    if (!request.auth) {
      return {
        success: false,
        error: "No authentication token provided",
      };
    }

    // Token is already verified by Firebase at this point
    // Just return the user data
    return {
      success: true,
      data: {
        uid: request.auth.uid,
        email: request.auth.token.email,
        emailVerified: request.auth.token.email_verified,
        displayName: request.auth.token.name,
        photoURL: request.auth.token.picture,
      }
    };
  } catch (error) {
    console.error("Error verifying token:", error);
    return {
      success: false,
      error: "Failed to verify authentication token",
    };
  }
});

/**
 * Revoke refresh tokens for a user
 * This is useful when you need to force a user to log out on all devices
 * Only admins can call this function
 */
export const revokeUserSessions = onCall({enforceAppCheck: true}, async (request) => {
  try {
    // Check if caller is authenticated
    if (!request.auth) {
      return {
        success: false,
        error: "Unauthorized",
      };
    }

    // Check if caller is admin (you would need to implement this check based on your admin rules)
    // For example, check a custom claim or admin collection
    const callerUid = request.auth.uid;
    const callerRecord = await auth.getUser(callerUid);
    
    if (!callerRecord.customClaims?.admin) {
      return {
        success: false,
        error: "Permission denied. Only admins can revoke user sessions.",
      };
    }

    // Get target user ID
    const {userId} = request.data;
    if (!userId) {
      return {
        success: false,
        error: "User ID is required",
      };
    }

    // Revoke refresh tokens
    await auth.revokeRefreshTokens(userId);
    
    return {
      success: true,
      message: "User sessions successfully revoked",
    };
  } catch (error) {
    console.error("Error revoking user sessions:", error);
    return {
      success: false,
      error: "Failed to revoke user sessions",
    };
  }
});

/**
 * Check if an email exists in Firebase Auth
 * This function is useful for company creation flow to give users
 * the option to use an existing email or change it
 */
export const checkEmailExists = onCall({
  enforceAppCheck: false,
}, async (request) => {
  try {
    const {email} = request.data as CheckEmailExistsData;

    // Validate input data
    const {error} = checkEmailExistsSchema.validate(request.data);
    if (error) {
      return {
        success: false,
        error: `Validation error: ${error.message}`,
      };
    }

    // Check if user exists in Firebase Auth
    let userRecord;
    let existsInAuth = false;
    let emailVerified = false;
    let displayName = '';
    let uid = '';

    try {
      userRecord = await auth.getUserByEmail(email);
      existsInAuth = true;
      emailVerified = userRecord.emailVerified || false;
      displayName = userRecord.displayName || '';
      uid = userRecord.uid;
    } catch (error: any) {
      if (error.code === 'auth/user-not-found') {
        existsInAuth = false;
      } else {
        // Re-throw other errors
        throw error;
      }
    }

    // Check if user exists in Firestore (for additional context)
    let existsInFirestore = false;
    let businessMode = false;
    let companyIds: string[] = [];

    if (existsInAuth) {
      try {
        const userRef = db.collection('users').doc(uid);
        const userDoc = await userRef.get();
        
        if (userDoc.exists) {
          existsInFirestore = true;
          const userData = userDoc.data();
          businessMode = userData?.businessMode || false;
          companyIds = userData?.companyId || [];
        }
      } catch (error) {
        console.error("Error checking Firestore user:", error);
        // Don't fail the request if Firestore check fails
      }
    }

    return {
      success: true,
      data: {
        email: email,
        existsInAuth: existsInAuth,
        existsInFirestore: existsInFirestore,
        emailVerified: emailVerified,
        displayName: displayName,
        uid: existsInAuth ? uid : null,
        businessMode: businessMode,
        companyIds: companyIds,
        message: existsInAuth 
          ? "Email exists in the system. You can use this email to create a company or choose a different one."
          : "Email is available for use."
      },
    };
  } catch (error) {
    console.error("Error checking email existence:", error);
    return {
      success: false,
      error: "Failed to check email existence. Please try again.",
    };
  }
});
 
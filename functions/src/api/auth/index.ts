import {onCall} from "firebase-functions/v2/https";
import {getAuth} from "firebase-admin/auth";
import {getFirestore, FieldValue} from "firebase-admin/firestore";
import * as Joi from "joi";

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
  createdAt: FieldValue;
  updatedAt: FieldValue;
}

/**
 * Create a new user account
 * This function handles:
 * 1. Validating the input data
 * 2. Creating a Firebase Auth user
 * 3. Saving additional user data to the users collection
 * 4. Setting up default values for business mode and company associations
 */
export const createAccount = onCall({enforceAppCheck: false}, async (request) => {
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
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    // Save user data to Firestore using the Firebase Auth UID
    await usersRef.doc(userRecord.uid).set(userData);

    return {
      success: true,
      message: "Account created successfully",
      data: {
        userId: userRecord.uid,
        email: userRecord.email,
        displayName: userRecord.displayName,
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
 
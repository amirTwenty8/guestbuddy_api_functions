import {onCall} from "firebase-functions/v2/https";
import {getAuth} from "firebase-admin/auth";

// Get auth instance directly instead of importing from index.ts
const auth = getAuth();

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
 
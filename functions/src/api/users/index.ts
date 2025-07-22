import {onCall, onRequest} from "firebase-functions/v2/https";
import {getFirestore} from "firebase-admin/firestore";
import {handleApiError} from "../../utils/error-handler";
import {User} from "../../types";
import * as express from "express";
import {authenticateUser} from "../../middleware/auth";

// Get Firestore instance directly instead of importing from index.ts
const db = getFirestore();

const app = express();

// Apply authentication middleware to all routes
app.use(authenticateUser);

/**
 * Get user profile
 * Authenticated endpoint
 */
app.get("/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;
    
    // Check if requesting user has permission to access this profile
    if ((req.user?.uid !== userId) && !req.user?.admin) {
      return res.status(403).json({
        success: false,
        error: "Permission denied",
      });
    }
    
    const userDoc = await db.collection("users").doc(userId).get();
    
    if (!userDoc.exists) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }
    
    const userData = userDoc.data() as User;
    
    return res.status(200).json({
      success: true,
      data: userData,
    });
  } catch (error) {
    handleApiError(res, error);
    return;
  }
});

/**
 * Update user profile
 * Authenticated endpoint
 */
app.put("/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;
    const updateData = req.body;
    
    // Check if requesting user has permission to update this profile
    if ((req.user?.uid !== userId) && !req.user?.admin) {
      return res.status(403).json({
        success: false,
        error: "Permission denied",
      });
    }
    
    // Validate update data
    const allowedFields = ["displayName", "photoURL"];
    const sanitizedData: Record<string, any> = {};
    
    Object.keys(updateData).forEach(key => {
      if (allowedFields.includes(key)) {
        sanitizedData[key] = updateData[key];
      }
    });
    
    // Add timestamp
    sanitizedData.updatedAt = new Date().toISOString();
    
    await db.collection("users").doc(userId).update(sanitizedData);
    
    return res.status(200).json({
      success: true,
      message: "User profile updated successfully",
    });
  } catch (error) {
    handleApiError(res, error);
    return;
  }
});

// Export the Express app as a Firebase Function
export const users = onRequest({cors: true}, app);

/**
 * Create user profile (called after user registration)
 * This is a callable function that can be called from client SDKs
 */
export const createUserProfile = onCall({enforceAppCheck: true}, async (request) => {
  try {
    // Ensure user is authenticated
    if (!request.auth) {
      throw new Error("Unauthorized");
    }
    
    const {displayName, email} = request.data;
    const uid = request.auth.uid;
    
    // Create user document
    const userData: User = {
      uid,
      email,
      displayName: displayName || "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    await db.collection("users").doc(uid).set(userData);
    
    return {
      success: true,
      message: "User profile created successfully",
    };
  } catch (error) {
    console.error("Error creating user profile:", error);
    throw new Error("Failed to create user profile");
  }
});
 
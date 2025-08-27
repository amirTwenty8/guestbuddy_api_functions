import {onCall, onRequest} from "firebase-functions/v2/https";
import {getFirestore} from "firebase-admin/firestore";
import {handleApiError} from "../../utils/error-handler";
import {User} from "../../types";
import * as express from "express";
import {authenticateUser} from "../../middleware/auth";
import {getAuth} from "firebase-admin/auth";
import {FieldValue} from "firebase-admin/firestore";
import * as Joi from "joi";

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

// Validation schema for adding user to company
const addUserToCompanySchema = Joi.object({
  companyId: Joi.string().required(),
  email: Joi.string().email().required(),
  firstName: Joi.string().required().min(1).max(50),
  lastName: Joi.string().required().min(1).max(50),
  password: Joi.string().optional().min(8).max(128), // Required only for new users
  role: Joi.string().valid('admins', 'editors', 'promotors', 'tableStaff', 'staff').required(),
});

// Type definitions for adding user to company
interface AddUserToCompanyData {
  companyId: string;
  email: string;
  firstName: string;
  lastName: string;
  password?: string;
  role: 'admins' | 'editors' | 'promotors' | 'tableStaff' | 'staff';
}

/**
 * Add a user to a company
 * This function:
 * 1. Checks if user exists by email
 * 2. If user exists: adds companyId to user and user to company role array
 * 3. If user doesn't exist: creates new user with Firebase Auth and adds to company
 * 4. Handles role assignment (admin, editor, promoter, tableStaff, staff)
 */
export const addUserToCompany = onCall({
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

    const data = request.data as AddUserToCompanyData;

    // Validate input data
    const {error} = addUserToCompanySchema.validate(data);
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

    // Check if user exists by email
    const usersRef = db.collection('users');
    const userQuery = await usersRef.where('userEmail', '==', data.email).get();

    let userId: string;
    let isNewUser = false;

    if (!userQuery.empty) {
      // User exists - get the first match
      const existingUserDoc = userQuery.docs[0];
      userId = existingUserDoc.id;
      const existingUserData = existingUserDoc.data();

      console.log(`Existing user found: ${userId}`);

      // Check if user is already in this company
      const existingCompanyIds = existingUserData.companyId || [];
      if (existingCompanyIds.includes(data.companyId)) {
        return {
          success: false,
          error: "User is already a member of this company",
        };
      }

      // Add company to user's companyId array
      const updatedCompanyIds = [...existingCompanyIds, data.companyId];
      
      await usersRef.doc(userId).update({
        companyId: updatedCompanyIds,
        businessMode: true, // Enable business mode
        updatedAt: FieldValue.serverTimestamp(),
      });

      console.log(`Added company ${data.companyId} to existing user ${userId}`);

    } else {
      // User doesn't exist - create new user
      if (!data.password) {
        return {
          success: false,
          error: "Password is required for new users",
        };
      }

      console.log(`Creating new user with email: ${data.email}`);

      // Create Firebase Auth user
      const userRecord = await getAuth().createUser({
        email: data.email,
        password: data.password,
        displayName: `${data.firstName} ${data.lastName}`,
        emailVerified: false,
      });

      userId = userRecord.uid;
      isNewUser = true;

      // Create user document in Firestore
      const newUserData = {
        companyId: [data.companyId],
        userFirstName: data.firstName,
        userLastName: data.lastName,
        userEmail: data.email,
        userActive: true,
        businessMode: true,
        emailVerified: false,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      };

      await usersRef.doc(userId).set(newUserData);

      console.log(`Created new user: ${userId}`);
    }

    // Add user to company's role array
    const companyRef = db.collection('companies').doc(data.companyId);
    const companyDoc = await companyRef.get();

    if (!companyDoc.exists) {
      return {
        success: false,
        error: "Company not found",
      };
    }

    const companyData = companyDoc.data();
    const roleArray = companyData?.[data.role] || [];

    // Check if user is already in this role
    if (roleArray.includes(userId)) {
      return {
        success: false,
        error: `User is already assigned the role: ${data.role}`,
      };
    }

    // Add user to the role array
    await companyRef.update({
      [data.role]: FieldValue.arrayUnion(userId),
      updatedAt: FieldValue.serverTimestamp(),
    });

    console.log(`Added user ${userId} to company ${data.companyId} with role: ${data.role}`);

    // Log the action
    await db.collection('companies')
      .doc(data.companyId)
      .collection('activityLogs')
      .add({
        action: 'user_added',
        userId: userId,
        userEmail: data.email,
        role: data.role,
        addedBy: userName,
        timestamp: FieldValue.serverTimestamp(),
        isNewUser: isNewUser,
      });

    return {
      success: true,
      message: isNewUser ? "User created and added to company successfully" : "User added to company successfully",
      data: {
        userId: userId,
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role,
        companyId: data.companyId,
        isNewUser: isNewUser,
        addedBy: userName,
        addedAt: new Date().toISOString(),
      }
    };

  } catch (error: any) {
    console.error("Error adding user to company:", error);
    
    // Handle specific Firebase Auth errors
    if (error.code === 'auth/email-already-exists') {
      return {
        success: false,
        error: "This email is already registered with Firebase Auth but not found in our database. Please contact support.",
      };
    } else if (error.code === 'auth/invalid-email') {
      return {
        success: false,
        error: "Invalid email address format.",
      };
    } else if (error.code === 'auth/weak-password') {
      return {
        success: false,
        error: "Password is too weak. Please use a stronger password.",
      };
    }
    
    return {
      success: false,
      error: `Failed to add user to company: ${error.message}`,
    };
  }
});

// Validation schema for editing user in company
const editUserInCompanySchema = Joi.object({
  companyId: Joi.string().required(),
  userId: Joi.string().required(),
  firstName: Joi.string().required().min(1).max(50),
  lastName: Joi.string().required().min(1).max(50),
  role: Joi.string().valid('admins', 'editors', 'promotors', 'tableStaff', 'staff').required(),
});

// Type definitions for editing user in company
interface EditUserInCompanyData {
  companyId: string;
  userId: string;
  firstName: string;
  lastName: string;
  role: 'admins' | 'editors' | 'promotors' | 'tableStaff' | 'staff';
}

/**
 * Edit a user in a company
 * This function:
 * 1. Updates user's first and last name in the users collection
 * 2. Removes user from all role arrays in the company
 * 3. Adds user to the new specified role array
 * 4. Logs the changes for audit trail
 */
export const editUserInCompany = onCall({
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

    const data = request.data as EditUserInCompanyData;

    // Validate input data
    const {error} = editUserInCompanySchema.validate(data);
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

    // Check if user exists
    const userRef = db.collection('users').doc(data.userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return {
        success: false,
        error: "User not found",
      };
    }

    const userData = userDoc.data();
    const userCompanyIds = userData?.companyId || [];

    // Check if user is a member of this company
    if (!userCompanyIds.includes(data.companyId)) {
      return {
        success: false,
        error: "User is not a member of this company",
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

    const companyData = companyDoc.data();
    
    // Get current role of the user
    let currentRole = '';
    const roleArrays = ['admins', 'editors', 'promotors', 'tableStaff', 'staff'];
    
    for (const role of roleArrays) {
      const roleArray = companyData?.[role] || [];
      if (roleArray.includes(data.userId)) {
        currentRole = role;
        break;
      }
    }

    // Check if role is actually changing
    const roleChanged = currentRole !== data.role;
    
    // Check if name is actually changing
    const nameChanged = userData?.userFirstName !== data.firstName || userData?.userLastName !== data.lastName;

    if (!roleChanged && !nameChanged) {
      return {
        success: false,
        error: "No changes detected",
      };
    }

    // Update user information if name changed
    if (nameChanged) {
      await userRef.update({
        userFirstName: data.firstName,
        userLastName: data.lastName,
        updatedAt: FieldValue.serverTimestamp(),
      });
      console.log(`Updated user ${data.userId} name to ${data.firstName} ${data.lastName}`);
    }

    // Handle role changes
    if (roleChanged) {
      // Remove user from all role arrays
      const updateData: any = {
        updatedAt: FieldValue.serverTimestamp(),
      };

      // Remove from current role if exists
      if (currentRole) {
        updateData[currentRole] = FieldValue.arrayRemove(data.userId);
      }

      // Add to new role
      updateData[data.role] = FieldValue.arrayUnion(data.userId);

      await companyRef.update(updateData);
      console.log(`Changed user ${data.userId} role from ${currentRole} to ${data.role}`);
    }

    // Log the action
    await db.collection('companies')
      .doc(data.companyId)
      .collection('activityLogs')
      .add({
        action: 'user_edited',
        userId: data.userId,
        userEmail: userData?.userEmail || '',
        previousRole: currentRole || 'none',
        newRole: data.role,
        nameChanged: nameChanged,
        roleChanged: roleChanged,
        previousName: nameChanged ? `${userData?.userFirstName || ''} ${userData?.userLastName || ''}`.trim() : null,
        newName: nameChanged ? `${data.firstName} ${data.lastName}` : null,
        editedBy: userName,
        timestamp: FieldValue.serverTimestamp(),
      });

    return {
      success: true,
      message: "User updated successfully",
      data: {
        userId: data.userId,
        email: userData?.userEmail || '',
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role,
        companyId: data.companyId,
        previousRole: currentRole || 'none',
        nameChanged: nameChanged,
        roleChanged: roleChanged,
        editedBy: userName,
        editedAt: new Date().toISOString(),
      }
    };

  } catch (error: any) {
    console.error("Error editing user in company:", error);
    
    return {
      success: false,
      error: `Failed to edit user in company: ${error.message}`,
    };
  }
});

// Validation schema for removing user from company
const removeUserFromCompanySchema = Joi.object({
  companyId: Joi.string().required(),
  userId: Joi.string().required(),
});

// Type definitions for removing user from company
interface RemoveUserFromCompanyData {
  companyId: string;
  userId: string;
}

/**
 * Remove a user from a company
 * This function:
 * 1. Removes user from all role arrays in the company
 * 2. Removes companyId from user's companyId array
 * 3. Checks if user has any remaining companies to determine businessMode
 * 4. Logs the removal for audit trail
 */
export const removeUserFromCompany = onCall({
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

    const data = request.data as RemoveUserFromCompanyData;

    // Validate input data
    const {error} = removeUserFromCompanySchema.validate(data);
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

    // Check if user exists
    const userRef = db.collection('users').doc(data.userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return {
        success: false,
        error: "User not found",
      };
    }

    const userData = userDoc.data();
    const userCompanyIds = userData?.companyId || [];

    // Check if user is a member of this company
    if (!userCompanyIds.includes(data.companyId)) {
      return {
        success: false,
        error: "User is not a member of this company",
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

    const companyData = companyDoc.data();
    
    // Get current role of the user before removal
    let currentRole = '';
    const roleArrays = ['admins', 'editors', 'promotors', 'tableStaff', 'staff'];
    
    for (const role of roleArrays) {
      const roleArray = companyData?.[role] || [];
      if (roleArray.includes(data.userId)) {
        currentRole = role;
        break;
      }
    }

    // Check if user is trying to remove themselves and they are the only admin
    if (data.userId === currentUser.uid && currentRole === 'admins') {
      const adminsArray = companyData?.admins || [];
      if (adminsArray.length === 1) {
        return {
          success: false,
          error: "Cannot remove yourself. You are the only admin in this company.",
        };
      }
    }

    // Remove user from all role arrays in company
    const updateData: any = {
      updatedAt: FieldValue.serverTimestamp(),
    };

    // Remove from all role arrays
    for (const role of roleArrays) {
      const roleArray = companyData?.[role] || [];
      if (roleArray.includes(data.userId)) {
        updateData[role] = FieldValue.arrayRemove(data.userId);
      }
    }

    await companyRef.update(updateData);
    console.log(`Removed user ${data.userId} from all roles in company ${data.companyId}`);

    // Remove company from user's companyId array
    const updatedCompanyIds = userCompanyIds.filter((id: string) => id !== data.companyId);
    
    // Determine if user should remain in business mode
    const shouldRemainInBusinessMode = updatedCompanyIds.length > 0;
    
    await userRef.update({
      companyId: updatedCompanyIds,
      businessMode: shouldRemainInBusinessMode,
      updatedAt: FieldValue.serverTimestamp(),
    });

    console.log(`Removed company ${data.companyId} from user ${data.userId}. Business mode: ${shouldRemainInBusinessMode}`);

    // Log the action
    await db.collection('companies')
      .doc(data.companyId)
      .collection('activityLogs')
      .add({
        action: 'user_removed',
        userId: data.userId,
        userEmail: userData?.userEmail || '',
        previousRole: currentRole || 'none',
        removedBy: userName,
        timestamp: FieldValue.serverTimestamp(),
        businessModeRemains: shouldRemainInBusinessMode,
        remainingCompanies: updatedCompanyIds.length,
      });

    return {
      success: true,
      message: "User removed from company successfully",
      data: {
        userId: data.userId,
        email: userData?.userEmail || '',
        companyId: data.companyId,
        previousRole: currentRole || 'none',
        businessModeRemains: shouldRemainInBusinessMode,
        remainingCompanies: updatedCompanyIds.length,
        removedBy: userName,
        removedAt: new Date().toISOString(),
      }
    };

  } catch (error: any) {
    console.error("Error removing user from company:", error);
    
    return {
      success: false,
      error: `Failed to remove user from company: ${error.message}`,
    };
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
 
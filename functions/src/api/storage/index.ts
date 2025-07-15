import {onCall} from "firebase-functions/v2/https";
import {getStorage} from "firebase-admin/storage";
import {getAuth} from "firebase-admin/auth";

// Get auth instance directly instead of importing from index.ts
const auth = getAuth();

// Initialize storage
const storage = getStorage();
const bucket = storage.bucket();

/**
 * Generate a signed URL for file uploads
 * This allows clients to upload files directly to Firebase Storage
 * without exposing your Firebase Admin credentials
 */
export const getUploadSignedUrl = onCall({enforceAppCheck: true}, async (request) => {
  try {
    // Ensure user is authenticated
    if (!request.auth) {
      throw new Error("Unauthorized");
    }
    
    const userId = request.auth.uid;
    const {fileName, contentType, folderPath = "uploads"} = request.data;
    
    if (!fileName || !contentType) {
      return {
        success: false,
        error: "File name and content type are required",
      };
    }
    
    // Create a safe file path with user ID to prevent unauthorized access
    const safeFolderPath = folderPath.replace(/\.\./g, "").replace(/^\//, "");
    const filePath = `${safeFolderPath}/${userId}/${Date.now()}-${fileName}`;
    const file = bucket.file(filePath);
    
    // Set metadata
    const metadata = {
      contentType,
      metadata: {
        uploadedBy: userId,
        originalName: fileName,
      },
    };
    
    // Generate signed URL for upload
    const [url] = await file.getSignedUrl({
      version: "v4",
      action: "write",
      expires: Date.now() + 15 * 60 * 1000, // URL expires in 15 minutes
      contentType,
    });
    
    return {
      success: true,
      data: {
        url,
        filePath,
        downloadUrl: `https://storage.googleapis.com/${bucket.name}/${filePath}`,
        metadata,
      },
    };
  } catch (error) {
    console.error("Error generating signed URL:", error);
    return {
      success: false,
      error: "Failed to generate upload URL",
    };
  }
});

/**
 * Generate a signed URL for file download
 * This creates a temporary URL that can be used to download a file
 */
export const getDownloadSignedUrl = onCall({enforceAppCheck: true}, async (request) => {
  try {
    // Ensure user is authenticated
    if (!request.auth) {
      throw new Error("Unauthorized");
    }
    
    const {filePath} = request.data;
    
    if (!filePath) {
      return {
        success: false,
        error: "File path is required",
      };
    }
    
    // Check if file exists
    const file = bucket.file(filePath);
    const [exists] = await file.exists();
    
    if (!exists) {
      return {
        success: false,
        error: "File not found",
      };
    }
    
    // Get file metadata to check permissions
    const [metadata] = await file.getMetadata();
    const uploadedBy = metadata.metadata?.uploadedBy;
    
    // Check if user has permission to access this file
    // Allow access if user uploaded the file or is an admin
    const userId = request.auth.uid;
    const userRecord = await auth.getUser(userId);
    const isAdmin = userRecord.customClaims?.admin === true;
    
    if (uploadedBy !== userId && !isAdmin) {
      return {
        success: false,
        error: "Permission denied",
      };
    }
    
    // Generate signed URL for download
    const [url] = await file.getSignedUrl({
      version: "v4",
      action: "read",
      expires: Date.now() + 60 * 60 * 1000, // URL expires in 1 hour
    });
    
    return {
      success: true,
      data: {
        url,
        fileName: metadata.metadata?.originalName || filePath.split("/").pop(),
        contentType: metadata.contentType,
        size: metadata.size,
      },
    };
  } catch (error) {
    console.error("Error generating download URL:", error);
    return {
      success: false,
      error: "Failed to generate download URL",
    };
  }
});

/**
 * Delete a file
 * This allows users to delete their own files
 */
export const deleteFile = onCall({enforceAppCheck: true}, async (request) => {
  try {
    // Ensure user is authenticated
    if (!request.auth) {
      throw new Error("Unauthorized");
    }
    
    const {filePath} = request.data;
    
    if (!filePath) {
      return {
        success: false,
        error: "File path is required",
      };
    }
    
    // Check if file exists
    const file = bucket.file(filePath);
    const [exists] = await file.exists();
    
    if (!exists) {
      return {
        success: false,
        error: "File not found",
      };
    }
    
    // Get file metadata to check permissions
    const [metadata] = await file.getMetadata();
    const uploadedBy = metadata.metadata?.uploadedBy;
    
    // Check if user has permission to delete this file
    const userId = request.auth.uid;
    const userRecord = await auth.getUser(userId);
    const isAdmin = userRecord.customClaims?.admin === true;
    
    if (uploadedBy !== userId && !isAdmin) {
      return {
        success: false,
        error: "Permission denied",
      };
    }
    
    // Delete the file
    await file.delete();
    
    return {
      success: true,
      message: "File deleted successfully",
    };
  } catch (error) {
    console.error("Error deleting file:", error);
    return {
      success: false,
      error: "Failed to delete file",
    };
  }
});

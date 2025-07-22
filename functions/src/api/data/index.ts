import {onRequest, onCall} from "firebase-functions/v2/https";
import {getFirestore} from "firebase-admin/firestore";
import * as express from "express";
import {authenticateUser} from "../../middleware/auth";
import {handleApiError} from "../../utils/error-handler";
import {validateRequest} from "../../utils/validation";
import * as Joi from "joi";

// Get Firestore instance directly instead of importing from index.ts
const db = getFirestore();

const app = express();

// Apply authentication middleware to all routes
app.use(authenticateUser);

/**
 * Data validation schemas
 */
const dataSchemas = {
  createItem: Joi.object({
    title: Joi.string().required().min(1).max(100),
    description: Joi.string().optional().max(500),
    status: Joi.string().valid("active", "inactive", "pending").default("active"),
    metadata: Joi.object().optional(),
  }),
  
  updateItem: Joi.object({
    title: Joi.string().optional().min(1).max(100),
    description: Joi.string().optional().max(500),
    status: Joi.string().valid("active", "inactive", "pending").optional(),
    metadata: Joi.object().optional(),
  }),
};

/**
 * Create a new data item
 */
app.post("/", validateRequest(dataSchemas.createItem), async (req, res) => {
  try {
    const userId = req.user?.uid;
    const data = req.body;
    
    // Add metadata
    const newItem = {
      ...data,
      createdBy: userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    const docRef = await db.collection("items").add(newItem);
    
    return res.status(201).json({
      success: true,
      data: {
        id: docRef.id,
        ...newItem,
      },
    });
  } catch (error) {
    handleApiError(res, error);
    return;
  }
});

/**
 * Get all data items for a user
 */
app.get("/", async (req, res) => {
  try {
    const userId = req.user?.uid;
    const {status} = req.query;
    
    let query = db.collection("items").where("createdBy", "==", userId);
    
    // Apply status filter if provided
    if (status) {
      query = query.where("status", "==", status);
    }
    
    const snapshot = await query.get();
    const items = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));
    
    return res.status(200).json({
      success: true,
      data: items,
    });
  } catch (error) {
    handleApiError(res, error);
    return;
  }
});

/**
 * Get a specific data item
 */
app.get("/:itemId", async (req, res) => {
  try {
    const userId = req.user?.uid;
    const {itemId} = req.params;
    
    const docRef = await db.collection("items").doc(itemId).get();
    
    if (!docRef.exists) {
      return res.status(404).json({
        success: false,
        error: "Item not found",
      });
    }
    
    const item = docRef.data();
    
    // Check if user has permission to access this item
    if (item?.createdBy !== userId && !req.user?.admin) {
      return res.status(403).json({
        success: false,
        error: "Permission denied",
      });
    }
    
    return res.status(200).json({
      success: true,
      data: {
        id: docRef.id,
        ...item,
      },
    });
  } catch (error) {
    handleApiError(res, error);
    return;
  }
});

/**
 * Update a data item
 */
app.put("/:itemId", validateRequest(dataSchemas.updateItem), async (req, res) => {
  try {
    const userId = req.user?.uid;
    const {itemId} = req.params;
    const updateData = req.body;
    
    // Check if item exists
    const docRef = await db.collection("items").doc(itemId).get();
    
    if (!docRef.exists) {
      return res.status(404).json({
        success: false,
        error: "Item not found",
      });
    }
    
    const item = docRef.data();
    
    // Check if user has permission to update this item
    if (item?.createdBy !== userId && !req.user?.admin) {
      return res.status(403).json({
        success: false,
        error: "Permission denied",
      });
    }
    
    // Add updated timestamp
    const dataToUpdate = {
      ...updateData,
      updatedAt: new Date().toISOString(),
    };
    
    await db.collection("items").doc(itemId).update(dataToUpdate);
    
    return res.status(200).json({
      success: true,
      message: "Item updated successfully",
    });
  } catch (error) {
    handleApiError(res, error);
    return;
  }
});

/**
 * Delete a data item
 */
app.delete("/:itemId", async (req, res) => {
  try {
    const userId = req.user?.uid;
    const {itemId} = req.params;
    
    // Check if item exists
    const docRef = await db.collection("items").doc(itemId).get();
    
    if (!docRef.exists) {
      return res.status(404).json({
        success: false,
        error: "Item not found",
      });
    }
    
    const item = docRef.data();
    
    // Check if user has permission to delete this item
    if (item?.createdBy !== userId && !req.user?.admin) {
      return res.status(403).json({
        success: false,
        error: "Permission denied",
      });
    }
    
    await db.collection("items").doc(itemId).delete();
    
    return res.status(200).json({
      success: true,
      message: "Item deleted successfully",
    });
  } catch (error) {
    handleApiError(res, error);
    return;
  }
});

// Export the Express app as a Firebase Function
export const data = onRequest({cors: true}, app);

/**
 * Batch operations (callable function)
 * This allows for more complex operations that might be difficult with REST
 */
export const batchUpdateItems = onCall({enforceAppCheck: true}, async (request) => {
  try {
    // Ensure user is authenticated
    if (!request.auth) {
      throw new Error("Unauthorized");
    }
    
    const userId = request.auth.uid;
    const {items, operation} = request.data;
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      return {
        success: false,
        error: "No items provided for batch operation",
      };
    }
    
    if (!operation || !["update", "delete"].includes(operation)) {
      return {
        success: false,
        error: "Invalid operation. Must be 'update' or 'delete'",
      };
    }
    
    const batch = db.batch();
    const results = [];
    
    // Process each item
    for (const item of items) {
      const {id, ...data} = item;
      
      if (!id) {
        results.push({
          id,
          success: false,
          error: "Item ID is required",
        });
        continue;
      }
      
      // Check if item exists and user has permission
      const docRef = db.collection("items").doc(id);
      const doc = await docRef.get();
      
      if (!doc.exists) {
        results.push({
          id,
          success: false,
          error: "Item not found",
        });
        continue;
      }
      
      const itemData = doc.data();
      
      if (itemData?.createdBy !== userId) {
        results.push({
          id,
          success: false,
          error: "Permission denied",
        });
        continue;
      }
      
      // Perform operation
      if (operation === "update") {
        batch.update(docRef, {
          ...data,
          updatedAt: new Date().toISOString(),
        });
      } else if (operation === "delete") {
        batch.delete(docRef);
      }
      
      results.push({
        id,
        success: true,
      });
    }
    
    // Commit batch
    await batch.commit();
    
    return {
      success: true,
      results,
    };
  } catch (error) {
    console.error("Error in batch operation:", error);
    return {
      success: false,
      error: "Failed to perform batch operation",
    };
  }
});
 
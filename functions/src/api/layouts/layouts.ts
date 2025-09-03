import {onCall} from "firebase-functions/v2/https";
import {getFirestore, FieldValue} from "firebase-admin/firestore";
import * as Joi from "joi";

// Get Firestore instance
const db = getFirestore();

// Validation schema for creating table layout
const createTableLayoutSchema = Joi.object({
  companyId: Joi.string().required(),
  name: Joi.string().required().min(1).max(100),
  canvasHeight: Joi.number().required().min(100).max(10000),
  canvasWidth: Joi.number().required().min(100).max(10000),
  items: Joi.array().items(Joi.object({
    tableName: Joi.string().when('type', {
      is: 'ItemType.table',
      then: Joi.required(),
      otherwise: Joi.optional()
    }),
    objectName: Joi.string().when('type', {
      is: 'ItemType.object',
      then: Joi.required(),
      otherwise: Joi.optional()
    }),
    type: Joi.string().valid('ItemType.table', 'ItemType.object').required(),
    shape: Joi.string().valid('ItemShape.square', 'ItemShape.circle', 'ItemShape.rectangle', 'ItemShape.oval').required(),
    width: Joi.number().required().min(1).max(10000),
    height: Joi.number().required().min(1).max(10000),
    positionX: Joi.number().required().min(0).max(10000),
    positionY: Joi.number().required().min(0).max(10000),
    rotation: Joi.number().optional().min(0).max(360), // Rotation in degrees (0-360)
  })).required().min(1).max(1000), // Maximum 1000 items per layout
});

// Type definitions
interface LayoutItem {
  tableName?: string;
  objectName?: string;
  type: 'ItemType.table' | 'ItemType.object';
  shape: 'ItemShape.square' | 'ItemShape.circle' | 'ItemShape.rectangle' | 'ItemShape.oval';
  width: number;
  height: number;
  positionX: number;
  positionY: number;
  rotation?: number; // Rotation in degrees (0-360)
}

interface CreateTableLayoutData {
  companyId: string;
  name: string;
  canvasHeight: number;
  canvasWidth: number;
  items: LayoutItem[];
}

/**
 * Create a new table layout from canvas objects
 * This function:
 * 1. Validates the layout data and items
 * 2. Checks if company exists
 * 3. Creates a new layout document with auto-generated ID
 * 4. Saves all canvas items with their properties
 * 5. Logs the creation action
 */
export const createTableLayout = onCall({
  enforceAppCheck: false,
}, async (request) => {
  try {
    console.log('🚀 createTableLayout function STARTED');
    console.log('Request details:', {
      hasAuth: !!request.auth,
      hasData: !!request.data,
      dataKeys: request.data ? Object.keys(request.data) : [],
      rawData: JSON.stringify(request.data, null, 2)
    });

    // Check if caller is authenticated
    if (!request.auth) {
      return {
        success: false,
        error: "Unauthorized",
      };
    }

    // Extract data from request - handle both direct data and wrapped data
    let data: CreateTableLayoutData;
    if (request.data && request.data.data) {
      // Data is wrapped in a "data" property
      data = request.data.data as CreateTableLayoutData;
      console.log('Using wrapped data:', data);
    } else {
      // Data is at root level
      data = request.data as CreateTableLayoutData;
      console.log('Using root data:', data);
    }

    // Validate input data
    console.log('🔍 Validating data with schema...');
    const {error} = createTableLayoutSchema.validate(data);
    if (error) {
      console.log('❌ Validation failed:', error.message);
      return {
        success: false,
        error: `Validation error: ${error.message}`,
      };
    }
    console.log('✅ Validation passed successfully');

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

    // Check if company exists
    const companyRef = db.collection('companies').doc(data.companyId);
    const companyDoc = await companyRef.get();

    if (!companyDoc.exists) {
      return {
        success: false,
        error: "Company not found",
      };
    }

    // Validate items based on type
    console.log('🔍 Validating layout items...');
    for (let i = 0; i < data.items.length; i++) {
      const item = data.items[i];
      
      if (item.type === 'ItemType.table' && !item.tableName) {
        return {
          success: false,
          error: `Item ${i + 1} is a table but missing tableName`,
        };
      }
      
      if (item.type === 'ItemType.object' && !item.objectName) {
        return {
          success: false,
          error: `Item ${i + 1} is an object but missing objectName`,
        };
      }
    }
    console.log('✅ Layout items validation passed');

    // Create layout document with auto-generated ID
    const layoutRef = db.collection('companies')
      .doc(data.companyId)
      .collection('layouts')
      .doc();

    const layoutData = {
      name: data.name,
      canvasHeight: data.canvasHeight,
      canvasWidth: data.canvasWidth,
      items: data.items,
      createdAt: FieldValue.serverTimestamp(),
      createdBy: currentUser.uid,
    };

    // Save layout to database
    await layoutRef.set(layoutData);
    console.log(`✅ Layout saved with ID: ${layoutRef.id}`);

    // Log the action
    await db.collection('companies')
      .doc(data.companyId)
      .collection('activityLogs')
      .add({
        action: 'table_layout_created',
        layoutId: layoutRef.id,
        layoutName: data.name,
        itemsCount: data.items.length,
        canvasDimensions: {
          height: data.canvasHeight,
          width: data.canvasWidth,
        },
        createdBy: userName,
        timestamp: FieldValue.serverTimestamp(),
      });

    // Get the created layout data for response
    const createdLayoutDoc = await layoutRef.get();
    const createdLayoutData = createdLayoutDoc.data();

    return {
      success: true,
      message: "Table layout created successfully",
      data: {
        layoutId: layoutRef.id,
        name: data.name,
        canvasHeight: data.canvasHeight,
        canvasWidth: data.canvasWidth,
        itemsCount: data.items.length,
        tablesCount: data.items.filter(item => item.type === 'ItemType.table').length,
        objectsCount: data.items.filter(item => item.type === 'ItemType.object').length,
        createdBy: userName,
        createdAt: createdLayoutData?.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
      }
    };

  } catch (error: any) {
    console.error("Error creating table layout:", error);
    
    // Get more detailed error information
    let errorMessage = 'Unknown error occurred';
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'object' && error !== null) {
      errorMessage = JSON.stringify(error);
    }
    
    return {
      success: false,
      error: `Failed to create table layout: ${errorMessage}`,
    };
  }
});

// Update Table Layout Schema
const updateTableLayoutSchema = Joi.object({
  companyId: Joi.string().required(),
  layoutId: Joi.string().required(),
  name: Joi.string().optional().min(1).max(100),
  canvasHeight: Joi.number().optional().min(100).max(10000),
  canvasWidth: Joi.number().optional().min(100).max(10000),
  items: Joi.array().items(Joi.object({
    tableName: Joi.string().when('type', {
      is: 'ItemType.table',
      then: Joi.required(),
      otherwise: Joi.optional()
    }),
    objectName: Joi.string().when('type', {
      is: 'ItemType.object',
      then: Joi.required(),
      otherwise: Joi.optional()
    }),
    type: Joi.string().valid('ItemType.table', 'ItemType.object').required(),
    shape: Joi.string().valid('ItemShape.square', 'ItemShape.circle', 'ItemShape.rectangle', 'ItemShape.oval').required(),
    width: Joi.number().required().min(1).max(10000),
    height: Joi.number().required().min(1).max(10000),
    positionX: Joi.number().required().min(0).max(10000),
    positionY: Joi.number().required().min(0).max(10000),
    rotation: Joi.number().optional().min(0).max(360), // Rotation in degrees (0-360)
  })).optional().min(1).max(1000), // Maximum 1000 items per layout
});

// Type definitions for update
interface UpdateTableLayoutData {
  companyId: string;
  layoutId: string;
  name?: string;
  canvasHeight?: number;
  canvasWidth?: number;
  items?: LayoutItem[];
}

/**
 * Update an existing table layout
 * This function:
 * 1. Validates the update data
 * 2. Checks if company and layout exist
 * 3. Validates items if provided
 * 4. Updates only the provided fields
 * 5. Logs the update action
 */
export const updateTableLayout = onCall({
  enforceAppCheck: false,
}, async (request) => {
  try {
    console.log('🚀 updateTableLayout function STARTED');
    console.log('Request details:', {
      hasAuth: !!request.auth,
      hasData: !!request.data,
      dataKeys: request.data ? Object.keys(request.data) : [],
      rawData: JSON.stringify(request.data, null, 2)
    });

    // Check if caller is authenticated
    if (!request.auth) {
      return {
        success: false,
        error: "Unauthorized",
      };
    }

    // Extract data from request - handle both direct data and wrapped data
    let data: UpdateTableLayoutData;
    if (request.data && request.data.data) {
      // Data is wrapped in a "data" property
      data = request.data.data as UpdateTableLayoutData;
      console.log('Using wrapped data:', data);
    } else {
      // Data is at root level
      data = request.data as UpdateTableLayoutData;
      console.log('Using root data:', data);
    }

    // Validate input data
    console.log('🔍 Validating data with schema...');
    const {error} = updateTableLayoutSchema.validate(data);
    if (error) {
      console.log('❌ Validation failed:', error.message);
      return {
        success: false,
        error: `Validation error: ${error.message}`,
      };
    }
    console.log('✅ Validation passed successfully');

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

    // Check if company exists
    const companyRef = db.collection('companies').doc(data.companyId);
    const companyDoc = await companyRef.get();

    if (!companyDoc.exists) {
      return {
        success: false,
        error: "Company not found",
      };
    }

    // Check if layout exists
    const layoutRef = companyRef.collection('layouts').doc(data.layoutId);
    const layoutDoc = await layoutRef.get();

    if (!layoutDoc.exists) {
      return {
        success: false,
        error: "Layout not found",
      };
    }

    const existingLayoutData = layoutDoc.data();
    if (!existingLayoutData) {
      return {
        success: false,
        error: "Layout data not found",
      };
    }

    // Validate items if provided
    if (data.items) {
      console.log('🔍 Validating layout items...');
      for (let i = 0; i < data.items.length; i++) {
        const item = data.items[i];
        
        if (item.type === 'ItemType.table' && !item.tableName) {
          return {
            success: false,
            error: `Item ${i + 1} is a table but missing tableName`,
          };
        }
        
        if (item.type === 'ItemType.object' && !item.objectName) {
          return {
            success: false,
            error: `Item ${i + 1} is an object but missing objectName`,
          };
        }
      }
      console.log('✅ Layout items validation passed');
    }

    // Prepare update data
    const updateFields: any = {
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: currentUser.uid
    };

    // Add fields that are being updated
    if (data.name !== undefined) {
      updateFields.name = data.name;
    }
    if (data.canvasHeight !== undefined) {
      updateFields.canvasHeight = data.canvasHeight;
    }
    if (data.canvasWidth !== undefined) {
      updateFields.canvasWidth = data.canvasWidth;
    }
    if (data.items !== undefined) {
      updateFields.items = data.items;
    }

    // Check if there are any changes
    const changes = Object.keys(updateFields).filter(key => key !== 'updatedAt' && key !== 'updatedBy');
    if (changes.length === 0) {
      return {
        success: false,
        error: "No changes detected",
      };
    }

    // Update the layout
    await layoutRef.update(updateFields);
    console.log(`✅ Layout updated with changes: ${changes.join(', ')}`);

    // Log the update action
    await db.collection('companies')
      .doc(data.companyId)
      .collection('activityLogs')
      .add({
        action: 'table_layout_updated',
        layoutId: data.layoutId,
        layoutName: data.name || existingLayoutData.name,
        changes: changes,
        updatedBy: userName,
        timestamp: FieldValue.serverTimestamp(),
      });

    // Calculate statistics
    const itemsCount = data.items ? data.items.length : existingLayoutData.items?.length || 0;
    const tablesCount = data.items ? 
      data.items.filter(item => item.type === 'ItemType.table').length :
      existingLayoutData.items?.filter((item: any) => item.type === 'ItemType.table').length || 0;
    const objectsCount = itemsCount - tablesCount;

    return {
      success: true,
      message: "Table layout updated successfully",
      data: {
        layoutId: data.layoutId,
        name: data.name || existingLayoutData.name,
        canvasHeight: data.canvasHeight || existingLayoutData.canvasHeight,
        canvasWidth: data.canvasWidth || existingLayoutData.canvasWidth,
        itemsCount: itemsCount,
        tablesCount: tablesCount,
        objectsCount: objectsCount,
        changes: changes,
        updatedBy: userName,
        updatedAt: new Date().toISOString()
      }
    };

  } catch (error: any) {
    console.error("Error updating table layout:", error);
    
    // Get more detailed error information
    let errorMessage = 'Unknown error occurred';
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'object' && error !== null) {
      errorMessage = JSON.stringify(error);
    }
    
    return {
      success: false,
      error: `Failed to update table layout: ${errorMessage}`,
    };
  }
});

// Delete Table Layout Schema
const deleteTableLayoutSchema = Joi.object({
  companyId: Joi.string().required(),
  layoutId: Joi.string().required(),
});

/**
 * Delete an existing table layout
 * This function:
 * 1. Validates the request data
 * 2. Checks if company and layout exist
 * 3. Validates that layout is not used in any events
 * 4. Deletes the layout document
 * 5. Logs the deletion action
 */
export const deleteTableLayout = onCall({
  enforceAppCheck: false,
}, async (request) => {
  try {
    console.log('🚀 deleteTableLayout function STARTED');
    console.log('Request details:', {
      hasAuth: !!request.auth,
      hasData: !!request.data,
      dataKeys: request.data ? Object.keys(request.data) : [],
      rawData: JSON.stringify(request.data, null, 2)
    });

    // Check if caller is authenticated
    if (!request.auth) {
      return {
        success: false,
        error: "Unauthorized",
      };
    }

    // Extract data from request - handle both direct data and wrapped data
    let data: {companyId: string; layoutId: string};
    if (request.data && request.data.data) {
      // Data is wrapped in a "data" property
      data = request.data.data as {companyId: string; layoutId: string};
      console.log('Using wrapped data:', data);
    } else {
      // Data is at root level
      data = request.data as {companyId: string; layoutId: string};
      console.log('Using root data:', data);
    }

    // Validate input data
    console.log('🔍 Validating data with schema...');
    const {error} = deleteTableLayoutSchema.validate(data);
    if (error) {
      console.log('❌ Validation failed:', error.message);
      return {
        success: false,
        error: `Validation error: ${error.message}`,
      };
    }
    console.log('✅ Validation passed successfully');

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

    // Check if company exists
    const companyRef = db.collection('companies').doc(data.companyId);
    const companyDoc = await companyRef.get();

    if (!companyDoc.exists) {
      return {
        success: false,
        error: "Company not found",
      };
    }

    // Check if layout exists
    const layoutRef = companyRef.collection('layouts').doc(data.layoutId);
    const layoutDoc = await layoutRef.get();

    if (!layoutDoc.exists) {
      return {
        success: false,
        error: "Layout not found",
      };
    }

    const existingLayoutData = layoutDoc.data();
    if (!existingLayoutData) {
      return {
        success: false,
        error: "Layout data not found",
      };
    }

    // Check if layout is used in any events
    console.log('🔍 Checking if layout is used in any events...');
    const eventsQuery = await db.collection('companies')
      .doc(data.companyId)
      .collection('events')
      .where('tableLayouts', 'array-contains', data.layoutId)
      .get();

    if (!eventsQuery.empty) {
      const eventNames = eventsQuery.docs.map(doc => doc.data().eventName || 'Unnamed Event');
      return {
        success: false,
        error: `Cannot delete layout. It is currently used in ${eventsQuery.size} event(s): ${eventNames.join(', ')}`,
      };
    }
    console.log('✅ Layout is not used in any events');

    // Delete the layout
    await layoutRef.delete();
    console.log(`✅ Layout deleted successfully: ${data.layoutId}`);

    // Log the deletion action
    await db.collection('companies')
      .doc(data.companyId)
      .collection('activityLogs')
      .add({
        action: 'table_layout_deleted',
        layoutId: data.layoutId,
        layoutName: existingLayoutData.name,
        itemsCount: existingLayoutData.items?.length || 0,
        canvasDimensions: {
          height: existingLayoutData.canvasHeight,
          width: existingLayoutData.canvasWidth,
        },
        deletedBy: userName,
        timestamp: FieldValue.serverTimestamp(),
      });

    return {
      success: true,
      message: "Table layout deleted successfully",
      data: {
        layoutId: data.layoutId,
        layoutName: existingLayoutData.name,
        itemsCount: existingLayoutData.items?.length || 0,
        tablesCount: existingLayoutData.items?.filter((item: any) => item.type === 'ItemType.table').length || 0,
        objectsCount: existingLayoutData.items?.filter((item: any) => item.type === 'ItemType.object').length || 0,
        deletedBy: userName,
        deletedAt: new Date().toISOString()
      }
    };

  } catch (error: any) {
    console.error("Error deleting table layout:", error);
    
    // Get more detailed error information
    let errorMessage = 'Unknown error occurred';
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'object' && error !== null) {
      errorMessage = JSON.stringify(error);
    }
    
    return {
      success: false,
      error: `Failed to delete table layout: ${errorMessage}`,
    };
  }
});

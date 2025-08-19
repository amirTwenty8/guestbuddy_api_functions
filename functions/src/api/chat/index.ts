import {onRequest} from "firebase-functions/v2/https";
import {getFirestore, FieldValue} from "firebase-admin/firestore";
import {handleApiError} from "../../utils/error-handler";
import * as express from "express";
import {authenticateUser} from "../../middleware/auth";

const db = getFirestore();
const app = express();

// Apply authentication middleware to all routes
app.use(authenticateUser);

/**
 * Get user conversations
 * Authenticated endpoint
 */
app.get("/conversations/user/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;
    
    // Check if requesting user has permission to access this user's conversations
    if ((req.user?.uid !== userId) && !req.user?.admin) {
      return res.status(403).json({
        success: false,
        error: "Permission denied",
      });
    }
    
    const conversationsSnapshot = await db
        .collection("conversations")
        .where("userId", "==", userId)
        .where("isActive", "==", true)
        .orderBy("lastUpdated", "desc")
        .get();
    
    const conversations = conversationsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    return res.status(200).json({
      success: true,
      data: conversations,
    });
  } catch (error) {
    handleApiError(res, error);
    return;
  }
});

/**
 * Get company conversations
 * Authenticated endpoint
 */
app.get("/conversations/company/:companyId", async (req, res) => {
  try {
    const companyId = req.params.companyId;
    
    // Check if user has access to this company
    const companyDoc = await db.collection("companies").doc(companyId).get();
    if (!companyDoc.exists) {
      return res.status(404).json({
        success: false,
        error: "Company not found",
      });
    }
    
    const companyData = companyDoc.data() as any;
    const userHasAccess = companyData.admins?.includes(req.user?.uid) ||
                         companyData.editors?.includes(req.user?.uid) ||
                         companyData.promotors?.includes(req.user?.uid) ||
                         companyData.tableStaff?.includes(req.user?.uid) ||
                         companyData.staff?.includes(req.user?.uid);
    
    if (!userHasAccess && !req.user?.admin) {
      return res.status(403).json({
        success: false,
        error: "Permission denied",
      });
    }
    
    const conversationsSnapshot = await db
        .collection("conversations")
        .where("companyId", "==", companyId)
        .where("isActive", "==", true)
        .orderBy("lastUpdated", "desc")
        .get();
    
    const conversations = conversationsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    return res.status(200).json({
      success: true,
      data: conversations,
    });
  } catch (error) {
    handleApiError(res, error);
    return;
  }
});

/**
 * Get messages for a conversation
 * Authenticated endpoint
 */
app.get("/messages/:conversationId", async (req, res) => {
  try {
    const conversationId = req.params.conversationId;
    
    // Get conversation to check permissions
    const conversationDoc = await db
        .collection("conversations")
        .doc(conversationId)
        .get();
    
    if (!conversationDoc.exists) {
      return res.status(404).json({
        success: false,
        error: "Conversation not found",
      });
    }
    
    const conversationData = conversationDoc.data() as any;
    const userHasAccess = conversationData.userId === req.user?.uid ||
                         conversationData.companyId === req.user?.uid ||
                         req.user?.admin;
    
    if (!userHasAccess) {
      return res.status(403).json({
        success: false,
        error: "Permission denied",
      });
    }
    
    const messagesSnapshot = await db
        .collection("messages")
        .doc(conversationId)
        .collection("messages")
        .orderBy("timestamp", "asc")
        .get();
    
    const messages = messagesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    return res.status(200).json({
      success: true,
      data: messages,
    });
  } catch (error) {
    handleApiError(res, error);
    return;
  }
});

/**
 * Send a message
 * Authenticated endpoint
 */
app.post("/messages/:conversationId", async (req, res) => {
  try {
    const conversationId = req.params.conversationId;
    const {message, messageType = "text", metadata} = req.body;
    
    if (!message || typeof message !== "string") {
      return res.status(400).json({
        success: false,
        error: "Message is required",
      });
    }
    
    // Get conversation to check permissions and determine sender type
    const conversationDoc = await db
        .collection("conversations")
        .doc(conversationId)
        .get();
    
    if (!conversationDoc.exists) {
      return res.status(404).json({
        success: false,
        error: "Conversation not found",
      });
    }
    
    const conversationData = conversationDoc.data() as any;
    const userHasAccess = conversationData.userId === req.user?.uid ||
                         conversationData.companyId === req.user?.uid ||
                         req.user?.admin;
    
    if (!userHasAccess) {
      return res.status(403).json({
        success: false,
        error: "Permission denied",
      });
    }
    
    // Determine sender type
    const senderType = conversationData.userId === req.user?.uid ? "user" : "company";
    
    // Create message
    const messageData = {
      conversationId,
      senderId: req.user?.uid,
      senderType,
      message,
      messageType,
      timestamp: new Date(),
      readStatus: false,
      metadata: metadata || null,
    };
    
    const messageRef = await db
        .collection("messages")
        .doc(conversationId)
        .collection("messages")
        .add(messageData);
    
    // Update conversation
    await db.collection("conversations").doc(conversationId).update({
      lastMessage: message,
      lastUpdated: new Date(),
      [`unreadCount${senderType === "user" ? "Company" : "User"}`]: 
        FieldValue.increment(1),
    });
    
    return res.status(201).json({
      success: true,
      data: {
        id: messageRef.id,
        ...messageData,
      },
    });
  } catch (error) {
    handleApiError(res, error);
    return;
  }
});

/**
 * Mark conversation as read
 * Authenticated endpoint
 */
app.put("/conversations/:conversationId/read", async (req, res) => {
  try {
    const conversationId = req.params.conversationId;
    const {isUser} = req.body;
    
    // Get conversation to check permissions
    const conversationDoc = await db
        .collection("conversations")
        .doc(conversationId)
        .get();
    
    if (!conversationDoc.exists) {
      return res.status(404).json({
        success: false,
        error: "Conversation not found",
      });
    }
    
    const conversationData = conversationDoc.data() as any;
    const userHasAccess = conversationData.userId === req.user?.uid ||
                         conversationData.companyId === req.user?.uid ||
                         req.user?.admin;
    
    if (!userHasAccess) {
      return res.status(403).json({
        success: false,
        error: "Permission denied",
      });
    }
    
    // Update conversation unread count
    await db.collection("conversations").doc(conversationId).update({
      [`unreadCount${isUser ? "User" : "Company"}`]: 0,
    });
    
    // Mark all messages as read
    const messagesSnapshot = await db
        .collection("messages")
        .doc(conversationId)
        .collection("messages")
        .where("readStatus", "==", false)
        .get();
    
    const batch = db.batch();
    messagesSnapshot.docs.forEach(doc => {
      batch.update(doc.ref, {readStatus: true});
    });
    await batch.commit();
    
    return res.status(200).json({
      success: true,
      message: "Conversation marked as read",
    });
  } catch (error) {
    handleApiError(res, error);
    return;
  }
});

/**
 * Create table booking
 * Authenticated endpoint
 */
app.post("/bookings", async (req, res) => {
  try {
    const {companyId, date, numberOfPeople, comments, images = []} = req.body;
    
    if (!companyId || !date || !numberOfPeople) {
      return res.status(400).json({
        success: false,
        error: "Company ID, date, and number of people are required",
      });
    }
    
    // Get user and company info
    if (!req.user?.uid) {
      return res.status(401).json({
        success: false,
        error: "User not authenticated",
      });
    }
    
    const userDoc = await db.collection("users").doc(req.user.uid).get();
    const companyDoc = await db.collection("companies").doc(companyId).get();
    
    if (!userDoc.exists || !companyDoc.exists) {
      return res.status(404).json({
        success: false,
        error: "User or company not found",
      });
    }
    
    const userData = userDoc.data() as any;
    const companyData = companyDoc.data() as any;
    
    // Create or get conversation
    const conversationId = `${req.user?.uid}_${companyId}`;
    let conversationDoc = await db.collection("conversations").doc(conversationId).get();
    
    if (!conversationDoc.exists) {
      // Create new conversation
      await db.collection("conversations").doc(conversationId).set({
        userId: req.user?.uid,
        companyId,
        userFirstName: userData.userFirstName || "",
        userLastName: userData.userLastName || "",
        companyName: companyData.companyName || "",
        lastMessage: null,
        lastUpdated: new Date(),
        unreadCountUser: 0,
        unreadCountCompany: 0,
        isActive: true,
        createdAt: new Date(),
      });
    }
    
    // Create booking
    const bookingData = {
      userId: req.user?.uid,
      companyId,
      conversationId,
      date: new Date(date),
      numberOfPeople,
      comments: comments || null,
      images,
      status: "pending",
      createdAt: new Date(),
      userFirstName: userData.userFirstName,
      userLastName: userData.userLastName,
      companyName: companyData.companyName,
    };
    
    const bookingRef = await db.collection("table_bookings").add(bookingData);
    
    // Send booking message
    const messageData = {
      conversationId,
      senderId: req.user?.uid,
      senderType: "user",
      message: `Table booking request submitted for ${new Date(date).toLocaleDateString()} at ${new Date(date).toLocaleTimeString()} for ${numberOfPeople} people.`,
      messageType: "booking",
      timestamp: new Date(),
      readStatus: false,
      metadata: {
        bookingId: bookingRef.id,
        date: new Date(date),
        numberOfPeople,
        comments,
        images,
      },
    };
    
    await db
        .collection("messages")
        .doc(conversationId)
        .collection("messages")
        .add(messageData);
    
    // Update conversation
    await db.collection("conversations").doc(conversationId).update({
      lastMessage: messageData.message,
      lastUpdated: new Date(),
      unreadCountCompany: FieldValue.increment(1),
    });
    
    return res.status(201).json({
      success: true,
      data: {
        bookingId: bookingRef.id,
        ...bookingData,
      },
    });
  } catch (error) {
    handleApiError(res, error);
    return;
  }
});

/**
 * Update booking status
 * Authenticated endpoint
 */
app.put("/bookings/:bookingId/status", async (req, res) => {
  try {
    const bookingId = req.params.bookingId;
    const {status, responseMessage} = req.body;
    
    if (!status || !["pending", "confirmed", "rejected", "cancelled"].includes(status)) {
      return res.status(400).json({
        success: false,
        error: "Valid status is required",
      });
    }
    
    // Get booking
    const bookingDoc = await db.collection("table_bookings").doc(bookingId).get();
    if (!bookingDoc.exists) {
      return res.status(404).json({
        success: false,
        error: "Booking not found",
      });
    }
    
    const bookingData = bookingDoc.data() as any;
    
    // Check if user has permission to update this booking
    const companyDoc = await db.collection("companies").doc(bookingData.companyId).get();
    if (!companyDoc.exists) {
      return res.status(404).json({
        success: false,
        error: "Company not found",
      });
    }
    
    const companyData = companyDoc.data() as any;
    const userHasAccess = companyData.admins?.includes(req.user?.uid) ||
                         companyData.editors?.includes(req.user?.uid) ||
                         companyData.promotors?.includes(req.user?.uid) ||
                         companyData.tableStaff?.includes(req.user?.uid) ||
                         companyData.staff?.includes(req.user?.uid) ||
                         req.user?.admin;
    
    if (!userHasAccess) {
      return res.status(403).json({
        success: false,
        error: "Permission denied",
      });
    }
    
    // Update booking status
    await db.collection("table_bookings").doc(bookingId).update({
      status,
    });
    
    // Send status update message
    let message;
    switch (status) {
      case "confirmed":
        message = "Your table booking has been confirmed! 🎉";
        break;
      case "rejected":
        message = "Your table booking has been rejected.";
        break;
      case "cancelled":
        message = "Your table booking has been cancelled.";
        break;
      default:
        message = "Your table booking status has been updated.";
    }
    
    if (responseMessage) {
      message += `\n\n${responseMessage}`;
    }
    
    const messageData = {
      conversationId: bookingData.conversationId,
      senderId: req.user?.uid,
      senderType: "company",
      message,
      messageType: "booking",
      timestamp: new Date(),
      readStatus: false,
      metadata: {
        bookingId,
        status,
      },
    };
    
    await db
        .collection("messages")
        .doc(bookingData.conversationId)
        .collection("messages")
        .add(messageData);
    
    // Update conversation
    await db.collection("conversations").doc(bookingData.conversationId).update({
      lastMessage: message,
      lastUpdated: new Date(),
      unreadCountUser: FieldValue.increment(1),
    });
    
    return res.status(200).json({
      success: true,
      message: "Booking status updated successfully",
    });
  } catch (error) {
    handleApiError(res, error);
    return;
  }
});

/**
 * Get user bookings
 * Authenticated endpoint
 */
app.get("/bookings/user/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;
    
    // Check if requesting user has permission to access this user's bookings
    if ((req.user?.uid !== userId) && !req.user?.admin) {
      return res.status(403).json({
        success: false,
        error: "Permission denied",
      });
    }
    
    const bookingsSnapshot = await db
        .collection("table_bookings")
        .where("userId", "==", userId)
        .orderBy("createdAt", "desc")
        .get();
    
    const bookings = bookingsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    return res.status(200).json({
      success: true,
      data: bookings,
    });
  } catch (error) {
    handleApiError(res, error);
    return;
  }
});

/**
 * Get company bookings
 * Authenticated endpoint
 */
app.get("/bookings/company/:companyId", async (req, res) => {
  try {
    const companyId = req.params.companyId;
    
    // Check if user has access to this company
    const companyDoc = await db.collection("companies").doc(companyId).get();
    if (!companyDoc.exists) {
      return res.status(404).json({
        success: false,
        error: "Company not found",
      });
    }
    
    const companyData = companyDoc.data() as any;
    const userHasAccess = companyData.admins?.includes(req.user?.uid) ||
                         companyData.editors?.includes(req.user?.uid) ||
                         companyData.promotors?.includes(req.user?.uid) ||
                         companyData.tableStaff?.includes(req.user?.uid) ||
                         companyData.staff?.includes(req.user?.uid) ||
                         req.user?.admin;
    
    if (!userHasAccess) {
      return res.status(403).json({
        success: false,
        error: "Permission denied",
      });
    }
    
    const bookingsSnapshot = await db
        .collection("table_bookings")
        .where("companyId", "==", companyId)
        .orderBy("createdAt", "desc")
        .get();
    
    const bookings = bookingsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    return res.status(200).json({
      success: true,
      data: bookings,
    });
  } catch (error) {
    handleApiError(res, error);
    return;
  }
});

// Export the Express app as a Firebase Function
export const chat = onRequest({cors: true}, app); 
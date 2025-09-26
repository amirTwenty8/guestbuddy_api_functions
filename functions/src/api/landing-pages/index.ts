import {onRequest} from "firebase-functions/v2/https";
import {getFirestore} from "firebase-admin/firestore";
import * as express from "express";
import * as cors from "cors";
import {authenticateUser} from "../../middleware/auth";
import {handleApiError} from "../../utils/error-handler";
import {validateRequest} from "../../utils/validation";
import * as Joi from "joi";

// Get Firestore instance
const db = getFirestore();

const app = express();

// Configure CORS to allow requests from your frontend
const corsOptions = {
  origin: [
    'http://localhost:3000',
    'http://localhost:3001', 
    'https://portal.guestbuddy.net', // Replace with your actual frontend domain
    /\.vercel\.app$/, // Allow Vercel preview deployments
    /\.netlify\.app$/, // Allow Netlify deployments
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-company-id'],
};

// Apply CORS middleware
app.use(cors(corsOptions));

// Apply authentication middleware to all routes except public endpoints
app.use((req, res, next) => {
  // Skip authentication for public landing page endpoints
  if (req.path.startsWith('/public/') || req.path.includes('/public/')) {
    return next();
  }
  return authenticateUser(req, res, next);
});

/**
 * Landing Page validation schemas
 */
const landingPageSchemas = {
  createLandingPage: Joi.object({
    title: Joi.string().required().min(1).max(200),
    description: Joi.string().optional().allow("").max(1000),
    eventId: Joi.string().optional().allow(""),
    guestCategoryId: Joi.string().optional().allow(""),
    guestListId: Joi.string().optional().allow(""),
    guestType: Joi.string().optional().valid("free", "paying").default("free"),
    showTickets: Joi.boolean().default(false),
    enableGuestRegistration: Joi.boolean().default(false),
    isPasswordProtected: Joi.boolean().default(false),
    password: Joi.string().optional().allow("").when("isPasswordProtected", {
      is: true,
      then: Joi.string().required().min(1),
      otherwise: Joi.string().optional().allow("")
    }),
    backgroundImageUrl: Joi.string().optional().allow("").uri(),
    customStyles: Joi.object({
      primaryColor: Joi.string().optional().default("#3b82f6"),
      textColor: Joi.string().optional().default("#ffffff"),
      backgroundColor: Joi.string().optional().default("#111827")
    }).optional()
  }),
  
  updateLandingPage: Joi.object({
    title: Joi.string().optional().min(1).max(200),
    description: Joi.string().optional().allow("").max(1000),
    eventId: Joi.string().optional().allow(""),
    guestCategoryId: Joi.string().optional().allow(""),
    guestListId: Joi.string().optional().allow(""),
    guestType: Joi.string().optional().valid("free", "paying"),
    showTickets: Joi.boolean().optional(),
    enableGuestRegistration: Joi.boolean().optional(),
    isPasswordProtected: Joi.boolean().optional(),
    password: Joi.string().optional().allow("").when("isPasswordProtected", {
      is: true,
      then: Joi.string().required().min(1),
      otherwise: Joi.string().optional().allow("")
    }),
    backgroundImageUrl: Joi.string().optional().allow("").uri(),
    customStyles: Joi.object({
      primaryColor: Joi.string().optional(),
      textColor: Joi.string().optional(),
      backgroundColor: Joi.string().optional()
    }).optional(),
    isActive: Joi.boolean().optional()
  }).min(1) // At least one field must be provided for update
};

/**
 * Create a new landing page
 */
app.post("/", validateRequest(landingPageSchemas.createLandingPage), async (req, res) => {
  try {
    const userId = req.user?.uid;
    const companyId = req.headers["x-company-id"] as string;
    
    if (!companyId) {
      return res.status(400).json({
        success: false,
        error: "Company ID is required"
      });
    }

    const data = req.body;
    
    // Validate that event exists if eventId is provided
    if (data.eventId) {
      const eventRef = db.collection("companies")
        .doc(companyId)
        .collection("events")
        .doc(data.eventId);
      const eventDoc = await eventRef.get();
      
      if (!eventDoc.exists) {
        return res.status(400).json({
          success: false,
          error: "Event not found"
        });
      }

      // Event is already scoped to the company, so no additional check needed
    }

    // Validate that guest category exists if guestCategoryId is provided
    if (data.guestCategoryId) {
      const categoryRef = db.collection("companies")
        .doc(companyId)
        .collection("categories")
        .doc(data.guestCategoryId);
      const categoryDoc = await categoryRef.get();
      
      if (!categoryDoc.exists) {
        return res.status(400).json({
          success: false,
          error: "Guest category not found"
        });
      }
    }

    // Validate that guest list exists if guestListId is provided
    if (data.guestListId && data.eventId) {
      const guestListRef = db.collection("companies")
        .doc(companyId)
        .collection("events")
        .doc(data.eventId)
        .collection("guest_lists")
        .doc(data.guestListId);
      const guestListDoc = await guestListRef.get();
      
      if (!guestListDoc.exists) {
        return res.status(400).json({
          success: false,
          error: "Guest list not found"
        });
      }
    }

    // Get company data to access the company slug
    const companyRef = db.collection("companies").doc(companyId);
    const companyDoc = await companyRef.get();
    
    if (!companyDoc.exists) {
      return res.status(400).json({
        success: false,
        error: "Company not found"
      });
    }
    
    const companyData = companyDoc.data();
    const companySlug = companyData?.slug;
    
    if (!companySlug) {
      return res.status(400).json({
        success: false,
        error: "Company slug not found"
      });
    }

    // Generate a unique slug for the landing page using company slug + title
    const generateSlug = (title: string): string => {
      return title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
    };

    const titleSlug = generateSlug(data.title);
    let slug = `${companySlug}/${titleSlug}`;
    let counter = 1;
    
    // Ensure slug is unique globally (across all companies)
    while (true) {
      // Check if this slug exists in any company's landing pages
      const companiesSnapshot = await db.collection("companies").get();
      let slugExists = false;
      
      for (const companyDocCheck of companiesSnapshot.docs) {
        const existingPage = await db.collection("companies")
          .doc(companyDocCheck.id)
          .collection("landingPages")
          .where("slug", "==", slug)
          .get();
        
        if (!existingPage.empty) {
          slugExists = true;
          break;
        }
      }
      
      if (!slugExists) {
        break;
      }
      
      slug = `${companySlug}/${titleSlug}-${counter}`;
      counter++;
    }

    // Create the landing page
    const newLandingPage = {
      title: data.title,
      description: data.description || "",
      slug,
      eventId: data.eventId || null,
      guestCategoryId: data.guestCategoryId || "",
      guestListId: data.guestListId || "",
      guestType: data.guestType || "free",
      showTickets: data.showTickets || false,
      enableGuestRegistration: data.enableGuestRegistration || false,
      isPasswordProtected: data.isPasswordProtected || false,
      password: data.isPasswordProtected ? data.password : null,
      backgroundImageUrl: data.backgroundImageUrl || null,
      customStyles: {
        primaryColor: data.customStyles?.primaryColor || "#3b82f6",
        textColor: data.customStyles?.textColor || "#ffffff",
        backgroundColor: data.customStyles?.backgroundColor || "#111827"
      },
      createdBy: userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isActive: true,
      views: 0,
      conversions: 0
    };
    
    const docRef = await db.collection("companies")
      .doc(companyId)
      .collection("landingPages")
      .add(newLandingPage);
    
    // Get the created document with its ID
    const createdDoc = await docRef.get();
    const createdData = createdDoc.data();
    
    return res.status(201).json({
      success: true,
      data: {
        id: docRef.id,
        ...createdData,
        url: `${req.get('origin') || 'https://your-domain.com'}/landing/${slug}` // Generate the public URL
      },
      message: "Landing page created successfully"
    });
  } catch (error) {
    console.error("Error creating landing page:", error);
    handleApiError(res, error);
    return;
  }
});

/**
 * Get all landing pages for a company
 */
app.get("/", async (req, res) => {
  try {
    const companyId = req.headers["x-company-id"] as string;
    
    if (!companyId) {
      return res.status(400).json({
        success: false,
        error: "Company ID is required"
      });
    }

    const {status} = req.query;
    
    let query = db.collection("companies")
      .doc(companyId)
      .collection("landingPages")
      .orderBy("createdAt", "desc");
    
    // Apply status filter if provided
    if (status === "active") {
      query = query.where("isActive", "==", true);
    } else if (status === "inactive") {
      query = query.where("isActive", "==", false);
    }
    
    const snapshot = await query.get();
    const landingPages = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        url: `${req.get('origin') || 'https://your-domain.com'}/landing/${data.slug}`
      };
    });
    
    return res.status(200).json({
      success: true,
      data: landingPages
    });
  } catch (error) {
    console.error("Error fetching landing pages:", error);
    handleApiError(res, error);
    return;
  }
});

/**
 * Get a specific landing page by ID
 */
app.get("/:id", async (req, res) => {
  try {
    const {id} = req.params;
    const companyId = req.headers["x-company-id"] as string;
    
    if (!companyId) {
      return res.status(400).json({
        success: false,
        error: "Company ID is required"
      });
    }
    
    const docRef = db.collection("companies")
      .doc(companyId)
      .collection("landingPages")
      .doc(id);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        error: "Landing page not found"
      });
    }
    
    const data = doc.data();
    
    return res.status(200).json({
      success: true,
      data: {
        id: doc.id,
        ...data,
        url: `${req.get('origin') || 'https://your-domain.com'}/landing/${data?.slug}`
      }
    });
  } catch (error) {
    console.error("Error fetching landing page:", error);
    handleApiError(res, error);
    return;
  }
});

/**
 * Update a landing page
 */
app.put("/:id", validateRequest(landingPageSchemas.updateLandingPage), async (req, res) => {
  try {
    const {id} = req.params;
    const companyId = req.headers["x-company-id"] as string;
    
    if (!companyId) {
      return res.status(400).json({
        success: false,
        error: "Company ID is required"
      });
    }

    const data = req.body;
    
    // Get the existing landing page
    const docRef = db.collection("companies")
      .doc(companyId)
      .collection("landingPages")
      .doc(id);
    const existingDoc = await docRef.get();
    
    if (!existingDoc.exists) {
      return res.status(404).json({
        success: false,
        error: "Landing page not found"
      });
    }
    
    const existingData = existingDoc.data();
    if (!existingData) {
      return res.status(404).json({
        success: false,
        error: "Landing page data not found"
      });
    }
    
    // Validate that event exists if eventId is being updated
    if (data.eventId !== undefined && data.eventId !== "") {
      const eventRef = db.collection("companies")
        .doc(companyId)
        .collection("events")
        .doc(data.eventId);
      const eventDoc = await eventRef.get();
      
      if (!eventDoc.exists) {
        return res.status(400).json({
          success: false,
          error: "Event not found"
        });
      }
    }

    // Validate that guest category exists if guestCategoryId is being updated (and not being cleared)
    if (data.guestCategoryId !== undefined && data.guestCategoryId !== "" && data.guestCategoryId !== null) {
      const categoryRef = db.collection("companies")
        .doc(companyId)
        .collection("categories")
        .doc(data.guestCategoryId);
      const categoryDoc = await categoryRef.get();
      
      if (!categoryDoc.exists) {
        return res.status(400).json({
          success: false,
          error: "Guest category not found"
        });
      }
    }

    // Validate that guest list exists if guestListId is being updated (and not being cleared)
    if (data.guestListId !== undefined && data.guestListId !== "" && data.guestListId !== null) {
      // We need to check if we have an eventId (either from data or existing)
      const eventId = data.eventId !== undefined ? data.eventId : existingData.eventId;
      
      if (!eventId) {
        return res.status(400).json({
          success: false,
          error: "Guest list requires an associated event"
        });
      }
      
      const guestListRef = db.collection("companies")
        .doc(companyId)
        .collection("events")
        .doc(eventId)
        .collection("guest_lists")
        .doc(data.guestListId);
      const guestListDoc = await guestListRef.get();
      
      if (!guestListDoc.exists) {
        return res.status(400).json({
          success: false,
          error: "Guest list not found"
        });
      }
    }

    // Prepare the update data
    const updateData: any = {
      updatedAt: new Date().toISOString()
    };

    // Handle title change and slug regeneration
    if (data.title && data.title !== existingData.title) {
      // Get company data to access the company slug
      const companyRef = db.collection("companies").doc(companyId);
      const companyDoc = await companyRef.get();
      
      if (!companyDoc.exists) {
        return res.status(400).json({
          success: false,
          error: "Company not found"
        });
      }
      
      const companyData = companyDoc.data();
      const companySlug = companyData?.slug;
      
      if (!companySlug) {
        return res.status(400).json({
          success: false,
          error: "Company slug not found"
        });
      }

      // Generate a new slug for the updated title
      const generateSlug = (title: string): string => {
        return title
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '')
          .trim()
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-');
      };

      const titleSlug = generateSlug(data.title);
      let newSlug = `${companySlug}/${titleSlug}`;
      let counter = 1;
      
      // Ensure new slug is unique globally (excluding the current document)
      while (true) {
        const companiesSnapshot = await db.collection("companies").get();
        let slugExists = false;
        
        for (const companyDocCheck of companiesSnapshot.docs) {
          const existingPage = await db.collection("companies")
            .doc(companyDocCheck.id)
            .collection("landingPages")
            .where("slug", "==", newSlug)
            .get();
          
          // Check if the slug exists and it's not the current document
          if (!existingPage.empty && existingPage.docs[0].id !== id) {
            slugExists = true;
            break;
          }
        }
        
        if (!slugExists) {
          break;
        }
        
        newSlug = `${companySlug}/${titleSlug}-${counter}`;
        counter++;
      }
      
      updateData.title = data.title;
      updateData.slug = newSlug;
    }

    // Handle other field updates
    if (data.description !== undefined) {
      updateData.description = data.description;
    }
    
    if (data.eventId !== undefined) {
      updateData.eventId = data.eventId || null;
    }
    
    if (data.guestCategoryId !== undefined) {
      updateData.guestCategoryId = data.guestCategoryId; // Allow empty string, null, or actual ID
    }
    
    if (data.guestListId !== undefined) {
      updateData.guestListId = data.guestListId; // Allow empty string, null, or actual ID
    }
    
    if (data.guestType !== undefined) {
      updateData.guestType = data.guestType;
    }
    
    if (data.showTickets !== undefined) {
      updateData.showTickets = data.showTickets;
    }
    
    if (data.enableGuestRegistration !== undefined) {
      updateData.enableGuestRegistration = data.enableGuestRegistration;
    }
    
    if (data.isPasswordProtected !== undefined) {
      updateData.isPasswordProtected = data.isPasswordProtected;
      // Handle password field based on isPasswordProtected value
      if (data.isPasswordProtected) {
        updateData.password = data.password || existingData.password;
      } else {
        updateData.password = null;
      }
    } else if (data.password !== undefined) {
      // If only password is being updated, keep existing isPasswordProtected value
      if (existingData.isPasswordProtected) {
        updateData.password = data.password;
      }
    }
    
    if (data.backgroundImageUrl !== undefined) {
      updateData.backgroundImageUrl = data.backgroundImageUrl || null;
    }
    
    if (data.customStyles !== undefined) {
      // Merge with existing custom styles
      updateData.customStyles = {
        ...existingData.customStyles,
        ...data.customStyles
      };
    }
    
    if (data.isActive !== undefined) {
      updateData.isActive = data.isActive;
    }
    
    // Update the document
    await docRef.update(updateData);
    
    // Get the updated document
    const updatedDoc = await docRef.get();
    const updatedData = updatedDoc.data();
    
    return res.status(200).json({
      success: true,
      data: {
        id: updatedDoc.id,
        ...updatedData,
        url: `${req.get('origin') || 'https://your-domain.com'}/landing/${updatedData?.slug}`
      },
      message: "Landing page updated successfully"
    });
  } catch (error) {
    console.error("Error updating landing page:", error);
    handleApiError(res, error);
    return;
  }
});

/**
 * Delete a landing page
 */
app.delete("/:id", async (req, res) => {
  try {
    const {id} = req.params;
    const companyId = req.headers["x-company-id"] as string;
    
    if (!companyId) {
      return res.status(400).json({
        success: false,
        error: "Company ID is required"
      });
    }
    
    const docRef = db.collection("companies")
      .doc(companyId)
      .collection("landingPages")
      .doc(id);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        error: "Landing page not found"
      });
    }
    
    await docRef.delete();
    
    return res.status(200).json({
      success: true,
      message: "Landing page deleted successfully"
    });
  } catch (error) {
    console.error("Error deleting landing page:", error);
    handleApiError(res, error);
    return;
  }
});

/**
 * Get landing page by slug (public endpoint for actual landing page display)
 */
app.get("/public/:slug(*)", async (req, res) => {
  try {
    const {slug} = req.params;
    
    // We need to search across all companies for the slug
    // First, get all companies
    const companiesSnapshot = await db.collection("companies").get();
    
    let foundLandingPage = null;
    let foundCompanyId = null;
    let foundDocRef = null;
    
    // Search through each company's landing pages
    for (const companyDoc of companiesSnapshot.docs) {
      const companyId = companyDoc.id;
      const landingPagesQuery = db.collection("companies")
        .doc(companyId)
        .collection("landingPages")
        .where("slug", "==", slug)
        .where("isActive", "==", true)
        .limit(1);
      
      const landingPagesSnapshot = await landingPagesQuery.get();
      
      if (!landingPagesSnapshot.empty) {
        const doc = landingPagesSnapshot.docs[0];
        foundLandingPage = doc.data();
        foundCompanyId = companyId;
        foundDocRef = doc.ref;
        break;
      }
    }
    
    if (!foundLandingPage || !foundDocRef || !foundCompanyId) {
      return res.status(404).json({
        success: false,
        error: "Landing page not found"
      });
    }
    
    // Increment view count
    await foundDocRef.update({
      views: (foundLandingPage.views || 0) + 1
    });
    
    // Don't return sensitive data like password in public endpoint
    const publicData = {
      id: foundDocRef.id,
      title: foundLandingPage.title,
      description: foundLandingPage.description,
      slug: foundLandingPage.slug,
      eventId: foundLandingPage.eventId,
      guestCategoryId: foundLandingPage.guestCategoryId,
      guestListId: foundLandingPage.guestListId,
      guestType: foundLandingPage.guestType || "free",
      showTickets: foundLandingPage.showTickets,
      enableGuestRegistration: foundLandingPage.enableGuestRegistration,
      isPasswordProtected: foundLandingPage.isPasswordProtected,
      backgroundImageUrl: foundLandingPage.backgroundImageUrl,
      customStyles: foundLandingPage.customStyles,
      companyId: foundCompanyId,
      views: (foundLandingPage.views || 0) + 1
    };
    
    return res.status(200).json({
      success: true,
      data: publicData
    });
  } catch (error) {
    console.error("Error fetching public landing page:", error);
    handleApiError(res, error);
    return;
  }
});

/**
 * Handle guest registration from a landing page (public endpoint)
 */
app.post("/public/:slug(*)/register", async (req, res) => {
  try {
    const {slug} = req.params;
    const {firstName, lastName, email} = req.body;
    
    // Validate required fields
    if (!firstName || !lastName || !email) {
      return res.status(400).json({
        success: false,
        error: "First name, last name, and email are required"
      });
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: "Invalid email format"
      });
    }
    
    // Find the landing page by slug
    const companiesSnapshot = await db.collection("companies").get();
    
    let foundLandingPage = null;
    let foundCompanyId = null;
    let foundDocRef = null;
    
    for (const companyDoc of companiesSnapshot.docs) {
      const companyId = companyDoc.id;
      const landingPagesQuery = db.collection("companies")
        .doc(companyId)
        .collection("landingPages")
        .where("slug", "==", slug)
        .where("isActive", "==", true)
        .where("enableGuestRegistration", "==", true)
        .limit(1);
      
      const landingPagesSnapshot = await landingPagesQuery.get();
      
      if (!landingPagesSnapshot.empty) {
        const doc = landingPagesSnapshot.docs[0];
        foundLandingPage = doc.data();
        foundCompanyId = companyId;
        foundDocRef = doc.ref;
        break;
      }
    }
    
    if (!foundLandingPage || !foundDocRef || !foundCompanyId) {
      return res.status(404).json({
        success: false,
        error: "Landing page not found or guest registration not enabled"
      });
    }
    
    // Check if landing page has an associated event
    if (!foundLandingPage.eventId) {
      return res.status(400).json({
        success: false,
        error: "Landing page must be associated with an event for guest registration"
      });
    }
    
    // Determine which guest list to use (default to 'main' if not specified)
    const targetGuestListId = foundLandingPage.guestListId || 'main';
    
    // Check if guest list exists
    const guestListRef = db.collection("companies")
      .doc(foundCompanyId)
      .collection("events")
      .doc(foundLandingPage.eventId)
      .collection("guest_lists")
      .doc(targetGuestListId);
    
    const guestListDoc = await guestListRef.get();
    if (!guestListDoc.exists) {
      return res.status(400).json({
        success: false,
        error: "Target guest list not found"
      });
    }
    
    // Check if guest already exists in this guest list
    const guestListData = guestListDoc.data();
    const existingGuests = guestListData?.guestList || [];
    const existingGuest = existingGuests.find((guest: any) => 
      guest.email && guest.email.toLowerCase() === email.toLowerCase()
    );
    
    if (existingGuest) {
      return res.status(409).json({
        success: false,
        error: "A guest with this email is already registered"
      });
    }
    
    // Generate a unique guest ID
    const guestId = db.collection("temp").doc().id;
    
    // Determine if guest should be free or paying based on landing page setting
    const isFreeGuest = foundLandingPage.guestType === "free";
    
    // Get category name if category is selected
    let categoryNames = [];
    if (foundLandingPage.guestCategoryId) {
      const categoryRef = db.collection("companies")
        .doc(foundCompanyId)
        .collection("categories")
        .doc(foundLandingPage.guestCategoryId);
      const categoryDoc = await categoryRef.get();
      
      if (categoryDoc.exists) {
        const categoryData = categoryDoc.data();
        const categoryName = categoryData?.name;
        if (categoryName) {
          categoryNames.push(categoryName);
        }
      }
    }
    
    // Create the new guest object with only essential fields
    const newGuest = {
      guestId: guestId,
      guestName: `${firstName.trim()} ${lastName.trim()}`,
      email: email.toLowerCase().trim(),
      categories: categoryNames,
      comment: "Landing page registration",
      freeCheckedIn: 0,
      freeGuests: isFreeGuest ? 1 : 0,
      normalCheckedIn: 0,
      normalGuests: isFreeGuest ? 0 : 1,
      logs: [],
      landingPageId: foundDocRef.id
    };
    
    // Add guest to the guestList array
    const updatedGuestList = [...existingGuests, newGuest];
    
    // Calculate updated counters
    const freeGuestsCount = updatedGuestList.filter((guest: any) => guest.isFree).length;
    const normalGuestsCount = updatedGuestList.filter((guest: any) => !guest.isFree).length;
    
    // Update the guest list document with the new guest
    await guestListRef.update({
      guestList: updatedGuestList,
      lastUpdated: new Date().toISOString(),
      guestCount: updatedGuestList.length,
      freeGuests: freeGuestsCount,
      normalGuests: normalGuestsCount,
      totalGuests: updatedGuestList.length
    });
    
    // Update landing page conversion count
    await foundDocRef.update({
      conversions: (foundLandingPage.conversions || 0) + 1
    });
    
    return res.status(201).json({
      success: true,
      message: `Successfully registered as ${isFreeGuest ? 'free' : 'paying'} guest for the guest list`,
      data: {
        guestId: guestId,
        guestName: newGuest.guestName,
        email: newGuest.email,
        guestType: isFreeGuest ? 'free' : 'paying',
        guestListName: guestListData?.name || 'Main Guest List',
        eventId: foundLandingPage.eventId,
        totalGuestsInList: updatedGuestList.length,
        freeGuestsCount: freeGuestsCount,
        normalGuestsCount: normalGuestsCount
      }
    });
    
  } catch (error) {
    console.error("Error processing guest registration:", error);
    handleApiError(res, error);
    return;
  }
});

// Export the Express app as a Firebase Function
export const landingPages = onRequest(app);
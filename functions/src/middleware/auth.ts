import {Request, Response, NextFunction} from "express";
import {getAuth} from "firebase-admin/auth";
import {HttpsError} from "firebase-functions/v2/https";

// Get auth instance directly instead of importing from index.ts
const auth = getAuth();

/**
 * Middleware to verify Firebase authentication token
 * Extracts the token from Authorization header and verifies it
 * Adds the decoded token to the request object
 */
export const authenticateUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new HttpsError("unauthenticated", "Unauthorized - No token provided");
    }
    
    const token = authHeader.split("Bearer ")[1];
    
    try {
      const decodedToken = await auth.verifyIdToken(token);
      // Add user info to request object
      (req as any).user = decodedToken;
      next();
    } catch (error) {
      throw new HttpsError("unauthenticated", "Unauthorized - Invalid token");
    }
  } catch (error) {
    if (error instanceof HttpsError) {
      res.status(401).json({error: error.message});
    } else {
      res.status(500).json({error: "Internal server error"});
    }
    return;
  }
};
 
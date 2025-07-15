import {Request, Response, NextFunction} from "express";
import * as Joi from "joi";
import {handleApiError} from "./error-handler";
import {HttpsError} from "firebase-functions/v2/https";

/**
 * Middleware factory for request validation
 * @param schema Joi validation schema
 * @param property Request property to validate ('body', 'query', 'params')
 */
export const validateRequest = (
  schema: Joi.ObjectSchema,
  property: "body" | "query" | "params" = "body"
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const {error} = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true,
    });

    if (!error) {
      next();
      return;
    }

    const errorMessage = error.details
      .map((detail) => detail.message)
      .join(", ");

    const httpsError = new HttpsError(
      "invalid-argument",
      `Validation error: ${errorMessage}`
    );

    handleApiError(res, httpsError);
  };
};

/**
 * Common validation schemas
 */
export const schemas = {
  userId: Joi.string().required().min(1).max(128),

  email: Joi.string().email().required(),

  displayName: Joi.string().min(1).max(50),

  photoURL: Joi.string().uri(),

  userProfile: Joi.object({
    displayName: Joi.string().min(1).max(50).optional(),
    photoURL: Joi.string().uri().optional(),
  }),
};

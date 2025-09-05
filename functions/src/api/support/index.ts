import {onCall} from "firebase-functions/v2/https";
import {getFirestore, Timestamp} from "firebase-admin/firestore";
import * as Joi from "joi";
import {defineSecret} from "firebase-functions/params";
import * as nodemailer from 'nodemailer';
import * as fs from 'fs';
import * as path from 'path';

// Define secrets
const smtpUser = defineSecret("SMTP_USER");
const smtpPass = defineSecret("SMTP_PASS");
const smtpHost = defineSecret("SMTP_HOST");
const smtpPort = defineSecret("SMTP_PORT");

// Get Firestore instance
const db = getFirestore();

// Validation schema for contact form
const contactFormSchema = Joi.object({
  name: Joi.string().required().min(1).max(100),
  email: Joi.string().email().required(),
  companyName: Joi.string().allow('').max(100),
  companyId: Joi.string().required(), // Company ID is now required
  subject: Joi.string().required().valid(
    'general', 'technical', 'billing', 'feature', 
    'bug', 'account', 'integration', 'training', 'other'
  ),
  message: Joi.string().required().min(10).max(2000),
  attachments: Joi.array().items(
    Joi.object({
      name: Joi.string().required(),
      type: Joi.string().required().pattern(/^image\//),
      size: Joi.number().required().max(10 * 1024 * 1024), // 10MB max
      data: Joi.string().required().pattern(/^data:image\/[a-zA-Z]+;base64,/)
    })
  ).max(3).optional()
});

// Type definitions
interface ContactFormData {
  name: string;
  email: string;
  companyName?: string;
  companyId: string; // Company ID is now required
  subject: string;
  message: string;
  attachments?: Array<{
    name: string;
    type: string;
    size: number;
    data: string;
  }>;
}


// Function to get the base64 encoded logo
function getLogoBase64(): string {
  try {
    // Try multiple possible paths for Firebase Functions environment
    const possiblePaths = [
      path.join(__dirname, '../../assets/images/guestbuddy-new-logo-white.svg'),
      path.join(__dirname, '../../../assets/images/guestbuddy-new-logo-white.svg'),
      path.join(process.cwd(), 'src/assets/images/guestbuddy-new-logo-white.svg'),
      path.join(process.cwd(), 'functions/src/assets/images/guestbuddy-new-logo-white.svg'),
    ];

    let logoBuffer: Buffer | null = null;

    for (const logoPath of possiblePaths) {
      try {
        if (fs.existsSync(logoPath)) {
          logoBuffer = fs.readFileSync(logoPath);
          console.log('Logo found at:', logoPath);
          break;
        }
      } catch (err) {
        console.log('Failed to read from:', logoPath, err);
      }
    }

    if (!logoBuffer) {
      console.error('Logo file not found in any of the expected locations');
      return '';
    }

    const base64 = logoBuffer.toString('base64');
    return `data:image/svg+xml;base64,${base64}`;
  } catch (error) {
    console.error('Error reading logo file:', error);
    return '';
  }
}

// Create transporter function
function createTransporter() {
  const emailConfig = {
    host: 'smtp.hostinger.com',
    port: parseInt('465'),
    secure: true, // true for 465, false for other ports
    auth: {
      user: 'admin@guestbuddy.net',
      pass: 'ufqSj7pmF9ciR8W!',
    },
  };

  return nodemailer.createTransport(emailConfig);
}

// Function to convert base64 to buffer for attachments
function base64ToBuffer(base64Data: string): Buffer {
  // Remove data URL prefix (e.g., "data:image/png;base64,")
  const base64String = base64Data.split(',')[1];
  return Buffer.from(base64String, 'base64');
}

// Function to get subject label
function getSubjectLabel(subject: string): string {
  const subjectLabels: { [key: string]: string } = {
    'general': 'General Question',
    'technical': 'Technical Issue',
    'billing': 'Billing & Subscription',
    'feature': 'Feature Request',
    'bug': 'Bug Report',
    'account': 'Account Management',
    'integration': 'Integration Support',
    'training': 'Training & Onboarding',
    'other': 'Other'
  };
  return subjectLabels[subject] || 'General Question';
}

// Function to send contact form email to support team
async function sendContactFormEmail(data: ContactFormData, ticketId: string, userId: string): Promise<boolean> {
  try {
    const transporter = createTransporter();
    const subjectLabel = getSubjectLabel(data.subject);
    
    // Prepare email attachments
    const emailAttachments: any[] = [];
    if (data.attachments && data.attachments.length > 0) {
      data.attachments.forEach((attachment, index) => {
        emailAttachments.push({
          filename: attachment.name,
          content: base64ToBuffer(attachment.data),
          contentType: attachment.type
        });
      });
    }

    const logoBase64 = getLogoBase64();

    const mailOptions = {
      from: `"GuestBuddy Support" <admin@guestbuddy.net>`,
      to: 'hello@guestbuddy.net',
      subject: `Support - #${ticketId} - ${subjectLabel}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>New Support Request - GuestBuddy</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
              background-color: #f4f4f4;
            }
            .container {
              background-color: #ffffff;
              padding: 30px;
              border-radius: 10px;
              box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
              border-bottom: 2px solid #e9ecef;
              padding-bottom: 20px;
            }
            .logo {
              text-align: center;
              margin-bottom: 20px;
            }
            .logo img {
              max-width: 200px;
              height: auto;
            }
            .ticket-info {
              background-color: #e3f2fd;
              border-left: 4px solid #2196F3;
              padding: 15px;
              margin: 20px 0;
            }
            .contact-details {
              background-color: #f8f9fa;
              border: 1px solid #e9ecef;
              border-radius: 8px;
              padding: 20px;
              margin: 20px 0;
            }
            .message-content {
              background-color: #ffffff;
              border: 1px solid #dee2e6;
              border-radius: 8px;
              padding: 20px;
              margin: 20px 0;
              white-space: pre-wrap;
              font-family: Arial, sans-serif;
            }
            .footer {
              text-align: center;
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #e9ecef;
              color: #6c757d;
              font-size: 14px;
            }
            .detail-row {
              margin-bottom: 8px;
            }
            .detail-label {
              font-weight: bold;
              color: #495057;
            }
            .attachments-info {
              background-color: #fff3cd;
              border: 1px solid #ffeaa7;
              border-radius: 5px;
              padding: 10px;
              margin: 15px 0;
              color: #856404;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">
                ${logoBase64 ? 
                  `<img src="${logoBase64}" alt="GuestBuddy" />` : 
                  '<div style="font-size: 24px; font-weight: bold; color: #2196F3;">GuestBuddy</div>'
                }
              </div>
              <h1>New Support Request</h1>
            </div>
            
            <div class="ticket-info">
              <strong>Ticket ID:</strong> #${ticketId}<br>
              <strong>Subject:</strong> ${subjectLabel}<br>
              <strong>Submitted:</strong> ${new Date().toLocaleString()}
            </div>
            
            <div class="contact-details">
              <h3>Contact Information</h3>
              <div class="detail-row">
                <span class="detail-label">Name:</span> ${data.name}
              </div>
              <div class="detail-row">
                <span class="detail-label">Email:</span> ${data.email}
              </div>
              ${data.companyName ? `
              <div class="detail-row">
                <span class="detail-label">Company:</span> ${data.companyName}
              </div>
              ` : ''}
              <div class="detail-row">
                <span class="detail-label">User ID:</span> ${userId}
              </div>
              <div class="detail-row">
                <span class="detail-label">Company ID:</span> ${data.companyId}
              </div>
            </div>
            
            <div>
              <h3>Message</h3>
              <div class="message-content">${data.message}</div>
            </div>
            
            ${data.attachments && data.attachments.length > 0 ? `
            <div class="attachments-info">
              <strong>📎 Attachments:</strong> ${data.attachments.length} file(s) attached
              <ul>
                ${data.attachments.map(att => `<li>${att.name} (${(att.size / 1024 / 1024).toFixed(1)} MB)</li>`).join('')}
              </ul>
            </div>
            ` : ''}
            
            <div class="footer">
              <p>This support request was submitted through the GuestBuddy support form.</p>
              <p>Please respond to the customer at: ${data.email}</p>
              <p>© 2025 GuestBuddy. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        New Support Request - GuestBuddy
        
        Ticket ID: #${ticketId}
        Subject: ${subjectLabel}
        Submitted: ${new Date().toLocaleString()}
        
        Contact Information:
        Name: ${data.name}
        Email: ${data.email}
        ${data.companyName ? `Company: ${data.companyName}` : ''}
        User ID: ${userId}
        Company ID: ${data.companyId}
        
        Message:
        ${data.message}
        
        ${data.attachments && data.attachments.length > 0 ? 
          `Attachments: ${data.attachments.length} file(s) attached\n${data.attachments.map(att => `- ${att.name} (${(att.size / 1024 / 1024).toFixed(1)} MB)`).join('\n')}` : 
          ''
        }
        
        This support request was submitted through the GuestBuddy support form.
        Please respond to the customer at: ${data.email}
        © 2025 GuestBuddy. All rights reserved.
      `,
      attachments: emailAttachments
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Support email sent successfully:', info.messageId);
    return true;
  } catch (error) {
    console.error('Error sending support email:', error);
    return false;
  }
}


// Function to generate a unique ticket ID
function generateTicketId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${timestamp}${random}`.toUpperCase();
}

/**
 * Contact Form Submission Function
 * Handles contact form submissions, stores them in Firestore, and sends emails
 */
export const submitContactForm = onCall(
  {
    secrets: [smtpUser, smtpPass, smtpHost, smtpPort],
    enforceAppCheck: false,
  },
  async (request: any) => {
    try {
      console.log("Contact form submission started");
      
      // Check if caller is authenticated
      if (!request.auth) {
        return {
          success: false,
          message: "Authentication required. Please log in to submit a support request.",
        };
      }

      const userId = request.auth.uid;
      console.log("Authenticated user:", userId);
      
      // Validate request data
      const {error, value} = contactFormSchema.validate(request.data, {
        abortEarly: false,
        stripUnknown: true,
      });

      if (error) {
        const errorMessage = error.details
          .map((detail) => detail.message)
          .join(", ");
        console.error("Validation error:", errorMessage);
        throw new Error(`Validation error: ${errorMessage}`);
      }

      const data = value as ContactFormData;
      console.log("Contact form data validated successfully");

      // Generate unique ticket ID
      const ticketId = generateTicketId();
      console.log("Generated ticket ID:", ticketId);

      // Get user information from Firestore
      let userName = 'Unknown User';
      let userEmail = data.email;
      
      try {
        const userDoc = await db.collection('users').doc(userId).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          userName = `${userData?.userFirstName || ''} ${userData?.userLastName || ''}`.trim() || 'Unknown User';
          userEmail = userData?.userEmail || data.email;
        }
      } catch (error) {
        console.log('Could not fetch user data from Firestore:', error);
      }

      // Verify company exists and user has access
      const companyRef = db.collection('companies').doc(data.companyId);
      const companyDoc = await companyRef.get();

      if (!companyDoc.exists) {
        return {
          success: false,
          message: "Company not found. Please contact support.",
        };
      }

      // Store contact form submission in Firestore using ticketId as document ID
      const contactSubmission = {
        // Contact form data
        name: data.name,
        email: data.email,
        companyName: data.companyName || null,
        subject: data.subject,
        subjectLabel: getSubjectLabel(data.subject),
        message: data.message,
        
        // User and company information
        userId: userId,
        companyId: data.companyId,
        submittedByName: userName,
        submittedByEmail: userEmail,
        
        // Attachment information
        attachmentCount: data.attachments ? data.attachments.length : 0,
        attachments: data.attachments ? data.attachments.map(att => ({
          name: att.name,
          type: att.type,
          size: att.size,
          sizeFormatted: `${(att.size / 1024 / 1024).toFixed(1)} MB`
        })) : [],
        
        // Ticket management
        ticketId,
        status: 'new',
        priority: 'normal',
        assignedTo: null,
        
        // Timestamps
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        
        // Email tracking
        supportEmailSent: false,
        confirmationEmailSent: false,
        
        // Additional metadata
        source: 'contact_form',
        customerResponse: null,
        internalNotes: [],
        tags: [data.subject]
      };

      // Save to Firestore using ticketId as document ID
      const docRef = db.collection('support').doc(ticketId);
      await docRef.set(contactSubmission);
      console.log("Contact form submission saved to Firestore with ID:", ticketId);

      // Send only support email (no confirmation email to user)
      const supportEmailSent = await sendContactFormEmail(data, ticketId, userId);

      // Update the document with email status
      await docRef.update({
        supportEmailSent,
        confirmationEmailSent: false, // Not sending confirmation emails
        updatedAt: Timestamp.now()
      });

      if (!supportEmailSent) {
        console.error("Failed to send support email");
        // Still return success as the ticket was created, but log the issue
      }

      console.log("Contact form submission completed successfully");

      return {
        success: true,
        message: "Your support request has been submitted successfully. Our support team will review it and respond directly to your email.",
        ticketId
      };

    } catch (error) {
      console.error("Error processing contact form:", error);
      
      // Return a user-friendly error message
      const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred";
      
      return {
        success: false,
        message: `Failed to submit support request: ${errorMessage}`
      };
    }
  }
);

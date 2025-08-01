# Email Setup Guide for GuestBuddy API

This guide explains how to set up email sending for the verification code system.

## Overview

The GuestBuddy API uses Nodemailer to send verification emails. You need to configure SMTP credentials to enable email sending.

## Current Email Configuration

### Hostinger Email (Currently Used)

The API is currently configured to use Hostinger email with the following settings:

```
SMTP Server: smtp.hostinger.com
Port: 465
Encryption: SSL
Authentication: Required
```

These settings are already configured in the email service and deployed to Firebase.

## Email Configuration Options

### Option 1: Hostinger (Current Configuration)

1. **Access Hostinger Email Settings**:
   - Log in to your Hostinger account
   - Go to Email → Email Accounts
   - Find your email account settings
2. **Get SMTP Credentials**:
   - SMTP Server: smtp.hostinger.com
   - Port: 465
   - Encryption: SSL
   - Username: your-email@yourdomain.com
   - Password: your-email-password
3. **Set Firebase Secrets**:
   ```bash
   firebase functions:secrets:set SMTP_HOST
   # Enter: smtp.hostinger.com
   
   firebase functions:secrets:set SMTP_PORT
   # Enter: 465
   
   firebase functions:secrets:set SMTP_USER
   # Enter: your-email@yourdomain.com
   
   firebase functions:secrets:set SMTP_PASS
   # Enter: your-email-password
   ```

### Option 2: Gmail (Alternative)

1. **Enable 2-Factor Authentication** on your Gmail account
2. **Generate an App Password**:
   - Go to Google Account settings
   - Security → 2-Step Verification → App passwords
   - Generate a new app password for "Mail"
3. **Update Email Service Configuration**:
   ```typescript
   // In functions/src/utils/email-service.ts
   const emailConfig = {
     host: smtpHost || process.env.SMTP_HOST || 'smtp.gmail.com',
     port: parseInt(smtpPort || process.env.SMTP_PORT || '587'),
     secure: false, // false for 587
     auth: {
       user: smtpUser || process.env.SMTP_USER || 'your-email@gmail.com',
       pass: smtpPass || process.env.SMTP_PASS || 'your-app-password',
     },
   };
   ```
4. **Set Firebase Secrets**:
   ```bash
   firebase functions:secrets:set SMTP_HOST
   # Enter: smtp.gmail.com
   
   firebase functions:secrets:set SMTP_PORT
   # Enter: 587
   
   firebase functions:secrets:set SMTP_USER
   # Enter: your-email@gmail.com
   
   firebase functions:secrets:set SMTP_PASS
   # Enter: your-16-character-app-password
   ```

### Option 3: Other SMTP Providers

You can use any SMTP provider. Common options include:
- **SendGrid**: `smtp.sendgrid.net:587`
- **Outlook/Hotmail**: `smtp-mail.outlook.com:587`
- **Yahoo**: `smtp.mail.yahoo.com:587`

## Setting Environment Variables

### Local Development

Create a `.env` file in the `functions` directory:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
NODE_ENV=development
```

### Firebase Functions (Production)

Set environment variables for your Firebase project:

```bash
# Set SMTP configuration
firebase functions:config:set smtp.host="smtp.gmail.com"
firebase functions:config:set smtp.port="587"
firebase functions:config:set smtp.user="your-email@gmail.com"
firebase functions:config:set smtp.pass="your-app-password"

# Set environment
firebase functions:config:set app.environment="production"
```

Then update the email service to use Firebase config:

```typescript
// In functions/src/utils/email-service.ts
import * as functions from 'firebase-functions';

const emailConfig = {
  host: functions.config().smtp?.host || process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(functions.config().smtp?.port || process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: functions.config().smtp?.user || process.env.SMTP_USER || 'your-email@gmail.com',
    pass: functions.config().smtp?.pass || process.env.SMTP_PASS || 'your-app-password',
  },
};
```

## Testing Email Configuration

### 1. Test Email Service

Create a test function to verify your email configuration:

```typescript
// Add this to functions/src/api/auth/index.ts for testing
export const testEmail = onCall({enforceAppCheck: false}, async (request) => {
  try {
    const {email} = request.data;
    
    if (!email) {
      return {
        success: false,
        error: "Email is required",
      };
    }

    const emailSent = await sendVerificationEmail(email, "123456", "Test User");
    
    return {
      success: emailSent,
      message: emailSent 
        ? "Test email sent successfully" 
        : "Failed to send test email",
    };
  } catch (error) {
    console.error("Error testing email:", error);
    return {
      success: false,
      error: "Failed to test email configuration",
    };
  }
});
```

### 2. Test with Postman

```bash
POST https://us-central1-guestbuddy-test-3b36d.cloudfunctions.net/testEmail
Content-Type: application/json

{
  "data": {
    "email": "test@example.com"
  }
}
```

## Email Templates

The system includes two email templates:

### 1. Initial Verification Email
- **Subject**: "Verify Your Email - GuestBuddy"
- **Content**: Welcome message with verification code
- **Sent when**: User creates account

### 2. Resend Verification Email
- **Subject**: "New Verification Code - GuestBuddy"
- **Content**: New verification code with instructions
- **Sent when**: User requests new verification code

## Security Considerations

### 1. App Passwords
- Use app passwords instead of your main password
- App passwords are 16-character codes
- Can be revoked without affecting your main account

### 2. Environment Variables
- Never commit email credentials to version control
- Use Firebase Functions config for production
- Use `.env` files for local development (add to `.gitignore`)

### 3. Rate Limiting
- Consider implementing rate limiting for email sending
- Monitor email sending quotas
- Set up email delivery monitoring

## Troubleshooting

### Common Issues

1. **Authentication Failed**
   - Check if 2FA is enabled (for Gmail)
   - Verify app password is correct
   - Ensure SMTP settings are correct

2. **Connection Timeout**
   - Check firewall settings
   - Verify SMTP host and port
   - Try different SMTP providers

3. **Email Not Received**
   - Check spam/junk folder
   - Verify email address is correct
   - Check email provider's sending limits

### Debug Mode

Enable debug logging by setting:

```typescript
const transporter = nodemailer.createTransport({
  ...emailConfig,
  debug: true, // Enable debug output
  logger: true, // Log to console
});
```

## Production Recommendations

1. **Use SendGrid or similar service** for better deliverability
2. **Set up email monitoring** to track delivery rates
3. **Implement rate limiting** to prevent abuse
4. **Use dedicated email domain** for better branding
5. **Set up SPF/DKIM records** for better deliverability

## Example Configuration Files

### .env (Development)
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-16-character-app-password
NODE_ENV=development
```

### firebase.json (Production)
```json
{
  "functions": {
    "config": {
      "smtp": {
        "host": "smtp.sendgrid.net",
        "port": "587",
        "user": "apikey",
        "pass": "your-sendgrid-api-key"
      },
      "app": {
        "environment": "production"
      }
    }
  }
}
```

## Next Steps

1. Choose an email provider (Gmail for dev, SendGrid for production)
2. Set up SMTP credentials
3. Configure environment variables
4. Test email sending
5. Deploy to production
6. Monitor email delivery rates 
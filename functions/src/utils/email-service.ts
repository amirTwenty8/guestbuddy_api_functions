import * as nodemailer from 'nodemailer';

// Create transporter function that accepts credentials
function createTransporter(smtpUser?: string, smtpPass?: string, smtpHost?: string, smtpPort?: string) {
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

/**
 * Send verification email with 6-digit code
 */
export async function sendVerificationEmail(
  toEmail: string,
  verificationCode: string,
  userName: string,
  smtpUser?: string,
  smtpPass?: string,
  smtpHost?: string,
  smtpPort?: string
): Promise<boolean> {
  try {
    const transporter = createTransporter(smtpUser, smtpPass, smtpHost, smtpPort);
    const mailOptions = {
      from: `"GuestBuddy" <admin@guestbuddy.net>`,
      to: toEmail,
      subject: 'Verify Your Email - GuestBuddy',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Verify Your Email - GuestBuddy</title>
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
            }
            .logo {
              font-size: 24px;
              font-weight: bold;
              color: #2196F3;
              margin-bottom: 10px;
            }
            .verification-code {
              background-color: #f8f9fa;
              border: 2px solid #e9ecef;
              border-radius: 8px;
              padding: 20px;
              text-align: center;
              margin: 20px 0;
              font-size: 32px;
              font-weight: bold;
              letter-spacing: 8px;
              color: #2196F3;
              font-family: 'Courier New', monospace;
            }
            .instructions {
              background-color: #e3f2fd;
              border-left: 4px solid #2196F3;
              padding: 15px;
              margin: 20px 0;
            }
            .footer {
              text-align: center;
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #e9ecef;
              color: #6c757d;
              font-size: 14px;
            }
            .button {
              display: inline-block;
              background-color: #2196F3;
              color: white;
              padding: 12px 24px;
              text-decoration: none;
              border-radius: 5px;
              margin: 10px 0;
            }
            .warning {
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
              <div class="logo">GuestBuddy</div>
              <h1>Verify Your Email Address</h1>
            </div>
            
            <p>Hi ${userName},</p>
            
            <p>Thank you for creating your GuestBuddy account! To complete your registration, please verify your email address by entering the verification code below:</p>
            
            <div class="verification-code">
              ${verificationCode}
            </div>
            
            <div class="instructions">
              <strong>Instructions:</strong>
              <ul>
                <li>Enter this 6-digit code in the verification screen</li>
                <li>The code will expire in 10 minutes</li>
                <li>If you didn't request this code, please ignore this email</li>
              </ul>
            </div>
            
            <div class="warning">
              <strong>⚠️ Security Notice:</strong> Never share this verification code with anyone. GuestBuddy will never ask for this code via phone, text, or email.
            </div>
            
            <p>If you're having trouble, you can request a new verification code from the app.</p>
            
            <div class="footer">
              <p>This email was sent to ${toEmail}</p>
              <p>© 2024 GuestBuddy. All rights reserved.</p>
              <p>If you didn't create this account, please contact support immediately.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        Verify Your Email - GuestBuddy
        
        Hi ${userName},
        
        Thank you for creating your GuestBuddy account! To complete your registration, please verify your email address by entering the verification code below:
        
        Verification Code: ${verificationCode}
        
        Instructions:
        - Enter this 6-digit code in the verification screen
        - The code will expire in 10 minutes
        - If you didn't request this code, please ignore this email
        
        Security Notice: Never share this verification code with anyone. GuestBuddy will never ask for this code via phone, text, or email.
        
        If you're having trouble, you can request a new verification code from the app.
        
        This email was sent to ${toEmail}
        © 2024 GuestBuddy. All rights reserved.
        If you didn't create this account, please contact support immediately.
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Verification email sent successfully:', info.messageId);
    return true;
  } catch (error) {
    console.error('Error sending verification email:', error);
    // Log detailed error information
    if (error instanceof Error) {
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    return false;
  }
}

/**
 * Send resend verification email
 */
export async function sendResendVerificationEmail(
  toEmail: string,
  verificationCode: string,
  userName: string,
  smtpUser?: string,
  smtpPass?: string,
  smtpHost?: string,
  smtpPort?: string
): Promise<boolean> {
  try {
    const transporter = createTransporter(smtpUser, smtpPass, smtpHost, smtpPort);
    const mailOptions = {
      from: `"GuestBuddy" <admin@guestbuddy.net>`,
      to: toEmail,
      subject: 'New Verification Code - GuestBuddy',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>New Verification Code - GuestBuddy</title>
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
            }
            .logo {
              font-size: 24px;
              font-weight: bold;
              color: #2196F3;
              margin-bottom: 10px;
            }
            .verification-code {
              background-color: #f8f9fa;
              border: 2px solid #e9ecef;
              border-radius: 8px;
              padding: 20px;
              text-align: center;
              margin: 20px 0;
              font-size: 32px;
              font-weight: bold;
              letter-spacing: 8px;
              color: #2196F3;
              font-family: 'Courier New', monospace;
            }
            .instructions {
              background-color: #e3f2fd;
              border-left: 4px solid #2196F3;
              padding: 15px;
              margin: 20px 0;
            }
            .footer {
              text-align: center;
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #e9ecef;
              color: #6c757d;
              font-size: 14px;
            }
            .warning {
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
              <div class="logo">GuestBuddy</div>
              <h1>New Verification Code</h1>
            </div>
            
            <p>Hi ${userName},</p>
            
            <p>You requested a new verification code for your GuestBuddy account. Here's your new verification code:</p>
            
            <div class="verification-code">
              ${verificationCode}
            </div>
            
            <div class="instructions">
              <strong>Instructions:</strong>
              <ul>
                <li>Enter this 6-digit code in the verification screen</li>
                <li>The code will expire in 10 minutes</li>
                <li>This code replaces your previous verification code</li>
              </ul>
            </div>
            
            <div class="warning">
              <strong>⚠️ Security Notice:</strong> Never share this verification code with anyone. GuestBuddy will never ask for this code via phone, text, or email.
            </div>
            
            <p>If you didn't request this new code, please contact support immediately.</p>
            
            <div class="footer">
              <p>This email was sent to ${toEmail}</p>
              <p>© 2024 GuestBuddy. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        New Verification Code - GuestBuddy
        
        Hi ${userName},
        
        You requested a new verification code for your GuestBuddy account. Here's your new verification code:
        
        Verification Code: ${verificationCode}
        
        Instructions:
        - Enter this 6-digit code in the verification screen
        - The code will expire in 10 minutes
        - This code replaces your previous verification code
        
        Security Notice: Never share this verification code with anyone. GuestBuddy will never ask for this code via phone, text, or email.
        
        If you didn't request this new code, please contact support immediately.
        
        This email was sent to ${toEmail}
        © 2024 GuestBuddy. All rights reserved.
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Resend verification email sent successfully:', info.messageId);
    return true;
  } catch (error) {
    console.error('Error sending resend verification email:', error);
    // Log detailed error information
    if (error instanceof Error) {
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    return false;
  }
}

/**
 * Test email configuration
 */
export async function testEmailConfiguration(smtpUser?: string, smtpPass?: string, smtpHost?: string, smtpPort?: string): Promise<boolean> {
  try {
    const transporter = createTransporter(smtpUser, smtpPass, smtpHost, smtpPort);
    await transporter.verify();
    console.log('Email configuration is valid');
    return true;
  } catch (error) {
    console.error('Email configuration error:', error);
    // Log detailed error information
    if (error instanceof Error) {
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    return false;
  }
}

/**
 * Send a test email to verify SMTP configuration
 */
export async function sendTestEmail(toEmail: string): Promise<boolean> {
  try {
    const transporter = createTransporter();
    const mailOptions = {
      from: `"GuestBuddy Test" <admin@guestbuddy.net>`,
      to: toEmail,
      subject: 'GuestBuddy Email Test',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px;">
          <h1>GuestBuddy Email Test</h1>
          <p>This is a test email to verify that the SMTP configuration is working correctly.</p>
          <p>If you're receiving this email, it means the email service is properly configured.</p>
          <p>Time sent: ${new Date().toISOString()}</p>
        </div>
      `,
      text: `
        GuestBuddy Email Test
        
        This is a test email to verify that the SMTP configuration is working correctly.
        If you're receiving this email, it means the email service is properly configured.
        
        Time sent: ${new Date().toISOString()}
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Test email sent successfully:', info.messageId);
    return true;
  } catch (error) {
    console.error('Error sending test email:', error);
    // Log detailed error information
    if (error instanceof Error) {
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    return false;
  }
} 
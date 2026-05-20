const axios = require('axios');
const config = require('../config');

// Using axios to send emails via Brevo API
const sendEmail = async ({ to, subject, htmlContent }) => {
  try {
    const apiKey = process.env.BREVO_API_KEY;
    if (!apiKey) {
      console.warn('BREVO_API_KEY is not defined. Email will not be sent.');
      console.log(`Mock Email to ${to}: ${subject}`);
      return false;
    }

    const response = await axios.post(
      'https://api.brevo.com/v3/smtp/email',
      {
        sender: {
          name: 'Mediatheque',
          email: process.env.FROM_EMAIL || 'ab964a001@smtp-brevo.com',
        },
        to: [{ email: to }],
        subject: subject,
        htmlContent: htmlContent,
      },
      {
        headers: {
          'api-key': apiKey,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data;
  } catch (error) {
    const errorData = error.response?.data;
    console.error('Error sending email via Brevo:', errorData || error.message);
    
    // Fallback to mock email if IP is not authorized in Brevo (common in local development)
    if (errorData?.code === 'unauthorized' && errorData?.message?.includes('IP address')) {
      console.warn('\n⚠️ BREVO IP AUTHORIZATION REQUIRED ⚠️');
      console.warn(errorData.message);
      console.warn('Falling back to mock email for local development...\n');
      console.log(`Mock Email to ${to}: ${subject}`);
      return false;
    }
    
    throw new Error('Failed to send email');
  }
};

const sendPasswordResetEmail = async (toEmail, resetToken) => {
  // Use frontend URL from config/env
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const resetLink = `${frontendUrl}/reset-password?token=${resetToken}`;
  
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #4f46e5;">Password Reset Request</h2>
      <p>Hello,</p>
      <p>You requested a password reset for your account. Click the button below to set a new password:</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${resetLink}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Reset Password</a>
      </div>
      <p>If you didn't request this, you can safely ignore this email.</p>
      <p>This link will expire in 10 minutes.</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
      <p style="color: #666; font-size: 12px;">The Mediatheque Team</p>
    </div>
  `;

  return sendEmail({
    to: toEmail,
    subject: 'Reset Your Password - Mediatheque',
    htmlContent,
  });
};

const sendInquiryResponseEmail = async (toEmail, originalSubject, responseText) => {
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #4f46e5;">Response to your inquiry</h2>
      <p>Hello,</p>
      <p>Thank you for contacting us regarding "<strong>${originalSubject}</strong>".</p>
      <div style="background-color: #f9fafb; padding: 15px; border-left: 4px solid #4f46e5; margin: 20px 0;">
        <p style="margin: 0; white-space: pre-wrap;">${responseText}</p>
      </div>
      <p>If you have any further questions, feel free to reply to this email.</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
      <p style="color: #666; font-size: 12px;">The Mediatheque Support Team</p>
    </div>
  `;

  return sendEmail({
    to: toEmail,
    subject: `Re: ${originalSubject}`,
    htmlContent,
  });
};

module.exports = {
  sendEmail,
  sendPasswordResetEmail,
  sendInquiryResponseEmail,
};

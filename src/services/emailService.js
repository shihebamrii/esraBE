// Importation de la bibliothèque axios pour effectuer des requêtes HTTP
const axios = require('axios');
// Importation du fichier de configuration globale de l'application
const config = require('../config');

// Déclaration de la fonction asynchrone pour envoyer un e-mail via l'API Brevo
const sendEmail = async ({ to, subject, htmlContent }) => {
  try {
    // Récupération de la clé API Brevo depuis les variables d'environnement
    const apiKey = process.env.BREVO_API_KEY;
    // Vérification si la clé API n'est pas définie
    if (!apiKey) {
      // Affichage d'un avertissement dans la console
      console.warn('BREVO_API_KEY is not defined. Email will not be sent.');
      // Simulation de l'envoi de l'e-mail dans la console
      console.log(`Mock Email to ${to}: ${subject}`);
      // Retourne faux car l'e-mail n'a pas été réellement envoyé
      return false;
    }

    // Envoi de la requête POST à l'API Brevo pour expédier l'e-mail
    const response = await axios.post(
      // URL de l'API d'envoi d'e-mails de Brevo
      'https://api.brevo.com/v3/smtp/email',
      {
        sender: {
          // Nom de l'expéditeur
          name: 'Mediatheque',
          // Adresse e-mail de l'expéditeur depuis les variables d'environnement ou valeur par défaut
          email: process.env.FROM_EMAIL || 'ab964a001@smtp-brevo.com',
        },
        // Liste des destinataires
        to: [{ email: to }],
        // Objet du message
        subject: subject,
        // Contenu du message au format HTML
        htmlContent: htmlContent,
      },
      {
        headers: {
          // Clé API Brevo passée dans les en-têtes de la requête
          'api-key': apiKey,
          // Format des données envoyées (JSON)
          'Content-Type': 'application/json',
        },
      }
    );

    // Retourne les données de la réponse renvoyées par Brevo
    return response.data;
  } catch (error) {
    // Récupération des données d'erreur renvoyées par le serveur si elles existent
    const errorData = error.response?.data;
    // Affichage de l'erreur dans la console
    console.error('Error sending email via Brevo:', errorData || error.message);
    
    // Vérification si l'erreur concerne une adresse IP non autorisée sur Brevo
    if (errorData?.code === 'unauthorized' && errorData?.message?.includes('IP address')) {
      // Affichage d'un avertissement spécifique pour l'autorisation IP
      console.warn('\n⚠️ BREVO IP AUTHORIZATION REQUIRED ⚠️');
      // Affichage du message d'erreur détaillé
      console.warn(errorData.message);
      // Indication du basculement vers un envoi simulé
      console.warn('Falling back to mock email for local development...\n');
      // Simulation de l'envoi de l'e-mail
      console.log(`Mock Email to ${to}: ${subject}`);
      // Retourne faux pour indiquer qu'aucun e-mail réel n'a été envoyé
      return false;
    }
    
    // Lancement d'une erreur en cas d'échec général d'envoi
    throw new Error('Failed to send email');
  }
};

// Déclaration de la fonction asynchrone pour envoyer un e-mail de réinitialisation de mot de passe
const sendPasswordResetEmail = async (toEmail, resetToken) => {
  // Définition de l'URL du frontend depuis les variables d'environnement ou valeur par défaut
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  // Construction du lien de réinitialisation incluant le jeton unique (token)
  const resetLink = `${frontendUrl}/reset-password?token=${resetToken}`;
  
  // Définition du contenu HTML du message de réinitialisation
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

  // Appel de la fonction sendEmail pour effectuer l'envoi
  return sendEmail({
    // Adresse e-mail de destination
    to: toEmail,
    // Objet de l'e-mail
    subject: 'Reset Your Password - Mediatheque',
    // Contenu HTML du message
    htmlContent,
  });
};

// Déclaration de la fonction asynchrone pour envoyer une réponse à une demande d'information
const sendInquiryResponseEmail = async (toEmail, originalSubject, responseText) => {
  // Définition du contenu HTML du message de réponse
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

  // Appel de la fonction sendEmail pour effectuer l'envoi de la réponse
  return sendEmail({
    // Adresse e-mail de destination
    to: toEmail,
    // Objet de l'e-mail avec le préfixe "Re:" suivi du sujet original
    subject: `Re: ${originalSubject}`,
    // Contenu HTML du message
    htmlContent,
  });
};

// Exportation des fonctions pour les utiliser dans le reste de l'application
module.exports = {
  sendEmail,
  sendPasswordResetEmail,
  sendInquiryResponseEmail,
};

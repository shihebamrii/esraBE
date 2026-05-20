// Importation du modèle de demande de contact
const { Inquiry } = require('../models');
// Importation du gestionnaire d'erreurs asynchrones
const asyncHandler = require('../utils/asyncHandler');
// Importation de la classe d'erreur personnalisée
const AppError = require('../utils/AppError');
// Importation du service d'envoi d'email pour répondre aux demandes
const { sendInquiryResponseEmail } = require('../services/emailService');

// Fonction pour soumettre une nouvelle demande de contact
const submitInquiry = asyncHandler(async (req, res, next) => {
  // Extraire les champs du corps de la requête
  const { name, email, subject, message } = req.body;

  // Vérifier que tous les champs obligatoires sont fournis
  if (!name || !email || !subject || !message) {
    return next(new AppError('Please provide all required fields', 400));
  }

  // Créer la demande dans la base de données
  const inquiry = await Inquiry.create({
    name,
    email,
    subject,
    message,
  });

  // Envoyer la réponse de confirmation avec la demande créée
  res.status(201).json({
    status: 'success',
    message: 'Inquiry submitted successfully',
    data: { inquiry },
  });
});

// Fonction pour récupérer toutes les demandes (réservée à l'administrateur)
const getAllInquiries = asyncHandler(async (req, res, next) => {
  // Extraire les paramètres de filtre et de pagination
  const { status, page = 1, limit = 20 } = req.query;

  // Construire le filtre de recherche
  const query = {};
  // Ajouter le filtre par statut si spécifié
  if (status) query.status = status;

  // Compter le nombre total de demandes correspondantes
  const total = await Inquiry.countDocuments(query);
  // Récupérer les demandes paginées et triées par date décroissante
  const inquiries = await Inquiry.find(query)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(parseInt(limit, 10));

  // Envoyer la réponse paginée avec les demandes
  res.status(200).json({
    status: 'success',
    results: inquiries.length,
    total,
    page: parseInt(page, 10),
    pages: Math.ceil(total / limit),
    data: { inquiries },
  });
});

// Fonction pour mettre à jour le statut ou les notes d'une demande (administrateur)
const updateInquiry = asyncHandler(async (req, res, next) => {
  // Extraire l'identifiant de la demande depuis les paramètres
  const { id } = req.params;
  // Extraire le statut et les notes de l'administrateur du corps de la requête
  const { status, adminNotes } = req.body;

  // Rechercher la demande par son identifiant
  const inquiry = await Inquiry.findById(id);

  // Si la demande n'existe pas, retourner une erreur 404
  if (!inquiry) {
    return next(new AppError('Inquiry not found', 404));
  }

  // Mettre à jour le statut si fourni
  if (status) inquiry.status = status;
  // Mettre à jour les notes si fournies
  if (adminNotes !== undefined) inquiry.adminNotes = adminNotes;

  // Sauvegarder les modifications
  await inquiry.save();

  // Envoyer la réponse avec la demande mise à jour
  res.status(200).json({
    status: 'success',
    data: { inquiry },
  });
});

// Fonction pour répondre à une demande par email (administrateur)
const respondToInquiry = asyncHandler(async (req, res, next) => {
  // Extraire l'identifiant de la demande depuis les paramètres
  const { id } = req.params;
  // Extraire le texte de la réponse du corps de la requête
  const { responseText } = req.body;

  // Vérifier que le texte de réponse est fourni
  if (!responseText) {
    return next(new AppError('Please provide a response text', 400));
  }

  // Rechercher la demande par son identifiant
  const inquiry = await Inquiry.findById(id);

  // Si la demande n'existe pas, retourner une erreur 404
  if (!inquiry) {
    return next(new AppError('Inquiry not found', 404));
  }

  // Essayer d'envoyer l'email de réponse via le service Brevo
  try {
    // Envoyer l'email à l'adresse du demandeur
    await sendInquiryResponseEmail(inquiry.email, inquiry.subject, responseText);

    // Mettre à jour le statut à "répondu"
    inquiry.status = 'replied';
    // Ajouter la réponse aux notes de l'administrateur
    inquiry.adminNotes = (inquiry.adminNotes ? inquiry.adminNotes + '\n\n' : '') + `Response sent: ${responseText}`;
    // Sauvegarder les modifications
    await inquiry.save();

    // Envoyer la réponse de confirmation
    res.status(200).json({
      status: 'success',
      message: 'Email response sent successfully',
      data: { inquiry },
    });
  } catch (error) {
    // Afficher l'erreur dans la console en cas d'échec
    console.error('Error sending response email:', error);
    // Retourner une erreur 500
    return next(new AppError('Failed to send email response', 500));
  }
});

// Fonction pour supprimer une demande (administrateur)
const deleteInquiry = asyncHandler(async (req, res, next) => {
  // Extraire l'identifiant de la demande depuis les paramètres
  const { id } = req.params;

  // Supprimer la demande par son identifiant
  const inquiry = await Inquiry.findByIdAndDelete(id);

  // Si la demande n'existe pas, retourner une erreur 404
  if (!inquiry) {
    return next(new AppError('Inquiry not found', 404));
  }

  // Envoyer une réponse vide avec le statut 204 (pas de contenu)
  res.status(204).json({
    status: 'success',
    data: null,
  });
});

// Exporter toutes les fonctions du contrôleur
module.exports = {
  submitInquiry,
  getAllInquiries,
  updateInquiry,
  respondToInquiry,
  deleteInquiry,
};

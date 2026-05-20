// Importation du fichier de configuration globale de l'application
const config = require('../config');

// Définition de la classe de base pour les adaptateurs de paiement
class PaymentAdapter {
  // Le constructeur initialise le nom de l'adaptateur
  constructor() {
    // Attribution du nom par défaut "base"
    this.name = 'base';
  }

  // Méthode asynchrone pour créer un paiement (doit être implémentée par les sous-classes)
  async createPayment(_paymentData) {
    // Lancement d'une erreur car cette méthode doit être redéfinie dans une sous-classe
    throw new Error('Cette méthode doit être implémentée !');
  }

  // Méthode pour vérifier la validité d'un webhook (doit être implémentée par les sous-classes)
  verifyWebhook(_payload, _signature) {
    // Lancement d'une erreur car cette méthode doit être redéfinie dans une sous-classe
    throw new Error('Cette méthode doit être implémentée !');
  }

  // Méthode asynchrone pour obtenir le statut d'un paiement (doit être implémentée par les sous-classes)
  async getPaymentStatus(_paymentId) {
    // Lancement d'une erreur car cette méthode doit être redéfinie dans une sous-classe
    throw new Error('Cette méthode doit être implémentée !');
  }

  // Méthode asynchrone pour effectuer un remboursement (doit être implémentée par les sous-classes)
  async refund(_paymentId, _amount) {
    // Lancement d'une erreur car cette méthode doit être redéfinie dans une sous-classe
    throw new Error('Cette méthode doit être implémentée !');
  }
}

// Définition de la classe du fournisseur de paiement simulé (pour le développement)
class MockPaymentProvider extends PaymentAdapter {
  // Le constructeur initialise le fournisseur simulé
  constructor() {
    // Appel du constructeur de la classe parente
    super();
    // Attribution du nom "mock" pour identifier ce fournisseur
    this.name = 'mock';
  }

  // Méthode asynchrone pour créer un paiement simulé
  async createPayment(paymentData) {
    // Extraction des données de paiement
    const { orderId, amount, currency, customerEmail } = paymentData;
    
    // Génération d'un identifiant de session simulé unique
    const sessionId = `mock_session_${Date.now()}_${orderId}`;
    
    // Construction de l'URL de base selon l'environnement (production ou développement)
    const baseUrl = config.server.env === 'production' ? '' : `http://localhost:${config.server.port}`;
    // Construction de l'URL de paiement simulé
    const paymentUrl = `${baseUrl}/api/payments/mock-complete?sessionId=${sessionId}&orderId=${orderId}`;
    
    // Affichage des détails du paiement simulé dans la console
    console.log(`🎭 Mock Payment Created:
      Order: ${orderId}
      Amount: ${amount} ${currency}
      Customer: ${customerEmail}
      URL: ${paymentUrl}
    `);
    
    // Retour des informations du paiement simulé
    return {
      sessionId,
      paymentId: sessionId,
      paymentUrl,
      status: 'pending',
    };
  }

  // Méthode pour vérifier un webhook simulé (retourne toujours vrai)
  verifyWebhook(_payload, _signature) {
    // En mode simulé, on accepte toujours le webhook
    return true;
  }

  // Méthode asynchrone pour obtenir le statut d'un paiement simulé (toujours payé)
  async getPaymentStatus(paymentId) {
    // Retour d'un statut "payé" avec la date actuelle
    return {
      paymentId,
      status: 'paid',
      paidAt: new Date(),
    };
  }

  // Méthode asynchrone pour effectuer un remboursement simulé
  async refund(paymentId, amount) {
    // Affichage du remboursement simulé dans la console
    console.log(`🎭 Mock Refund: ${paymentId}, Amount: ${amount || 'full'}`);
    // Retour des informations du remboursement simulé
    return {
      refundId: `mock_refund_${Date.now()}`,
      status: 'refunded',
    };
  }
}

// Définition de la classe du fournisseur de paiement Stripe
class StripePaymentProvider extends PaymentAdapter {
  // Le constructeur initialise le fournisseur Stripe
  constructor() {
    // Appel du constructeur de la classe parente
    super();
    // Attribution du nom "stripe" pour identifier ce fournisseur
    this.name = 'stripe';
    // Initialisation du SDK Stripe si la clé secrète est disponible
    if (config.payment.stripe.secretKey) {
      this.stripe = require('stripe')(config.payment.stripe.secretKey);
    }
  }

  // Méthode asynchrone pour créer un paiement via Stripe Checkout
  async createPayment(paymentData) {
    // Extraction des données de paiement
    const { orderId, amount, currency, customerEmail, customerName, description } = paymentData;

    // Vérification que Stripe est correctement configuré
    if (!this.stripe) {
      throw new Error("Stripe n'est pas configuré ! Vérifiez STRIPE_SECRET_KEY");
    }

    // Création d'une session Stripe Checkout
    const session = await this.stripe.checkout.sessions.create({
      // Types de méthodes de paiement acceptés
      payment_method_types: ['card'],
      // Mode de paiement unique
      mode: 'payment',
      // E-mail du client
      customer_email: customerEmail,
      // Liste des articles à payer
      line_items: [
        {
          price_data: {
            // Devise du paiement en minuscules
            currency: currency.toLowerCase(),
            product_data: {
              // Description du produit ou numéro de commande
              name: description || `Order #${orderId}`,
            },
            // Montant en centimes (Stripe exige les montants en plus petite unité)
            unit_amount: Math.round(amount * 100),
          },
          // Quantité de l'article
          quantity: 1,
        },
      ],
      // Métadonnées associées à la session
      metadata: {
        orderId,
        customerName,
      },
      // URL de redirection en cas de succès
      success_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/orders/${orderId}/success?session_id={CHECKOUT_SESSION_ID}`,
      // URL de redirection en cas d'annulation
      cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/orders/${orderId}/cancel`,
    });

    // Retour des informations de la session de paiement
    return {
      sessionId: session.id,
      paymentId: session.id,
      paymentUrl: session.url,
      status: 'pending',
    };
  }

  // Méthode pour vérifier la validité d'un webhook Stripe
  verifyWebhook(payload, signature) {
    // Vérification que Stripe et le secret du webhook sont configurés
    if (!this.stripe || !config.payment.stripe.webhookSecret) {
      console.error('Stripe webhook verification not configured');
      return false;
    }

    try {
      // Construction et vérification de l'événement webhook
      this.stripe.webhooks.constructEvent(
        payload,
        signature,
        config.payment.stripe.webhookSecret
      );
      // Retourne vrai si la vérification réussit
      return true;
    } catch (err) {
      // Affichage de l'erreur de vérification dans la console
      console.error('Stripe webhook verification failed:', err.message);
      // Retourne faux si la vérification échoue
      return false;
    }
  }

  // Méthode asynchrone pour obtenir le statut d'un paiement Stripe
  async getPaymentStatus(sessionId) {
    // Vérification que Stripe est configuré
    if (!this.stripe) {
      throw new Error("Stripe n'est pas configuré !");
    }

    // Récupération des détails de la session Stripe
    const session = await this.stripe.checkout.sessions.retrieve(sessionId);

    // Retour du statut de paiement
    return {
      paymentId: session.id,
      // Conversion du statut Stripe en statut interne
      status: session.payment_status === 'paid' ? 'paid' : 'pending',
      // Date de paiement si le statut est "payé"
      paidAt: session.payment_status === 'paid' ? new Date() : null,
    };
  }

  // Méthode asynchrone pour effectuer un remboursement via Stripe
  async refund(paymentId, amount) {
    // Vérification que Stripe est configuré
    if (!this.stripe) {
      throw new Error("Stripe n'est pas configuré !");
    }

    // Récupération de la session pour obtenir l'intention de paiement
    const session = await this.stripe.checkout.sessions.retrieve(paymentId);
    
    // Préparation des données de remboursement avec l'intention de paiement
    const refundData = {
      payment_intent: session.payment_intent,
    };
    
    // Si un montant spécifique est fourni, ajout du montant en centimes
    if (amount) {
      refundData.amount = Math.round(amount * 100);
    }

    // Création du remboursement via l'API Stripe
    const refund = await this.stripe.refunds.create(refundData);

    // Retour des informations du remboursement
    return {
      refundId: refund.id,
      status: refund.status,
    };
  }
}

// Définition de la classe du fournisseur de paiement PayTech (Tunisie) - non implémenté
class PayTechPaymentProvider extends PaymentAdapter {
  // Le constructeur initialise le fournisseur PayTech
  constructor() {
    // Appel du constructeur de la classe parente
    super();
    // Attribution du nom "paytech" pour identifier ce fournisseur
    this.name = 'paytech';
    // Récupération de la clé API PayTech depuis la configuration
    this.apiKey = config.payment.paytech.apiKey;
    // Récupération de la clé secrète PayTech depuis la configuration
    this.secretKey = config.payment.paytech.secretKey;
    // URL de base de l'API PayTech
    this.baseUrl = 'https://api.paytech.tn/v1';
  }

  // Méthode asynchrone pour créer un paiement PayTech (non implémentée)
  async createPayment(paymentData) {
    // Extraction des données de paiement
    const { orderId, amount, currency, customerEmail, customerName } = paymentData;

    // Lancement d'une erreur car l'intégration n'est pas encore implémentée
    throw new Error('PayTech integration not implemented yet! voir TODO dans paymentAdapter.js');
  }

  // Méthode pour vérifier un webhook PayTech (non implémentée)
  verifyWebhook(payload, signature) {
    // Lancement d'une erreur car la vérification n'est pas encore implémentée
    throw new Error('PayTech webhook verification not implemented!');
  }

  // Méthode asynchrone pour obtenir le statut d'un paiement PayTech (non implémentée)
  async getPaymentStatus(paymentId) {
    // Lancement d'une erreur car cette fonctionnalité n'est pas encore implémentée
    throw new Error('PayTech getPaymentStatus not implemented!');
  }

  // Méthode asynchrone pour effectuer un remboursement PayTech (non implémenté)
  async refund(paymentId, amount) {
    // Lancement d'une erreur car cette fonctionnalité n'est pas encore implémentée
    throw new Error('PayTech refund not implemented!');
  }
}

// Variable pour stocker l'instance unique du fournisseur de paiement (singleton)
let paymentProvider = null;

// Fonction pour obtenir le fournisseur de paiement selon la configuration
const getPaymentProvider = () => {
  // Si un fournisseur est déjà instancié, on le retourne directement
  if (paymentProvider) {
    return paymentProvider;
  }

  // Récupération du nom du fournisseur depuis la configuration ou "mock" par défaut
  const provider = config.payment.provider || 'mock';

  // Sélection et instanciation du fournisseur selon la configuration
  switch (provider) {
    // Cas du fournisseur Stripe
    case 'stripe':
      paymentProvider = new StripePaymentProvider();
      break;
    // Cas du fournisseur PayTech
    case 'paytech':
      paymentProvider = new PayTechPaymentProvider();
      break;
    // Cas par défaut : fournisseur simulé
    case 'mock':
    default:
      paymentProvider = new MockPaymentProvider();
      break;
  }

  // Affichage du fournisseur de paiement sélectionné dans la console
  console.log(`💳 Payment Provider: ${paymentProvider.name}`);
  // Retour de l'instance du fournisseur
  return paymentProvider;
};

// Exportation de toutes les classes et de la fonction de sélection du fournisseur
module.exports = {
  PaymentAdapter,
  MockPaymentProvider,
  StripePaymentProvider,
  PayTechPaymentProvider,
  getPaymentProvider,
};

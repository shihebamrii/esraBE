/**
 * Payment Adapter / محول الدفع
 * هنا نعرفو interface للدفع ونعملو implementations مختلفة
 */

const config = require('../config');

/**
 * واجهة محول الدفع الأساسية
 * كل مزود لازم يـ implement هالميثودز
 */
class PaymentAdapter {
  constructor() {
    this.name = 'base';
  }

  /**
   * ننشئو عملية دفع
   * @param {Object} paymentData
   * @returns {Promise<Object>} - معلومات الدفع (url, sessionId, etc.)
   */
  async createPayment(_paymentData) {
    throw new Error('لازم تـ implement هالميثود!');
  }

  /**
   * نتأكدو من صحة الـ webhook
   * @param {Object} payload - بيانات الـ webhook
   * @param {string} signature - التوقيع
   * @returns {boolean}
   */
  verifyWebhook(_payload, _signature) {
    throw new Error('لازم تـ implement هالميثود!');
  }

  /**
   * نجيبو حالة الدفع
   * @param {string} paymentId
   * @returns {Promise<Object>}
   */
  async getPaymentStatus(_paymentId) {
    throw new Error('لازم تـ implement هالميثود!');
  }

  /**
   * نعملو refund
   * @param {string} paymentId
   * @param {number} amount - المبلغ (optional, للـ partial refund)
   * @returns {Promise<Object>}
   */
  async refund(_paymentId, _amount) {
    throw new Error('لازم تـ implement هالميثود!');
  }
}

// ============================================
// Mock Payment Provider / مزود وهمي للتطوير
// ============================================

class MockPaymentProvider extends PaymentAdapter {
  constructor() {
    super();
    this.name = 'mock';
  }

  async createPayment(paymentData) {
    const { orderId, amount, currency, customerEmail } = paymentData;
    
    // نعملو session ID وهمي
    const sessionId = `mock_session_${Date.now()}_${orderId}`;
    
    // في التطوير، نرجعو رابط للـ webhook مباشرة
    const paymentUrl = `http://localhost:${config.server.port}/api/payment/mock-complete?sessionId=${sessionId}&orderId=${orderId}`;
    
    console.log(`🎭 Mock Payment Created:
      Order: ${orderId}
      Amount: ${amount} ${currency}
      Customer: ${customerEmail}
      URL: ${paymentUrl}
    `);
    
    return {
      sessionId,
      paymentId: sessionId,
      paymentUrl,
      status: 'pending',
    };
  }

  verifyWebhook(_payload, _signature) {
    // دايما نقبلو في الـ mock
    return true;
  }

  async getPaymentStatus(paymentId) {
    // في الـ mock، دايما paid
    return {
      paymentId,
      status: 'paid',
      paidAt: new Date(),
    };
  }

  async refund(paymentId, amount) {
    console.log(`🎭 Mock Refund: ${paymentId}, Amount: ${amount || 'full'}`);
    return {
      refundId: `mock_refund_${Date.now()}`,
      status: 'refunded',
    };
  }
}

// ============================================
// Stripe Payment Provider / مزود Stripe
// ============================================

class StripePaymentProvider extends PaymentAdapter {
  constructor() {
    super();
    this.name = 'stripe';
    // نجيبو Stripe SDK
    if (config.payment.stripe.secretKey) {
      this.stripe = require('stripe')(config.payment.stripe.secretKey);
    }
  }

  async createPayment(paymentData) {
    const { orderId, amount, currency, customerEmail, customerName, description } = paymentData;

    if (!this.stripe) {
      throw new Error('Stripe مش مهيأ! تأكد من STRIPE_SECRET_KEY');
    }

    // ننشئو Checkout Session
    const session = await this.stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: customerEmail,
      line_items: [
        {
          price_data: {
            currency: currency.toLowerCase(),
            product_data: {
              name: description || `Order #${orderId}`,
            },
            // Stripe يحب المبالغ بالسنتيم
            unit_amount: Math.round(amount * 100),
          },
          quantity: 1,
        },
      ],
      metadata: {
        orderId,
        customerName,
      },
      success_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/orders/${orderId}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/orders/${orderId}/cancel`,
    });

    return {
      sessionId: session.id,
      paymentId: session.id,
      paymentUrl: session.url,
      status: 'pending',
    };
  }

  verifyWebhook(payload, signature) {
    if (!this.stripe || !config.payment.stripe.webhookSecret) {
      console.error('Stripe webhook verification not configured');
      return false;
    }

    try {
      this.stripe.webhooks.constructEvent(
        payload,
        signature,
        config.payment.stripe.webhookSecret
      );
      return true;
    } catch (err) {
      console.error('Stripe webhook verification failed:', err.message);
      return false;
    }
  }

  async getPaymentStatus(sessionId) {
    if (!this.stripe) {
      throw new Error('Stripe مش مهيأ!');
    }

    const session = await this.stripe.checkout.sessions.retrieve(sessionId);

    return {
      paymentId: session.id,
      status: session.payment_status === 'paid' ? 'paid' : 'pending',
      paidAt: session.payment_status === 'paid' ? new Date() : null,
    };
  }

  async refund(paymentId, amount) {
    if (!this.stripe) {
      throw new Error('Stripe مش مهيأ!');
    }

    // نجيبو الـ payment intent من الـ session
    const session = await this.stripe.checkout.sessions.retrieve(paymentId);
    
    const refundData = {
      payment_intent: session.payment_intent,
    };
    
    if (amount) {
      refundData.amount = Math.round(amount * 100);
    }

    const refund = await this.stripe.refunds.create(refundData);

    return {
      refundId: refund.id,
      status: refund.status,
    };
  }
}

// ============================================
// PayTech Payment Provider / مزود PayTech (تونس)
// ============================================

/**
 * TODO: PayTech Integration
 * 
 * PayTech هو مزود دفع تونسي. هالكلاس stub باش تكملو.
 * 
 * معلومات PayTech:
 * - Website: https://paytech.tn
 * - API Docs: (تواصل معاهم للـ documentation)
 * 
 * الخطوات:
 * 1. سجل في PayTech وجيب API Key و Secret
 * 2. أقرا الـ API documentation
 * 3. كمل الميثودز هنا
 */

class PayTechPaymentProvider extends PaymentAdapter {
  constructor() {
    super();
    this.name = 'paytech';
    this.apiKey = config.payment.paytech.apiKey;
    this.secretKey = config.payment.paytech.secretKey;
    // TODO: حط الـ base URL الصحيح
    this.baseUrl = 'https://api.paytech.tn/v1';
  }

  async createPayment(paymentData) {
    const { orderId, amount, currency, customerEmail, customerName } = paymentData;

    // TODO: نبعثو request لـ PayTech API
    // Example:
    // const response = await fetch(`${this.baseUrl}/payments`, {
    //   method: 'POST',
    //   headers: {
    //     'Authorization': `Bearer ${this.apiKey}`,
    //     'Content-Type': 'application/json',
    //   },
    //   body: JSON.stringify({
    //     amount,
    //     currency,
    //     customer_email: customerEmail,
    //     customer_name: customerName,
    //     order_id: orderId,
    //     callback_url: `${process.env.API_URL}/api/payment/webhook`,
    //     return_url: `${process.env.FRONTEND_URL}/orders/${orderId}/success`,
    //   }),
    // });
    // const data = await response.json();

    throw new Error('PayTech integration not implemented yet! شوف TODO في paymentAdapter.js');
  }

  verifyWebhook(payload, signature) {
    // TODO: تحقق من التوقيع
    // const expectedSignature = crypto
    //   .createHmac('sha256', this.secretKey)
    //   .update(JSON.stringify(payload))
    //   .digest('hex');
    // return signature === expectedSignature;

    throw new Error('PayTech webhook verification not implemented!');
  }

  async getPaymentStatus(paymentId) {
    // TODO: جيب الحالة من PayTech API
    throw new Error('PayTech getPaymentStatus not implemented!');
  }

  async refund(paymentId, amount) {
    // TODO: اعمل refund عبر PayTech API
    throw new Error('PayTech refund not implemented!');
  }
}

// ============================================
// Factory Function / فانكشن اختيار المزود
// ============================================

let paymentProvider = null;

/**
 * نجيبو مزود الدفع حسب الإعدادات
 * @returns {PaymentAdapter}
 */
const getPaymentProvider = () => {
  if (paymentProvider) {
    return paymentProvider;
  }

  const provider = config.payment.provider || 'mock';

  switch (provider) {
    case 'stripe':
      paymentProvider = new StripePaymentProvider();
      break;
    case 'paytech':
      paymentProvider = new PayTechPaymentProvider();
      break;
    case 'mock':
    default:
      paymentProvider = new MockPaymentProvider();
      break;
  }

  console.log(`💳 Payment Provider: ${paymentProvider.name}`);
  return paymentProvider;
};

module.exports = {
  PaymentAdapter,
  MockPaymentProvider,
  StripePaymentProvider,
  PayTechPaymentProvider,
  getPaymentProvider,
};

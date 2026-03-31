require('dotenv').config();
const express = require('express');
const { shopifyApp } = require('@shopify/shopify-app-express');
const { restResources } = require('@shopify/shopify-api/rest/admin/2024-01');

const app = express();

// Shopify App Configuration
const shopify = shopifyApp({
  api: {
    apiVersion: '2024-01',
    restResources,
    billing: undefined,
    apiKey: process.env.SHOPIFY_API_KEY,
    apiSecretKey: process.env.SHOPIFY_API_SECRET,
    scopes: process.env.SHOPIFY_API_SCOPES?.split(',') || ['write_script_tags', 'read_orders', 'write_orders'],
    hostName: process.env.SHOPIFY_APP_URL?.replace('https://', ''),
    isEmbeddedApp: true,
  },
  auth: {
    path: '/api/auth',
    callbackPath: '/api/auth/callback',
  },
  webhooks: {
    path: '/api/webhooks',
  },
  sessionStorage: new MemorySessionStorage(),
});

// Simple in-memory session storage for development
function MemorySessionStorage() {
  this.sessions = {};
  
  this.storeSession = async (session) => {
    this.sessions[session.id] = session;
    return true;
  };
  
  this.loadSession = async (id) => {
    return this.sessions[id] || undefined;
  };
  
  this.deleteSession = async (id) => {
    delete this.sessions[id];
    return true;
  };
  
  this.findSessionsByShop = async (shop) => {
    return Object.values(this.sessions).filter(s => s.shop === shop);
  };
}

// Middleware
app.use(express.json());

// Webhook handlers
app.post('/api/webhooks', async (req, res) => {
  try {
    const topic = req.headers['x-shopify-topic'];
    const shop = req.headers['x-shopify-shop-domain'];
    
    console.log(`Received webhook: ${topic} from ${shop}`);
    
    switch (topic) {
      case 'app/uninstalled':
        // Handle app uninstallation
        await handleAppUninstall(shop);
        break;
      case 'orders/create':
        // Handle new order (for CAPTCHA validation on checkout)
        await handleOrderCreate(req.body);
        break;
      default:
        console.log(`Unhandled webhook topic: ${topic}`);
    }
    
    res.status(200).send('OK');
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).send(error.message);
  }
});

// API routes for CAPTCHA
app.get('/api/captcha/generate', async (req, res) => {
  try {
    const { type, difficulty } = req.query;
    
    const response = await fetch(`${process.env.CAPTCHA_API_URL}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: type || 'text',
        difficulty: difficulty || 'medium',
      }),
    });
    
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate CAPTCHA' });
  }
});

app.post('/api/captcha/validate', async (req, res) => {
  try {
    const { sessionId, response: captchaResponse, type } = req.body;
    
    const response = await fetch(`${process.env.CAPTCHA_API_URL}/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        response: captchaResponse,
        type: type || 'text',
      }),
    });
    
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to validate CAPTCHA' });
  }
});

// Admin dashboard proxy
app.use('/admin', shopify.processWebhooks({ webhookHandlers: {} }));

// Serve static files for admin dashboard
app.use(express.static('public'));

// Handle app installation
app.get('/', async (req, res) => {
  const shop = req.query.shop;
  if (shop) {
    return res.redirect(`/api/auth?shop=${shop}`);
  }
  res.sendFile(__dirname + '/public/index.html');
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

// Helper functions
async function handleAppUninstall(shop) {
  console.log(`App uninstalled by ${shop}`);
  // Clean up shop-specific data
}

async function handleOrderCreate(orderData) {
  console.log(`New order created: ${orderData?.id}`);
  // Process order with CAPTCHA validation if needed
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Shopify app running on port ${PORT}`);
});

module.exports = app;
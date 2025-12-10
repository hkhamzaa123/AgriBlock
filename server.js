const express = require('express');
const cors = require('cors');
const pool = require('./config/db');
const fs = require('fs');
const path = require('path');
const authRoutes = require('./routes/authRoutes');
const farmerRoutes = require('./routes/farmerRoutes');
const distributorRoutes = require('./routes/distributorRoutes');
const transporterRoutes = require('./routes/transporterRoutes');
const shopRoutes = require('./routes/shopRoutes');
const traceabilityRoutes = require('./routes/traceabilityRoutes');
const eventRoutes = require('./routes/eventRoutes');
const commerceRoutes = require('./routes/commerceRoutes');
const consumerRoutes = require('./routes/consumerRoutes');
const adminRoutes = require('./routes/adminRoutes');
require('dotenv').config();

const app = express();
const PORT = 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Test database connection and initialize schema
async function initializeDatabase() {
  let connection;
  
  try {
    connection = await pool.getConnection();
    console.log('✅ Database connection established');

    // Create database if it doesn't exist
    await connection.query('CREATE DATABASE IF NOT EXISTS agrichain');
    await connection.query('USE agrichain');
    console.log('✅ Database "agrichain" ready');

    // Read and execute schema.sql
    const schemaPath = path.join(__dirname, 'database', 'schema.sql');
    const schemaSQL = fs.readFileSync(schemaPath, 'utf8');
    
    // Split by semicolons and execute each statement
    const statements = schemaSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => 
        stmt.length > 0 && 
        !stmt.startsWith('--') && 
        !stmt.toLowerCase().startsWith('create database') &&
        !stmt.toLowerCase().startsWith('use ')
      );

    for (const statement of statements) {
      if (statement.length > 0) {
        try {
          await connection.query(statement);
        } catch (error) {
          // Ignore "table already exists" errors
          if (!error.message.includes('already exists')) {
            console.warn('⚠️  Schema execution warning:', error.message);
          }
        }
      }
    }
    console.log('✅ Database schema initialized');

    // Run seed script
    console.log('🌱 Running database seeder...');
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    
    try {
      await execAsync('node database/seed.js');
      console.log('✅ Database seeded successfully');
    } catch (seedError) {
      // Seed script might fail if users already exist, which is okay
      console.log('ℹ️  Seed script completed (users may already exist)');
    }

    connection.release();
    
  } catch (error) {
    console.error('❌ Database initialization error:', error.message);
    if (connection) {
      connection.release();
    }
    // Don't exit - allow server to start even if DB init has issues
  }
}

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    res.json({ 
      status: 'healthy', 
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'unhealthy', 
      database: 'disconnected',
      error: error.message 
    });
  }
});

// API Routes - MUST BE REGISTERED BEFORE ROOT ENDPOINT
app.use('/api/auth', authRoutes);
app.use('/api/farmer', farmerRoutes);
app.use('/api/distributor', distributorRoutes);
app.use('/api/transporter', transporterRoutes);
app.use('/api/shop', shopRoutes);
app.use('/api/traceability', traceabilityRoutes); // Public - no auth required
app.use('/api/events', eventRoutes);
app.use('/api/commerce', commerceRoutes);
app.use('/api/consumer', consumerRoutes);
app.use('/api/admin', adminRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'AgriChain API Server - Farm-to-Retail Supply Chain Blockchain Platform',
    version: '2.0.0',
    description: 'Digital Twin system for agriculture with provenance, genealogy, and ownership tracking',
    endpoints: {
      health: '/health',
      auth: {
        login: 'POST /api/auth/login',
        register: 'POST /api/auth/register'
      },
      farmer: {
        createProduct: 'POST /api/farmer/products',
        getProducts: 'GET /api/farmer/products',
        createBatch: 'POST /api/farmer/batches',
        getBatches: 'GET /api/farmer/batches',
        logEvent: 'POST /api/farmer/events'
      },
      distributor: {
        marketplace: 'GET /api/distributor/marketplace',
        buy: 'POST /api/distributor/buy',
        splitBatch: 'POST /api/distributor/split-batch',
        inventory: 'GET /api/distributor/inventory'
      },
      transporter: {
        createEvent: 'POST /api/transporter/events',
        addAttachment: 'POST /api/transporter/events/:event_id/attachments',
        addIoTData: 'POST /api/transporter/events/:event_id/iot-data'
      },
      retailer: {
        createOrder: 'POST /api/shop/orders',
        getOrders: 'GET /api/shop/orders',
        getOrder: 'GET /api/shop/orders/:order_id'
      },
      traceability: {
        getBatchStory: 'GET /api/traceability/batch/:batch_code',
        getGenealogy: 'GET /api/traceability/batch/:batch_code/genealogy',
        getEvents: 'GET /api/traceability/batch/:batch_code/events'
      },
      events: {
        create: 'POST /api/events',
        getBatchEvents: 'GET /api/events/batch/:batch_id',
        addAttachment: 'POST /api/events/:event_id/attachments',
        addIoTData: 'POST /api/events/:event_id/iot-data'
      },
      commerce: {
        createOrder: 'POST /api/commerce/orders',
        getOrders: 'GET /api/commerce/orders',
        getOrder: 'GET /api/commerce/orders/:order_id'
      }
    }
  });
});

// Initialize database and start server
initializeDatabase().then(() => {
  app.listen(PORT, () => {
    console.log('\n🚀 AgriChain Server Started');
    console.log(`📡 Server running on http://localhost:${PORT}`);
    console.log(`💾 Database: MySQL (localhost:3306)`);
    console.log(`📊 Database Name: agrichain`);
    console.log('\n📋 Available API Routes:');
    console.log('   Auth: POST /api/auth/login, POST /api/auth/register');
    console.log('   Farmer: POST /api/farmer/products, POST /api/farmer/batches, GET /api/farmer/batches');
    console.log('   Distributor: GET /api/distributor/marketplace, POST /api/distributor/buy, POST /api/distributor/split-batch');
    console.log('   Transporter: POST /api/transporter/events, POST /api/transporter/events/:id/attachments');
    console.log('   Retailer: POST /api/shop/orders, GET /api/shop/orders');
    console.log('   Traceability: GET /api/traceability/batch/:batch_code (Public)');
    console.log('   Events: POST /api/events, GET /api/events/batch/:batch_id');
    console.log('   Commerce: POST /api/commerce/orders, GET /api/commerce/orders');
    console.log('');
  });
}).catch(error => {
  console.error('❌ Failed to initialize server:', error);
  process.exit(1);
});

module.exports = app;

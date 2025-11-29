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

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'AgriChain API Server',
    version: '1.0.0',
    module: 'Module 1: Website & Role-based Dashboards',
    endpoints: {
      health: '/health',
      auth: {
        login: '/api/auth/login',
        register: '/api/auth/register'
      },
      farmer: {
        addBatch: '/api/farmer/add-batch',
        myBatches: '/api/farmer/my-batches',
        logEvent: '/api/farmer/log-event'
      },
      distributor: {
        marketplace: '/api/distributor/marketplace',
        buy: '/api/distributor/buy',
        inventory: '/api/distributor/inventory',
        ship: '/api/distributor/ship'
      },
      transporter: {
        jobs: '/api/transporter/jobs',
        deliver: '/api/transporter/deliver'
      },
      shop: {
        inventory: '/api/shop/inventory',
        sell: '/api/shop/sell'
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
    console.log('   Auth: /api/auth/login, /api/auth/register');
    console.log('   Farmer: /api/farmer/add-batch, /api/farmer/my-batches, /api/farmer/log-event');
    console.log('   Distributor: /api/distributor/marketplace, /api/distributor/buy, /api/distributor/inventory, /api/distributor/ship');
    console.log('   Transporter: /api/transporter/jobs, /api/transporter/deliver');
    console.log('   Shop: /api/shop/inventory, /api/shop/sell');
    console.log('');
  });
}).catch(error => {
  console.error('❌ Failed to initialize server:', error);
  process.exit(1);
});

module.exports = app;

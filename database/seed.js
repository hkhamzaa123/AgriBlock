const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

async function seedDatabase() {
  let connection;
  
  try {
    // Get connection from pool
    connection = await pool.getConnection();
    console.log('✅ Connected to database for seeding');

    // Read and execute schema.sql first to ensure tables exist
    const schemaPath = path.join(__dirname, 'schema.sql');
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
    console.log('✅ Schema executed successfully');

    // ========== SEED ROLES ==========
    const roles = [
      { id: uuidv4(), name: 'FARMER', description: 'Farm owner who grows and harvests crops' },
      { id: uuidv4(), name: 'DISTRIBUTOR', description: 'Buys bulk from farmers and splits into smaller batches' },
      { id: uuidv4(), name: 'TRANSPORTER', description: 'Transports goods between locations' },
      { id: uuidv4(), name: 'RETAILER', description: 'Shopkeeper who sells to consumers' },
      { id: uuidv4(), name: 'CONSUMER', description: 'End consumer who purchases products' },
      { id: uuidv4(), name: 'ADMIN', description: 'System administrator with full access' }
    ];

    for (const role of roles) {
      try {
        await connection.query(
          'INSERT INTO roles (id, name, description) VALUES (?, ?, ?)',
          [role.id, role.name, role.description]
        );
        console.log(`✅ Seeded role: ${role.name}`);
      } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
          console.log(`⚠️  Role ${role.name} already exists, skipping...`);
        } else {
          throw error;
        }
      }
    }

    // Store role IDs for user creation
    const roleMap = {};
    for (const role of roles) {
      roleMap[role.name] = role.id;
    }

    // ========== SEED STATUSES ==========
    const statuses = [
      { id: uuidv4(), name: 'Harvested', description: 'Batch has been harvested from the farm' },
      { id: uuidv4(), name: 'In Transit', description: 'Batch is being transported' },
      { id: uuidv4(), name: 'In Warehouse', description: 'Batch is stored in distributor warehouse' },
      { id: uuidv4(), name: 'In Shop', description: 'Batch is available in retail shop' },
      { id: uuidv4(), name: 'Sold', description: 'Batch has been sold to consumer' },
      { id: uuidv4(), name: 'Processing', description: 'Batch is being processed/split' }
    ];

    for (const status of statuses) {
      try {
        await connection.query(
          'INSERT INTO statuses (id, name, description) VALUES (?, ?, ?)',
          [status.id, status.name, status.description]
        );
        console.log(`✅ Seeded status: ${status.name}`);
      } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
          console.log(`⚠️  Status ${status.name} already exists, skipping...`);
        } else {
          throw error;
        }
      }
    }

    // ========== SEED EVENT TYPES ==========
    const eventTypes = [
      { id: uuidv4(), name: 'Harvest', description: 'Crop harvested from field' },
      { id: uuidv4(), name: 'Transport Start', description: 'Transportation began' },
      { id: uuidv4(), name: 'Transport End', description: 'Transportation completed' },
      { id: uuidv4(), name: 'Quality Check', description: 'Quality inspection performed' },
      { id: uuidv4(), name: 'Split', description: 'Batch split into smaller batches' },
      { id: uuidv4(), name: 'Sold', description: 'Batch sold to buyer' },
      { id: uuidv4(), name: 'Fertilizer Applied', description: 'Fertilizer applied to crop' },
      { id: uuidv4(), name: 'Pesticide Applied', description: 'Pesticide applied to crop' },
      { id: uuidv4(), name: 'Irrigation', description: 'Crop irrigated' }
    ];

    for (const eventType of eventTypes) {
      try {
        await connection.query(
          'INSERT INTO event_types (id, name, description) VALUES (?, ?, ?)',
          [eventType.id, eventType.name, eventType.description]
        );
        console.log(`✅ Seeded event type: ${eventType.name}`);
      } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
          console.log(`⚠️  Event type ${eventType.name} already exists, skipping...`);
        } else {
          throw error;
        }
      }
    }

    // ========== SEED USERS ==========
    // Hash password for all users
    const hashedPassword = await bcrypt.hash('password123', 10);
    const adminPassword = await bcrypt.hash('admin123', 10);

    const users = [
      {
        id: uuidv4(),
        username: 'farmer_joe',
        email: 'farmer@agrichain.com',
        password_hash: hashedPassword,
        full_name: 'Farmer Joe',
        role_id: roleMap['FARMER'],
        is_active: 1
      },
      {
        id: uuidv4(),
        username: 'distributor_dave',
        email: 'distributor@agrichain.com',
        password_hash: hashedPassword,
        full_name: 'Distributor Dave',
        role_id: roleMap['DISTRIBUTOR'],
        is_active: 1
      },
      {
        id: uuidv4(),
        username: 'transporter_tom',
        email: 'transporter@agrichain.com',
        password_hash: hashedPassword,
        full_name: 'Transporter Tom',
        role_id: roleMap['TRANSPORTER'],
        is_active: 1
      },
      {
        id: uuidv4(),
        username: 'retailer_sarah',
        email: 'retailer@agrichain.com',
        password_hash: hashedPassword,
        full_name: 'Retailer Sarah',
        role_id: roleMap['RETAILER'],
        is_active: 1
      },
      {
        id: uuidv4(),
        username: 'consumer_carl',
        email: 'consumer@agrichain.com',
        password_hash: hashedPassword,
        full_name: 'Consumer Carl',
        role_id: roleMap['CONSUMER'],
        is_active: 1
      },
      {
        id: uuidv4(),
        username: 'admin',
        email: 'admin@agrichain.com',
        password_hash: adminPassword,
        full_name: 'System Administrator',
        role_id: roleMap['ADMIN'],
        is_active: 1  // Admin is pre-approved
      }
    ];

    // Insert users (ignore if they already exist)
    for (const user of users) {
      try {
        await connection.query(
          `INSERT INTO users (id, username, email, password_hash, full_name, role_id, is_active) 
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [user.id, user.username, user.email, user.password_hash, user.full_name, user.role_id, user.is_active]
        );
        console.log(`✅ Seeded user: ${user.username}`);
      } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
          console.log(`⚠️  User ${user.username} already exists, skipping...`);
        } else {
          throw error;
        }
      }
    }

    console.log('\n🎉 Database seeding completed successfully!');
    console.log('\n📋 Seeded Data:');
    console.log(`   - ${roles.length} Roles`);
    console.log(`   - ${statuses.length} Statuses`);
    console.log(`   - ${eventTypes.length} Event Types`);
    console.log(`   - ${users.length} Users`);
    console.log('\n🔑 All users have password: password123');
    console.log('\n👤 Test Users:');
    users.forEach(user => {
      console.log(`   - ${user.username} (${user.full_name})`);
    });

  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  } finally {
    if (connection) {
      connection.release();
    }
    // Close pool
    await pool.end();
    process.exit(0);
  }
}

// Run the seeder
seedDatabase();






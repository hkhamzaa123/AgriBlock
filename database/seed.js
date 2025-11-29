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
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--') && !stmt.toLowerCase().startsWith('create database'));

    for (const statement of statements) {
      if (statement.length > 0) {
        await connection.query(statement);
      }
    }
    console.log('✅ Schema executed successfully');

    // Hash password for all users
    const hashedPassword = await bcrypt.hash('password123', 10);

    // Define users to seed
    const users = [
      {
        user_id: uuidv4(),
        username: 'farmer_joe',
        password_hash: hashedPassword,
        role: 'FARMER',
        wallet_balance: 0.00
      },
      {
        user_id: uuidv4(),
        username: 'distributor_dave',
        password_hash: hashedPassword,
        role: 'DISTRIBUTOR',
        wallet_balance: 50000.00
      },
      {
        user_id: uuidv4(),
        username: 'transporter_tom',
        password_hash: hashedPassword,
        role: 'TRANSPORTER',
        wallet_balance: 0.00
      },
      {
        user_id: uuidv4(),
        username: 'shop_sarah',
        password_hash: hashedPassword,
        role: 'SHOPKEEPER',
        wallet_balance: 20000.00
      },
      {
        user_id: uuidv4(),
        username: 'consumer_carl',
        password_hash: hashedPassword,
        role: 'CONSUMER',
        wallet_balance: 0.00
      }
    ];

    // Insert users (ignore if they already exist)
    for (const user of users) {
      try {
        await connection.query(
          `INSERT INTO users (user_id, username, password_hash, role, wallet_balance) 
           VALUES (?, ?, ?, ?, ?)`,
          [user.user_id, user.username, user.password_hash, user.role, user.wallet_balance]
        );
        console.log(`✅ Seeded user: ${user.username} (${user.role})`);
      } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
          console.log(`⚠️  User ${user.username} already exists, skipping...`);
        } else {
          throw error;
        }
      }
    }

    console.log('\n🎉 Database seeding completed successfully!');
    console.log('\n📋 Seeded Users:');
    users.forEach(user => {
      console.log(`   - ${user.username} (${user.role}) - Wallet: $${user.wallet_balance.toFixed(2)}`);
    });
    console.log('\n🔑 All users have password: password123');

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






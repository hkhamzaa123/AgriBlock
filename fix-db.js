const pool = require('./config/db');

const runFix = async () => {
  try {
    const connection = await pool.getConnection();
    console.log('Running ALTER TABLE to add quantity column...');

    await connection.query(
      `ALTER TABLE crop_batches ADD COLUMN quantity DECIMAL(10,2) NOT NULL DEFAULT 1000.00;`
    );

    connection.release();
    console.log('Column quantity added successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Failed to add column:', error);
    process.exit(1);
  }
};

runFix();


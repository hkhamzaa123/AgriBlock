const db = require('../config/db');

async function fixMarketplaceData() {
  console.log('🔧 Starting marketplace data repair...');

  try {
    const [result] = await db.execute(
      `UPDATE crop_batches
       SET quantity = 1000, status = 'HARVESTED'
       WHERE status = 'HARVESTED' AND (quantity = 0 OR quantity IS NULL)`
    );

    console.log(`✅ Fixed ${result.affectedRows} rows`);
  } catch (error) {
    console.error('❌ Failed to repair marketplace data:', error.message);
    process.exitCode = 1;
  } finally {
    await db.end();
  }
}

fixMarketplaceData();


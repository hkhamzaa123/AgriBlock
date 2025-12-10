const db = require('../config/db');

class ProductChainLog {
  static async findById(log_id) {
    const [rows] = await db.execute(
      `SELECT pcl.*, 
              p.title as product_title,
              b.batch_code,
              e.recorded_at as event_time,
              s.name as status_name
       FROM product_chain_log pcl
       LEFT JOIN products p ON pcl.product_id = p.id
       LEFT JOIN batches b ON pcl.batch_id = b.id
       LEFT JOIN events e ON pcl.event_id = e.id
       LEFT JOIN statuses s ON pcl.status_id = s.id
       WHERE pcl.log_id = ?`,
      [log_id]
    );
    return rows[0] || null;
  }

  static async findByBatchId(batch_id) {
    const [rows] = await db.execute(
      `SELECT pcl.*, s.name as status_name, e.recorded_at as event_time
       FROM product_chain_log pcl
       LEFT JOIN statuses s ON pcl.status_id = s.id
       LEFT JOIN events e ON pcl.event_id = e.id
       WHERE pcl.batch_id = ?
       ORDER BY pcl.timestamp DESC`,
      [batch_id]
    );
    return rows;
  }

  static async findByProductId(product_id) {
    const [rows] = await db.execute(
      `SELECT pcl.*, b.batch_code, s.name as status_name
       FROM product_chain_log pcl
       LEFT JOIN batches b ON pcl.batch_id = b.id
       LEFT JOIN statuses s ON pcl.status_id = s.id
       WHERE pcl.product_id = ?
       ORDER BY pcl.timestamp DESC`,
      [product_id]
    );
    return rows;
  }

  static async create(data) {
    const { log_id, product_id, batch_id, event_id, status_id } = data;
    await db.execute(
      `INSERT INTO product_chain_log (log_id, product_id, batch_id, event_id, status_id)
       VALUES (?, ?, ?, ?, ?)`,
      [log_id, product_id, batch_id, event_id, status_id]
    );
    return await this.findById(log_id);
  }
}

module.exports = ProductChainLog;
















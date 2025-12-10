const db = require('../config/db');

class OrderItem {
  static async findById(id) {
    const [rows] = await db.execute(
      `SELECT oi.*, 
              b.batch_code, b.product_id,
              p.title as product_title
       FROM order_items oi
       LEFT JOIN batches b ON oi.batch_id = b.id
       LEFT JOIN products p ON b.product_id = p.id
       WHERE oi.id = ?`,
      [id]
    );
    return rows[0] || null;
  }

  static async findByOrderId(order_id) {
    const [rows] = await db.execute(
      `SELECT oi.*, 
              b.batch_code, b.product_id, b.quantity_unit,
              p.title as product_title
       FROM order_items oi
       LEFT JOIN batches b ON oi.batch_id = b.id
       LEFT JOIN products p ON b.product_id = p.id
       WHERE oi.order_id = ?
       ORDER BY oi.id`,
      [order_id]
    );
    return rows;
  }

  static async findByBatchId(batch_id) {
    const [rows] = await db.execute(
      `SELECT oi.*, o.order_number, o.buyer_id, o.seller_id
       FROM order_items oi
       LEFT JOIN orders o ON oi.order_id = o.id
       WHERE oi.batch_id = ?
       ORDER BY o.created_at DESC`,
      [batch_id]
    );
    return rows;
  }

  static async create(data) {
    const { id, order_id, batch_id, quantity, unit_price } = data;
    await db.execute(
      `INSERT INTO order_items (id, order_id, batch_id, quantity, unit_price)
       VALUES (?, ?, ?, ?, ?)`,
      [id, order_id, batch_id, quantity, unit_price]
    );
    return await this.findById(id);
  }
}

module.exports = OrderItem;
















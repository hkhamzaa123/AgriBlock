const db = require('../config/db');

class Shipment {
  static async findById(id) {
    const [rows] = await db.execute(
      `SELECT s.*, 
              o.order_number, o.buyer_id, o.seller_id,
              t.username as transporter_username, t.full_name as transporter_name
       FROM shipments s
       LEFT JOIN orders o ON s.order_id = o.id
       LEFT JOIN users t ON s.transporter_id = t.id
       WHERE s.id = ?`,
      [id]
    );
    return rows[0] || null;
  }

  static async findByOrderId(order_id) {
    const [rows] = await db.execute(
      `SELECT s.*, t.username as transporter_username
       FROM shipments s
       LEFT JOIN users t ON s.transporter_id = t.id
       WHERE s.order_id = ?
       ORDER BY s.created_at DESC`,
      [order_id]
    );
    return rows;
  }

  static async findByTransporterId(transporter_id) {
    const [rows] = await db.execute(
      `SELECT s.*, o.order_number
       FROM shipments s
       LEFT JOIN orders o ON s.order_id = o.id
       WHERE s.transporter_id = ?
       ORDER BY s.created_at DESC`,
      [transporter_id]
    );
    return rows;
  }

  static async create(data) {
    const { id, order_id, transporter_id, estimated_delivery } = data;
    await db.execute(
      `INSERT INTO shipments (id, order_id, transporter_id, estimated_delivery)
       VALUES (?, ?, ?, ?)`,
      [id, order_id, transporter_id, estimated_delivery]
    );
    return await this.findById(id);
  }

  static async update(id, data) {
    const fields = [];
    const values = [];
    
    if (data.estimated_delivery !== undefined) { fields.push('estimated_delivery = ?'); values.push(data.estimated_delivery); }
    
    if (fields.length === 0) return await this.findById(id);
    
    values.push(id);
    await db.execute(
      `UPDATE shipments SET ${fields.join(', ')} WHERE id = ?`,
      values
    );
    return await this.findById(id);
  }
}

module.exports = Shipment;
















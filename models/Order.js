const db = require('../config/db');

class Order {
  static async findById(id) {
    const [rows] = await db.execute(
      `SELECT o.*, 
              buyer.username as buyer_username, buyer.full_name as buyer_name,
              seller.username as seller_username, seller.full_name as seller_name
       FROM orders o
       LEFT JOIN users buyer ON o.buyer_id = buyer.id
       LEFT JOIN users seller ON o.seller_id = seller.id
       WHERE o.id = ?`,
      [id]
    );
    return rows[0] || null;
  }

  static async findByOrderNumber(order_number) {
    const [rows] = await db.execute(
      `SELECT o.*, 
              buyer.username as buyer_username,
              seller.username as seller_username
       FROM orders o
       LEFT JOIN users buyer ON o.buyer_id = buyer.id
       LEFT JOIN users seller ON o.seller_id = seller.id
       WHERE o.order_number = ?`,
      [order_number]
    );
    return rows[0] || null;
  }

  static async findByBuyerId(buyer_id) {
    const [rows] = await db.execute(
      `SELECT o.*, seller.username as seller_username
       FROM orders o
       LEFT JOIN users seller ON o.seller_id = seller.id
       WHERE o.buyer_id = ?
       ORDER BY o.created_at DESC`,
      [buyer_id]
    );
    return rows;
  }

  static async findBySellerId(seller_id) {
    const [rows] = await db.execute(
      `SELECT o.*, buyer.username as buyer_username
       FROM orders o
       LEFT JOIN users buyer ON o.buyer_id = buyer.id
       WHERE o.seller_id = ?
       ORDER BY o.created_at DESC`,
      [seller_id]
    );
    return rows;
  }

  static async create(data) {
    const { id, order_number, buyer_id, seller_id, total_amount, is_completed = false } = data;
    await db.execute(
      `INSERT INTO orders (id, order_number, buyer_id, seller_id, total_amount, is_completed)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, order_number, buyer_id, seller_id, total_amount, is_completed]
    );
    return await this.findById(id);
  }

  static async update(id, data) {
    const fields = [];
    const values = [];
    
    if (data.is_completed !== undefined) { fields.push('is_completed = ?'); values.push(data.is_completed); }
    if (data.total_amount !== undefined) { fields.push('total_amount = ?'); values.push(data.total_amount); }
    
    if (fields.length === 0) return await this.findById(id);
    
    values.push(id);
    await db.execute(
      `UPDATE orders SET ${fields.join(', ')} WHERE id = ?`,
      values
    );
    return await this.findById(id);
  }
}

module.exports = Order;
















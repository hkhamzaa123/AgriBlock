const db = require('../config/db');

class Product {
  static async findById(id) {
    const [rows] = await db.execute(
      `SELECT p.*, u.username as farmer_username, u.full_name as farmer_name
       FROM products p
       LEFT JOIN users u ON p.farmer_id = u.id
       WHERE p.id = ?`,
      [id]
    );
    return rows[0] || null;
  }

  static async findByFarmerId(farmer_id) {
    const [rows] = await db.execute(
      'SELECT * FROM products WHERE farmer_id = ? ORDER BY created_at DESC',
      [farmer_id]
    );
    return rows;
  }

  static async findAll() {
    const [rows] = await db.execute(
      `SELECT p.*, u.username as farmer_username
       FROM products p
       LEFT JOIN users u ON p.farmer_id = u.id
       ORDER BY p.created_at DESC`
    );
    return rows;
  }

  static async create(data) {
    const { id, farmer_id, title, crop_details } = data;
    await db.execute(
      'INSERT INTO products (id, farmer_id, title, crop_details) VALUES (?, ?, ?, ?)',
      [id, farmer_id, title, crop_details]
    );
    return await this.findById(id);
  }
}

module.exports = Product;
















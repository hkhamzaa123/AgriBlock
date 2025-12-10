const db = require('../config/db');

class User {
  static async findById(id) {
    const [rows] = await db.execute(
      `SELECT u.*, r.name as role_name, r.description as role_description
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE u.id = ?`,
      [id]
    );
    return rows[0] || null;
  }

  static async findByUsername(username) {
    const [rows] = await db.execute(
      `SELECT u.*, r.name as role_name, r.description as role_description
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE u.username = ?`,
      [username]
    );
    return rows[0] || null;
  }

  static async findByEmail(email) {
    const [rows] = await db.execute(
      `SELECT u.*, r.name as role_name
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE u.email = ?`,
      [email]
    );
    return rows[0] || null;
  }

  static async create(data) {
    const { id, username, email, password_hash, full_name, role_id, is_active = 0 } = data;
    await db.execute(
      `INSERT INTO users (id, username, email, password_hash, full_name, role_id, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, username, email, password_hash, full_name, role_id, is_active]
    );
    return await this.findById(id);
  }

  static async update(id, data) {
    const fields = [];
    const values = [];
    
    if (data.email !== undefined) { fields.push('email = ?'); values.push(data.email); }
    if (data.password_hash !== undefined) { fields.push('password_hash = ?'); values.push(data.password_hash); }
    if (data.full_name !== undefined) { fields.push('full_name = ?'); values.push(data.full_name); }
    if (data.role_id !== undefined) { fields.push('role_id = ?'); values.push(data.role_id); }
    if (data.is_active !== undefined) { fields.push('is_active = ?'); values.push(data.is_active); }
    
    if (fields.length === 0) return await this.findById(id);
    
    values.push(id);
    await db.execute(
      `UPDATE users SET ${fields.join(', ')} WHERE id = ?`,
      values
    );
    return await this.findById(id);
  }
}

module.exports = User;
















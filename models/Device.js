const db = require('../config/db');

class Device {
  static async findById(id) {
    const [rows] = await db.execute(
      `SELECT d.*, u.username as owner_username
       FROM devices d
       LEFT JOIN users u ON d.owner_user_id = u.id
       WHERE d.id = ?`,
      [id]
    );
    return rows[0] || null;
  }

  static async findByOwnerId(owner_user_id) {
    const [rows] = await db.execute(
      'SELECT * FROM devices WHERE owner_user_id = ? ORDER BY created_at DESC',
      [owner_user_id]
    );
    return rows;
  }

  static async create(data) {
    const { id, owner_user_id, name, device_type } = data;
    await db.execute(
      'INSERT INTO devices (id, owner_user_id, name, device_type) VALUES (?, ?, ?, ?)',
      [id, owner_user_id, name, device_type]
    );
    return await this.findById(id);
  }
}

module.exports = Device;
















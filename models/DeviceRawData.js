const db = require('../config/db');

class DeviceRawData {
  static async findById(id) {
    const [rows] = await db.execute(
      `SELECT drd.*, e.batch_id, d.name as device_name
       FROM device_raw_data drd
       LEFT JOIN events e ON drd.event_id = e.id
       LEFT JOIN devices d ON drd.device_id = d.id
       WHERE drd.id = ?`,
      [id]
    );
    return rows[0] || null;
  }

  static async findByEventId(event_id) {
    const [rows] = await db.execute(
      `SELECT drd.*, d.name as device_name, d.device_type
       FROM device_raw_data drd
       LEFT JOIN devices d ON drd.device_id = d.id
       WHERE drd.event_id = ?
       ORDER BY drd.captured_at ASC`,
      [event_id]
    );
    return rows;
  }

  static async create(data) {
    const { id, event_id, device_id, raw_data } = data;
    await db.execute(
      'INSERT INTO device_raw_data (id, event_id, device_id, raw_data) VALUES (?, ?, ?, ?)',
      [id, event_id, device_id, raw_data]
    );
    return await this.findById(id);
  }
}

module.exports = DeviceRawData;
















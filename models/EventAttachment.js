const db = require('../config/db');

class EventAttachment {
  static async findById(id) {
    const [rows] = await db.execute('SELECT * FROM event_attachments WHERE id = ?', [id]);
    return rows[0] || null;
  }

  static async findByEventId(event_id) {
    const [rows] = await db.execute(
      'SELECT * FROM event_attachments WHERE event_id = ? ORDER BY uploaded_at ASC',
      [event_id]
    );
    return rows;
  }

  static async create(data) {
    const { id, event_id, file_url, file_type, description } = data;
    await db.execute(
      `INSERT INTO event_attachments (id, event_id, file_url, file_type, description)
       VALUES (?, ?, ?, ?, ?)`,
      [id, event_id, file_url, file_type, description]
    );
    return await this.findById(id);
  }
}

module.exports = EventAttachment;
















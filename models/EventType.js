const db = require('../config/db');

class EventType {
  static async findById(id) {
    const [rows] = await db.execute('SELECT * FROM event_types WHERE id = ?', [id]);
    return rows[0] || null;
  }

  static async findByName(name) {
    const [rows] = await db.execute('SELECT * FROM event_types WHERE name = ?', [name]);
    return rows[0] || null;
  }

  static async findAll() {
    const [rows] = await db.execute('SELECT * FROM event_types ORDER BY name');
    return rows;
  }

  static async create(data) {
    const { id, name, description } = data;
    await db.execute(
      'INSERT INTO event_types (id, name, description) VALUES (?, ?, ?)',
      [id, name, description]
    );
    return { id, name, description };
  }
}

module.exports = EventType;
















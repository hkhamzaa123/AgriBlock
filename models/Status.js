const db = require('../config/db');

class Status {
  static async findById(id) {
    const [rows] = await db.execute('SELECT * FROM statuses WHERE id = ?', [id]);
    return rows[0] || null;
  }

  static async findByName(name) {
    const [rows] = await db.execute('SELECT * FROM statuses WHERE name = ?', [name]);
    return rows[0] || null;
  }

  static async findAll() {
    const [rows] = await db.execute('SELECT * FROM statuses ORDER BY name');
    return rows;
  }

  static async create(data) {
    const { id, name, description } = data;
    await db.execute(
      'INSERT INTO statuses (id, name, description) VALUES (?, ?, ?)',
      [id, name, description]
    );
    return { id, name, description };
  }
}

module.exports = Status;
















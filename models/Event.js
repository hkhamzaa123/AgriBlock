const db = require('../config/db');

class Event {
  static async findById(id) {
    const [rows] = await db.execute(
      `SELECT e.*, 
              et.name as event_type_name, et.description as event_type_description,
              b.batch_code, b.product_id,
              u.username as actor_username, u.full_name as actor_name
       FROM events e
       LEFT JOIN event_types et ON e.event_type_id = et.id
       LEFT JOIN batches b ON e.batch_id = b.id
       LEFT JOIN users u ON e.actor_user_id = u.id
       WHERE e.id = ?`,
      [id]
    );
    return rows[0] || null;
  }

  static async findByBatchId(batch_id) {
    const [rows] = await db.execute(
      `SELECT e.*, et.name as event_type_name, u.username as actor_username
       FROM events e
       LEFT JOIN event_types et ON e.event_type_id = et.id
       LEFT JOIN users u ON e.actor_user_id = u.id
       WHERE e.batch_id = ?
       ORDER BY e.recorded_at ASC`,
      [batch_id]
    );
    return rows;
  }

  static async findByActorId(actor_user_id) {
    const [rows] = await db.execute(
      `SELECT e.*, et.name as event_type_name, b.batch_code
       FROM events e
       LEFT JOIN event_types et ON e.event_type_id = et.id
       LEFT JOIN batches b ON e.batch_id = b.id
       WHERE e.actor_user_id = ?
       ORDER BY e.recorded_at DESC`,
      [actor_user_id]
    );
    return rows;
  }

  static async create(data) {
    const {
      id,
      event_type_id,
      batch_id,
      actor_user_id,
      location_coords,
      blockchain_tx_hash
    } = data;

    await db.execute(
      `INSERT INTO events (id, event_type_id, batch_id, actor_user_id, location_coords, blockchain_tx_hash)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, event_type_id, batch_id, actor_user_id, location_coords, blockchain_tx_hash]
    );
    return await this.findById(id);
  }

  // Get all events for a batch including parent batch events (recursive)
  static async getFullHistory(batch_id) {
    const events = [];
    let current_batch_id = batch_id;

    // Traverse up the genealogy tree
    while (current_batch_id) {
      const batchEvents = await this.findByBatchId(current_batch_id);
      events.push(...batchEvents);

      // Get parent batch
      const [parentRows] = await db.execute(
        'SELECT parent_batch_id FROM batches WHERE id = ?',
        [current_batch_id]
      );
      
      if (parentRows.length && parentRows[0].parent_batch_id) {
        current_batch_id = parentRows[0].parent_batch_id;
      } else {
        break;
      }
    }

    // Sort by recorded_at
    return events.sort((a, b) => new Date(a.recorded_at) - new Date(b.recorded_at));
  }
}

module.exports = Event;
















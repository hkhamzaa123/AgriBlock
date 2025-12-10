const db = require('../config/db');

class Batch {
  static async findById(id) {
    const [rows] = await db.execute(
      `SELECT b.*, 
              p.title as product_title, p.crop_details,
              u.username as owner_username, u.full_name as owner_name,
              s.name as status_name, s.description as status_description,
              pb.batch_code as parent_batch_code
       FROM batches b
       LEFT JOIN products p ON b.product_id = p.id
       LEFT JOIN users u ON b.current_owner_id = u.id
       LEFT JOIN statuses s ON b.current_status_id = s.id
       LEFT JOIN batches pb ON b.parent_batch_id = pb.id
       WHERE b.id = ?`,
      [id]
    );
    return rows[0] || null;
  }

  static async findByBatchCode(batch_code) {
    const [rows] = await db.execute(
      `SELECT b.*, 
              p.title as product_title,
              s.name as status_name,
              u.username as owner_username
       FROM batches b
       LEFT JOIN products p ON b.product_id = p.id
       LEFT JOIN statuses s ON b.current_status_id = s.id
       LEFT JOIN users u ON b.current_owner_id = u.id
       WHERE b.batch_code = ?`,
      [batch_code]
    );
    return rows[0] || null;
  }

  static async findByOwnerId(owner_id) {
    const [rows] = await db.execute(
      `SELECT b.*, p.title as product_title, s.name as status_name
       FROM batches b
       LEFT JOIN products p ON b.product_id = p.id
       LEFT JOIN statuses s ON b.current_status_id = s.id
       WHERE b.current_owner_id = ?
       ORDER BY b.created_at DESC`,
      [owner_id]
    );
    return rows;
  }

  static async findByProductId(product_id) {
    const [rows] = await db.execute(
      `SELECT b.*, s.name as status_name
       FROM batches b
       LEFT JOIN statuses s ON b.current_status_id = s.id
       WHERE b.product_id = ?
       ORDER BY b.created_at DESC`,
      [product_id]
    );
    return rows;
  }

  static async findByParentBatchId(parent_batch_id) {
    const [rows] = await db.execute(
      `SELECT b.*, s.name as status_name
       FROM batches b
       LEFT JOIN statuses s ON b.current_status_id = s.id
       WHERE b.parent_batch_id = ?
       ORDER BY b.created_at DESC`,
      [parent_batch_id]
    );
    return rows;
  }

  static async findRootBatches() {
    const [rows] = await db.execute(
      `SELECT b.*, p.title as product_title, s.name as status_name
       FROM batches b
       LEFT JOIN products p ON b.product_id = p.id
       LEFT JOIN statuses s ON b.current_status_id = s.id
       WHERE b.parent_batch_id IS NULL
       ORDER BY b.created_at DESC`
    );
    return rows;
  }

  static async create(data) {
    const {
      id,
      product_id,
      parent_batch_id,
      batch_code,
      current_owner_id,
      current_status_id,
      initial_quantity,
      remaining_quantity,
      quantity_unit,
      harvest_date
    } = data;

    await db.execute(
      `INSERT INTO batches (
        id, product_id, parent_batch_id, batch_code, current_owner_id,
        current_status_id, initial_quantity, remaining_quantity, quantity_unit, harvest_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, product_id, parent_batch_id, batch_code, current_owner_id,
        current_status_id, initial_quantity, remaining_quantity, quantity_unit, harvest_date
      ]
    );
    return await this.findById(id);
  }

  static async update(id, data) {
    const fields = [];
    const values = [];
    
    if (data.current_owner_id !== undefined) { fields.push('current_owner_id = ?'); values.push(data.current_owner_id); }
    if (data.current_status_id !== undefined) { fields.push('current_status_id = ?'); values.push(data.current_status_id); }
    if (data.remaining_quantity !== undefined) { fields.push('remaining_quantity = ?'); values.push(data.remaining_quantity); }
    if (data.harvest_date !== undefined) { fields.push('harvest_date = ?'); values.push(data.harvest_date); }
    
    if (fields.length === 0) return await this.findById(id);
    
    values.push(id);
    await db.execute(
      `UPDATE batches SET ${fields.join(', ')} WHERE id = ?`,
      values
    );
    return await this.findById(id);
  }

  static async deductQuantity(id, quantity) {
    await db.execute(
      'UPDATE batches SET remaining_quantity = remaining_quantity - ? WHERE id = ?',
      [quantity, id]
    );
    return await this.findById(id);
  }

  // Recursive function to get full genealogy tree
  static async getGenealogyTree(batch_id) {
    const batch = await this.findById(batch_id);
    if (!batch) return null;

    const tree = {
      batch: batch,
      parent: null,
      children: []
    };

    // Get parent if exists
    if (batch.parent_batch_id) {
      tree.parent = await this.getGenealogyTree(batch.parent_batch_id);
    }

    // Get children
    const children = await this.findByParentBatchId(batch_id);
    for (const child of children) {
      const childTree = await this.getGenealogyTree(child.id);
      if (childTree) {
        tree.children.push(childTree);
      }
    }

    return tree;
  }
}

module.exports = Batch;
















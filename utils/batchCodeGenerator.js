/**
 * Generate unique batch codes for traceability
 * Format: BATCH-YYYYMMDD-HHMMSS-XXXX (where XXXX is random)
 */
function generateBatchCode() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  
  return `BATCH-${year}${month}${day}-${hours}${minutes}${seconds}-${random}`;
}

/**
 * Generate order number
 * Format: ORD-YYYYMMDD-XXXX
 */
function generateOrderNumber() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  
  return `ORD-${year}${month}${day}-${random}`;
}

module.exports = {
  generateBatchCode,
  generateOrderNumber
};
















const axios = require('axios');
const crypto = require('crypto');

// Blockchain Configuration
const BLOCKCHAIN_BASE_URL = process.env.BLOCKCHAIN_URL || 'http://localhost:8000';

/**
 * Generate a 32-byte hexadecimal address (64 characters)
 * Used for wallet addresses in the blockchain
 */
function generateAddress(userId) {
  // Create a deterministic hash based on user ID
  const hash = crypto.createHash('sha256').update(`agriblock-${userId}`).digest('hex');
  return hash;
}

/**
 * Submit a transaction to the blockchain
 * @param {Object} transactionData
 * @param {string} transactionData.sender - User ID of sender
 * @param {string} transactionData.recipient - User ID of recipient
 * @param {string} transactionData.batch_id - Batch identifier
 * @param {string} transactionData.event_type - Event type (HARVEST, TRANSPORT, SALE, etc.)
 * @param {Object} transactionData.data - Additional metadata
 * @returns {Promise<Object>} Response from blockchain
 */
async function submitTransaction(transactionData) {
  try {
    const { sender, recipient, batch_id, event_type, data } = transactionData;

    // Validate required fields
    if (!sender || !recipient || !batch_id || !event_type) {
      throw new Error('Missing required transaction fields: sender, recipient, batch_id, event_type');
    }

    // Convert user IDs to blockchain addresses (32-byte hex)
    const senderAddress = generateAddress(sender);
    const recipientAddress = generateAddress(recipient);

    // Prepare transaction payload for blockchain
    const payload = {
      sender: senderAddress,
      recipient: recipientAddress,
      batch_id: batch_id,
      event_type: event_type,
      data: JSON.stringify(data || {}), // Stringify metadata as per blockchain requirement
    };

    console.log('[Blockchain] Submitting transaction:', {
      event_type,
      batch_id,
      sender_id: sender,
      recipient_id: recipient,
    });

    // Submit to blockchain
    const response = await axios.post(
      `${BLOCKCHAIN_BASE_URL}/transactions`,
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 5000, // 5 second timeout
      }
    );

    console.log('[Blockchain] Transaction submitted successfully:', response.data);
    return {
      success: true,
      transaction_hash: response.data?.hash || null,
      data: response.data,
    };
  } catch (error) {
    console.error('[Blockchain] Transaction submission failed:', error.message);
    
    // Don't fail the main operation if blockchain is unavailable
    return {
      success: false,
      error: error.message,
      message: 'Blockchain unavailable, transaction recorded locally only',
    };
  }
}

/**
 * Fetch the entire blockchain
 * @returns {Promise<Array>} Array of blocks
 */
async function getBlockchain() {
  try {
    console.log('[Blockchain] Fetching entire blockchain...');
    
    const response = await axios.get(`${BLOCKCHAIN_BASE_URL}/blocks`, {
      timeout: 10000, // 10 second timeout
    });

    return {
      success: true,
      blocks: response.data || [],
    };
  } catch (error) {
    console.error('[Blockchain] Failed to fetch blockchain:', error.message);
    return {
      success: false,
      error: error.message,
      blocks: [],
    };
  }
}

/**
 * Get blockchain transactions filtered by batch_id
 * @param {string} batchId - The batch ID to filter by
 * @returns {Promise<Array>} Transactions related to the batch
 */
async function getTransactionsByBatchId(batchId) {
  try {
    console.log('[Blockchain] Fetching transactions for batch:', batchId);
    
    // Fetch entire blockchain
    const blockchainResult = await getBlockchain();
    
    if (!blockchainResult.success) {
      return {
        success: false,
        transactions: [],
        error: blockchainResult.error,
      };
    }

    // Filter transactions by batch_id
    const transactions = [];
    
    blockchainResult.blocks.forEach(block => {
      if (block.transactions && Array.isArray(block.transactions)) {
        block.transactions.forEach(tx => {
          if (tx.batch_id === batchId) {
            transactions.push({
              ...tx,
              block_index: block.index,
              block_hash: block.hash,
              block_timestamp: block.timestamp,
              previous_hash: block.previous_hash,
            });
          }
        });
      }
    });

    console.log(`[Blockchain] Found ${transactions.length} transactions for batch ${batchId}`);

    return {
      success: true,
      transactions,
      count: transactions.length,
    };
  } catch (error) {
    console.error('[Blockchain] Failed to fetch batch transactions:', error.message);
    return {
      success: false,
      transactions: [],
      error: error.message,
    };
  }
}

/**
 * Get blockchain transactions filtered by multiple batch IDs
 * @param {Array<string>} batchIds - Array of batch IDs
 * @returns {Promise<Object>} Transactions grouped by batch_id
 */
async function getTransactionsByBatchIds(batchIds) {
  try {
    console.log('[Blockchain] Fetching transactions for batches:', batchIds);
    
    const blockchainResult = await getBlockchain();
    
    if (!blockchainResult.success) {
      return {
        success: false,
        transactions: {},
        error: blockchainResult.error,
      };
    }

    // Group transactions by batch_id
    const transactionsByBatch = {};
    batchIds.forEach(id => {
      transactionsByBatch[id] = [];
    });

    blockchainResult.blocks.forEach(block => {
      if (block.transactions && Array.isArray(block.transactions)) {
        block.transactions.forEach(tx => {
          if (batchIds.includes(tx.batch_id)) {
            transactionsByBatch[tx.batch_id].push({
              ...tx,
              block_index: block.index,
              block_hash: block.hash,
              block_timestamp: block.timestamp,
            });
          }
        });
      }
    });

    return {
      success: true,
      transactions: transactionsByBatch,
    };
  } catch (error) {
    console.error('[Blockchain] Failed to fetch batch transactions:', error.message);
    return {
      success: false,
      transactions: {},
      error: error.message,
    };
  }
}

/**
 * Health check for blockchain API
 * @returns {Promise<boolean>} True if blockchain is reachable
 */
async function checkBlockchainHealth() {
  try {
    const response = await axios.get(`${BLOCKCHAIN_BASE_URL}/blocks`, {
      timeout: 3000,
    });
    return response.status === 200;
  } catch (error) {
    return false;
  }
}

module.exports = {
  submitTransaction,
  getBlockchain,
  getTransactionsByBatchId,
  getTransactionsByBatchIds,
  checkBlockchainHealth,
  generateAddress,
};

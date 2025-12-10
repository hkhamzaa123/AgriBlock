const { Event, EventType, Batch, ProductChainLog, Status, EventAttachment, DeviceRawData } = require('../models');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');

/**
 * POST /api/events
 * Create an event (used by transporters, distributors, etc.)
 * Automatically updates product_chain_log and batches.current_status
 */
const createEvent = async (req, res) => {
  const connection = await db.getConnection();
  
  try {
    await connection.beginTransaction();

    const { batch_id, event_type_name, location_coords, blockchain_tx_hash, status_name } = req.body;
    const actor_user_id = req.user.user_id;

    if (!batch_id || !event_type_name) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'batch_id and event_type_name are required',
      });
    }

    // Verify batch exists
    const batch = await Batch.findById(batch_id);
    if (!batch) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: 'Batch not found',
      });
    }

    // Find event type
    const eventType = await EventType.findByName(event_type_name);
    if (!eventType) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: `Event type "${event_type_name}" not found`,
      });
    }

    // Determine new status (if provided, use it; otherwise keep current)
    let newStatusId = batch.current_status_id;
    if (status_name) {
      const newStatus = await Status.findByName(status_name);
      if (!newStatus) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: `Status "${status_name}" not found`,
        });
      }
      newStatusId = newStatus.id;
    }

    // Create event
    const eventId = uuidv4();
    const event = await Event.create({
      id: eventId,
      event_type_id: eventType.id,
      batch_id,
      actor_user_id,
      location_coords: location_coords || null,
      blockchain_tx_hash: blockchain_tx_hash || null,
    });

    // Update batch status if changed
    if (newStatusId !== batch.current_status_id) {
      await Batch.update(batch_id, { current_status_id: newStatusId });
    }

    // Update product_chain_log (performance cache)
    const logId = uuidv4();
    await ProductChainLog.create({
      log_id: logId,
      product_id: batch.product_id,
      batch_id,
      event_id: eventId,
      status_id: newStatusId,
    });

    await connection.commit();

    const updatedBatch = await Batch.findById(batch_id);

    res.status(201).json({
      success: true,
      message: 'Event created successfully',
      data: {
        event,
        batch: updatedBatch,
        log_entry: await ProductChainLog.findById(logId),
      },
    });
  } catch (error) {
    await connection.rollback();
    console.error('createEvent error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create event',
      error: error.message,
    });
  } finally {
    connection.release();
  }
};

/**
 * POST /api/events/:event_id/attachments
 * Add media attachment to an event (proof of quality, photos, etc.)
 */
const addAttachment = async (req, res) => {
  try {
    const { event_id } = req.params;
    const { file_url, file_type, description } = req.body;

    if (!event_id || !file_url) {
      return res.status(400).json({
        success: false,
        message: 'event_id and file_url are required',
      });
    }

    // Verify event exists
    const event = await Event.findById(event_id);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found',
      });
    }

    const attachmentId = uuidv4();
    const attachment = await EventAttachment.create({
      id: attachmentId,
      event_id,
      file_url,
      file_type: file_type || null,
      description: description || null,
    });

    res.status(201).json({
      success: true,
      message: 'Attachment added successfully',
      data: attachment,
    });
  } catch (error) {
    console.error('addAttachment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add attachment',
      error: error.message,
    });
  }
};

/**
 * POST /api/events/:event_id/iot-data
 * Add IoT sensor data to an event
 */
const addIoTData = async (req, res) => {
  try {
    const { event_id } = req.params;
    const { device_id, raw_data } = req.body;

    if (!event_id || !device_id || !raw_data) {
      return res.status(400).json({
        success: false,
        message: 'event_id, device_id, and raw_data are required',
      });
    }

    // Verify event exists
    const event = await Event.findById(event_id);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found',
      });
    }

    const dataId = uuidv4();
    const iotData = await DeviceRawData.create({
      id: dataId,
      event_id,
      device_id,
      raw_data,
    });

    res.status(201).json({
      success: true,
      message: 'IoT data added successfully',
      data: iotData,
    });
  } catch (error) {
    console.error('addIoTData error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add IoT data',
      error: error.message,
    });
  }
};

/**
 * GET /api/events/batch/:batch_id
 * Get all events for a batch (including parent batch events - recursive)
 */
const getBatchEvents = async (req, res) => {
  try {
    const { batch_id } = req.params;

    // Get full history (recursive)
    const events = await Event.getFullHistory(batch_id);

    // Enrich with attachments and IoT data
    const enrichedEvents = await Promise.all(
      events.map(async (event) => {
        const attachments = await EventAttachment.findByEventId(event.id);
        const iotData = await DeviceRawData.findByEventId(event.id);
        return {
          ...event,
          attachments,
          iot_data: iotData,
        };
      })
    );

    res.status(200).json({
      success: true,
      message: 'Events retrieved successfully',
      data: enrichedEvents,
      count: enrichedEvents.length,
    });
  } catch (error) {
    console.error('getBatchEvents error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch events',
      error: error.message,
    });
  }
};

module.exports = {
  createEvent,
  addAttachment,
  addIoTData,
  getBatchEvents,
};
















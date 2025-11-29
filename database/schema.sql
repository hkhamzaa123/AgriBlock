-- =================================================================================
-- FARM-TO-FORK TRACEABILITY SYSTEM (FINAL FIXED VERSION)
-- Compatible with: MySQL 8.0+
-- Includes: Genealogy, Media Proof, Multi-Item Orders, IoT Raw Data
-- =================================================================================

-- 1. ROLES
CREATE TABLE roles (
  id CHAR(36) PRIMARY KEY NOT NULL DEFAULT (UUID()),
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  created_at DATETIME(6) NOT NULL DEFAULT (CURRENT_TIMESTAMP(6))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. USERS
CREATE TABLE users (
  id CHAR(36) PRIMARY KEY NOT NULL DEFAULT (UUID()),
  username VARCHAR(150) NOT NULL UNIQUE,
  email VARCHAR(255) UNIQUE,
  password_hash TEXT,
  full_name VARCHAR(255),
  role_id CHAR(36),
  is_active TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL DEFAULT (CURRENT_TIMESTAMP(6)),
  CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. STATUSES (State of the Batch)
CREATE TABLE statuses (
  id CHAR(36) PRIMARY KEY NOT NULL DEFAULT (UUID()),
  name VARCHAR(200) NOT NULL,
  description TEXT,
  created_at DATETIME(6) NOT NULL DEFAULT (CURRENT_TIMESTAMP(6))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. PRODUCTS (The Definition)
CREATE TABLE products (
  id CHAR(36) PRIMARY KEY NOT NULL DEFAULT (UUID()),
  farmer_id CHAR(36) NOT NULL,
  title VARCHAR(400) NOT NULL,
  crop_details TEXT,
  created_at DATETIME(6) NOT NULL DEFAULT (CURRENT_TIMESTAMP(6)),
  CONSTRAINT fk_products_farmer FOREIGN KEY (farmer_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. BATCHES (FIXED: Added Parent-Child Genealogy)
CREATE TABLE batches (
  id CHAR(36) PRIMARY KEY NOT NULL DEFAULT (UUID()),
  product_id CHAR(36) NOT NULL,
  parent_batch_id CHAR(36) NULL, -- << FIX #1: Links to previous batch (Splitting)
  batch_code VARCHAR(200) NOT NULL UNIQUE,
  current_owner_id CHAR(36),
  current_status_id CHAR(36),
  initial_quantity DECIMAL(10,2),
  remaining_quantity DECIMAL (10,2) NOT NULL DEFAULT 0.00,
  quantity_unit VARCHAR(20),      -- e.g., 'kg', 'tons', 'bags'
  harvest_date DATETIME,
  created_at DATETIME(6) NOT NULL DEFAULT (CURRENT_TIMESTAMP(6)),

  CONSTRAINT fk_batches_product FOREIGN KEY (product_id) REFERENCES products(id),
  CONSTRAINT fk_batches_parent FOREIGN KEY (parent_batch_id) REFERENCES batches(id), -- Self Reference
  CONSTRAINT fk_batches_owner FOREIGN KEY (current_owner_id) REFERENCES users(id),
  CONSTRAINT fk_batches_status FOREIGN KEY (current_status_id) REFERENCES statuses(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. EVENT DEFINITIONS
CREATE TABLE event_types (
  id CHAR(36) PRIMARY KEY NOT NULL DEFAULT (UUID()),
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. EVENTS (The Timeline)
CREATE TABLE events (
  id CHAR(36) PRIMARY KEY NOT NULL DEFAULT (UUID()),
  event_type_id CHAR(36) NOT NULL,
  batch_id CHAR(36) NOT NULL,
  actor_user_id CHAR(36),
  location_coords VARCHAR(100),
  blockchain_tx_hash VARCHAR(255),
  recorded_at DATETIME(6) NOT NULL DEFAULT (CURRENT_TIMESTAMP(6)),

  CONSTRAINT fk_events_type FOREIGN KEY (event_type_id) REFERENCES event_types(id),
  CONSTRAINT fk_events_batch FOREIGN KEY (batch_id) REFERENCES batches(id),
  CONSTRAINT fk_events_actor FOREIGN KEY (actor_user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. MEDIA ATTACHMENTS (FIX #2: Proof of Quality/Certificates)
CREATE TABLE event_attachments (
  id CHAR(36) PRIMARY KEY NOT NULL DEFAULT (UUID()),
  event_id CHAR(36) NOT NULL, -- The proof is linked to the EVENT (e.g., "Quality Check")
  file_url TEXT NOT NULL,     -- URL to S3, Cloudinary, or local path
  file_type VARCHAR(50),      -- e.g., 'application/pdf', 'image/jpeg'
  description VARCHAR(255),   -- e.g., 'Lab Test Report', 'Photo of Mold'
  uploaded_at DATETIME(6) NOT NULL DEFAULT (CURRENT_TIMESTAMP(6)),

  CONSTRAINT fk_attachments_event FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. DEVICES (IoT)
CREATE TABLE devices (
  id CHAR(36) PRIMARY KEY NOT NULL DEFAULT (UUID()),
  owner_user_id CHAR(36) NOT NULL,
  name VARCHAR(100),
  device_type VARCHAR(50),
  created_at DATETIME(6) NOT NULL DEFAULT (CURRENT_TIMESTAMP(6)),
  CONSTRAINT fk_devices_owner FOREIGN KEY (owner_user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. DEVICE RAW DATA (IoT Strings)
CREATE TABLE device_raw_data (
  id CHAR(36) PRIMARY KEY NOT NULL DEFAULT (UUID()),
  event_id CHAR(36) NOT NULL,
  device_id CHAR(36) NOT NULL,
  raw_data TEXT,
  captured_at DATETIME(6) NOT NULL DEFAULT (CURRENT_TIMESTAMP(6)),

  CONSTRAINT fk_device_data_event FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  CONSTRAINT fk_device_data_device FOREIGN KEY (device_id) REFERENCES devices(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11. PRODUCT CHAIN LOG (The Lookup Table)
CREATE TABLE product_chain_log (
  log_id CHAR(36) PRIMARY KEY NOT NULL DEFAULT (UUID()),
  product_id CHAR(36) NOT NULL,
  batch_id CHAR(36) NOT NULL,
  event_id CHAR(36) NOT NULL,
  status_id CHAR(36) NOT NULL,
  timestamp DATETIME(6) NOT NULL DEFAULT (CURRENT_TIMESTAMP(6)),

  CONSTRAINT fk_log_product FOREIGN KEY (product_id) REFERENCES products(id),
  CONSTRAINT fk_log_batch FOREIGN KEY (batch_id) REFERENCES batches(id),
  CONSTRAINT fk_log_event FOREIGN KEY (event_id) REFERENCES events(id),
  CONSTRAINT fk_log_status FOREIGN KEY (status_id) REFERENCES statuses(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 12. ORDERS (FIX #3 Part A: The Header)
CREATE TABLE orders (
  id CHAR(36) PRIMARY KEY NOT NULL DEFAULT (UUID()),
  order_number VARCHAR(50) UNIQUE NOT NULL, -- Human readable ID (e.g. ORD-2024-001)
  buyer_id CHAR(36),
  seller_id CHAR(36),
  total_amount DECIMAL(20,6),
  is_completed BOOLEAN DEFAULT FALSE,
  created_at DATETIME(6) NOT NULL DEFAULT (CURRENT_TIMESTAMP(6)),

  CONSTRAINT fk_orders_buyer FOREIGN KEY (buyer_id) REFERENCES users(id),
  CONSTRAINT fk_orders_seller FOREIGN KEY (seller_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 13. ORDER ITEMS (FIX #3 Part B: The Shopping Cart)
CREATE TABLE order_items (
  id CHAR(36) PRIMARY KEY NOT NULL DEFAULT (UUID()),
  order_id CHAR(36) NOT NULL,
  batch_id CHAR(36) NOT NULL, -- Which specific batch are they buying?
  quantity DECIMAL(10,2) NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,

  CONSTRAINT fk_items_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_items_batch FOREIGN KEY (batch_id) REFERENCES batches(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 14. SHIPMENTS
CREATE TABLE shipments (
  id CHAR(36) PRIMARY KEY NOT NULL DEFAULT (UUID()),
  order_id CHAR(36),
  transporter_id CHAR(36),
  estimated_delivery DATETIME,
  created_at DATETIME(6) NOT NULL DEFAULT (CURRENT_TIMESTAMP(6)),

  CONSTRAINT fk_shipments_order FOREIGN KEY (order_id) REFERENCES orders(id),
  CONSTRAINT fk_shipments_transporter FOREIGN KEY (transporter_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
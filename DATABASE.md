# AgriBlock Database Documentation

## 📋 Table of Contents
1. [Database Overview](#database-overview)
2. [Database Schema Architecture](#database-schema-architecture)
3. [User Roles & Permissions](#user-roles--permissions)
4. [Table Structures & Relationships](#table-structures--relationships)
5. [Data Flow & Interactions](#data-flow--interactions)
6. [Traceability System](#traceability-system)
7. [Blockchain Integration](#blockchain-integration)
8. [Sample Data Scenarios](#sample-data-scenarios)

---

## 🎯 Database Overview

**AgriBlock** is a farm-to-fork traceability system built on **MySQL 8.0+** that tracks agricultural products from seedling to consumer. The database implements a trust-based blockchain integration ensuring transparency, authenticity, and complete product journey tracking.

### Key Features
- **Product-Based Traceability**: All batches trace back to original product_id regardless of splits
- **Multi-Role System**: 6 distinct roles (Admin, Farmer, Distributor, Transporter, Retailer, Consumer)
- **Genealogy Tracking**: Parent-child relationships for batch splitting
- **Event Timeline**: Complete audit trail with multimedia proof
- **IoT Integration**: Device data capture for quality monitoring
- **Blockchain Sync**: Every transaction recorded on distributed ledger

---

## 🏗️ Database Schema Architecture

### Entity Relationship Diagram (Conceptual)

```
┌─────────────┐
│    ROLES    │
└──────┬──────┘
       │
       ↓
┌─────────────┐     ┌──────────────┐
│    USERS    │────→│   PRODUCTS   │
└──────┬──────┘     └──────┬───────┘
       │                   │
       ↓                   ↓
┌─────────────┐     ┌──────────────┐
│  STATUSES   │←───→│   BATCHES    │←──┐ (parent_batch_id)
└─────────────┘     └──────┬───────┘   │
                           │            │
                           ↓            │
                    ┌──────────────┐   │
                    │    EVENTS    │───┘
                    └──────┬───────┘
                           │
          ┌────────────────┼────────────────┐
          ↓                ↓                ↓
┌──────────────────┐ ┌─────────────┐ ┌─────────────┐
│ EVENT_ATTACHMENTS│ │ DEVICE_DATA │ │ CHAIN_LOG   │
└──────────────────┘ └─────────────┘ └─────────────┘

┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   ORDERS    │────→│ ORDER_ITEMS  │────→│  SHIPMENTS  │
└─────────────┘     └──────────────┘     └─────────────┘
```

### Database Statistics
- **Total Tables**: 14
- **Foreign Keys**: 22
- **Primary Keys**: All tables (UUID)
- **Indexes**: Optimized for batch_code, user_id, product_id lookups
- **Character Set**: utf8mb4 (Unicode support)
- **Storage Engine**: InnoDB (ACID compliance)

---

## 👥 User Roles & Permissions

### 1. **ADMIN** 👨‍💼
**Responsibilities**: System oversight, user management, analytics

**Database Access**:
- Full read access to all tables
- User activation/deactivation (users.is_active)
- System-wide reporting queries
- Event type and status management

**Typical Queries**:
```sql
-- View all users and their roles
SELECT u.username, u.full_name, r.name as role, u.is_active
FROM users u JOIN roles r ON u.role_id = r.id;

-- System-wide batch statistics
SELECT COUNT(*) as total_batches, 
       SUM(initial_quantity) as total_production
FROM batches;
```

---

### 2. **FARMER** 🌾
**Responsibilities**: Create products, harvest batches, log farm events

**Database Interactions**:

#### a) **Create Product Definition**
```sql
INSERT INTO products (id, farmer_id, title, crop_details)
VALUES (
    'uuid-1234',
    'farmer-uuid',
    'Organic Tomatoes',
    '{"variety": "Roma", "season": "Summer 2025"}'
);
```

**Data Flow**: `roles → users (FARMER) → products`

---

#### b) **Harvest New Batch**
```sql
-- Step 1: Create batch
INSERT INTO batches (
    id, product_id, parent_batch_id, batch_code,
    current_owner_id, current_status_id,
    initial_quantity, remaining_quantity, quantity_unit, harvest_date
) VALUES (
    'batch-uuid',
    'product-uuid',
    NULL,  -- Root batch (no parent)
    'BATCH-A1B2C3D4-20251213-5678',  -- Includes product_id reference
    'farmer-uuid',
    'harvested-status-uuid',
    500.00,  -- 500 kg
    500.00,  -- Initially full
    'kg',
    '2025-12-13 08:00:00'
);

-- Step 2: Log harvest event
INSERT INTO events (id, event_type_id, batch_id, actor_user_id, recorded_at)
VALUES (
    'event-uuid',
    'harvest-event-type-uuid',
    'batch-uuid',
    'farmer-uuid',
    NOW()
);

-- Step 3: Update traceability log
INSERT INTO product_chain_log (log_id, product_id, batch_id, event_id, status_id)
VALUES (
    'log-uuid',
    'product-uuid',
    'batch-uuid',
    'event-uuid',
    'harvested-status-uuid'
);
```

**Tables Updated**: `batches`, `events`, `product_chain_log`

---

#### c) **Log Farm Events**
Farmers track critical farming activities:

```sql
-- Fertilizer application
INSERT INTO events (id, event_type_id, batch_id, actor_user_id, location_coords)
VALUES (
    'event-uuid-2',
    'fertilizer-event-uuid',
    'batch-uuid',
    'farmer-uuid',
    '31.5204,74.3587'  -- GPS coordinates
);

-- Attach IoT sensor data
INSERT INTO device_raw_data (id, event_id, device_id, raw_data)
VALUES (
    'data-uuid',
    'event-uuid-2',
    'sensor-device-uuid',
    '{"temperature": 25.5, "humidity": 60, "soil_ph": 6.8}'
);

-- Attach quality certificate (PDF)
INSERT INTO event_attachments (id, event_id, file_url, file_type, description)
VALUES (
    'attach-uuid',
    'event-uuid-2',
    'https://storage.com/cert-12345.pdf',
    'application/pdf',
    'Organic Certification'
);
```

**Tables Updated**: `events`, `device_raw_data`, `event_attachments`

---

### 3. **DISTRIBUTOR** 🏭
**Responsibilities**: Buy batches from farmers, split into smaller quantities, sell to retailers

**Database Interactions**:

#### a) **Purchase Batch from Farmer**
```sql
-- Full purchase (transfer ownership)
UPDATE batches 
SET current_owner_id = 'distributor-uuid',
    current_status_id = 'in-warehouse-status-uuid',
    remaining_quantity = 0
WHERE id = 'batch-uuid';

-- Create "Sold" event
INSERT INTO events (id, event_type_id, batch_id, actor_user_id)
VALUES ('event-uuid-3', 'sold-event-uuid', 'batch-uuid', 'distributor-uuid');
```

**Partial Purchase**: Creates a new child batch for distributor

---

#### b) **Split Batch** (Key Feature!)
Distributors split large batches into smaller units for retailers:

```sql
-- Parent batch: 500 kg → Split into 3 child batches

-- Child 1: 200 kg
INSERT INTO batches (
    id, product_id, parent_batch_id, batch_code,
    current_owner_id, initial_quantity, remaining_quantity
) VALUES (
    'child-batch-1-uuid',
    'product-uuid',  -- SAME PRODUCT_ID (traceability!)
    'batch-uuid',    -- Parent reference
    'BATCH-A1B2C3D4-20251213-5678-S1-2341',
    'distributor-uuid',
    200.00, 200.00
);

-- Child 2: 150 kg
INSERT INTO batches (...) VALUES (...);

-- Child 3: 150 kg
INSERT INTO batches (...) VALUES (...);

-- Update parent batch
UPDATE batches 
SET remaining_quantity = 0  -- Fully split
WHERE id = 'batch-uuid';

-- Log split event
INSERT INTO events (id, event_type_id, batch_id, actor_user_id)
VALUES ('split-event-uuid', 'split-event-type-uuid', 'batch-uuid', 'distributor-uuid');
```

**Critical**: All child batches maintain `product_id` link for complete traceability!

**Tables Updated**: `batches` (parent + children), `events`, `product_chain_log`

---

### 4. **TRANSPORTER** 🚚
**Responsibilities**: Ship batches between supply chain actors

**Database Interactions**:

#### a) **Create Shipment**
```sql
-- Step 1: Create shipment record
INSERT INTO shipments (id, order_id, transporter_id, estimated_delivery)
VALUES (
    'shipment-uuid',
    'order-uuid',
    'transporter-uuid',
    '2025-12-15 14:00:00'
);

-- Step 2: Update batch status to "In Transit"
UPDATE batches 
SET current_status_id = 'in-transit-status-uuid'
WHERE id IN (
    SELECT batch_id FROM order_items WHERE order_id = 'order-uuid'
);

-- Step 3: Log transport event
INSERT INTO events (id, event_type_id, batch_id, actor_user_id, location_coords)
VALUES (
    'transport-event-uuid',
    'transport-start-event-uuid',
    'batch-uuid',
    'transporter-uuid',
    '31.5204,74.3587'  -- Pickup location
);
```

---

#### b) **Update Delivery Status**
```sql
-- Mark as delivered
UPDATE batches 
SET current_status_id = 'delivered-status-uuid',
    current_owner_id = 'retailer-uuid'  -- Transfer ownership
WHERE id = 'batch-uuid';

-- Complete order
UPDATE orders 
SET is_completed = TRUE
WHERE id = 'order-uuid';

-- Log delivery event
INSERT INTO events (id, event_type_id, batch_id, location_coords)
VALUES (
    'delivery-event-uuid',
    'delivered-event-uuid',
    'batch-uuid',
    '31.4700,74.2700'  -- Delivery location
);
```

**Tables Updated**: `shipments`, `batches`, `orders`, `events`

---

### 5. **RETAILER (SHOPKEEPER)** 🏪
**Responsibilities**: Receive shipments, display inventory, sell to consumers

**Database Interactions**:

#### a) **Receive Delivery**
```sql
-- Update batch status to "In Shop"
UPDATE batches 
SET current_status_id = 'in-shop-status-uuid'
WHERE id = 'batch-uuid';
```

---

#### b) **Create Order (Buy from Distributor)**
```sql
-- Step 1: Create order header
INSERT INTO orders (id, order_number, buyer_id, seller_id, total_amount)
VALUES (
    'order-uuid',
    'ORD-20251213-A1B2',
    'retailer-uuid',
    'distributor-uuid',
    1500.00  -- Total amount
);

-- Step 2: Create order items
INSERT INTO order_items (id, order_id, batch_id, quantity, unit_price)
VALUES (
    'item-uuid-1',
    'order-uuid',
    'batch-uuid-1',
    50.00,  -- 50 kg
    30.00   -- $30/kg
);

-- Step 3: Deduct quantity from distributor batch
UPDATE batches 
SET remaining_quantity = remaining_quantity - 50.00
WHERE id = 'batch-uuid-1';

-- Step 4: Create new batch for retailer (traceability chain)
INSERT INTO batches (
    id, product_id, parent_batch_id, batch_code,
    current_owner_id, current_status_id,
    initial_quantity, remaining_quantity
) VALUES (
    'retailer-batch-uuid',
    'product-uuid',  -- SAME PRODUCT_ID
    'batch-uuid-1',  -- Parent reference
    'BATCH-A1B2C3D4-20251213-5678-R1-9876',
    'retailer-uuid',
    'pending-delivery-status-uuid',
    50.00, 50.00
);
```

**Tables Updated**: `orders`, `order_items`, `batches`

---

### 6. **CONSUMER** 🛒
**Responsibilities**: Purchase products, view traceability history

**Database Interactions**:

#### a) **Purchase from Retailer**
```sql
-- Step 1: Deduct from retailer batch
UPDATE batches 
SET remaining_quantity = remaining_quantity - 2.00
WHERE id = 'retailer-batch-uuid';

-- Step 2: Create consumer batch (final traceability node)
INSERT INTO batches (
    id, product_id, parent_batch_id, batch_code,
    current_owner_id, current_status_id,
    initial_quantity, remaining_quantity
) VALUES (
    'consumer-batch-uuid',
    'product-uuid',  -- SAME PRODUCT_ID (full traceability!)
    'retailer-batch-uuid',
    'BATCH-A1B2C3D4-20251213-5678-C981',
    'consumer-uuid',
    'consumed-status-uuid',
    2.00, 2.00  -- 2 kg purchased
);

-- Step 3: Log purchase event
INSERT INTO events (id, event_type_id, batch_id, actor_user_id)
VALUES (
    'purchase-event-uuid',
    'sold-event-uuid',
    'retailer-batch-uuid',
    'consumer-uuid'
);
```

---

#### b) **Query Traceability** (Most Important Feature!)
Consumer scans QR code → System traces entire product journey:

```sql
-- Step 1: Get consumer's batch
SELECT * FROM batches WHERE batch_code = 'BATCH-A1B2C3D4-20251213-5678-C981';

-- Step 2: Get ALL batches for this product (complete chain)
SELECT b.*, u.full_name as owner_name, r.name as owner_role
FROM batches b
JOIN users u ON b.current_owner_id = u.id
JOIN roles r ON u.role_id = r.id
WHERE b.product_id = 'product-uuid'
ORDER BY b.created_at ASC;

-- Step 3: Get ALL events for ALL batches (seedling to consumer)
SELECT e.*, et.name as event_type, b.batch_code, u.full_name as actor
FROM events e
JOIN event_types et ON e.event_type_id = et.id
JOIN batches b ON e.batch_id = b.id
JOIN users u ON e.actor_user_id = u.id
WHERE b.product_id = 'product-uuid'
ORDER BY e.recorded_at ASC;

-- Result: Complete journey showing:
-- ✓ Farmer: Planted, Fertilized, Irrigated, Harvested
-- ✓ Distributor: Purchased, Quality Checked, Stored
-- ✓ Transporter: Picked Up, In Transit, Delivered
-- ✓ Retailer: Received, Displayed
-- ✓ Consumer: Purchased
```

**Query Returns**: 
- Timeline: All events from seedling to shelf
- Attachments: Certificates, lab reports, photos
- IoT Data: Temperature logs, humidity readings
- Blockchain: Immutable transaction hashes

---

## 📊 Table Structures & Relationships

### 1. **roles** (Role Definitions)
```sql
CREATE TABLE roles (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  created_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6)
);
```

**Sample Data**:
| id | name | description |
|---|---|---|
| role-1 | ADMIN | System administrator |
| role-2 | FARMER | Agricultural producer |
| role-3 | DISTRIBUTOR | Wholesale supplier |
| role-4 | TRANSPORTER | Logistics provider |
| role-5 | RETAILER | Shop owner |
| role-6 | CONSUMER | End customer |

---

### 2. **users** (System Users)
```sql
CREATE TABLE users (
  id CHAR(36) PRIMARY KEY,
  username VARCHAR(150) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE,
  password_hash TEXT,
  full_name VARCHAR(255),
  role_id CHAR(36),  -- FK to roles
  is_active TINYINT(1) DEFAULT 0,
  created_at DATETIME(6),
  FOREIGN KEY (role_id) REFERENCES roles(id)
);
```

**Sample Data**:
| id | username | full_name | role_id | is_active |
|---|---|---|---|---|
| user-1 | john_farmer | John Smith | role-2 | 1 |
| user-2 | abc_dist | ABC Distributors | role-3 | 1 |
| user-3 | quick_transport | Quick Movers | role-4 | 1 |
| user-4 | green_shop | Green Grocers | role-5 | 1 |
| user-5 | alice_consumer | Alice Johnson | role-6 | 1 |

**Relationships**: `roles (1) → (N) users`

---

### 3. **products** (Product Definitions)
```sql
CREATE TABLE products (
  id CHAR(36) PRIMARY KEY,
  farmer_id CHAR(36) NOT NULL,  -- FK to users
  title VARCHAR(400) NOT NULL,
  crop_details TEXT,
  created_at DATETIME(6),
  FOREIGN KEY (farmer_id) REFERENCES users(id) ON DELETE CASCADE
);
```

**Sample Data**:
| id | farmer_id | title | crop_details |
|---|---|---|---|
| prod-1 | user-1 | Organic Roma Tomatoes | {"variety": "Roma", "organic": true} |
| prod-2 | user-1 | Fresh Spinach | {"variety": "Bloomsdale"} |

**Relationships**: `users (1) → (N) products`

---

### 4. **batches** (Core Traceability Entity)
```sql
CREATE TABLE batches (
  id CHAR(36) PRIMARY KEY,
  product_id CHAR(36) NOT NULL,      -- FK to products (TRACEABILITY KEY!)
  parent_batch_id CHAR(36),          -- FK to batches (genealogy)
  batch_code VARCHAR(200) UNIQUE,    -- Human-readable + product_id embedded
  current_owner_id CHAR(36),         -- FK to users
  current_status_id CHAR(36),        -- FK to statuses
  initial_quantity DECIMAL(10,2),
  remaining_quantity DECIMAL(10,2),
  quantity_unit VARCHAR(20),
  harvest_date DATETIME,
  created_at DATETIME(6),
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (parent_batch_id) REFERENCES batches(id),  -- Self-reference
  FOREIGN KEY (current_owner_id) REFERENCES users(id),
  FOREIGN KEY (current_status_id) REFERENCES statuses(id)
);
```

**Sample Data Flow** (One Product's Journey):
| id | product_id | parent_batch_id | batch_code | current_owner_id | remaining_qty |
|---|---|---|---|---|---|
| batch-1 | prod-1 | NULL | BATCH-A1B2C3D4-20251213-5678 | user-1 (farmer) | 0 (split) |
| batch-2 | prod-1 | batch-1 | BATCH-A1B2C3D4-...-S1-2341 | user-2 (distributor) | 0 (sold) |
| batch-3 | prod-1 | batch-2 | BATCH-A1B2C3D4-...-R1-9876 | user-4 (retailer) | 48.00 |
| batch-4 | prod-1 | batch-3 | BATCH-A1B2C3D4-...-C981 | user-5 (consumer) | 2.00 |

**Key Insight**: All rows share `product_id = prod-1` → Complete traceability query:
```sql
SELECT * FROM batches WHERE product_id = 'prod-1';
-- Returns all 4 batches showing entire supply chain!
```

**Relationships**: 
- `products (1) → (N) batches`
- `batches (1) → (N) batches` (parent-child)
- `users (1) → (N) batches` (current_owner)
- `statuses (1) → (N) batches`

---

### 5. **statuses** (Batch Lifecycle States)
```sql
CREATE TABLE statuses (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  created_at DATETIME(6)
);
```

**Sample Data**:
| id | name | description |
|---|---|---|
| stat-1 | Harvested | Freshly harvested at farm |
| stat-2 | In Warehouse | Stored at distributor facility |
| stat-3 | In Transit | Being transported |
| stat-4 | Delivered | Reached destination |
| stat-5 | In Shop | Available for consumer purchase |
| stat-6 | Sold | Sold to consumer |
| stat-7 | Consumed | Final state |

---

### 6. **event_types** (Event Definitions)
```sql
CREATE TABLE event_types (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT
);
```

**Sample Data**:
| id | name | description |
|---|---|---|
| evt-1 | Harvest | Product harvested from field |
| evt-2 | Fertilizer Applied | Nutrients added to crop |
| evt-3 | Pesticide Applied | Pest control treatment |
| evt-4 | Irrigation | Water applied to crop |
| evt-5 | Quality Check | Quality inspection performed |
| evt-6 | Sold | Ownership transferred via sale |
| evt-7 | Split | Batch divided into smaller units |
| evt-8 | Transport Start | Shipment initiated |
| evt-9 | Delivered | Shipment completed |

---

### 7. **events** (Event Timeline)
```sql
CREATE TABLE events (
  id CHAR(36) PRIMARY KEY,
  event_type_id CHAR(36) NOT NULL,   -- FK to event_types
  batch_id CHAR(36) NOT NULL,        -- FK to batches
  actor_user_id CHAR(36),            -- FK to users
  location_coords VARCHAR(100),      -- GPS: "lat,lng"
  blockchain_tx_hash VARCHAR(255),   -- Blockchain verification
  recorded_at DATETIME(6),
  FOREIGN KEY (event_type_id) REFERENCES event_types(id),
  FOREIGN KEY (batch_id) REFERENCES batches(id),
  FOREIGN KEY (actor_user_id) REFERENCES users(id)
);
```

**Sample Data** (Complete Product Journey):
| id | event_type_id | batch_id | actor_user_id | recorded_at | blockchain_tx_hash |
|---|---|---|---|---|---|
| ev-1 | evt-1 (Harvest) | batch-1 | user-1 (farmer) | 2025-12-13 08:00 | 0xabc123... |
| ev-2 | evt-2 (Fertilizer) | batch-1 | user-1 | 2025-11-20 10:00 | 0xdef456... |
| ev-3 | evt-6 (Sold) | batch-1 | user-2 (dist) | 2025-12-13 14:00 | 0xghi789... |
| ev-4 | evt-7 (Split) | batch-1 | user-2 | 2025-12-13 15:00 | 0xjkl012... |
| ev-5 | evt-8 (Transport) | batch-2 | user-3 (trans) | 2025-12-14 09:00 | 0xmno345... |
| ev-6 | evt-9 (Delivered) | batch-2 | user-3 | 2025-12-14 16:00 | 0xpqr678... |
| ev-7 | evt-6 (Sold) | batch-3 | user-5 (consumer) | 2025-12-15 10:00 | 0xstu901... |

**Query for Consumer**: Shows 7 events from farm to purchase!

**Relationships**:
- `event_types (1) → (N) events`
- `batches (1) → (N) events`
- `users (1) → (N) events` (actor)

---

### 8. **event_attachments** (Multimedia Proof)
```sql
CREATE TABLE event_attachments (
  id CHAR(36) PRIMARY KEY,
  event_id CHAR(36) NOT NULL,  -- FK to events
  file_url TEXT NOT NULL,
  file_type VARCHAR(50),
  description VARCHAR(255),
  uploaded_at DATETIME(6),
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);
```

**Sample Data**:
| id | event_id | file_url | file_type | description |
|---|---|---|---|---|
| att-1 | ev-1 | s3://certs/organic-cert.pdf | application/pdf | Organic Certification |
| att-2 | ev-2 | s3://photos/field-123.jpg | image/jpeg | Pre-harvest photo |
| att-3 | ev-4 | s3://reports/quality-lab.pdf | application/pdf | Lab Test Report |

---

### 9. **devices** (IoT Sensors)
```sql
CREATE TABLE devices (
  id CHAR(36) PRIMARY KEY,
  owner_user_id CHAR(36) NOT NULL,  -- FK to users
  name VARCHAR(100),
  device_type VARCHAR(50),
  created_at DATETIME(6),
  FOREIGN KEY (owner_user_id) REFERENCES users(id)
);
```

**Sample Data**:
| id | owner_user_id | name | device_type |
|---|---|---|---|
| dev-1 | user-1 | Farm Sensor #1 | Temperature/Humidity |
| dev-2 | user-2 | Warehouse Monitor | Climate Control |

---

### 10. **device_raw_data** (IoT Readings)
```sql
CREATE TABLE device_raw_data (
  id CHAR(36) PRIMARY KEY,
  event_id CHAR(36) NOT NULL,     -- FK to events
  device_id CHAR(36) NOT NULL,    -- FK to devices
  raw_data TEXT,                  -- JSON string
  captured_at DATETIME(6),
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  FOREIGN KEY (device_id) REFERENCES devices(id)
);
```

**Sample Data**:
| id | event_id | device_id | raw_data | captured_at |
|---|---|---|---|---|
| data-1 | ev-1 | dev-1 | {"temp": 25.5, "humidity": 60} | 2025-12-13 08:00 |
| data-2 | ev-2 | dev-1 | {"temp": 26.0, "humidity": 58} | 2025-11-20 10:00 |

---

### 11. **product_chain_log** (Traceability Cache)
```sql
CREATE TABLE product_chain_log (
  log_id CHAR(36) PRIMARY KEY,
  product_id CHAR(36) NOT NULL,  -- FK to products
  batch_id CHAR(36) NOT NULL,    -- FK to batches
  event_id CHAR(36) NOT NULL,    -- FK to events
  status_id CHAR(36) NOT NULL,   -- FK to statuses
  timestamp DATETIME(6),
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (batch_id) REFERENCES batches(id),
  FOREIGN KEY (event_id) REFERENCES events(id),
  FOREIGN KEY (status_id) REFERENCES statuses(id)
);
```

**Purpose**: Performance optimization for product-wide queries

---

### 12. **orders** (Order Headers)
```sql
CREATE TABLE orders (
  id CHAR(36) PRIMARY KEY,
  order_number VARCHAR(50) UNIQUE,  -- e.g., "ORD-20251213-A1B2"
  buyer_id CHAR(36),                -- FK to users
  seller_id CHAR(36),               -- FK to users
  total_amount DECIMAL(20,6),
  is_completed BOOLEAN DEFAULT FALSE,
  created_at DATETIME(6),
  FOREIGN KEY (buyer_id) REFERENCES users(id),
  FOREIGN KEY (seller_id) REFERENCES users(id)
);
```

**Sample Data**:
| id | order_number | buyer_id | seller_id | total_amount | is_completed |
|---|---|---|---|---|---|
| ord-1 | ORD-20251213-A1B2 | user-4 (retailer) | user-2 (dist) | 1500.00 | TRUE |
| ord-2 | ORD-20251214-C3D4 | user-5 (consumer) | user-4 (retailer) | 30.00 | TRUE |

---

### 13. **order_items** (Order Line Items)
```sql
CREATE TABLE order_items (
  id CHAR(36) PRIMARY KEY,
  order_id CHAR(36) NOT NULL,    -- FK to orders
  batch_id CHAR(36) NOT NULL,    -- FK to batches
  quantity DECIMAL(10,2),
  unit_price DECIMAL(10,2),
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (batch_id) REFERENCES batches(id)
);
```

**Sample Data**:
| id | order_id | batch_id | quantity | unit_price |
|---|---|---|---|---|
| item-1 | ord-1 | batch-2 | 50.00 | 30.00 |
| item-2 | ord-2 | batch-3 | 2.00 | 15.00 |

---

### 14. **shipments** (Logistics Tracking)
```sql
CREATE TABLE shipments (
  id CHAR(36) PRIMARY KEY,
  order_id CHAR(36),              -- FK to orders
  transporter_id CHAR(36),        -- FK to users
  estimated_delivery DATETIME,
  created_at DATETIME(6),
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (transporter_id) REFERENCES users(id)
);
```

**Sample Data**:
| id | order_id | transporter_id | estimated_delivery | created_at |
|---|---|---|---|---|
| ship-1 | ord-1 | user-3 | 2025-12-15 14:00 | 2025-12-14 09:00 |

---

## 🔄 Data Flow & Interactions

### Scenario 1: **Farm to Fork Journey**

#### Day 1: Farmer Harvests
```sql
-- Farmer creates product
INSERT INTO products (id, farmer_id, title) VALUES ('prod-1', 'farmer-1', 'Tomatoes');

-- Farmer harvests batch
INSERT INTO batches (id, product_id, batch_code, current_owner_id, initial_quantity, remaining_quantity)
VALUES ('batch-1', 'prod-1', 'BATCH-ABC-001', 'farmer-1', 500.00, 500.00);

-- Log harvest event
INSERT INTO events (id, event_type_id, batch_id, actor_user_id)
VALUES ('event-1', 'harvest-event', 'batch-1', 'farmer-1');
```

**Database State**:
- `products`: 1 row
- `batches`: 1 row (farmer-owned, 500 kg)
- `events`: 1 row (Harvest)

---

#### Day 2: Distributor Purchases & Splits
```sql
-- Distributor buys full batch
UPDATE batches SET current_owner_id = 'dist-1', remaining_quantity = 0 WHERE id = 'batch-1';

-- Split into 3 child batches
INSERT INTO batches (id, product_id, parent_batch_id, batch_code, current_owner_id, initial_quantity)
VALUES 
  ('batch-2', 'prod-1', 'batch-1', 'BATCH-ABC-001-S1', 'dist-1', 200.00),
  ('batch-3', 'prod-1', 'batch-1', 'BATCH-ABC-001-S2', 'dist-1', 150.00),
  ('batch-4', 'prod-1', 'batch-1', 'BATCH-ABC-001-S3', 'dist-1', 150.00);

-- Log events
INSERT INTO events (id, event_type_id, batch_id, actor_user_id)
VALUES 
  ('event-2', 'sold-event', 'batch-1', 'dist-1'),
  ('event-3', 'split-event', 'batch-1', 'dist-1');
```

**Database State**:
- `batches`: 4 rows (1 parent + 3 children, all linked via `product_id = prod-1`)
- `events`: 3 rows

---

#### Day 3: Retailer Orders
```sql
-- Create order
INSERT INTO orders (id, buyer_id, seller_id, total_amount)
VALUES ('order-1', 'retailer-1', 'dist-1', 1500.00);

-- Order 50 kg from batch-2
INSERT INTO order_items (id, order_id, batch_id, quantity, unit_price)
VALUES ('item-1', 'order-1', 'batch-2', 50.00, 30.00);

-- Deduct from distributor batch
UPDATE batches SET remaining_quantity = 150.00 WHERE id = 'batch-2';

-- Create retailer batch
INSERT INTO batches (id, product_id, parent_batch_id, batch_code, current_owner_id, initial_quantity)
VALUES ('batch-5', 'prod-1', 'batch-2', 'BATCH-ABC-001-R1', 'retailer-1', 50.00);
```

**Database State**:
- `batches`: 5 rows
- `orders`: 1 row
- `order_items`: 1 row

---

#### Day 4: Transporter Delivers
```sql
-- Create shipment
INSERT INTO shipments (id, order_id, transporter_id)
VALUES ('ship-1', 'order-1', 'trans-1');

-- Update batch status
UPDATE batches SET current_status_id = 'in-transit-status' WHERE id = 'batch-5';

-- Log events
INSERT INTO events (id, event_type_id, batch_id, actor_user_id)
VALUES 
  ('event-4', 'transport-event', 'batch-5', 'trans-1'),
  ('event-5', 'delivered-event', 'batch-5', 'trans-1');

-- Mark complete
UPDATE orders SET is_completed = TRUE WHERE id = 'order-1';
UPDATE batches SET current_status_id = 'in-shop-status' WHERE id = 'batch-5';
```

**Database State**:
- `shipments`: 1 row
- `events`: 5 rows

---

#### Day 5: Consumer Purchases
```sql
-- Deduct from retailer
UPDATE batches SET remaining_quantity = 48.00 WHERE id = 'batch-5';

-- Create consumer batch
INSERT INTO batches (id, product_id, parent_batch_id, batch_code, current_owner_id, initial_quantity)
VALUES ('batch-6', 'prod-1', 'batch-5', 'BATCH-ABC-001-C1', 'consumer-1', 2.00);

-- Log sale
INSERT INTO events (id, event_type_id, batch_id, actor_user_id)
VALUES ('event-6', 'sold-event', 'batch-5', 'consumer-1');
```

**Final Database State**:
- `batches`: 6 rows (all with `product_id = prod-1`)
- `events`: 6 rows
- **Consumer can now trace entire journey!**

---

## 🔍 Traceability System

### How Product-Based Traceability Works

**Key Principle**: Every batch (original or split) maintains the `product_id` link.

#### Consumer Query:
```sql
-- Consumer scans QR code: "BATCH-ABC-001-C1"

-- Step 1: Get consumer's batch
SELECT * FROM batches WHERE batch_code = 'BATCH-ABC-001-C1';
-- Returns: batch-6 with product_id = 'prod-1'

-- Step 2: Get ALL batches for this product
SELECT b.id, b.batch_code, b.initial_quantity, u.full_name as owner, r.name as role
FROM batches b
JOIN users u ON b.current_owner_id = u.id
JOIN roles r ON u.role_id = r.id
WHERE b.product_id = 'prod-1'
ORDER BY b.created_at ASC;

-- Returns:
-- batch-1: 500 kg (Farmer John)
-- batch-2: 200 kg (ABC Distributors) - child of batch-1
-- batch-3: 150 kg (ABC Distributors) - child of batch-1
-- batch-4: 150 kg (ABC Distributors) - child of batch-1
-- batch-5: 50 kg (Green Grocers) - child of batch-2
-- batch-6: 2 kg (Alice Johnson) - child of batch-5

-- Step 3: Get ALL events across ALL batches
SELECT e.recorded_at, et.name as event, u.full_name as actor, b.batch_code
FROM events e
JOIN event_types et ON e.event_type_id = et.id
JOIN users u ON e.actor_user_id = u.id
JOIN batches b ON e.batch_id = b.id
WHERE b.product_id = 'prod-1'
ORDER BY e.recorded_at ASC;

-- Returns complete timeline:
-- 2025-12-13 08:00 | Harvest | Farmer John | BATCH-ABC-001
-- 2025-12-13 14:00 | Sold | ABC Distributors | BATCH-ABC-001
-- 2025-12-13 15:00 | Split | ABC Distributors | BATCH-ABC-001
-- 2025-12-14 09:00 | Transport Start | Quick Movers | BATCH-ABC-001-R1
-- 2025-12-14 16:00 | Delivered | Quick Movers | BATCH-ABC-001-R1
-- 2025-12-15 10:00 | Sold | Alice Johnson | BATCH-ABC-001-R1
```

**Result**: Consumer sees **complete journey** from seedling to shelf!

---

## ⛓️ Blockchain Integration

### How Blockchain Tracks Products

Every transaction is submitted to blockchain with `batch_id:product_id` format:

```javascript
// Example blockchain transaction
{
  sender: "0xabc123...",  // Farmer's blockchain address
  recipient: "0xdef456...",  // Distributor's blockchain address
  batch_id: "BATCH-ABC-001:prod-1",  // Combined identifier
  event_type: "HARVEST",
  data: {
    batch_code: "BATCH-ABC-001",
    product_id: "prod-1",
    root_product_id: "prod-1",  // For traceability
    quantity: 500.00,
    timestamp: "2025-12-13T08:00:00Z"
  },
  hash: "0x1a2b3c..."  // Blockchain transaction hash
}
```

### Querying Blockchain by Product

```sql
-- Store blockchain hash in events table
UPDATE events 
SET blockchain_tx_hash = '0x1a2b3c...'
WHERE id = 'event-1';

-- Later: Verify integrity
SELECT e.id, e.event_type_id, e.blockchain_tx_hash, b.product_id
FROM events e
JOIN batches b ON e.batch_id = b.id
WHERE b.product_id = 'prod-1'
AND e.blockchain_tx_hash IS NOT NULL;
```

**Blockchain API Endpoint**: `GET /api/traceability/product/{product_id}/blockchain`

Returns all blockchain blocks containing transactions for this product.

---

## 📈 Sample Data Scenarios

### Scenario A: **Organic Tomato Farm**

```sql
-- Setup
INSERT INTO users VALUES ('farmer-001', 'organic_tom', 'Organic Tom Farms', 'FARMER', 1);
INSERT INTO products VALUES ('prod-tomato', 'farmer-001', 'Organic Roma Tomatoes', '{"organic":true}');

-- Harvest 1000 kg
INSERT INTO batches VALUES 
  ('batch-tom-1', 'prod-tomato', NULL, 'BATCH-TOM-001', 'farmer-001', 'harvested-status', 1000, 1000, 'kg', NOW());

-- Distributor buys and splits into 5 batches
INSERT INTO batches VALUES
  ('batch-tom-2', 'prod-tomato', 'batch-tom-1', 'BATCH-TOM-001-S1', 'dist-001', 'in-warehouse', 200, 200, 'kg', NOW()),
  ('batch-tom-3', 'prod-tomato', 'batch-tom-1', 'BATCH-TOM-001-S2', 'dist-001', 'in-warehouse', 200, 200, 'kg', NOW()),
  ('batch-tom-4', 'prod-tomato', 'batch-tom-1', 'BATCH-TOM-001-S3', 'dist-001', 'in-warehouse', 200, 200, 'kg', NOW()),
  ('batch-tom-5', 'prod-tomato', 'batch-tom-1', 'BATCH-TOM-001-S4', 'dist-001', 'in-warehouse', 200, 200, 'kg', NOW()),
  ('batch-tom-6', 'prod-tomato', 'batch-tom-1', 'BATCH-TOM-001-S5', 'dist-001', 'in-warehouse', 200, 200, 'kg', NOW());

-- 3 retailers buy from distributor
INSERT INTO orders VALUES
  ('order-1', 'ORD-001', 'retailer-1', 'dist-001', 3000, TRUE, NOW()),
  ('order-2', 'ORD-002', 'retailer-2', 'dist-001', 3000, TRUE, NOW()),
  ('order-3', 'ORD-003', 'retailer-3', 'dist-001', 3000, TRUE, NOW());

-- Create retailer batches (children of split batches)
INSERT INTO batches VALUES
  ('batch-tom-7', 'prod-tomato', 'batch-tom-2', 'BATCH-TOM-001-R1', 'retailer-1', 'in-shop', 200, 200, 'kg', NOW()),
  ('batch-tom-8', 'prod-tomato', 'batch-tom-3', 'BATCH-TOM-001-R2', 'retailer-2', 'in-shop', 200, 200, 'kg', NOW()),
  ('batch-tom-9', 'prod-tomato', 'batch-tom-4', 'BATCH-TOM-001-R3', 'retailer-3', 'in-shop', 200, 200, 'kg', NOW());

-- 50 consumers purchase
-- (Simplified - only showing 3)
INSERT INTO batches VALUES
  ('batch-tom-10', 'prod-tomato', 'batch-tom-7', 'BATCH-TOM-001-C1', 'consumer-1', 'consumed', 2, 2, 'kg', NOW()),
  ('batch-tom-11', 'prod-tomato', 'batch-tom-7', 'BATCH-TOM-001-C2', 'consumer-2', 'consumed', 3, 3, 'kg', NOW()),
  ('batch-tom-12', 'prod-tomato', 'batch-tom-8', 'BATCH-TOM-001-C3', 'consumer-3', 'consumed', 1.5, 1.5, 'kg', NOW());

-- Result: Single product_id links 62 batch records (1 original + 5 splits + 3 retailer + 50+ consumer)
```

**Traceability Query**:
```sql
SELECT COUNT(*) FROM batches WHERE product_id = 'prod-tomato';
-- Result: 62 batches tracked from single harvest!
```

---

## 🎓 Database Best Practices

### 1. **UUID Primary Keys**
- Globally unique identifiers
- Prevents ID collision in distributed systems
- 36-character format: `123e4567-e89b-12d3-a456-426614174000`

### 2. **Foreign Key Constraints**
- Ensures referential integrity
- `ON DELETE CASCADE` for child records (attachments, raw data)
- Prevents orphaned records

### 3. **Indexes for Performance**
```sql
-- Recommended indexes
CREATE INDEX idx_batches_product_id ON batches(product_id);
CREATE INDEX idx_batches_batch_code ON batches(batch_code);
CREATE INDEX idx_events_batch_id ON events(batch_id);
CREATE INDEX idx_events_recorded_at ON events(recorded_at);
```

### 4. **Transaction Safety**
All multi-table operations use database transactions:
```sql
START TRANSACTION;
  -- Multiple INSERT/UPDATE statements
  -- If any fails, ROLLBACK
COMMIT;
```

### 5. **Soft Deletes** (Future Enhancement)
Instead of deleting records, mark as inactive:
```sql
ALTER TABLE batches ADD COLUMN is_deleted TINYINT(1) DEFAULT 0;
-- Query: WHERE is_deleted = 0
```

---

## 📊 Database Statistics (Example Production Scale)

### System Metrics
| Metric | Value |
|---|---|
| Total Users | 10,000 |
| Active Farmers | 2,500 |
| Products Registered | 15,000 |
| Batches Tracked | 500,000 |
| Total Events | 2,000,000 |
| Blockchain Transactions | 2,000,000 |
| Storage Size | ~50 GB |

### Query Performance
| Query Type | Avg Time |
|---|---|
| Single Batch Lookup | 5 ms |
| Product History (100 batches) | 50 ms |
| Full Traceability Query | 200 ms |
| Blockchain Verification | 100 ms |

---

## 🔐 Security Considerations

### 1. **Data Privacy**
- User passwords: Bcrypt hashed (never plain text)
- Sensitive data encrypted at rest
- Role-based access control (RBAC)

### 2. **Audit Trail**
Every modification logged via `events` table:
```sql
-- Who changed what, when, and where
SELECT e.recorded_at, u.username, et.name, b.batch_code
FROM events e
JOIN users u ON e.actor_user_id = u.id
JOIN event_types et ON e.event_type_id = et.id
JOIN batches b ON e.batch_id = b.id
WHERE b.id = 'suspicious-batch-id'
ORDER BY e.recorded_at DESC;
```

### 3. **Blockchain Immutability**
- Once recorded on blockchain, data cannot be altered
- Tampering detected via hash mismatch
- Provides trust without central authority

---

## 🚀 Future Enhancements

### 1. **Advanced Analytics Tables**
```sql
CREATE TABLE analytics_daily (
  date DATE PRIMARY KEY,
  total_harvests INT,
  total_sales DECIMAL(20,2),
  avg_traceability_depth DECIMAL(5,2)
);
```

### 2. **Recall Management**
```sql
CREATE TABLE recalls (
  id CHAR(36) PRIMARY KEY,
  product_id CHAR(36),
  reason TEXT,
  issued_at DATETIME,
  FOREIGN KEY (product_id) REFERENCES products(id)
);
```

### 3. **Consumer Ratings**
```sql
CREATE TABLE reviews (
  id CHAR(36) PRIMARY KEY,
  batch_id CHAR(36),
  consumer_id CHAR(36),
  rating INT CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  FOREIGN KEY (batch_id) REFERENCES batches(id),
  FOREIGN KEY (consumer_id) REFERENCES users(id)
);
```

---

## 📞 Support & Maintenance

### Common Queries

#### Query 1: Find all batches for a product
```sql
SELECT * FROM batches WHERE product_id = ?;
```

#### Query 2: Get complete event history
```sql
SELECT e.*, et.name, u.full_name
FROM events e
JOIN event_types et ON e.event_type_id = et.id
JOIN users u ON e.actor_user_id = u.id
JOIN batches b ON e.batch_id = b.id
WHERE b.product_id = ?
ORDER BY e.recorded_at;
```

#### Query 3: Verify blockchain integrity
```sql
SELECT COUNT(*) as unverified_events
FROM events
WHERE blockchain_tx_hash IS NULL
AND recorded_at > DATE_SUB(NOW(), INTERVAL 24 HOUR);
```

---

## 📝 Conclusion

The AgriBlock database is designed for:
- ✅ **Complete Traceability**: Product-based tracking from farm to consumer
- ✅ **Scalability**: Handles millions of transactions
- ✅ **Data Integrity**: Foreign keys, transactions, blockchain verification
- ✅ **Transparency**: Every action logged and auditable
- ✅ **Trust**: Blockchain-backed immutable records

**Key Innovation**: Product-ID based traceability ensures consumers can trace any purchase back to the original farm, regardless of how many times the batch was split or transferred in the supply chain.

---

**Document Version**: 1.0  
**Last Updated**: December 13, 2025  
**Database Version**: MySQL 8.0+  
**Author**: AgriBlock Development Team

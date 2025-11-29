-- AgriChain Database Schema
-- All Primary Keys use UUID (VARCHAR(36)) for future blockchain compatibility

-- Create database if it doesn't exist
CREATE DATABASE IF NOT EXISTS agrichain;
USE agrichain;

-- Table 1: users
-- Stores all users with their roles and wallet balances
CREATE TABLE IF NOT EXISTS users (
    user_id VARCHAR(36) PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('FARMER', 'DISTRIBUTOR', 'TRANSPORTER', 'SHOPKEEPER', 'CONSUMER') NOT NULL,
    wallet_balance DECIMAL(10,2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_username (username),
    INDEX idx_role (role)
);

-- Table 2: farm_profiles
-- The Origin - Links farmers to their land details
CREATE TABLE IF NOT EXISTS farm_profiles (
    farm_id VARCHAR(36) PRIMARY KEY,
    farmer_id VARCHAR(36) NOT NULL,
    soil_type ENUM('CLAY', 'SANDY', 'LOAM', 'SILT') NOT NULL,
    irrigation_source VARCHAR(255),
    gps_lat DECIMAL(10, 8),
    gps_long DECIMAL(11, 8),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (farmer_id) REFERENCES users(user_id) ON DELETE CASCADE,
    INDEX idx_farmer_id (farmer_id)
);

-- Table 3: crop_batches
-- The Digital Twin - Central entity tracked through the entire supply chain
CREATE TABLE IF NOT EXISTS crop_batches (
    batch_id VARCHAR(36) PRIMARY KEY,
    farmer_id VARCHAR(36) NOT NULL,
    crop_name VARCHAR(100) NOT NULL,
    variety VARCHAR(100),
    planting_date DATE,
    harvest_date DATE,
    harvest_machine_type VARCHAR(255),
    status ENUM('PLANTED', 'HARVESTED', 'SOLD_TO_DISTRIBUTOR', 'IN_TRANSIT', 'IN_SHOP', 'SOLD_TO_CONSUMER') DEFAULT 'PLANTED',
    current_holder_id VARCHAR(36),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (farmer_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (current_holder_id) REFERENCES users(user_id) ON DELETE SET NULL,
    INDEX idx_farmer_id (farmer_id),
    INDEX idx_current_holder (current_holder_id),
    INDEX idx_status (status)
);

-- Table 4: chemical_logs
-- Lifecycle Events - Detailed logs for fertilizers/pesticides applied
CREATE TABLE IF NOT EXISTS chemical_logs (
    log_id VARCHAR(36) PRIMARY KEY,
    batch_id VARCHAR(36) NOT NULL,
    chemical_name VARCHAR(255) NOT NULL,
    applied_date DATE NOT NULL,
    quantity DECIMAL(10,2),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (batch_id) REFERENCES crop_batches(batch_id) ON DELETE CASCADE,
    INDEX idx_batch_id (batch_id),
    INDEX idx_applied_date (applied_date)
);

-- Table 5: transactions
-- The Marketplace - Financial records of ownership change
CREATE TABLE IF NOT EXISTS transactions (
    tx_id VARCHAR(36) PRIMARY KEY,
    batch_id VARCHAR(36) NOT NULL,
    buyer_id VARCHAR(36) NOT NULL,
    seller_id VARCHAR(36) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    quantity DECIMAL(10,2),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (batch_id) REFERENCES crop_batches(batch_id) ON DELETE CASCADE,
    FOREIGN KEY (buyer_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (seller_id) REFERENCES users(user_id) ON DELETE CASCADE,
    INDEX idx_batch_id (batch_id),
    INDEX idx_buyer_id (buyer_id),
    INDEX idx_seller_id (seller_id),
    INDEX idx_timestamp (timestamp)
);






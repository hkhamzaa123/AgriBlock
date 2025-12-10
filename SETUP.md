# AgriChain - Setup Instructions

## Phase 2: Authentication & Role-Based Routing - Complete ✅

### Prerequisites
- Node.js installed
- MySQL running on localhost:3306
- Database credentials: root / sql@123

### Running the Application

#### Option 1: Run Backend and Frontend Separately (Recommended)

**Terminal 1 - Backend Server:**
```bash
cd C:\Users\hamza\AgriBlock
npm install
npm start
```
Backend will run on: http://localhost:5000

**Terminal 2 - Frontend Client:**
```bash
cd C:\Users\hamza\AgriBlock\client
npm install
npm run dev
```
Frontend will run on: http://localhost:5173 (or similar Vite port)

#### Option 2: Using Concurrently (Optional)

You can install `concurrently` to run both servers in one terminal:
```bash
npm install -D concurrently
```

Then add to root `package.json`:
```json
"scripts": {
  "dev": "concurrently \"npm start\" \"cd client && npm run dev\""
}
```

### Demo Login Credentials

All users have the password: `password123`

- **Farmer:** `farmer_joe`
- **Distributor:** `distributor_dave` (Wallet: $50,000)
- **Transporter:** `transporter_tom`
- **Shopkeeper:** `shop_sarah` (Wallet: $20,000)
- **Consumer:** `consumer_carl`

### Project Structure

```
AgriBlock/
├── config/
│   └── db.js                 # Database connection pool
├── controllers/
│   └── authController.js     # Authentication logic
├── routes/
│   └── authRoutes.js         # Auth API routes
├── database/
│   ├── schema.sql            # Database schema
│   └── seed.js               # Database seeder
├── server.js                 # Express server
├── client/                   # React frontend
│   ├── src/
│   │   ├── context/
│   │   │   └── AuthContext.jsx
│   │   ├── pages/
│   │   │   ├── Login.jsx
│   │   │   ├── FarmerDashboard.jsx
│   │   │   ├── DistributorDashboard.jsx
│   │   │   ├── TransporterDashboard.jsx
│   │   │   ├── ShopkeeperDashboard.jsx
│   │   │   └── ConsumerDashboard.jsx
│   │   ├── components/
│   │   │   └── ProtectedRoute.jsx
│   │   ├── App.jsx
│   │   └── main.jsx
│   └── package.json
└── package.json
```

### Features Implemented

✅ Backend Authentication API (`POST /api/auth/login`)
✅ JWT Token Generation
✅ React Frontend with Tailwind CSS
✅ Role-Based Routing
✅ Protected Routes (Role-specific access)
✅ 5 Role-Specific Dashboards
✅ Global Auth Context Management
✅ Professional Login UI

### Next Steps

Phase 3 will implement:
- Farmer: Crop batch creation and management
- Distributor: Marketplace and purchase functionality
- Transporter: Transport job management
- Shopkeeper: Inventory and sales management
- Consumer: Purchase and traceability viewing




















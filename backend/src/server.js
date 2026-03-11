require('dotenv').config();
const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const cors = require('cors');
const { Server } = require('socket.io');
const blockchain = require('./services/blockchain');

const nodeRoutes = require('./routes/nodes');
const trustRoutes = require('./routes/trust');
const blockchainRoutes = require('./routes/blockchain');
const attackRoutes = require('./routes/attacks');
const realtime = require('./websocket/realtime');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/nodes', nodeRoutes);
app.use('/api/trust', trustRoutes);
app.use('/api/blockchain', blockchainRoutes);
app.use('/api/attacks', attackRoutes);

// Database connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/6g_trustguard';
mongoose.connect(MONGODB_URI)
  .then(async () => {
    console.log('Connected to MongoDB');
    await blockchain.init();
    realtime(io);
    
    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch(err => console.error('MongoDB connection error:', err));

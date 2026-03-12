import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { blockchainService } from './services/blockchain.service';
import { trustRoutes } from './routes/trust.routes';
import { trafficSimulatorService, simulatorEvents } from './services/simulator.service';

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());

// Trust & Nodes endpoints
app.use('/api', trustRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', simulator: trafficSimulatorService.maliciousMode });
});

app.post('/api/simulator/toggle', (req, res) => {
  trafficSimulatorService.toggleMalicious();
  io.emit('simulator_mode', { maliciousMode: trafficSimulatorService.maliciousMode });
  res.json({ maliciousMode: trafficSimulatorService.maliciousMode });
});

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  socket.emit('simulator_mode', { maliciousMode: trafficSimulatorService.maliciousMode });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Broadcast simulator ticks to frontend
simulatorEvents.on('traffic_tick', (data) => {
  io.emit('trust_update', data);
});

const PORT = process.env.PORT || 4000;

async function bootstrap() {
  try {
    // 1. Init Blockchain integration
    await blockchainService.initialize();
    
    // 2. Start Express Server
    server.listen(PORT, () => {
      console.log(`Backend server running on http://localhost:${PORT}`);
    });

    // 3. Start 6G Network Simulator after 2 seconds
    setTimeout(() => {
      trafficSimulatorService.startSimulation();
    }, 2000);

  } catch (err) {
    console.error('Failed to bootstrap backend:', err);
    process.exit(1);
  }
}

bootstrap();

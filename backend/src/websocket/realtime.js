const trustEngine = require('../services/trustEngine');
const attackDetector = require('../services/attackDetector');
const Node = require('../models/Node');

module.exports = (io) => {
  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    const interval = setInterval(async () => {
      try {
        await trustEngine.updateAllNodes();
        const attacks = await attackDetector.detectAttacks();
        const nodes = await Node.find({});
        
        socket.emit('trust_update', {
          nodes,
          alerts: attacks,
          timestamp: Date.now()
        });
      } catch (err) {
        console.error('Update error:', err);
      }
    }, 3000);

    socket.on('disconnect', () => {
      console.log('Client disconnected');
      clearInterval(interval);
    });
  });
};

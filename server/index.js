import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import { startTwilioCall, handleTwilioWebhook } from './twilio.js';
import { handleWebsocketConnection } from './websocket/websocketHandler.js';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Create HTTP server
const server = http.createServer(app);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// TwiML endpoint - handles both GET and POST
app.all('/twiml', (req, res) => {
  console.log(`🔔 TwiML request - Method: ${req.method}, Role: ${req.query.role}`);
  handleTwilioWebhook(req, res);
});

// Twilio status callback endpoint
app.post('/twilio-status', (req, res) => {
  console.log('🔔 Twilio status callback:', {
    callSid: req.body.CallSid,
    callStatus: req.body.CallStatus,
    direction: req.body.Direction
  });
  res.sendStatus(200);
});

// Start interview call endpoint
app.post('/api/interview/start', async (req, res) => {
  const { phoneNumber, role } = req.body;
  
  console.log(`📞 Starting interview call to ${phoneNumber} for role: ${role}`);
  
  try {
    const call = await startTwilioCall(phoneNumber, role);
    res.json({ 
      success: true, 
      callSid: call.sid,
      status: call.status,
      message: 'Call initiated successfully'
    });
  } catch (error) {
    console.error(`❌ Call initiation failed: ${error.message}`);
    res.status(500).json({ 
      success: false,
      error: error.message,
      message: 'Failed to initiate call'
    });
  }
});

// Create WebSocket server
const wss = new WebSocketServer({
  server,
  path: '/api/interview/websocket',
});

// Handle WebSocket connections
wss.on('connection', (ws, req) => {
  console.log('🔌 New WebSocket connection established');
  handleWebsocketConnection(ws, req);
});

// WebSocket server error handling
wss.on('error', (error) => {
  console.error('❌ WebSocket server error:', error.message);
});

// Start server
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 AI Interviewer server running on http://localhost:${PORT}`);
  console.log(`📡 WebSocket endpoint: ws://localhost:${PORT}/api/interview/websocket`);
  console.log(`🔔 TwiML endpoint: http://localhost:${PORT}/twiml`);
  console.log(`📞 Start call endpoint: http://localhost:${PORT}/api/interview/start`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 Received SIGINT, shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});
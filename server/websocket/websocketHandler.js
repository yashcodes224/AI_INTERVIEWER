import { CallSession } from '../services/CallSession.js';

export function handleWebsocketConnection(ws, req) {
  console.log('🔌 Twilio WebSocket connection established');

  let callSession = null;

  ws.on('message', async (message) => {
    try {
      const msg = JSON.parse(message.toString());
      //console.log(`📨 [${msg.start?.callSid || callSession?.callSid || 'unknown'}] WebSocket message: ${msg.event}`);

      switch (msg.event) {
        case 'start':
          console.log(`🚀 [${msg.start.callSid}] WebSocket session starting`);
          console.log(`📋 Start message details:`, JSON.stringify(msg.start, null, 2));
          
          // Create new call session
          callSession = new CallSession(ws, msg.start.callSid);
          callSession.setStreamSid(msg.start.streamSid);
          
          // Get role from URL query parameters
          const url = new URL(`http://localhost${req.url}`);
          const role = url.searchParams.get('role') || 'frontend developer';
          console.log(`📋 [${msg.start.callSid}] Role set to: ${role}`);
          callSession.setRole(role);
          
          // Initialize the session and start the conversation pipeline
          await callSession.initializeSession();
          console.log(`✅ [${msg.start.callSid}] Call session fully initialized`);
          break;

        case 'media':
          if (callSession && msg.media?.payload) {
            await callSession.processAudioChunk(msg.media.payload);
          }
          break;

        case 'mark':
          if (callSession && msg.mark?.name) {
            console.log(`✅ [${callSession.callSid}] Mark received: ${msg.mark.name}`);
            callSession.handleMark(msg.mark.name);
          }
          break;

        case 'stop':
          console.log(`🛑 [${callSession?.callSid || 'unknown'}] Call ended by Twilio`);
          if (callSession) {
            await callSession.cleanup();
            callSession = null;
          }
          break;

        default:
          console.log(`ℹ️ [${callSession?.callSid || 'unknown'}] Ignored event: ${msg.event}`);
          break;
      }
    } catch (error) {
      console.error(`❌ WebSocket message parsing error: ${error.message}`);
      console.error(`❌ Raw message: ${message.toString()}`);
      if (callSession) {
        await callSession.cleanup();
        callSession = null;
      }
    }
  });

  ws.on('error', async (error) => {
    console.error(`❌ WebSocket error: ${error.message}`);
    if (callSession) {
      await callSession.cleanup();
      callSession = null;
    }
  });

  ws.on('close', async (code, reason) => {
    console.log(`❌ Twilio WebSocket closed (${code}): ${reason || 'no reason provided'}`);
    if (callSession) {
      await callSession.cleanup();
      callSession = null;
    }
  });

  // Keep connection alive with periodic pings
  const pingInterval = setInterval(() => {
    if (ws.readyState === ws.OPEN) {
      ws.ping();
    } else {
      clearInterval(pingInterval);
    }
  }, 30000);

  ws.on('close', () => {
    clearInterval(pingInterval);
  });

  // Send initial connection acknowledgment
  console.log('📡 WebSocket connection ready for Twilio stream');
}
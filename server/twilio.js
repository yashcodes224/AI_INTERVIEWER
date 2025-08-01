import dotenv from 'dotenv';
import Twilio from 'twilio';

dotenv.config();

const {
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_NUMBER,
  SERVER_URL,
} = process.env;

// sanity checks up front
if (!TWILIO_ACCOUNT_SID) throw new Error('Missing env var: TWILIO_ACCOUNT_SID');
if (!TWILIO_AUTH_TOKEN) throw new Error('Missing env var: TWILIO_AUTH_TOKEN');
if (!TWILIO_NUMBER) throw new Error('Missing env var: TWILIO_NUMBER');
if (!SERVER_URL) throw new Error('Missing env var: SERVER_URL');

const client = new Twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

export const startTwilioCall = async (to, role) => {
  const safeRole = role || 'frontend developer';
  const base = SERVER_URL.replace(/\/+$/, ''); // strip trailing slash if any
  const twimlUrl = `https://${base}/twiml?role=${encodeURIComponent(safeRole)}`;

  console.log(`📞 Starting call to ${to} using TwiML: ${twimlUrl}`);

  try {
    const call = await client.calls.create({
      to,
      from: TWILIO_NUMBER,
      url: twimlUrl,
      method: 'GET',
      statusCallback: `https://${base}/twilio-status`,
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
      statusCallbackMethod: 'POST',
    });
    console.log(`✅ Call initiated with SID: ${call.sid}`);
    return call;
  } catch (error) {
    console.error(`❌ Call initiation error: ${error.message}`);
    throw error;
  }
};

export const handleTwilioWebhook = (req, res) => {
  const VoiceResponse = Twilio.twiml.VoiceResponse;
  const { role } = req.query;
  console.log(`🔔 Twilio requested TwiML for role: ${role}`);

  const twiml = new VoiceResponse();

  // Build WebSocket stream URL (role passed along)
  const wsHost = req.get('host');
  const safeRole = role || 'frontend developer';
  const wsUrl = `wss://${wsHost}/api/interview/websocket?role=${encodeURIComponent(safeRole)}`;
  console.log(`📡 WebSocket URL: ${wsUrl}`);

  const connect = twiml.connect();
  connect.stream({ url: wsUrl });

  console.log(`📤 Sending TwiML response for role: ${safeRole}`);

  res.type('text/xml');
  res.send(twiml.toString());
};

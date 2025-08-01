import axios from 'axios';
import { spawn } from 'child_process';
import dotenv from 'dotenv';

dotenv.config();

export async function streamElevenLabsAudio(text, onChunk, onEnd) {
  try {
    console.log(`🎵 Starting TTS for: "${text.substring(0, 50)}..."`);
    
    const response = await axios.post(
      `https://api.elevenlabs.io/v1/text-to-speech/${process.env.ELEVENLABS_VOICE_ID}/stream`,
      {
        text,
        voice_settings: { 
          stability: 0.7, 
          similarity_boost: 0.8,
          style: 0.0,
          use_speaker_boost: true
        },
        model_id: "eleven_monolingual_v1"
      },
      {
        headers: {
          "xi-api-key": process.env.ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
          "Accept": "audio/mpeg"
        },
        responseType: "stream"
      }
    );

    // Convert MP3 to μ-law PCM using FFmpeg
    const ffmpeg = spawn('ffmpeg', [
      '-i', 'pipe:0',           // Input from stdin
      '-f', 'mulaw',            // Output format μ-law
      '-ar', '8000',            // Sample rate 8kHz
      '-ac', '1',               // Mono
      '-',                      // Output to stdout
    ]);

    // Handle FFmpeg errors
    ffmpeg.stderr.on('data', (data) => {
      // Only log actual errors, not status info
      const message = data.toString();
      if (message.includes('Error') || message.includes('error')) {
        console.error('🔴 FFmpeg error:', message);
      }
    });

    // Stream converted audio chunks
    ffmpeg.stdout.on('data', (chunk) => {
      if (onChunk) onChunk(chunk);
    });

    // Handle completion
    ffmpeg.stdout.on('end', () => {
      console.log('✅ TTS conversion completed');
      if (onEnd) onEnd();
    });

    // Handle FFmpeg process errors
    ffmpeg.on('error', (error) => {
      console.error('❌ FFmpeg process error:', error.message);
      if (onEnd) onEnd(error);
    });

    ffmpeg.on('exit', (code) => {
      if (code !== 0) {
        console.error(`❌ FFmpeg exited with code ${code}`);
        if (onEnd) onEnd(new Error(`FFmpeg exit code ${code}`));
      }
    });

    // Pipe ElevenLabs MP3 to FFmpeg
    response.data.pipe(ffmpeg.stdin);

    // Handle ElevenLabs stream errors
    response.data.on('error', (error) => {
      console.error('🔴 ElevenLabs stream error:', error.message);
      ffmpeg.kill();
      if (onEnd) onEnd(error);
    });

  } catch (error) {
    console.error('❌ ElevenLabs TTS Error:', error.response?.status, error.response?.data || error.message);
    if (onEnd) onEnd(error);
  }
}

// Fallback function without audio conversion (for testing)
export async function streamElevenLabsAudioSimple(text, onChunk, onEnd) {
  try {
    const response = await axios.post(
      `https://api.elevenlabs.io/v1/text-to-speech/${process.env.ELEVENLABS_VOICE_ID}`,
      {
        text,
        voice_settings: { stability: 0.7, similarity_boost: 0.8 }
      },
      {
        headers: {
          "xi-api-key": process.env.ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
        },
        responseType: "arraybuffer"
      }
    );

    // Send the MP3 data directly (Twilio might handle some conversion)
    const audioBuffer = Buffer.from(response.data);
    if (onChunk) onChunk(audioBuffer);
    if (onEnd) onEnd();

  } catch (error) {
    console.error('❌ ElevenLabs TTS Error:', error.response?.status, error.response?.data || error.message);
    if (onEnd) onEnd(error);
  }
}
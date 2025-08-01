import { createClient as createDeepgramClient, LiveTranscriptionEvents } from '@deepgram/sdk';
import { getInterviewResponse } from './gpt.js';
import { streamElevenLabsAudio } from './tts.js';
import { StreamService } from './StreamService.js';
import dotenv from 'dotenv';

dotenv.config();

export class CallSession {
  constructor(ws, callSid) {
    this.ws = ws;
    this.callSid = callSid;
    this.streamSid = null;
    this.isActive = false;
    this.isAIProcessing = false;
    this.previousQAs = [];
    this.role = 'frontend developer';
    this.streamService = new StreamService(ws);
    
    // Deepgram setup
    this.deepgram = null;
    this.dgConnection = null;
    this.deepgramReady = false;
    
    console.log(`📞 [${this.callSid}] CallSession created`);
  }

  async initializeSession() {
    console.log(`🚀 [${this.callSid}] Initializing session...`);
    
    this.isActive = true;
    
    // Send immediate greeting (don't wait for Deepgram)
    setTimeout(() => {
      this.sendInitialGreeting();
    }, 500);
    
    // Initialize Deepgram in background
    this.initDeepgramAsync();
  }

  async initDeepgramAsync() {
    try {
      console.log(`🔍 [${this.callSid}] Initializing Deepgram...`);
      
      if (!process.env.DEEPGRAM_API_KEY) {
        console.error(`❌ [${this.callSid}] DEEPGRAM_API_KEY not found`);
        return;
      }
      
      this.deepgram = createDeepgramClient(process.env.DEEPGRAM_API_KEY);
      this.dgConnection = this.deepgram.listen.live({
        model: 'nova-2',
        language: 'en-US',
        interim_results: false,
        punctuate: true,
        smart_format: true,
        encoding: 'mulaw',
        sample_rate: 8000,
        channels: 1
      });

      this.dgConnection.on(LiveTranscriptionEvents.Open, () => {
        console.log(`🎤 [${this.callSid}] Deepgram connected`);
        this.deepgramReady = true;
      });

      this.dgConnection.on(LiveTranscriptionEvents.Error, (error) => {
        console.error(`❌ [${this.callSid}] Deepgram error: ${error.message}`);
        this.deepgramReady = false;
      });

      this.dgConnection.on(LiveTranscriptionEvents.Transcript, async (data) => {
        if (this.isAIProcessing || !this.isActive) return;
        
        const transcript = data.channel?.alternatives?.[0]?.transcript?.trim();
        if (data.is_final && transcript && transcript.length > 2) {
          console.log(`🗣️ [${this.callSid}] User: "${transcript}"`);
          await this.handleUserInput(transcript);
        }
      });

    } catch (error) {
      console.error(`❌ [${this.callSid}] Deepgram init failed: ${error.message}`);
    }
  }

  async sendInitialGreeting() {
    console.log(`👋 [${this.callSid}] Sending greeting...`);
    
    const greeting = `Hello! I'm your AI interviewer for the ${this.role} position. How are you doing today?`;
    this.previousQAs.push({ assistant: greeting });
    
    await this.sendAudioToUser(greeting);
  }

  async handleUserInput(transcript) {
    this.isAIProcessing = true;
    
    try {
      console.log(`🤖 [${this.callSid}] Processing: "${transcript}"`);
      
      this.previousQAs.push({ user: transcript });
      
      const aiResponse = await getInterviewResponse(transcript, {
        role: this.role,
        previousQAs: this.previousQAs
      });
      
      console.log(`🤖 [${this.callSid}] AI says: "${aiResponse}"`);
      this.previousQAs.push({ assistant: aiResponse });
      
      await this.sendAudioToUser(aiResponse);
      
    } catch (error) {
      console.error(`❌ [${this.callSid}] AI error: ${error.message}`);
      await this.sendAudioToUser("I apologize, could you please repeat that?");
    } finally {
      this.isAIProcessing = false;
    }
  }

  async sendAudioToUser(text) {
    return new Promise((resolve, reject) => {
      console.log(`🎵 [${this.callSid}] TTS: "${text.substring(0, 50)}..."`);
      
      let completed = false;
      const timeout = setTimeout(() => {
        if (!completed) {
          completed = true;
          console.error(`⏰ [${this.callSid}] TTS timeout`);
          reject(new Error('TTS timeout'));
        }
      }, 15000);

      streamElevenLabsAudio(
        text,
        (audioChunk) => {
          if (!completed && this.isActive && this.ws.readyState === 1) {
            try {
              this.streamService.sendAudio(audioChunk.toString('base64'));
            } catch (error) {
              console.error(`❌ [${this.callSid}] Send audio error: ${error.message}`);
            }
          }
        },
        (error) => {
          clearTimeout(timeout);
          if (!completed) {
            completed = true;
            if (error) {
              console.error(`❌ [${this.callSid}] TTS error: ${error.message}`);
              reject(error);
            } else {
              console.log(`✅ [${this.callSid}] Audio sent successfully`);
              resolve();
            }
          }
        }
      );
    });
  }

  processAudioChunk(base64Audio) {
    if (this.deepgramReady && this.dgConnection && !this.isAIProcessing) {
      try {
        const buffer = Buffer.from(base64Audio, 'base64');
        this.dgConnection.send(buffer);
      } catch (error) {
        console.error(`❌ [${this.callSid}] Audio send error: ${error.message}`);
      }
    }
  }

  handleMark(markName) {
    console.log(`✅ [${this.callSid}] Mark: ${markName}`);
  }

  setRole(role) {
    this.role = role;
    console.log(`📋 [${this.callSid}] Role: ${role}`);
  }

  setStreamSid(streamSid) {
    this.streamSid = streamSid;
    this.streamService.setStreamSid(streamSid);
    console.log(`📡 [${this.callSid}] Stream SID: ${streamSid}`);
  }

  async cleanup() {
    console.log(`🧹 [${this.callSid}] Cleaning up...`);
    
    this.isActive = false;
    this.deepgramReady = false;
    
    if (this.dgConnection) {
      try {
        this.dgConnection.removeAllListeners();
        this.dgConnection.finish();
      } catch (error) {
        console.error(`❌ [${this.callSid}] Cleanup error: ${error.message}`);
      }
    }
    
    if (this.ws && this.ws.readyState === 1) {
      try {
        this.ws.close();
      } catch (error) {
        console.error(`❌ [${this.callSid}] WebSocket close error: ${error.message}`);
      }
    }
    
    console.log(`✅ [${this.callSid}] Cleanup complete`);
  }
}
export class StreamService {
  constructor(ws) {
    this.ws = ws;
    this.streamSid = null;
  }

  setStreamSid(streamSid) {
    this.streamSid = streamSid;
    console.log(`📡 StreamService: Stream SID set to ${streamSid}`);
  }

  sendAudio(base64Audio) {
    if (!this.streamSid || this.ws.readyState !== 1) {
      console.warn('⚠️ StreamService: Cannot send audio - WebSocket not ready or no stream SID');
      return;
    }

    const message = {
      event: 'media',
      streamSid: this.streamSid,
      media: {
        payload: base64Audio
      }
    };

    try {
      this.ws.send(JSON.stringify(message));
    } catch (error) {
      console.error(`❌ StreamService: Failed to send audio: ${error.message}`);
    }
  }

  sendMark(markName) {
    if (!this.streamSid || this.ws.readyState !== 1) {
      console.warn('⚠️ StreamService: Cannot send mark - WebSocket not ready or no stream SID');
      return;
    }

    const message = {
      event: 'mark',
      streamSid: this.streamSid,
      mark: {
        name: markName
      }
    };

    try {
      this.ws.send(JSON.stringify(message));
      console.log(`📌 StreamService: Sent mark ${markName}`);
    } catch (error) {
      console.error(`❌ StreamService: Failed to send mark: ${error.message}`);
    }
  }

  sendClear() {
    if (!this.streamSid || this.ws.readyState !== 1) {
      console.warn('⚠️ StreamService: Cannot send clear - WebSocket not ready or no stream SID');
      return;
    }

    const message = {
      event: 'clear',
      streamSid: this.streamSid
    };

    try {
      this.ws.send(JSON.stringify(message));
      console.log(`🧹 StreamService: Sent clear command`);
    } catch (error) {
      console.error(`❌ StreamService: Failed to send clear: ${error.message}`);
    }
  }
}
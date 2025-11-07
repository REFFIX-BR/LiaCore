import { WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { URL } from 'url';

export async function handleTwilioOpenAIBridge(ws: WebSocket, req: IncomingMessage) {
  const url = new URL(req.url || '', `http://${req.headers.host}`);
  const sessionId = url.searchParams.get('sessionId');
  const targetId = url.searchParams.get('targetId');

  console.log(`🔗 [Voice Bridge] New Twilio connection for target ${targetId}`);

  if (!sessionId) {
    console.error('❌ [Voice Bridge] Missing sessionId parameter');
    ws.close(1008, 'Missing sessionId');
    return;
  }

  let openAIWs: WebSocket | null = null;
  let streamSid: string | null = null;
  let audioChunkCount = 0;
  let currentResponseId: string | null = null;
  let inactivityTimer: NodeJS.Timeout | null = null;
  const COMMIT_EVERY_N_CHUNKS = 10;
  const INACTIVITY_TIMEOUT_MS = 250;

  try {
    const { redis } = await import('../../lib/redis-config');

    const cacheKey = `openai-session:${sessionId}`;
    const cachedData = await redis.get<string>(cacheKey);
    
    if (!cachedData) {
      console.error(`❌ [Voice Bridge] Session ${sessionId} not found in cache or expired`);
      ws.close(1008, 'Session expired');
      return;
    }

    const { wsUrl, clientSecret } = JSON.parse(cachedData);
    console.log(`✅ [Voice Bridge] Session credentials retrieved from cache`);

    await redis.del(cacheKey);
    console.log(`✅ [Voice Bridge] Session cache entry deleted (one-time use)`);

    console.log(`🔗 [Voice Bridge] Connecting to OpenAI Realtime...`);
    
    openAIWs = new WebSocket(wsUrl, {
      headers: {
        'Authorization': `Bearer ${clientSecret}`,
        'OpenAI-Beta': 'realtime=v1',
      },
    });

    await new Promise((resolve, reject) => {
      openAIWs!.once('open', resolve);
      openAIWs!.once('error', reject);
    });

    console.log(`✅ [Voice Bridge] Connected to OpenAI Realtime`);

    ws.on('message', (message: Buffer) => {
      try {
        const msg = JSON.parse(message.toString());

        switch (msg.event) {
          case 'start':
            streamSid = msg.start.streamSid;
            console.log(`📞 [Voice Bridge] Twilio stream started: ${streamSid}`);
            
            openAIWs?.send(JSON.stringify({
              type: 'session.update',
              session: {
                turn_detection: {
                  type: 'server_vad',
                  threshold: 0.5,
                  prefix_padding_ms: 300,
                  silence_duration_ms: 500,
                },
                input_audio_format: 'g711_ulaw',
                output_audio_format: 'g711_ulaw',
              },
            }));
            break;

          case 'media':
            if (openAIWs && openAIWs.readyState === WebSocket.OPEN) {
              openAIWs.send(JSON.stringify({
                type: 'input_audio_buffer.append',
                audio: msg.media.payload,
              }));
              
              audioChunkCount++;
              
              if (inactivityTimer) {
                clearTimeout(inactivityTimer);
              }
              
              if (audioChunkCount % COMMIT_EVERY_N_CHUNKS === 0) {
                openAIWs.send(JSON.stringify({
                  type: 'input_audio_buffer.commit',
                }));
                console.log(`📤 [Voice Bridge] Committed input buffer (batch at ${audioChunkCount} chunks)`);
              }
              
              inactivityTimer = setTimeout(() => {
                if (openAIWs && openAIWs.readyState === WebSocket.OPEN) {
                  openAIWs.send(JSON.stringify({
                    type: 'input_audio_buffer.commit',
                  }));
                  console.log(`📤 [Voice Bridge] Committed input buffer (inactivity timeout)`);
                }
              }, INACTIVITY_TIMEOUT_MS);
            }
            break;

          case 'stop':
            console.log(`🔌 [Voice Bridge] Twilio stream stopped: ${streamSid}`);
            
            if (inactivityTimer) {
              clearTimeout(inactivityTimer);
              inactivityTimer = null;
            }
            
            if (openAIWs && openAIWs.readyState === WebSocket.OPEN) {
              if (audioChunkCount % COMMIT_EVERY_N_CHUNKS !== 0) {
                openAIWs.send(JSON.stringify({
                  type: 'input_audio_buffer.commit',
                }));
                console.log(`📤 [Voice Bridge] Final input buffer commit (${audioChunkCount} chunks)`);
              }
              
              openAIWs.send(JSON.stringify({
                type: 'input_audio_buffer.clear',
              }));
              console.log(`🧹 [Voice Bridge] Cleared input audio buffer`);
              
              setTimeout(() => {
                openAIWs?.close();
                ws.close();
              }, 500);
            } else {
              ws.close();
            }
            
            audioChunkCount = 0;
            break;
        }
      } catch (error) {
        console.error('❌ [Voice Bridge] Error processing Twilio message:', error);
      }
    });

    openAIWs.on('message', (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString());

        switch (msg.type) {
          case 'session.created':
            console.log(`✅ [Voice Bridge] OpenAI session created: ${msg.session?.id}`);
            break;

          case 'session.updated':
            console.log(`✅ [Voice Bridge] OpenAI session updated`);
            break;

          case 'response.created':
            currentResponseId = msg.response?.id || null;
            console.log(`🎙️ [Voice Bridge] OpenAI response started: ${currentResponseId}`);
            break;

          case 'response.audio.delta':
            if (msg.delta && ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({
                event: 'media',
                streamSid: streamSid,
                media: {
                  payload: msg.delta,
                },
              }));
            }
            break;

          case 'response.audio.done':
            console.log(`✅ [Voice Bridge] OpenAI audio response completed`);
            if (openAIWs && openAIWs.readyState === WebSocket.OPEN && currentResponseId) {
              openAIWs.send(JSON.stringify({
                type: 'response.output_audio_buffer.commit',
                response_id: currentResponseId,
              }));
              console.log(`📤 [Voice Bridge] Committed output audio buffer for response: ${currentResponseId}`);
            }
            break;

          case 'conversation.item.input_audio_transcription.completed':
            console.log(`📝 [Voice Bridge] User said: ${msg.transcript}`);
            break;

          case 'response.done':
            console.log(`✅ [Voice Bridge] OpenAI response completed: ${msg.response?.id}`);
            currentResponseId = null;
            break;

          case 'response.completed':
            console.log(`✅ [Voice Bridge] OpenAI response fully completed`);
            currentResponseId = null;
            break;

          case 'error':
            console.error('❌ [Voice Bridge] OpenAI error:', msg.error);
            break;

          default:
            console.log(`📨 [Voice Bridge] OpenAI event: ${msg.type}`);
        }
      } catch (error) {
        console.error('❌ [Voice Bridge] Error processing OpenAI message:', error);
      }
    });

    ws.on('close', () => {
      console.log(`🔌 [Voice Bridge] Twilio connection closed`);
      if (inactivityTimer) {
        clearTimeout(inactivityTimer);
        inactivityTimer = null;
      }
      if (openAIWs && openAIWs.readyState === WebSocket.OPEN) {
        if (audioChunkCount % COMMIT_EVERY_N_CHUNKS !== 0 && audioChunkCount > 0) {
          openAIWs.send(JSON.stringify({
            type: 'input_audio_buffer.commit',
          }));
          console.log(`📤 [Voice Bridge] Final commit on Twilio close (${audioChunkCount} chunks)`);
        }
        openAIWs.close();
      }
      audioChunkCount = 0;
    });

    ws.on('error', (error) => {
      console.error('❌ [Voice Bridge] Twilio WebSocket error:', error);
      if (inactivityTimer) {
        clearTimeout(inactivityTimer);
        inactivityTimer = null;
      }
      openAIWs?.close();
    });

    openAIWs.on('close', () => {
      console.log(`🔌 [Voice Bridge] OpenAI connection closed`);
      if (inactivityTimer) {
        clearTimeout(inactivityTimer);
        inactivityTimer = null;
      }
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
      audioChunkCount = 0;
      currentResponseId = null;
    });

    openAIWs.on('error', (error) => {
      console.error('❌ [Voice Bridge] OpenAI WebSocket error:', error);
      if (inactivityTimer) {
        clearTimeout(inactivityTimer);
        inactivityTimer = null;
      }
      ws.close();
    });

  } catch (error) {
    console.error('❌ [Voice Bridge] Error setting up bridge:', error);
    ws.close(1011, 'Internal error');
    openAIWs?.close();
  }
}

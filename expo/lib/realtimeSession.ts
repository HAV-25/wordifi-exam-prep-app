import { Platform } from 'react-native';
import { Audio } from 'expo-av';
import { File as FSFile, Paths } from 'expo-file-system/next';
import { EncodingType } from 'expo-file-system';
import * as Sentry from '@sentry/react-native';

// Load react-native-webrtc on native platforms. Falls back gracefully if unavailable.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _NativeRTCPeerConnection: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _nativeMediaDevices: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _NativeRTCSessionDescription: any = null;

if (Platform.OS !== 'web') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const rnWebRTC = require('react-native-webrtc');
    _NativeRTCPeerConnection = rnWebRTC.RTCPeerConnection;
    _nativeMediaDevices = rnWebRTC.mediaDevices;
    _NativeRTCSessionDescription = rnWebRTC.RTCSessionDescription;
    console.log('[Realtime] react-native-webrtc loaded');
  } catch {
    console.log('[Realtime] react-native-webrtc not available — native WebRTC disabled');
  }
}

const SUPABASE_URL = 'https://wwfiauhsbssjowaxmqyn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind3ZmlhdWhzYnNzam93YXhtcXluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0MTQxMzUsImV4cCI6MjA4Njk5MDEzNX0.lSPPEQCtdigdXpwB2X5hUTrC2dThil6qleQtqcUEKAE';
const REALTIME_MODEL = 'gpt-4o-realtime-preview-2024-12-17';

export type ConversationState =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'ai_speaking'
  | 'listening'
  | 'ended'
  | 'error';

export type SprechenScores = {
  overall: number;
  fluency: number;
  grammar: number;
  vocabulary: number;
  encouragement_note: string;
  improvement_tip: string;
  task_completion: boolean;
};

export type TranscriptEntry = {
  role: 'user' | 'assistant';
  text: string;
};

export type RealtimeCallbacks = {
  onStateChange: (state: ConversationState) => void;
  onTranscript: (entry: TranscriptEntry) => void;
  onAiSpeakingText: (delta: string) => void;
  onError: (message: string) => void;
};

export async function createSprechenSession(params: {
  question_id: string;
  level: string;
  topic: string;
  turn1_text: string;
  partner_prompts: unknown[];
  rubric_card: unknown;
  accessToken: string;
}): Promise<{ client_secret: string; session_id: string }> {
  console.log('[Realtime] Creating sprechen session...');

  const res = await fetch(`${SUPABASE_URL}/functions/v1/create-sprechen-session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${params.accessToken}`,
      'apikey': SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({
      question_id: params.question_id,
      level: params.level,
      topic: params.topic,
      turn1_text: params.turn1_text,
      partner_prompts: params.partner_prompts,
      rubric_card: params.rubric_card,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.log('[Realtime] Create session error:', res.status, text);
    Sentry.captureMessage(`Create sprechen session failed (${res.status}): ${text.slice(0, 200)}`, { tags: { context: 'sprechen_realtime' } });
    throw new Error(`Sitzung konnte nicht erstellt werden (${res.status})`);
  }

  const data = await res.json();
  console.log('[Realtime] Session created:', data.session_id);

  const secret = typeof data.client_secret === 'string'
    ? data.client_secret
    : data.client_secret?.value ?? '';

  return { client_secret: secret, session_id: data.session_id };
}

export async function scoreSprechenConversation(params: {
  question_id: string;
  level: string;
  source_structure_type: string;
  transcript: string;
  rubric_card: unknown;
  duration_seconds: number;
  accessToken: string;
}): Promise<SprechenScores> {
  console.log('[Realtime] Scoring conversation...');

  const res = await fetch(`${SUPABASE_URL}/functions/v1/score-sprechen`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${params.accessToken}`,
      'apikey': SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({
      question_id: params.question_id,
      level: params.level,
      source_structure_type: params.source_structure_type,
      transcript: params.transcript,
      rubric_card: params.rubric_card,
      duration_seconds: params.duration_seconds,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.log('[Realtime] Score error:', res.status, text);
    Sentry.captureMessage(`Score sprechen failed (${res.status}): ${text.slice(0, 200)}`, { tags: { context: 'sprechen_realtime' } });
    throw new Error(`Bewertung fehlgeschlagen (${res.status})`);
  }

  const data = await res.json();
  return data.scores;
}

function base64ToBytes(base64: string): Uint8Array {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]!);
  }
  return btoa(bin);
}

function createWavBase64(pcmChunks: Uint8Array[], sampleRate = 24000): string {
  let totalLen = 0;
  for (const c of pcmChunks) totalLen += c.length;

  const wav = new Uint8Array(44 + totalLen);
  const v = new DataView(wav.buffer);
  const w = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i));
  };

  w(0, 'RIFF');
  v.setUint32(4, 36 + totalLen, true);
  w(8, 'WAVE');
  w(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  w(36, 'data');
  v.setUint32(40, totalLen, true);

  let off = 44;
  for (const c of pcmChunks) {
    wav.set(c, off);
    off += c.length;
  }

  return bytesToBase64(wav);
}

export function isWebRTCAvailable(): boolean {
  if (Platform.OS !== 'web') {
    return _NativeRTCPeerConnection !== null && _nativeMediaDevices !== null;
  }
  try {
    return typeof RTCPeerConnection !== 'undefined' &&
      typeof navigator !== 'undefined' &&
      typeof navigator.mediaDevices?.getUserMedia === 'function';
  } catch {
    return false;
  }
}

export interface IRealtimeSession {
  readonly fullTranscript: string;
  readonly isConnected: boolean;
  connect(clientSecret: string): Promise<void>;
  disconnect(): void;
  sendUserAudio?(base64Pcm16: string): void;
}

export class WebRTCRealtimeSession implements IRealtimeSession {
  private pc: RTCPeerConnection | null = null;
  private dc: RTCDataChannel | null = null;
  private audioEl: HTMLAudioElement | null = null;
  private mediaStream: MediaStream | null = null;
  private callbacks: RealtimeCallbacks;
  private parts: TranscriptEntry[] = [];
  private currentAiText = '';
  private _isConnected = false;
  private _isAiSpeaking = false;

  constructor(callbacks: RealtimeCallbacks) {
    this.callbacks = callbacks;
  }

  get isConnected() { return this._isConnected; }

  get fullTranscript(): string {
    return this.parts
      .map(e => `${e.role === 'assistant' ? 'Partner' : 'Sie'}: ${e.text}`)
      .join('\n');
  }

  async connect(clientSecret: string): Promise<void> {
    this.callbacks.onStateChange('connecting');

    try {
      const PeerConnection = Platform.OS !== 'web' ? _NativeRTCPeerConnection : RTCPeerConnection;
      this.pc = new PeerConnection();

      if (Platform.OS === 'web') {
        this.audioEl = document.createElement('audio');
        this.audioEl.autoplay = true;
        this.pc.ontrack = (e: RTCTrackEvent) => {
          if (this.audioEl && e.streams[0]) {
            this.audioEl.srcObject = e.streams[0];
          }
        };
      } else {
        this.pc.ontrack = () => {
          // react-native-webrtc routes audio to device speaker automatically
        };
      }

      const mediaDevices = Platform.OS !== 'web' ? _nativeMediaDevices : navigator.mediaDevices;
      this.mediaStream = await mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      const track = this.mediaStream.getTracks()[0];
      if (track) this.pc.addTrack(track, this.mediaStream);

      this.dc = this.pc.createDataChannel('oai-events');
      this.dc.onopen = () => {
        console.log('[Realtime] DC open');
        this._isConnected = true;
        this.callbacks.onStateChange('connected');
        this.configureSession();
      };
      this.dc.onmessage = (e: MessageEvent) => {
        try {
          this.handleEvent(JSON.parse(e.data as string));
        } catch (err) {
          console.log('[Realtime] Parse error:', err);
        }
      };
      this.dc.onclose = () => {
        console.log('[Realtime] DC closed');
        this._isConnected = false;
      };

      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);

      const sdpRes = await fetch(
        `https://api.openai.com/v1/realtime?model=${REALTIME_MODEL}`,
        {
          method: 'POST',
          body: offer.sdp,
          headers: {
            'Authorization': `Bearer ${clientSecret}`,
            'Content-Type': 'application/sdp',
          },
        }
      );

      if (!sdpRes.ok) {
        const errText = await sdpRes.text().catch(() => '');
        throw new Error(`SDP-Austausch fehlgeschlagen (${sdpRes.status}): ${errText.slice(0, 200)}`);
      }

      const answerSdp = await sdpRes.text();
      const sessionDesc = Platform.OS !== 'web'
        ? new _NativeRTCSessionDescription({ type: 'answer', sdp: answerSdp })
        : { type: 'answer' as RTCSdpType, sdp: answerSdp };
      await this.pc.setRemoteDescription(sessionDesc);
      console.log('[Realtime] WebRTC connected');
    } catch (err) {
      console.log('[Realtime] Connect error:', err);
      this._isConnected = false;
      this.callbacks.onStateChange('error');
      this.callbacks.onError(err instanceof Error ? err.message : 'Verbindung fehlgeschlagen');
      throw err;
    }
  }

  private configureSession() {
    this.sendEvent({
      type: 'session.update',
      session: {
        modalities: ['text', 'audio'],
        input_audio_transcription: { model: 'whisper-1' },
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 700,
        },
      },
    });
  }

  private sendEvent(event: Record<string, unknown>) {
    if (this.dc?.readyState === 'open') {
      this.dc.send(JSON.stringify(event));
    }
  }

  private handleEvent(event: Record<string, unknown>) {
    const type = event.type as string;
    console.log('[Realtime] Event:', type);

    switch (type) {
      case 'response.audio_transcript.delta': {
        const delta = (event.delta as string) ?? '';
        this.currentAiText += delta;
        this.callbacks.onAiSpeakingText(delta);
        this._isAiSpeaking = true;
        this.callbacks.onStateChange('ai_speaking');
        // Mute mic while AI is speaking to prevent speaker bleed
        this.mediaStream?.getAudioTracks().forEach(t => { t.enabled = false; });
        break;
      }
      case 'response.audio_transcript.done': {
        if (this.currentAiText.trim()) {
          const entry: TranscriptEntry = { role: 'assistant', text: this.currentAiText.trim() };
          this.parts.push(entry);
          this.callbacks.onTranscript(entry);
        }
        this.currentAiText = '';
        break;
      }
      case 'response.done':
        this._isAiSpeaking = false;
        // Unmute mic when AI finishes speaking
        this.mediaStream?.getAudioTracks().forEach(t => { t.enabled = true; });
        this.callbacks.onStateChange('listening');
        break;
      case 'input_audio_buffer.speech_started':
        // Ignore VAD triggers while AI is still speaking — prevents premature Zuhören state
        if (!this._isAiSpeaking) {
          this.callbacks.onStateChange('listening');
        }
        break;
      case 'conversation.item.input_audio_transcription.completed': {
        const t = (event.transcript as string) ?? '';
        if (t.trim()) {
          const entry: TranscriptEntry = { role: 'user', text: t.trim() };
          this.parts.push(entry);
          this.callbacks.onTranscript(entry);
        }
        break;
      }
      case 'error': {
        const errObj = event.error as Record<string, unknown> | undefined;
        this.callbacks.onError((errObj?.message as string) ?? 'Serverfehler');
        break;
      }
    }
  }

  disconnect() {
    console.log('[Realtime] Disconnecting WebRTC...');
    this.mediaStream?.getTracks().forEach(t => t.stop());
    this.dc?.close();
    this.pc?.close();
    if (this.audioEl) {
      this.audioEl.srcObject = null;
      if (Platform.OS === 'web') this.audioEl.remove();
    }
    this.pc = null;
    this.dc = null;
    this.audioEl = null;
    this.mediaStream = null;
    this._isConnected = false;
    this.callbacks.onStateChange('ended');
  }
}

const NATIVE_RECORDING_OPTIONS: Audio.RecordingOptions = {
  isMeteringEnabled: false,
  android: {
    extension: '.wav',
    outputFormat: 0,
    audioEncoder: 0,
    sampleRate: 24000,
    numberOfChannels: 1,
    bitRate: 384000,
  },
  ios: {
    extension: '.wav',
    outputFormat: Audio.IOSOutputFormat.LINEARPCM,
    audioQuality: Audio.IOSAudioQuality.HIGH,
    sampleRate: 24000,
    numberOfChannels: 1,
    bitRate: 384000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {},
};

export class NativeWSRealtimeSession implements IRealtimeSession {
  private ws: WebSocket | null = null;
  private callbacks: RealtimeCallbacks;
  private parts: TranscriptEntry[] = [];
  private currentAiText = '';
  private audioChunks: Uint8Array[] = [];
  private _isConnected = false;
  private currentSound: Audio.Sound | null = null;
  private recording: Audio.Recording | null = null;
  private _isRecording = false;

  onAiAudioReady?: () => void;
  onNeedUserAudio?: () => void;

  constructor(callbacks: RealtimeCallbacks) {
    this.callbacks = callbacks;
  }

  get isConnected() { return this._isConnected; }
  get isRecording() { return this._isRecording; }

  get fullTranscript(): string {
    return this.parts
      .map(e => `${e.role === 'assistant' ? 'Partner' : 'Sie'}: ${e.text}`)
      .join('\n');
  }

  async connect(clientSecret: string): Promise<void> {
    this.callbacks.onStateChange('connecting');

    return new Promise<void>((resolve, reject) => {
      try {
        const url = `wss://api.openai.com/v1/realtime?model=${REALTIME_MODEL}`;

        // React Native WebSocket supports headers via 3rd arg but TS types only allow 2
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const WS = WebSocket as any;
        this.ws = new WS(url, undefined, {
          headers: {
            'Authorization': `Bearer ${clientSecret}`,
            'OpenAI-Beta': 'realtime=v1',
          },
        }) as WebSocket;

        this.ws.onopen = () => {
          console.log('[Realtime] WS open');
          this._isConnected = true;
          this.callbacks.onStateChange('connected');
          this.configureSession();
          resolve();
        };

        this.ws.onmessage = (e: WebSocketMessageEvent) => {
          try {
            const event = JSON.parse(typeof e.data === 'string' ? e.data : '{}');
            this.handleEvent(event);
          } catch (err) {
            console.log('[Realtime] WS parse error:', err);
          }
        };

        this.ws.onerror = (e: Event) => {
          console.log('[Realtime] WS error:', e);
          this._isConnected = false;
          this.callbacks.onStateChange('error');
          this.callbacks.onError('WebSocket-Verbindung fehlgeschlagen');
          reject(new Error('WebSocket connection failed'));
        };

        this.ws.onclose = () => {
          console.log('[Realtime] WS closed');
          this._isConnected = false;
        };
      } catch (err) {
        console.log('[Realtime] WS connect error:', err);
        this.callbacks.onStateChange('error');
        this.callbacks.onError(err instanceof Error ? err.message : 'Verbindung fehlgeschlagen');
        reject(err);
      }
    });
  }

  private configureSession() {
    this.sendEvent({
      type: 'session.update',
      session: {
        modalities: ['text', 'audio'],
        input_audio_transcription: { model: 'whisper-1' },
        turn_detection: null,
      },
    });
  }

  private sendEvent(event: Record<string, unknown>) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(event));
    }
  }

  private handleEvent(event: Record<string, unknown>) {
    const type = event.type as string;

    switch (type) {
      case 'response.audio.delta': {
        const audioB64 = (event.delta as string) ?? '';
        if (audioB64) {
          this.audioChunks.push(base64ToBytes(audioB64));
        }
        if (this.callbacks.onStateChange) {
          this.callbacks.onStateChange('ai_speaking');
        }
        break;
      }
      case 'response.audio.done':
        void this.playAccumulatedAudio();
        break;
      case 'response.audio_transcript.delta': {
        const delta = (event.delta as string) ?? '';
        this.currentAiText += delta;
        this.callbacks.onAiSpeakingText(delta);
        this.callbacks.onStateChange('ai_speaking');
        break;
      }
      case 'response.audio_transcript.done': {
        if (this.currentAiText.trim()) {
          const entry: TranscriptEntry = { role: 'assistant', text: this.currentAiText.trim() };
          this.parts.push(entry);
          this.callbacks.onTranscript(entry);
        }
        this.currentAiText = '';
        break;
      }
      case 'response.done':
        break;
      case 'conversation.item.input_audio_transcription.completed': {
        const t = (event.transcript as string) ?? '';
        if (t.trim()) {
          const entry: TranscriptEntry = { role: 'user', text: t.trim() };
          this.parts.push(entry);
          this.callbacks.onTranscript(entry);
        }
        break;
      }
      case 'error': {
        const errObj = event.error as Record<string, unknown> | undefined;
        console.log('[Realtime] WS server error:', errObj);
        this.callbacks.onError((errObj?.message as string) ?? 'Serverfehler');
        break;
      }
    }
  }

  private async playAccumulatedAudio() {
    if (this.audioChunks.length === 0) return;

    try {
      const wavB64 = createWavBase64(this.audioChunks);
      this.audioChunks = [];

      const tempFile = new FSFile(Paths.cache, `ai_response_${Date.now()}.wav`);
      await tempFile.create({ overwrite: true });
      await tempFile.write(wavB64, { encoding: EncodingType.Base64 });
      const tempUri = tempFile.uri;

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });

      if (this.currentSound) {
        await this.currentSound.unloadAsync().catch(() => {});
      }

      const { sound } = await Audio.Sound.createAsync(
        { uri: tempUri },
        { shouldPlay: true }
      );
      this.currentSound = sound;

      sound.setOnPlaybackStatusUpdate((status) => {
        if (!status.isLoaded) return;
        if (status.didJustFinish) {
          sound.unloadAsync().catch(() => {});
          this.currentSound = null;
          this.onAiAudioReady?.();
          this.onNeedUserAudio?.();
          this.callbacks.onStateChange('listening');
        }
      });
    } catch (err) {
      console.log('[Realtime] Play audio error:', err);
      this.callbacks.onStateChange('listening');
      this.onAiAudioReady?.();
      this.onNeedUserAudio?.();
    }
  }

  async startRecording(): Promise<void> {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(NATIVE_RECORDING_OPTIONS);
      this.recording = recording;
      this._isRecording = true;
      this.callbacks.onStateChange('listening');
      console.log('[Realtime] Recording started');
    } catch (err) {
      console.log('[Realtime] Start recording error:', err);
      this._isRecording = false;
    }
  }

  async stopRecordingAndSend(): Promise<void> {
    if (!this.recording) return;

    try {
      await this.recording.stopAndUnloadAsync();
      const uri = this.recording.getURI();
      this.recording = null;
      this._isRecording = false;

      if (!uri) {
        console.log('[Realtime] No recording URI');
        return;
      }

      const recordingFile = new FSFile(uri);
      const fileB64 = await recordingFile.base64();

      const fileBytes = base64ToBytes(fileB64);

      let pcmB64: string;
      if (fileBytes.length > 44 &&
        fileBytes[0] === 0x52 && fileBytes[1] === 0x49 &&
        fileBytes[2] === 0x46 && fileBytes[3] === 0x46) {
        const pcmData = fileBytes.slice(44);
        pcmB64 = bytesToBase64(pcmData);
      } else {
        pcmB64 = fileB64;
      }

      const CHUNK_SIZE = 8192;
      const pcmBytes = base64ToBytes(pcmB64);
      for (let i = 0; i < pcmBytes.length; i += CHUNK_SIZE) {
        const chunk = pcmBytes.slice(i, Math.min(i + CHUNK_SIZE, pcmBytes.length));
        this.sendEvent({
          type: 'input_audio_buffer.append',
          audio: bytesToBase64(chunk),
        });
      }

      this.sendEvent({ type: 'input_audio_buffer.commit' });
      this.sendEvent({ type: 'response.create' });

      console.log('[Realtime] Audio sent, committed, response requested');

      try { new FSFile(uri).delete(); } catch { /* ignore */ }
    } catch (err) {
      console.log('[Realtime] Stop recording error:', err);
      this._isRecording = false;
    }
  }

  sendUserAudio(base64Pcm16: string) {
    this.sendEvent({
      type: 'input_audio_buffer.append',
      audio: base64Pcm16,
    });
  }

  disconnect() {
    console.log('[Realtime] Disconnecting WS...');
    if (this.recording) {
      void this.recording.stopAndUnloadAsync().catch(() => {});
      this.recording = null;
      this._isRecording = false;
    }
    if (this.currentSound) {
      void this.currentSound.unloadAsync().catch(() => {});
      this.currentSound = null;
    }
    this.ws?.close();
    this.ws = null;
    this._isConnected = false;
    this.callbacks.onStateChange('ended');
  }
}

export function createRealtimeSession(callbacks: RealtimeCallbacks): IRealtimeSession {
  if (isWebRTCAvailable()) {
    console.log('[Realtime] Using WebRTC session');
    return new WebRTCRealtimeSession(callbacks);
  }
  console.log('[Realtime] Using native WebSocket session');
  return new NativeWSRealtimeSession(callbacks);
}

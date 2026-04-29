import { FileNode } from '../store';

export interface SessionSnapshot {
  id: string;
  timestamp: string;
  duration: number;
  files: {
    id: string;
    name: string;
    content: string;
    language: string;
    isDirty: boolean;
  }[];
  notes: string;
  ai_interactions: Array<{
    timestamp: string;
    prompt: string;
    response: string;
  }>;
  terminal_history?: string[];
}

export class SessionStorageManager {
  private currentSession: SessionSnapshot | null = null;
  private sessionStartTime: number = 0;
  private audioRecording: any = null;
  private transcript: string = '';

  initializeSession() {
    this.sessionStartTime = Date.now();
    this.currentSession = {
      id: `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      duration: 0,
      files: [],
      notes: '',
      ai_interactions: [],
      terminal_history: [],
    };

    console.log(`✓ Session initialized: ${this.currentSession.id}`);
    return this.currentSession.id;
  }

  captureFiles(files: FileNode[]) {
    if (!this.currentSession) throw new Error('Session not initialized');

    this.currentSession.files = files
      .filter((f) => f.type === 'file')
      .map((f) => ({
        id: f.id,
        name: f.name,
        content: f.content || '',
        language: this.detectLanguage(f.name),
        isDirty: f.isDirty || false,
      }));

    return this.currentSession.files;
  }

  recordAIInteraction(prompt: string, response: string) {
    if (!this.currentSession) throw new Error('Session not initialized');

    this.currentSession.ai_interactions.push({
      timestamp: new Date().toISOString(),
      prompt,
      response,
    });
  }

  recordTerminalCommand(command: string) {
    if (!this.currentSession) throw new Error('Session not initialized');

    if (!this.currentSession.terminal_history) {
      this.currentSession.terminal_history = [];
    }

    this.currentSession.terminal_history.push(
      `[${new Date().toISOString()}] ${command}`
    );
  }

  async startAudioRecording() {
    try {
      // Get user permission and start recording
      const mediaRecorder = new MediaRecorder(
        await navigator.mediaDevices.getUserMedia({ audio: true })
      );

      let chunks: BlobPart[] = [];

      mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        await this.transcribeAudio(blob);
      };

      this.audioRecording = mediaRecorder;
      mediaRecorder.start();

      console.log('✓ Audio recording started');
    } catch (error) {
      console.warn('Could not start audio recording:', error);
    }
  }

  stopAudioRecording() {
    if (this.audioRecording) {
      this.audioRecording.stop();
      this.audioRecording = null;
      console.log('✓ Audio recording stopped');
    }
  }

  private async transcribeAudio(audioBlob: Blob) {
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob);

      const response = await fetch('/api/session/transcribe', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      this.transcript = data.transcript || '';

      if (this.currentSession) {
        this.currentSession.notes = this.transcript;
      }

      console.log('✓ Audio transcribed');
    } catch (error) {
      console.error('Failed to transcribe audio:', error);
    }
  }

  addNotes(notes: string) {
    if (!this.currentSession) throw new Error('Session not initialized');
    this.currentSession.notes = notes;
  }

  finalizeSession(): SessionSnapshot | null {
    if (!this.currentSession) return null;

    this.currentSession.duration = Math.round((Date.now() - this.sessionStartTime) / 1000);

    const snapshot = this.currentSession;
    this.currentSession = null;

    console.log(`✓ Session finalized: ${snapshot.id} (${snapshot.duration}s)`);
    return snapshot;
  }

  getCurrentSession(): SessionSnapshot | null {
    return this.currentSession;
  }

  private detectLanguage(fileName: string): string {
    const ext = fileName.split('.').pop()?.toLowerCase();

    const languageMap: Record<string, string> = {
      ts: 'typescript',
      tsx: 'react',
      js: 'javascript',
      jsx: 'react',
      py: 'python',
      html: 'html',
      css: 'css',
      json: 'json',
      md: 'markdown',
      txt: 'plaintext',
    };

    return languageMap[ext || ''] || 'plaintext';
  }
}

export const sessionManager = new SessionStorageManager();

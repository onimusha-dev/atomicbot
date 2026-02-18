import { useCallback, useEffect, useRef, useState } from "react";

export type VoiceProvider = "openai" | "local";

const STORAGE_KEY = "openclaw:voiceProvider";

export function getVoiceProvider(): VoiceProvider {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "openai" || v === "local") return v;
  } catch {
    // localStorage unavailable
  }
  return "openai";
}

export function setVoiceProvider(provider: VoiceProvider): void {
  try {
    localStorage.setItem(STORAGE_KEY, provider);
  } catch {
    // localStorage unavailable
  }
}

type GatewayRequest = <T = unknown>(method: string, params?: unknown) => Promise<T>;

export type UseVoiceInputResult = {
  startRecording: () => void;
  stopRecording: () => Promise<string | null>;
  cancelRecording: () => void;
  isRecording: boolean;
  error: string | null;
  isProcessing: boolean;
};

export function useVoiceInput(gwRequest: GatewayRequest): UseVoiceInputResult {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    return () => {
      mediaRecorderRef.current?.stop();
      mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const startRecording = useCallback(() => {
    setError(null);

    const provider = getVoiceProvider();

    if (provider === "local") {
      setError("Local Whisper is not available yet. Switch to OpenAI Whisper in Settings → Voice.");
      return;
    }

    // OpenAI mode: record audio via MediaRecorder, transcribe on stop
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        mediaStreamRef.current = stream;
        chunksRef.current = [];

        const recorder = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            chunksRef.current.push(e.data);
          }
        };
        recorder.onerror = () => {
          setError("Recording failed");
          setIsRecording(false);
        };

        mediaRecorderRef.current = recorder;
        recorder.start();
        setIsRecording(true);
      })
      .catch((err) => {
        setError(`Microphone access denied: ${String(err)}`);
      });
  }, []);

  const stopRecording = useCallback(async (): Promise<string | null> => {
    const recorder = mediaRecorderRef.current;
    const stream = mediaStreamRef.current;
    if (!recorder || recorder.state !== "recording") {
      setIsRecording(false);
      return null;
    }

    return new Promise<string | null>((resolve) => {
      recorder.onstop = async () => {
        stream?.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
        mediaRecorderRef.current = null;
        setIsRecording(false);

        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        chunksRef.current = [];

        if (blob.size === 0) {
          resolve(null);
          return;
        }

        setIsProcessing(true);
        try {
          const arrayBuf = await blob.arrayBuffer();
          const bytes = new Uint8Array(arrayBuf);
          let binary = "";
          for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]!);
          }
          const base64 = btoa(binary);

          const result = await gwRequest<{ text: string; model?: string }>("audio.transcribe", {
            audio: base64,
            mime: "audio/webm",
            fileName: "recording.webm",
          });
          resolve(result.text?.trim() || null);
        } catch (err) {
          setError(`Transcription failed: ${err instanceof Error ? err.message : String(err)}`);
          resolve(null);
        } finally {
          setIsProcessing(false);
        }
      };
      recorder.stop();
    });
  }, [gwRequest]);

  const cancelRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;
    mediaRecorderRef.current = null;
    chunksRef.current = [];
    setIsRecording(false);
    setIsProcessing(false);
  }, []);

  return { startRecording, stopRecording, cancelRecording, isRecording, error, isProcessing };
}

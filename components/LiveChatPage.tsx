import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Loader, Send, Sparkles, X, AlertTriangle, Lightbulb } from './Icons';
import { createBlob, decodeAudioData, decode, startLiveChatSession } from '../services/geminiService';
import { Toast } from '../types';

interface LiveChatPageProps {
  isAIOff: boolean;
  addToast: (message: string, type: Toast['type']) => void;
}

interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
}

const LiveChatPage: React.FC<LiveChatPageProps> = ({ isAIOff, addToast }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentInputTranscription, setCurrentInputTranscription] = useState('');
  const [currentOutputTranscription, setCurrentOutputTranscription] = useState('');
  const [inputText, setInputText] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const audioSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const outputNodeRef = useRef<GainNode | null>(null);
  const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextStartTimeRef = useRef(0);
  const sessionPromiseRef = useRef<Promise<any> | null>(null); // To hold the promise of the Live API session

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, currentInputTranscription, currentOutputTranscription]);

  useEffect(() => {
    if (isAIOff) {
      setError('AI機能は現在無効です。リアルタイムチャットは利用できません。');
    } else {
      setError(null);
    }
  }, [isAIOff]);

  const stopAllAudioPlayback = useCallback(() => {
    for (const source of audioSourcesRef.current.values()) {
      source.stop();
    }
    audioSourcesRef.current.clear();
    nextStartTimeRef.current = 0;
  }, []);

  const resetState = useCallback(() => {
    setIsRecording(false);
    setIsConnecting(false);
    setError(null);
    setMessages([]);
    setCurrentInputTranscription('');
    setCurrentOutputTranscription('');
    setInputText('');
    stopAllAudioPlayback();

    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect();
      scriptProcessorRef.current = null;
    }
    if (audioSourceRef.current) {
      audioSourceRef.current.disconnect();
      audioSourceRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (outputAudioContextRef.current) {
        outputAudioContextRef.current.close();
        outputAudioContextRef.current = null;
    }
    if (outputNodeRef.current) {
        outputNodeRef.current.disconnect();
        outputNodeRef.current = null;
    }
    if (sessionPromiseRef.current) {
        sessionPromiseRef.current.then(session => session.close()).catch(console.error);
        sessionPromiseRef.current = null;
    }
  }, [stopAllAudioPlayback]);

  const handleStartConversation = useCallback(async () => {
    if (isAIOff) {
      addToast('AI機能が無効です。', 'error');
      return;
    }
    if (isRecording) {
      resetState();
      return;
    }

    setIsConnecting(true);
    setError(null);
    setMessages([{ id: 'system-start', role: 'model', content: '会話を開始します。' }]);
    setCurrentInputTranscription('');
    setCurrentOutputTranscription('');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioContextRef.current = new AudioContext({ sampleRate: 16000 });
      outputAudioContextRef.current = new AudioContext({ sampleRate: 24000 });
      outputNodeRef.current = outputAudioContextRef.current.createGain();
      outputNodeRef.current.connect(outputAudioContextRef.current.destination);

      const audioInput = audioContextRef.current.createMediaStreamSource(stream);
      scriptProcessorRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);
      audioSourceRef.current = audioInput;

      scriptProcessorRef.current.onaudioprocess = (event) => {
        const inputData = event.inputBuffer.getChannelData(0);
        const pcmBlob = createBlob(inputData);
        sessionPromiseRef.current?.then(session => {
          session.sendRealtimeInput({ media: pcmBlob });
        }).catch(err => console.error("Error sending audio input:", err));
      };

      audioInput.connect(scriptProcessorRef.current);
      scriptProcessorRef.current.connect(audioContextRef.current.destination);

      sessionPromiseRef.current = startLiveChatSession({
        onTranscription: (type, text) => {
          if (type === 'input') {
            setCurrentInputTranscription(prev => prev + text);
          } else {
            setCurrentOutputTranscription(prev => prev + text);
          }
        },
        onAudioChunk: async (base64Audio) => {
          if (!outputAudioContextRef.current || !outputNodeRef.current) return;
          try {
            nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputAudioContextRef.current.currentTime);
            const audioBuffer = await decodeAudioData(
              decode(base64Audio),
              outputAudioContextRef.current,
              24000,
              1,
            );
            const source = outputAudioContextRef.current.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(outputNodeRef.current);
            source.addEventListener('ended', () => {
              audioSourcesRef.current.delete(source);
            });
            source.start(nextStartTimeRef.current);
            nextStartTimeRef.current = nextStartTimeRef.current + audioBuffer.duration;
            audioSourcesRef.current.add(source);
          } catch (audioError) {
            console.error("Error decoding or playing audio chunk:", audioError);
          }
        },
        onTurnComplete: () => {
            if (currentInputTranscription.trim()) {
                setMessages(prev => [...prev, { id: `user-turn-${Date.now()}`, role: 'user', content: currentInputTranscription.trim() }]);
            }
            if (currentOutputTranscription.trim()) {
                setMessages(prev => [...prev, { id: `model-turn-${Date.now()}`, role: 'model', content: currentOutputTranscription.trim() }]);
            }
            setCurrentInputTranscription('');
            setCurrentOutputTranscription('');
        },
        onError: (e) => {
          console.error("Live session error:", e);
          setError(`接続エラー: ${e.message || '不明なエラー'}`);
          addToast(`AIライブチャットエラー: ${e.message || '不明なエラー'}`, 'error');
          resetState();
        },
        onClose: (e) => {
          console.debug("Live session closed:", e);
          if (e.code !== 1000) { // 1000 is normal closure
              setError(`接続が閉じられました: ${e.reason || '不明な理由'}`);
              addToast(`AIライブチャット接続終了: ${e.reason || '不明な理由'}`, 'info');
          }
          resetState();
        },
        onInterrupted: () => {
            stopAllAudioPlayback();
        }
      });
      
      sessionPromiseRef.current.then(session => {
        console.log("Live session connected:", session);
        setIsRecording(true);
        setIsConnecting(false);
        setMessages(prev => [...prev, { id: 'system-ready', role: 'model', content: '準備ができました。話しかけてください。' }]);
      }).catch(err => {
        console.error("Failed to connect live session:", err);
        setError(`Live API接続エラー: ${err.message || '不明なエラー'}`);
        addToast(`AIライブチャット接続エラー: ${err.message || '不明なエラー'}`, 'error');
        resetState();
      });

    } catch (err: any) {
      console.error('Failed to get user media or start session:', err);
      setError(`マイクアクセスエラーまたはLive API開始失敗: ${err.message || '不明なエラー'}`);
      addToast(`マイクアクセスエラー: ${err.message || '不明なエラー'}`, 'error');
      resetState();
    }
  }, [isAIOff, resetState, addToast, currentInputTranscription, currentOutputTranscription, stopAllAudioPlayback]);

  const handleStopConversation = useCallback(() => {
    resetState();
    setMessages(prev => [...prev, { id: 'system-end', role: 'model', content: '会話を終了します。' }]);
  }, [resetState]);

  const handleSendTextInput = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !sessionPromiseRef.current || isAIOff) return;

    const userMessage: Message = { id: `user-text-${Date.now()}`, role: 'user', content: inputText };
    setMessages(prev => [...prev, userMessage]);
    setCurrentInputTranscription(''); // Clear for text input
    setCurrentOutputTranscription('');
    setInputText('');

    try {
        const session = await sessionPromiseRef.current;
        session.sendRealtimeInput({ text: userMessage.content });
    } catch (err) {
        console.error("Error sending text input to Live API:", err);
        setError(`テキスト送信エラー: ${err instanceof Error ? err.message : '不明なエラー'}`);
        addToast(`テキスト送信エラー: ${err instanceof Error ? err.message : '不明なエラー'}`, 'error');
    }
  }, [inputText, isAIOff, addToast]);

  const renderMessageContent = (content: string) => {
    // Basic Markdown-like rendering for lists, bold.
    return content.split('\n').map((line, index) => {
        if (line.startsWith('- ')) {
            return <li key={index} className="ml-4 list-disc">{line.substring(2)}</li>;
        }
        if (line.startsWith('* ')) {
            return <li key={index} className="ml-4 list-disc">{line.substring(2)}</li>;
        }
        if (line.startsWith('**') && line.endsWith('**')) {
            return <p key={index} className="font-bold">{line.substring(2, line.length - 2)}</p>;
        }
        return <p key={index}>{line}</p>;
    });
};

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm h-[80vh] flex flex-col">
      <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-blue-500" />
          AIライブチャット
        </h2>
      </div>

      {error && (
        <div className="p-4 text-red-500 bg-red-100 dark:bg-red-900/30 rounded-t-lg flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex items-start gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
            {msg.role === 'model' && (
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center flex-shrink-0 text-sm font-bold">AI</div>
            )}
            <div
              className={`max-w-xl p-3 rounded-2xl whitespace-pre-wrap break-words ${
                msg.role === 'user' ? 'bg-blue-500 text-white rounded-br-none' : 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-bl-none'
              }`}
            >
              {renderMessageContent(msg.content)}
            </div>
          </div>
        ))}

        {currentInputTranscription && (
            <div className="flex items-start gap-3 justify-end">
                <div className="max-w-xl p-3 rounded-2xl whitespace-pre-wrap break-words bg-blue-500 text-white rounded-br-none opacity-70">
                    <p className="italic text-sm">（認識中...）{currentInputTranscription}</p>
                </div>
            </div>
        )}
        {currentOutputTranscription && (
             <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center flex-shrink-0 text-sm font-bold">AI</div>
                <div className="max-w-xl p-3 rounded-2xl whitespace-pre-wrap break-words bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-bl-none opacity-70">
                    <p className="italic text-sm">（生成中...）{currentOutputTranscription}</p>
                </div>
            </div>
        )}
        {isConnecting && (
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center flex-shrink-0 text-sm font-bold">AI</div>
            <div className="max-w-xl p-3 rounded-2xl bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-bl-none">
              <Loader className="w-5 h-5 animate-spin" />
              <span className="ml-2">接続中...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex-shrink-0">
        <div className="flex justify-end mb-3">
          {isRecording ? (
            <button
              onClick={handleStopConversation}
              disabled={isConnecting || isAIOff}
              className="flex items-center gap-2 bg-red-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:bg-red-700 disabled:bg-slate-400"
            >
              <X className="w-5 h-5" />
              会話を停止
            </button>
          ) : (
            <button
              onClick={handleStartConversation}
              disabled={isConnecting || isAIOff}
              className="flex items-center gap-2 bg-green-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:bg-green-700 disabled:bg-slate-400"
            >
              <Lightbulb className="w-5 h-5" />
              会話を開始
            </button>
          )}
        </div>
        <form onSubmit={handleSendTextInput} className="flex items-center gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={isAIOff ? "AI機能は無効です。" : (isRecording ? "テキストでメッセージを入力..." : "会話を開始してから入力してください...")}
            disabled={!isRecording || isAIOff}
            className="w-full bg-slate-100 dark:bg-slate-700 border border-transparent text-slate-900 dark:text-white rounded-lg p-3 focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!isRecording || !inputText.trim() || isAIOff}
            className="bg-blue-600 text-white p-3 rounded-lg shadow-sm hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed flex-shrink-0"
          >
            <Send className="w-6 h-6" />
          </button>
        </form>
      </div>
    </div>
  );
};

export default LiveChatPage;
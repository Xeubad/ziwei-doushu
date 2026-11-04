/**
 * components/insight/useInsightChat —— AI 解读面板的对话状态机
 *
 * 职责：消息列表、流式发送、本地续聊（版本化存储）、分析快照上报。
 * 只读分享模式（readOnly）下禁用一切请求与持久化。
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import type { ZiweiChart } from '@/lib/ziwei/types';
import { streamAiText, aiErrorMessage, AiStreamError } from '@/lib/ai/client';
import { loadChat, saveChat, type ChatMessage } from '@/lib/ai/chat-store';
import { TOPIC_PROMPTS } from './prompts';

interface UseInsightChatOptions {
  chart: ZiweiChart;
  /** 本地续聊存储 key（生辰指纹）；不传则不持久化 */
  persistKey?: string;
  /** 只读分享模式：不恢复、不保存、不发请求 */
  readOnly?: boolean;
  /** assistant 分析快照变化时通知父级（分享码用） */
  onAnalysesChange?: (analyses: string[]) => void;
}

export function useInsightChat({ chart, persistKey, readOnly = false, onAnalysesChange }: UseInsightChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState('');
  const messagesRef = useRef<ChatMessage[]>([]);
  const loadingRef = useRef(false);
  const autoLoaded = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { loadingRef.current = loading; }, [loading]);

  // 自动滚动到底部
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const streamResponse = useCallback(async (apiMessages: { role: 'user' | 'assistant'; content: string }[]) => {
    // 先占位一条空 assistant 消息，流式增量持续覆盖它
    setMessages(prev => [...prev, { role: 'assistant', content: '' }]);
    try {
      await streamAiText({
        url: '/api/interpret',
        body: { chart, messages: apiMessages },
        onText: (fullText) => {
          setMessages(prev => {
            const updated = [...prev];
            updated[updated.length - 1] = { role: 'assistant', content: fullText };
            return updated;
          });
        },
      });
    } catch (e) {
      const err = e instanceof AiStreamError ? e : null;
      // 替换占位消息，避免留下一条空的 assistant 气泡
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: 'assistant',
          content: aiErrorMessage(err?.kind ?? 'unknown', '/api/interpret', err?.retryAfter),
          isError: true,
        };
        return updated;
      });
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [chart]);

  const sendMessage = useCallback((text: string, hidden = false) => {
    if (!text.trim() || loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);

    const userMsg: ChatMessage = { role: 'user', content: text, hidden };
    // 经 ref 同步取当前消息（避免闭包陈旧）
    const apiMessages = [...messagesRef.current, userMsg].map(m => ({
      role: m.role,
      content: m.content,
    }));

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    streamResponse(apiMessages);
  }, [streamResponse]);

  // 首次进入：优先恢复本地续聊；没有记录再自动生成命格总览
  useEffect(() => {
    if (autoLoaded.current) return;
    autoLoaded.current = true;
    if (readOnly) return;

    if (persistKey) {
      const saved = loadChat(persistKey);
      if (saved) {
        setMessages(saved);
        return;
      }
    }
    sendMessage(TOPIC_PROMPTS.overview, true);
  }, [persistKey, readOnly, sendMessage]);

  // 本地续聊：对话变化后防抖落盘（流式过程中不写，避免每个 delta 都写）
  useEffect(() => {
    if (readOnly || !persistKey || messages.length === 0) return;
    const timer = setTimeout(() => saveChat(persistKey, messages), 300);
    return () => clearTimeout(timer);
  }, [messages, persistKey, readOnly]);

  // 把 assistant 分析快照同步给父级（分享码用，不包含用户提问与错误卡）
  useEffect(() => {
    if (!onAnalysesChange || readOnly) return;
    const analyses = messages
      .filter(m => m.role === 'assistant' && !m.isError && m.content.trim().length > 0)
      .map(m => m.content);
    onAnalysesChange(analyses);
  }, [messages, onAnalysesChange, readOnly]);

  return {
    messages, loading, input, setInput,
    sendMessage, scrollRef,
  };
}

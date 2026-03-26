import { motion } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface MessageListProps {
  messages: Message[];
  userName?: string;
  isLoading: boolean;
}

export function MessageList({ messages, userName, isLoading }: MessageListProps) {
  if (messages.length === 0) {
    return (
      <div className="msg-list__empty">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="msg-list__empty-icon"
        >
          Φ
        </motion.div>
        <h2 className="msg-list__empty-title">How can I help you today?</h2>
        <p className="msg-list__empty-sub">
          Ask any question — I'll give you a clean, direct answer.
        </p>
      </div>
    );
  }

  return (
    <div className="msg-list">
      {messages.map((msg, idx) => (
        <motion.div
          key={idx}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className={`msg-row ${msg.role === 'user' ? 'msg-row--user' : 'msg-row--ai'}`}
        >
          <div className={`msg-avatar ${msg.role === 'user' ? 'msg-avatar--user' : 'msg-avatar--ai'}`}>
            {msg.role === 'user' ? (userName?.[0]?.toUpperCase() || 'U') : 'Φ'}
          </div>
          <div className="msg-bubble">
            <ReactMarkdown
              remarkPlugins={[remarkMath]}
              rehypePlugins={[rehypeKatex]}
              components={{
                p: ({ node, ...props }) => <span {...props} />,
              }}
            >
              {msg.content
                .replace(/\\\(/g, '$')
                .replace(/\\\)/g, '$')
                .replace(/\\\[/g, '$$')
                .replace(/\\\]/g, '$$')}
            </ReactMarkdown>
          </div>
        </motion.div>
      ))}

      {isLoading && (
        <div className="msg-row msg-row--ai">
          <div className="msg-avatar msg-avatar--ai">Φ</div>
          <div className="msg-typing">
            <div className="msg-typing__dot" />
            <div className="msg-typing__dot" />
            <div className="msg-typing__dot" />
          </div>
        </div>
      )}
    </div>
  );
}

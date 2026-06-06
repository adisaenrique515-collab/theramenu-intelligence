
import React, { useState, useRef, useEffect } from 'react';
import { Bot, MessageCircle, Minus, Send, X } from 'lucide-react';
import { chatWithDietitian } from '../services/claudeService';
import { Card, Input } from './thera/ui';

const ChatBot: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: 'user' | 'bot'; text: string }[]>([
    { role: 'bot', text: 'Hello. I am your local TheraMenu clinical dietitian assistant. How can I help with therapeutic diet protocols today?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setIsLoading(true);

    try {
      const botResponse = await chatWithDietitian(userMessage);
      setMessages(prev => [...prev, { role: 'bot', text: botResponse }]);
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, { role: 'bot', text: 'I encountered a local processing error. Please retry after checking the internal engine status.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-[1000] no-print">
      {/* Chat Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg transition-all hover:bg-blue-700"
        aria-label={isOpen ? 'Close clinical assistant' : 'Open clinical assistant'}
      >
        {isOpen ? (
          <X className="h-6 w-6" aria-hidden />
        ) : (
          <div className="relative">
            <MessageCircle className="h-6 w-6" aria-hidden />
            <span className="absolute -right-1 -top-1 h-3 w-3 animate-pulse rounded-full border-2 border-white bg-emerald-500"></span>
          </div>
        )}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <Card className="absolute bottom-20 right-0 flex h-[500px] w-[350px] flex-col overflow-hidden animate-in slide-in-from-bottom-5 duration-300 sm:w-[400px]">
          {/* Header */}
          <div className="flex items-center justify-between bg-slate-900 p-4 text-white">
            <div className="flex items-center space-x-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
                <Bot className="h-4 w-4" aria-hidden />
              </div>
              <div>
                <h3 className="text-sm font-semibold">Local Clinical Dietitian</h3>
                <p className="text-[10px] text-slate-400 font-mono uppercase tracking-widest">Internal Offline Engine</p>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-800 hover:text-white" aria-label="Minimize clinical assistant">
              <Minus className="h-4 w-4" aria-hidden />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${
                  msg.role === 'user' 
                    ? 'bg-blue-600 text-white rounded-tr-none shadow-sm' 
                    : 'bg-white text-gray-800 border border-gray-200 rounded-tl-none shadow-sm'
                }`}>
                  {msg.text}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="flex space-x-1 rounded-2xl rounded-tl-none border border-gray-200 bg-white p-3 shadow-sm" role="status" aria-label="Assistant response loading">
                  <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce"></div>
                  <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                  <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 bg-white border-t border-gray-200">
            <div className="relative flex items-center">
              <Input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Ask about IDDSI, protocols..."
                className="pr-12"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className="absolute right-2 rounded-lg p-1.5 text-blue-600 transition-colors hover:bg-blue-50 disabled:opacity-50"
                aria-label="Send clinical assistant message"
              >
                <Send className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <p className="text-[9px] text-center text-gray-400 mt-2 uppercase tracking-widest font-mono">
              Processed Locally - No External API
            </p>
          </div>
        </Card>
      )}
    </div>
  );
};

export default ChatBot;

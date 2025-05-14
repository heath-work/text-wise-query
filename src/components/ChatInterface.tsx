
import React, { useRef, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, User, FileText, ChevronDown, ChevronUp } from "lucide-react";
import { ChatMessage } from "@/utils/chatUtils";

interface ChatInterfaceProps {
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
  isWaitingForResponse: boolean;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({
  messages,
  onSendMessage,
  isWaitingForResponse
}) => {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [expandedSourceInfo, setExpandedSourceInfo] = useState<Set<string>>(new Set());

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isWaitingForResponse) {
      onSendMessage(input.trim());
      setInput("");
    }
  };

  // Toggle source info visibility
  const toggleSourceInfo = (messageId: string) => {
    setExpandedSourceInfo(prev => {
      const newSet = new Set(prev);
      if (newSet.has(messageId)) {
        newSet.delete(messageId);
      } else {
        newSet.add(messageId);
      }
      return newSet;
    });
  };

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-hidden">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center p-6 max-w-md">
              <div className="bg-primary/10 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <User className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-lg font-medium mb-2">Start Asking Questions</h3>
              <p className="text-muted-foreground text-sm">
                Upload PDF documents and ask questions about their content. I'll provide answers based on the information in your files.
              </p>
            </div>
          </div>
        ) : (
          <ScrollArea className="h-full pr-4 chat-container">
            <div className="space-y-4 py-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${
                    message.sender === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`rounded-lg px-4 py-2 max-w-[80%] ${
                      message.sender === "user"
                        ? "bg-chat-user text-foreground"
                        : "bg-chat-bot border border-border"
                    }`}
                  >
                    <div className="text-sm whitespace-pre-wrap">{message.text}</div>
                    
                    {message.sender === "bot" && message.sourceInfo && message.sourceInfo.sourceDocuments.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-border">
                        <button 
                          onClick={() => toggleSourceInfo(message.id)}
                          className="flex items-center text-xs text-muted-foreground hover:text-primary transition-colors"
                        >
                          <FileText size={12} className="mr-1" />
                          Source information
                          {expandedSourceInfo.has(message.id) ? (
                            <ChevronUp size={12} className="ml-1" />
                          ) : (
                            <ChevronDown size={12} className="ml-1" />
                          )}
                        </button>
                        
                        {expandedSourceInfo.has(message.id) && (
                          <div className="mt-2 text-xs space-y-1 text-muted-foreground">
                            <div>
                              <span className="font-medium">Source:</span> {message.sourceInfo.sourceDocuments.join(", ")}
                            </div>
                            {message.sourceInfo.pageNumber && (
                              <div>
                                <span className="font-medium">Page:</span> {message.sourceInfo.pageNumber}
                              </div>
                            )}
                            {message.sourceInfo.sectionInfo && (
                              <div>
                                <span className="font-medium">Section:</span> {message.sourceInfo.sectionInfo}
                              </div>
                            )}
                            {message.sourceInfo.paragraphInfo && (
                              <div>
                                <span className="font-medium">Reference:</span> {message.sourceInfo.paragraphInfo}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    
                    <div className="text-xs text-muted-foreground mt-1">
                      {new Date(message.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit"
                      })}
                    </div>
                  </div>
                </div>
              ))}
              {isWaitingForResponse && (
                <div className="flex justify-start">
                  <div className="rounded-lg px-4 py-2 max-w-[80%] bg-chat-bot border border-border">
                    <div className="flex space-x-2">
                      <div className="w-2 h-2 rounded-full bg-primary animate-pulse"></div>
                      <div className="w-2 h-2 rounded-full bg-primary animate-pulse" style={{ animationDelay: "0.2s" }}></div>
                      <div className="w-2 h-2 rounded-full bg-primary animate-pulse" style={{ animationDelay: "0.4s" }}></div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>
        )}
      </div>

      <div className="pt-4">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question about your documents..."
            className="flex-1"
            disabled={isWaitingForResponse}
          />
          <Button
            type="submit"
            disabled={!input.trim() || isWaitingForResponse}
          >
            {isWaitingForResponse ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent"></div>
            ) : (
              <Send size={18} />
            )}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default ChatInterface;

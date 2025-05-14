
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { 
  MessageSquare, 
  Plus, 
  Trash2, 
  Edit2, 
  Check, 
  X,
  Clock
} from "lucide-react";
import { 
  getChatSessions, 
  deleteChatSession, 
  updateChatSessionTitle,
  ChatSession
} from "@/utils/chatHistoryUtils";
import { Input } from "@/components/ui/input";
import { 
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatDistanceToNow } from "date-fns";

interface ChatHistoryProps {
  onSelectChat: (chatId: string) => void;
  onNewChat: () => void;
  currentChatId: string | null;
}

const ChatHistory: React.FC<ChatHistoryProps> = ({ 
  onSelectChat, 
  onNewChat, 
  currentChatId 
}) => {
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");

  useEffect(() => {
    loadChatSessions();
  }, []);

  const loadChatSessions = async () => {
    setIsLoading(true);
    const sessions = await getChatSessions();
    setChatSessions(sessions);
    setIsLoading(false);
  };

  const handleDeleteChat = async (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (confirm("Are you sure you want to delete this chat?")) {
      const success = await deleteChatSession(chatId);
      if (success) {
        setChatSessions(prev => prev.filter(session => session.id !== chatId));
        
        // If the deleted chat was the current chat, create a new chat
        if (chatId === currentChatId) {
          onNewChat();
        }
      }
    }
  };

  const startEditing = (chatId: string, currentTitle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingChatId(chatId);
    setEditTitle(currentTitle);
  };

  const saveTitle = async (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (editTitle.trim()) {
      const success = await updateChatSessionTitle(chatId, editTitle.trim());
      if (success) {
        setChatSessions(prev => prev.map(session => 
          session.id === chatId ? { ...session, title: editTitle.trim() } : session
        ));
      }
    }
    setEditingChatId(null);
  };

  const cancelEditing = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingChatId(null);
  };

  return (
    <div className="space-y-4">
      <Button 
        variant="outline" 
        className="w-full flex items-center gap-2" 
        onClick={onNewChat}
      >
        <Plus size={16} /> New Chat
      </Button>

      <div className="space-y-2 mt-4">
        <div className="text-sm font-medium text-muted-foreground mb-2">Chat History</div>
        {isLoading ? (
          <div className="flex justify-center py-4">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
          </div>
        ) : chatSessions.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-4">
            No chat history yet
          </div>
        ) : (
          <div className="space-y-1">
            {chatSessions.map((session) => (
              <div
                key={session.id}
                onClick={() => onSelectChat(session.id)}
                className={`flex items-center justify-between p-2 rounded-md cursor-pointer hover:bg-accent group ${
                  currentChatId === session.id ? "bg-accent" : ""
                }`}
              >
                <div className="flex items-center space-x-2 overflow-hidden">
                  <MessageSquare size={16} className="flex-shrink-0 text-muted-foreground" />
                  
                  {editingChatId === session.id ? (
                    <div className="flex items-center space-x-1 flex-grow">
                      <Input
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="h-7 text-sm"
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                      />
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        onClick={(e) => saveTitle(session.id, e)}
                        className="h-7 w-7 p-0"
                      >
                        <Check size={14} />
                      </Button>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        onClick={cancelEditing}
                        className="h-7 w-7 p-0"
                      >
                        <X size={14} />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-1 flex-grow overflow-hidden">
                      <span className="text-sm truncate">{session.title}</span>
                      
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="text-xs text-muted-foreground flex items-center ml-1">
                            <Clock size={12} className="mr-1" />
                            {formatDistanceToNow(new Date(session.updated_at), { addSuffix: true })}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="right">
                          Last updated: {new Date(session.updated_at).toLocaleString()}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  )}
                </div>

                {editingChatId !== session.id && (
                  <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0"
                      onClick={(e) => startEditing(session.id, session.title, e)}
                    >
                      <Edit2 size={14} />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 hover:text-destructive"
                      onClick={(e) => handleDeleteChat(session.id, e)}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatHistory;

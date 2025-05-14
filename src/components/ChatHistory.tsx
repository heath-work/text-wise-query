import React, { useState, useEffect } from "react";
import { getChatSessions, deleteChatSession, ChatSession } from "@/utils/chatHistoryUtils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

interface ChatHistoryProps {
  onSelectChat: (chatId: string) => void;
  onNewChat: () => void;
  currentChatId: string | null;
}

const ChatHistory: React.FC<ChatHistoryProps> = ({ onSelectChat, onNewChat, currentChatId }) => {
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchChatSessions = async () => {
      setIsLoading(true);
      try {
        const sessions = await getChatSessions();
        setChatSessions(sessions);
      } catch (error) {
        console.error("Error fetching chat sessions:", error);
        toast.error("Failed to load chat history");
      } finally {
        setIsLoading(false);
      }
    };

    fetchChatSessions();
  }, []);

  const handleDeleteChat = async (chatId: string) => {
    try {
      const deleted = await deleteChatSession(chatId);
      if (deleted) {
        setChatSessions((prevSessions) => prevSessions.filter((session) => session.id !== chatId));
        toast.success("Chat history deleted successfully");
        if (chatId === currentChatId) {
          onNewChat();
        }
      } else {
        toast.error("Failed to delete chat history");
      }
    } catch (error) {
      console.error("Error deleting chat session:", error);
      toast.error("Failed to delete chat history");
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-grow overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center p-6 max-w-md">
              <div className="bg-primary/10 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-8 w-8 text-primary animate-spin"
                >
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
              </div>
              <h3 className="text-lg font-medium mb-2">Loading Chat History</h3>
              <p className="text-muted-foreground text-sm">
                Fetching your previous chat sessions...
              </p>
            </div>
          </div>
        ) : chatSessions.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center p-6 max-w-md">
              <div className="bg-primary/10 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-8 w-8 text-primary"
                >
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
              </div>
              <h3 className="text-lg font-medium mb-2">No Chat History</h3>
              <p className="text-muted-foreground text-sm">
                Start a new conversation to see your chat history here.
              </p>
            </div>
          </div>
        ) : (
          <ScrollArea className="rounded-md border h-full">
            <div className="p-4">
              <ul className="space-y-2">
                {chatSessions.map((session) => (
                  <li
                    key={session.id}
                    className="flex items-center justify-between p-2 rounded-md hover:bg-secondary cursor-pointer"
                  >
                    <button
                      onClick={() => onSelectChat(session.id)}
                      className={`flex-grow text-left ${
                        session.id === currentChatId ? "font-semibold" : ""
                      }`}
                    >
                      {session.title}
                    </button>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-muted-foreground">
                        {new Date(session.updatedAt).toLocaleDateString()}
                      </span>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This action cannot be undone. This will permanently delete this chat and all of its
                              messages.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteChat(session.id)}>
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </ScrollArea>
        )}
      </div>
      <div className="mt-4">
        <Button variant="outline" onClick={onNewChat} className="w-full">
          New Chat
        </Button>
      </div>
    </div>
  );
};

export default ChatHistory;

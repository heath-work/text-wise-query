
import React, { useState, useEffect } from "react";
import { DocumentFile } from "@/utils/pdfUtils";
import { ChatMessage, generateResponse } from "@/utils/chatUtils";
import {
  ChatSession,
  createChatSession,
  getChatSession,
  getChatMessages,
  saveChatMessages
} from "@/utils/chatHistoryUtils";
import DocumentUploader from "@/components/DocumentUploader";
import DocumentList from "@/components/DocumentList";
import ChatInterface from "@/components/ChatInterface";
import ChatHistory from "@/components/ChatHistory";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useIsMobile } from "@/hooks/use-mobile";
import { getDocumentsFromSupabase, deleteDocumentFromSupabase } from "@/utils/supabaseDocumentUtils";
import { toast } from "sonner";
import { Maximize } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";

const Index = () => {
  const [documents, setDocuments] = useState<DocumentFile[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isProcessingUpload, setIsProcessingUpload] = useState(false);
  const [isWaitingForResponse, setIsWaitingForResponse] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const isMobile = useIsMobile();

  // Fetch documents from Supabase on component mount
  useEffect(() => {
    const fetchDocuments = async () => {
      setIsLoading(true);
      try {
        const docs = await getDocumentsFromSupabase();
        setDocuments(docs);
      } catch (error) {
        console.error("Error fetching documents:", error);
        toast.error("Failed to load documents");
      } finally {
        setIsLoading(false);
      }
    };

    fetchDocuments();
  }, []);

  // Save messages when they change (debounced)
  useEffect(() => {
    if (!currentChatId || messages.length === 0 || isSaving) return;
    
    const saveChatDebounced = setTimeout(async () => {
      setIsSaving(true);
      await saveChatMessages(currentChatId, messages);
      setIsSaving(false);
    }, 1000);
    
    return () => clearTimeout(saveChatDebounced);
  }, [messages, currentChatId]);

  const handleDocumentsUploaded = (newDocuments: DocumentFile[]) => {
    setDocuments((prevDocuments) => [...prevDocuments, ...newDocuments]);
  };

  const handleRemoveDocument = async (id: string) => {
    const deleted = await deleteDocumentFromSupabase(id);
    if (deleted) {
      setDocuments((prevDocuments) => prevDocuments.filter((doc) => doc.id !== id));
      toast.success("Document removed successfully");
    }
  };

  const handleSendMessage = async (text: string) => {
    // Add user message
    const userMessage: ChatMessage = {
      id: Math.random().toString(36).substr(2, 9),
      text,
      sender: "user",
      timestamp: Date.now(),
    };
    
    setMessages((prev) => [...prev, userMessage]);
    setIsWaitingForResponse(true);
    
    try {
      // Create a chat session if we don't have one
      if (!currentChatId) {
        let title = text.length > 30 ? `${text.substring(0, 30)}...` : text;
        const chatSession = await createChatSession(documents.map(doc => doc.id), title);
        if (chatSession) {
          setCurrentChatId(chatSession.id);
        }
      }

      // Generate bot response
      const botMessage = await generateResponse(text, documents, currentChatId || undefined);
      
      // Add bot message to chat
      setMessages((prev) => [...prev, botMessage]);
    } catch (error) {
      console.error("Error sending message:", error);
      
      // Add error message if the response generation fails
      const errorMessage: ChatMessage = {
        id: Math.random().toString(36).substr(2, 9),
        text: "Sorry, I encountered an error while processing your question. Please try again.",
        sender: "bot",
        timestamp: Date.now()
      };
      
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsWaitingForResponse(false);
    }
  };

  const handleSelectChat = async (chatId: string) => {
    if (chatId === currentChatId) return;
    
    setIsLoading(true);
    try {
      // Get the chat session
      const session = await getChatSession(chatId);
      if (!session) {
        toast.error("Failed to load chat session");
        return;
      }
      
      // Get the chat messages
      const chatMessages = await getChatMessages(chatId);
      
      setCurrentChatId(chatId);
      setMessages(chatMessages);
    } catch (error) {
      console.error("Error loading chat session:", error);
      toast.error("Failed to load chat session");
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewChat = () => {
    setCurrentChatId(null);
    setMessages([]);
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  return (
    <div className="min-h-screen bg-background py-8 px-4 md:px-8">
      <div className="mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Document Chatbot</h1>
          <p className="text-muted-foreground mt-2">
            Upload PDF documents and ask questions about their content
          </p>
        </div>

        <div className={`grid ${isMobile ? 'grid-cols-1 gap-6' : 'grid-cols-12 gap-8'}`}>
          {/* Documents Section - Only visible when not in fullscreen mode */}
          {!isFullscreen && (
            <div className={isMobile ? '' : 'col-span-3'}>
              <Card className="h-full">
                <CardHeader className="pb-3">
                  <CardTitle>Documents</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <DocumentUploader 
                    onDocumentsUploaded={handleDocumentsUploaded}
                    isProcessing={isProcessingUpload}
                    setIsProcessing={setIsProcessingUpload}
                  />
                  {isLoading ? (
                    <div className="flex justify-center py-8">
                      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
                    </div>
                  ) : (
                    <DocumentList 
                      documents={documents}
                      onRemoveDocument={handleRemoveDocument}
                    />
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Chat Section - Takes full width in fullscreen mode */}
          <div className={isMobile ? '' : `col-span-${isFullscreen ? '12' : '9'}`}>
            <Card className="h-full">
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle>Chat</CardTitle>
                <div className="flex items-center gap-2">
                  {/* Chat History Flyout Trigger */}
                  <Sheet>
                    <SheetTrigger asChild>
                      <Button variant="outline" size="sm">
                        Chat History
                      </Button>
                    </SheetTrigger>
                    <SheetContent side="right" className="w-[400px] sm:w-[540px]">
                      <div className="h-full pt-6">
                        <ChatHistory
                          onSelectChat={handleSelectChat}
                          onNewChat={handleNewChat}
                          currentChatId={currentChatId}
                        />
                      </div>
                    </SheetContent>
                  </Sheet>
                  
                  {/* Fullscreen Toggle Button */}
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={toggleFullscreen} 
                    title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
                  >
                    <Maximize className={isFullscreen ? "rotate-45" : ""} />
                  </Button>
                </div>
              </CardHeader>
              <Separator />
              <CardContent className="p-0">
                <div className="h-[600px] p-4">
                  <ChatInterface
                    messages={messages}
                    onSendMessage={handleSendMessage}
                    isWaitingForResponse={isWaitingForResponse}
                    onToggleChatHistory={() => {}}
                    showChatHistoryButton={false}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;

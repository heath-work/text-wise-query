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

const Index = () => {
  const [documents, setDocuments] = useState<DocumentFile[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isProcessingUpload, setIsProcessingUpload] = useState(false);
  const [isWaitingForResponse, setIsWaitingForResponse] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showChatHistory, setShowChatHistory] = useState(!useIsMobile());
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

  return (
    <div className="min-h-screen bg-background py-8 px-4 md:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Document Chatbot</h1>
          <p className="text-muted-foreground mt-2">
            Upload PDF documents and ask questions about their content
          </p>
        </div>

        <div className={`grid ${isMobile ? 'grid-cols-1 gap-6' : 'grid-cols-12 gap-8'}`}>
          {/* Documents Section - 25% width */}
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

          {/* Chat History Section - 25% width */}
          {showChatHistory && (
            <div className={isMobile ? '' : 'col-span-3'}>
              <Card className="h-full">
                <CardHeader className="pb-3">
                  <CardTitle>Chat History</CardTitle>
                </CardHeader>
                <CardContent>
                  <ChatHistory 
                    onSelectChat={handleSelectChat}
                    onNewChat={handleNewChat}
                    currentChatId={currentChatId}
                  />
                </CardContent>
              </Card>
            </div>
          )}

          {/* Chat Section - 50% width (or more if chat history is hidden) */}
          <div className={isMobile ? '' : `col-span-${showChatHistory ? '6' : '9'}`}>
            <Card className="h-full">
              <CardHeader className="pb-3">
                <CardTitle>Chat</CardTitle>
              </CardHeader>
              <Separator />
              <CardContent className="p-0">
                <div className="h-[600px] p-4">
                  <ChatInterface
                    messages={messages}
                    onSendMessage={handleSendMessage}
                    isWaitingForResponse={isWaitingForResponse}
                    onToggleChatHistory={() => setShowChatHistory(!showChatHistory)}
                    showChatHistoryButton={isMobile}
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

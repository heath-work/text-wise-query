
import React, { useState } from "react";
import { DocumentFile } from "@/utils/pdfUtils";
import { ChatMessage, generateResponse } from "@/utils/chatUtils";
import DocumentUploader from "@/components/DocumentUploader";
import DocumentList from "@/components/DocumentList";
import ChatInterface from "@/components/ChatInterface";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useIsMobile } from "@/hooks/use-mobile";

const Index = () => {
  const [documents, setDocuments] = useState<DocumentFile[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isProcessingUpload, setIsProcessingUpload] = useState(false);
  const [isWaitingForResponse, setIsWaitingForResponse] = useState(false);
  const isMobile = useIsMobile();

  const handleDocumentsUploaded = (newDocuments: DocumentFile[]) => {
    setDocuments((prevDocuments) => [...prevDocuments, ...newDocuments]);
  };

  const handleRemoveDocument = (id: string) => {
    setDocuments((prevDocuments) => prevDocuments.filter((doc) => doc.id !== id));
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
      // Generate bot response
      const response = await generateResponse(text, documents);
      
      // Add bot message
      const botMessage: ChatMessage = {
        id: Math.random().toString(36).substr(2, 9),
        text: response,
        sender: "bot",
        timestamp: Date.now(),
      };
      
      setMessages((prev) => [...prev, botMessage]);
    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setIsWaitingForResponse(false);
    }
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
          {/* Documents Section */}
          <div className={isMobile ? '' : 'col-span-4'}>
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
                <DocumentList 
                  documents={documents}
                  onRemoveDocument={handleRemoveDocument}
                />
              </CardContent>
            </Card>
          </div>

          {/* Chat Section */}
          <div className={isMobile ? '' : 'col-span-8'}>
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

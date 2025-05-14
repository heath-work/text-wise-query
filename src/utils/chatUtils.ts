
import { toast } from "sonner";
import { DocumentFile } from "./pdfUtils";
import { supabase } from "@/integrations/supabase/client";

export interface ChatMessage {
  id: string;
  text: string;
  sender: "user" | "bot";
  timestamp: number;
  sourceInfo?: {
    sourceDocuments: string[];
    pageNumber?: string;
    sectionInfo?: string;
    paragraphInfo?: string;
  };
}

// Generate a response using OpenAI via Supabase Edge Function
export const generateResponse = async (
  question: string,
  documents: DocumentFile[]
): Promise<ChatMessage> => {
  if (documents.length === 0) {
    return {
      id: Math.random().toString(36).substr(2, 9),
      text: "Please upload some PDF documents first so I can answer your questions.",
      sender: "bot",
      timestamp: Date.now()
    };
  }
  
  try {
    // Debug: Log documents being sent
    console.log(`Sending ${documents.length} documents to AI:`, 
      documents.map(doc => ({ id: doc.id, name: doc.name, contentLength: doc.content.length })));
    
    // Collect document IDs
    const documentIds = documents.map(doc => doc.id);
    
    // Call the Supabase Edge Function
    const { data, error } = await supabase.functions.invoke('generate-ai-response', {
      body: { question, documentIds }
    });

    if (error) {
      console.error("Error calling AI function:", error);
      
      // Check if there's a more detailed error message
      const errorMessage = error.message || "Unknown error";
      
      // Handle quota exceeded case
      if (errorMessage.includes("quota") || errorMessage.includes("429") || 
          errorMessage.includes("insufficient_quota")) {
        toast.error("OpenAI API quota exceeded. Please check your billing details.");
        return {
          id: Math.random().toString(36).substr(2, 9),
          text: "I'm sorry, but your OpenAI API quota has been exceeded. Please check your OpenAI account billing details at https://platform.openai.com/account/billing.",
          sender: "bot",
          timestamp: Date.now()
        };
      }
      
      // Handle missing API key
      if (errorMessage.includes("OpenAI API key is not configured")) {
        toast.error("OpenAI API key is not configured.");
        return {
          id: Math.random().toString(36).substr(2, 9),
          text: "The OpenAI API key is not configured. Please add your OpenAI API key to continue using this feature.",
          sender: "bot",
          timestamp: Date.now()
        };
      }
      
      toast.error("Error connecting to AI service. Please try again.");
      return {
        id: Math.random().toString(36).substr(2, 9),
        text: `I'm having trouble connecting to the AI service. Error: ${errorMessage}. Please try again in a moment.`,
        sender: "bot",
        timestamp: Date.now()
      };
    }

    if (!data) {
      toast.error("No response received from AI service");
      return {
        id: Math.random().toString(36).substr(2, 9),
        text: "No response received from the AI service. Please try again.",
        sender: "bot",
        timestamp: Date.now()
      };
    }
    
    if (data.error) {
      console.error("AI service returned an error:", data.error);
      
      // Handle quota exceeded case
      if (data.error.includes("quota") || data.error.includes("insufficient_quota")) {
        toast.error("OpenAI API quota exceeded. Please check your billing details.");
        return {
          id: Math.random().toString(36).substr(2, 9),
          text: "I'm sorry, but your OpenAI API quota has been exceeded. Please check your OpenAI account billing details at https://platform.openai.com/account/billing.",
          sender: "bot",
          timestamp: Date.now()
        };
      }
      
      toast.error(`AI service error: ${data.error}`);
      return {
        id: Math.random().toString(36).substr(2, 9),
        text: `I encountered an error while processing your question: ${data.error}. ${data.details || ''}`,
        sender: "bot",
        timestamp: Date.now()
      };
    }
    
    // Check if we received the expected response format
    if (!data.text) {
      toast.error("Invalid response format from AI service");
      return {
        id: Math.random().toString(36).substr(2, 9),
        text: "I received an invalid response format. Please try again.",
        sender: "bot",
        timestamp: Date.now()
      };
    }
    
    // Create a chat message with source information
    return {
      id: Math.random().toString(36).substr(2, 9),
      text: data.text,
      sender: "bot",
      timestamp: Date.now(),
      sourceInfo: {
        sourceDocuments: Array.isArray(data.sourceDocuments) ? data.sourceDocuments : [],
        pageNumber: data.pageNumber || undefined,
        sectionInfo: data.sectionInfo || undefined,
        paragraphInfo: data.paragraphInfo || undefined
      }
    };
    
  } catch (error) {
    console.error("Error generating response:", error);
    toast.error("Failed to generate a response. Please try again.");
    return {
      id: Math.random().toString(36).substr(2, 9),
      text: "I'm sorry, but I couldn't generate a response at this time. Please try again in a few moments.",
      sender: "bot",
      timestamp: Date.now()
    };
  }
};

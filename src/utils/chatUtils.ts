
import { toast } from "sonner";
import { DocumentFile } from "./pdfUtils";
import { supabase } from "@/integrations/supabase/client";

export interface ChatMessage {
  id: string;
  text: string;
  sender: "user" | "bot";
  timestamp: number;
}

// Generate a response using OpenAI via Supabase Edge Function
export const generateResponse = async (
  question: string,
  documents: DocumentFile[]
): Promise<string> => {
  if (documents.length === 0) {
    return "Please upload some PDF documents first so I can answer your questions.";
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
        return "I'm sorry, but your OpenAI API quota has been exceeded. Please check your OpenAI account billing details at https://platform.openai.com/account/billing.";
      }
      
      // Handle missing API key
      if (errorMessage.includes("OpenAI API key is not configured")) {
        toast.error("OpenAI API key is not configured.");
        return "The OpenAI API key is not configured. Please add your OpenAI API key to continue using this feature.";
      }
      
      toast.error("Error connecting to AI service. Please try again.");
      return `I'm having trouble connecting to the AI service. Error: ${errorMessage}. Please try again in a moment.`;
    }

    if (!data) {
      toast.error("No response received from AI service");
      return "No response received from the AI service. Please try again.";
    }
    
    if (data.error) {
      console.error("AI service returned an error:", data.error);
      
      // Handle quota exceeded case
      if (data.error.includes("quota") || data.error.includes("insufficient_quota")) {
        toast.error("OpenAI API quota exceeded. Please check your billing details.");
        return "I'm sorry, but your OpenAI API quota has been exceeded. Please check your OpenAI account billing details at https://platform.openai.com/account/billing.";
      }
      
      toast.error(`AI service error: ${data.error}`);
      return `I encountered an error while processing your question: ${data.error}. ${data.details || ''}`;
    }
    
    if (!data.text) {
      toast.error("Invalid response format from AI service");
      return "I received an invalid response format. Please try again.";
    }
    
    return data.text;
    
  } catch (error) {
    console.error("Error generating response:", error);
    toast.error("Failed to generate a response. Please try again.");
    return "I'm sorry, but I couldn't generate a response at this time. Please try again in a few moments.";
  }
};

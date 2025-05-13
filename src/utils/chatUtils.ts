
import { toast } from "sonner";
import { DocumentFile } from "./pdfUtils";
import { supabase } from "@/integrations/supabase/client";

export interface ChatMessage {
  id: string;
  text: string;
  sender: "user" | "bot";
  timestamp: number;
}

// Generate a response using the Google AI API via Supabase Edge Function
export const generateResponse = async (
  question: string,
  documents: DocumentFile[]
): Promise<string> => {
  if (documents.length === 0) {
    return "Please upload some PDF documents first so I can answer your questions.";
  }
  
  try {
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
      if (errorMessage.includes("rate limit")) {
        toast.error("AI service rate limit exceeded. Please try again later.");
        return "I've hit my rate limit at the moment. Please try again in a few minutes.";
      }
      
      throw new Error(errorMessage);
    }

    if (!data) {
      throw new Error("No response received from AI service");
    }
    
    if (data.error) {
      console.error("AI service returned an error:", data.error);
      toast.error(`AI service error: ${data.error}`);
      return `I encountered an error while processing your question: ${data.error}. Please try again or rephrase your question.`;
    }
    
    if (!data.text) {
      throw new Error("No text field in response from AI service");
    }
    
    return data.text;
    
  } catch (error) {
    console.error("Error generating response:", error);
    toast.error("Failed to generate a response. Please try again.");
    return "I'm sorry, but I couldn't generate a response at this time. The AI service might be experiencing high traffic or rate limiting. Please try again in a few minutes.";
  }
};

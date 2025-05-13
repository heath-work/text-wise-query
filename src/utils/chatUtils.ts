
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
      throw new Error(error.message);
    }

    if (!data || !data.text) {
      throw new Error("No response received from AI service");
    }
    
    return data.text;
    
  } catch (error) {
    console.error("Error generating response:", error);
    toast.error("Failed to generate a response. Please try again.");
    return "I'm sorry, but I couldn't generate a response at this time. Please try again later.";
  }
};

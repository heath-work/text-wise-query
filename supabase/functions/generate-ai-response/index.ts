
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { supabase } from "../_shared/supabase-client.ts";

// Use an environment variable for the Ollama API URL with a default value
const OLLAMA_API_URL = Deno.env.get("OLLAMA_API_URL") || "https://api.ollama.ai/v1";
const MODEL_NAME = "llama3" // Default model

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { question, documentIds } = await req.json();
    
    if (!question) {
      throw new Error("Question is required");
    }

    if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
      throw new Error("At least one document ID is required");
    }

    console.log(`Received question: "${question}" for documents:`, documentIds);

    // Fetch documents from Supabase
    const { data: documents, error } = await supabase
      .from('documents')
      .select('name, content')
      .in('id', documentIds);

    if (error) {
      throw new Error(`Failed to fetch documents: ${error.message}`);
    }

    if (!documents || documents.length === 0) {
      throw new Error("No documents found with the provided IDs");
    }

    // Prepare context from documents
    const documentContext = documents.map(doc => 
      `Document: ${doc.name}\nContent: ${doc.content}`
    ).join("\n\n");

    // Prepare prompt for Ollama
    const prompt = `
You are a helpful assistant that answers questions based on the content of uploaded documents.
Please analyze the following documents and answer the question.

DOCUMENTS:
${documentContext}

QUESTION:
${question}

Please provide a comprehensive but concise answer based solely on the information in these documents. 
If the answer cannot be found in the documents, please state that clearly.
`;

    console.log("Sending request to Ollama API...");

    try {
      // Call Ollama API
      const response = await fetch(`${OLLAMA_API_URL}/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: MODEL_NAME,
          prompt: prompt,
          stream: false,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Ollama API error:", errorText);
        
        // Generate a simple fallback response if there's an issue with Ollama
        let fallbackResponse = "I apologize, but I'm having trouble processing your request. ";
        
        // Add some basic document information as a fallback
        fallbackResponse += "Here's a summary of the documents you've provided: ";
        
        documents.forEach(doc => {
          fallbackResponse += `\n\n${doc.name}: `;
          const contentPreview = doc.content.substring(0, 200);
          fallbackResponse += `${contentPreview}... (${doc.content.length} characters total)`;
        });
        
        return new Response(
          JSON.stringify({ text: fallbackResponse }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const data = await response.json();
      console.log("Received response from Ollama API");

      // Extract the generated text from the response
      const generatedText = data.response || 
        "Sorry, I couldn't generate a response based on the documents.";

      return new Response(
        JSON.stringify({ text: generatedText }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (error) {
      console.error("Error calling Ollama API:", error);
      
      // Provide a helpful error message
      return new Response(
        JSON.stringify({ 
          error: "Failed to connect to Ollama API", 
          details: "Please ensure Ollama is running and accessible.",
          message: error.message 
        }),
        { 
          status: 503, 
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }
  } catch (error) {
    console.error("Error processing request:", error);
    return new Response(
      JSON.stringify({ error: error.message, details: "Please check the Edge Function logs for more information." }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});

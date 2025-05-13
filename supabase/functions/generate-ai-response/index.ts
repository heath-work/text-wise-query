
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { supabase } from "../_shared/supabase-client.ts";

const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");
const API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent";

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

    // Prepare prompt for Google AI
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

    console.log("Sending request to Google AI API...");

    // Call Google AI API
    const response = await fetch(`${API_URL}?key=${GOOGLE_AI_API_KEY}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.2,
          topP: 0.8,
          topK: 40,
          maxOutputTokens: 2048,
        },
        safetySettings: [
          {
            category: "HARM_CATEGORY_HARASSMENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_HATE_SPEECH",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_DANGEROUS_CONTENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          }
        ]
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Google AI API error:", errorText);
      
      // Check if it's a rate limit error
      if (response.status === 429) {
        let fallbackResponse = "I apologize, but I've hit a rate limit with the AI service. ";
        
        // Generate a simple fallback response using the document content
        fallbackResponse += "Based on the documents you've uploaded, here's a summary: ";
        
        // Add simple document information
        documents.forEach(doc => {
          fallbackResponse += `\n\n${doc.name}: `;
          
          // Get a short preview of the content
          const contentPreview = doc.content.substring(0, 200);
          fallbackResponse += `${contentPreview}... (${doc.content.length} characters total)`;
        });
        
        fallbackResponse += "\n\nPlease try again in a few minutes when the rate limit has reset.";
        
        return new Response(
          JSON.stringify({ text: fallbackResponse }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`Google AI API error: ${response.status}`);
    }

    const data = await response.json();
    console.log("Received response from Google AI API");

    // Extract the generated text from the response
    const generatedText = data.candidates[0]?.content?.parts[0]?.text || 
      "Sorry, I couldn't generate a response based on the documents.";

    return new Response(
      JSON.stringify({ text: generatedText }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
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

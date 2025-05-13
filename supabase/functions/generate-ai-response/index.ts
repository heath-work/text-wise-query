
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
      const errorData = await response.text();
      console.error("Google AI API error:", errorData);
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
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});

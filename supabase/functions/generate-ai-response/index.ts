
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { supabase } from "../_shared/supabase-client.ts";

// Use an environment variable for the OpenAI API key
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const MODEL_NAME = "gpt-4o-mini"; // Default model - fast and affordable

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
      .select('id, name, content')
      .in('id', documentIds);

    if (error) {
      throw new Error(`Failed to fetch documents: ${error.message}`);
    }

    if (!documents || documents.length === 0) {
      throw new Error("No documents found with the provided IDs");
    }
    
    // Debug: Log document names and content length to verify data
    documents.forEach(doc => {
      console.log(`Document ${doc.id} (${doc.name}): Content length = ${doc.content ? doc.content.length : 0} characters`);
      if (!doc.content || doc.content.length < 10) {
        console.warn(`Warning: Document ${doc.name} has little or no content!`);
      }
    });

    // Prepare context from documents
    const documentContext = documents.map(doc => 
      `Document: ${doc.name}\nContent: ${doc.content || "No content available"}`
    ).join("\n\n");

    // Check if we have the OpenAI API key
    if (!OPENAI_API_KEY) {
      throw new Error("OpenAI API key is not configured");
    }

    console.log("Sending request to OpenAI API...");

    try {
      // Call OpenAI API with improved error handling
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: MODEL_NAME,
          messages: [
            {
              role: "system", 
              content: "You are a helpful assistant that answers questions based on the content of uploaded documents. If you detect that document content is missing or empty, indicate that there might be an issue with text extraction from the PDF."
            },
            {
              role: "user",
              content: `Please analyze the following documents and answer this question: "${question}"\n\nDOCUMENTS:\n${documentContext}\n\nProvide a comprehensive but concise answer based solely on the information in these documents. If the answer cannot be found in the documents, please state that clearly.`
            }
          ],
          temperature: 0.3, // Lower temperature for more factual responses
          max_tokens: 1000  // Reasonable length limit
        })
      });

      // Attempt to parse the error response, even if not valid JSON
      let errorData = {};
      if (!response.ok) {
        try {
          errorData = await response.json();
        } catch (e) {
          console.error("Could not parse error response as JSON");
        }
        
        console.error("OpenAI API error details:", JSON.stringify(errorData, null, 2));
        
        // Handle quota exceeded specifically
        if (response.status === 429 || 
           (errorData?.error?.type === "insufficient_quota") ||
           (errorData?.error?.message && errorData.error.message.includes("quota"))) {
          return new Response(
            JSON.stringify({ 
              error: "OpenAI API quota exceeded", 
              details: "Your OpenAI API key has insufficient quota. Please check your billing details at https://platform.openai.com/account/billing."
            }),
            { 
              status: 429, 
              headers: { ...corsHeaders, "Content-Type": "application/json" }
            }
          );
        }
        
        // Handle other API errors
        return new Response(
          JSON.stringify({
            error: `OpenAI API error: ${response.status} ${response.statusText}`,
            details: errorData?.error?.message || "Unknown error"
          }),
          {
            status: response.status,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          }
        );
      }

      const data = await response.json();
      console.log("Received response from OpenAI API");

      // Extract the generated text from the response
      const generatedText = data.choices[0].message.content || 
        "Sorry, I couldn't generate a response based on the documents.";

      return new Response(
        JSON.stringify({ text: generatedText }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (error) {
      console.error("Error calling OpenAI API:", error);
      
      // Provide a helpful error message
      return new Response(
        JSON.stringify({ 
          error: "Failed to connect to OpenAI API", 
          details: error.message,
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
      JSON.stringify({ 
        error: error.message, 
        details: "Please check the Edge Function logs for more information." 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});

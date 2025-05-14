
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
      // Call OpenAI API with improved error handling and the new system prompt
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
              content: `You are a helpful assistant that answers questions based on the content of uploaded insurance policy documents. 

Follow these rules strictly:
1. Answer in a concise and informative manner.
2. Use ONLY information that is directly stated in the PDS documents provided.
3. Do NOT give personal opinions, advice, or interpretations beyond what is written in the documents.
4. If a question cannot be answered solely from the PDS documents, respond with: "I couldn't find that information in the Product Disclosure Statements provided."
5. Explain things as if speaking to someone with a 6th-grade reading level.
6. Be clear, friendly, and concise.
7. Avoid technical jargon or legal language unless it appears directly in the documents—if so, explain it in plain terms.

For each response, you MUST include:
- The source document(s) used to formulate the answer
- Page number (if available)
- Section info (name or number, if available)
- Paragraph or key sentence that supports your answer (if available)

Your response should be formatted as a JSON object with these fields:
{
  "text": "Your answer here following all the rules above",
  "sourceDocuments": ["document name(s)"],
  "pageNumber": "page number or empty string if not available",
  "sectionInfo": "section info or empty string if not available",
  "paragraphInfo": "supporting paragraph or key sentence or empty string if not available"
}

If the information is from multiple documents, cite the primary one for details or the first where relevant information is found.`
            },
            {
              role: "user",
              content: `Please analyze the following documents and answer this question: "${question}"\n\nDOCUMENTS:\n${documentContext}\n\nProvide a comprehensive but concise answer based solely on the information in these documents. Remember to format your response as specified with sourceDocuments, pageNumber, sectionInfo, and paragraphInfo.`
            }
          ],
          temperature: 0.3, // Lower temperature for more factual responses
          max_tokens: 1000,  // Reasonable length limit
          response_format: { type: "json_object" } // Ensure response is formatted as JSON
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

      // Parse the JSON response
      let parsedResponse;
      try {
        // The response should already be a JSON object with the proper structure
        parsedResponse = data.choices[0].message.content;
        
        // Make sure we have a text field at minimum
        if (typeof parsedResponse === 'string') {
          try {
            parsedResponse = JSON.parse(parsedResponse);
          } catch (e) {
            console.error("Error parsing JSON string from OpenAI response:", e);
            parsedResponse = { text: parsedResponse };
          }
        }
        
        if (!parsedResponse.text) {
          parsedResponse.text = "I couldn't generate a properly formatted response. Please try again.";
        }
        
        // Ensure all required fields exist
        parsedResponse.sourceDocuments = parsedResponse.sourceDocuments || [];
        parsedResponse.pageNumber = parsedResponse.pageNumber || "";
        parsedResponse.sectionInfo = parsedResponse.sectionInfo || "";
        parsedResponse.paragraphInfo = parsedResponse.paragraphInfo || "";
        
      } catch (e) {
        console.error("Error processing OpenAI response:", e);
        parsedResponse = {
          text: "Sorry, I encountered an error processing the response. Please try again.",
          sourceDocuments: [],
          pageNumber: "",
          sectionInfo: "",
          paragraphInfo: ""
        };
      }

      return new Response(
        JSON.stringify(parsedResponse),
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


import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Function to proxy PDF requests to bypass CORS restrictions
serve(async (req) => {
  try {
    // Parse request body to get URL
    const { url } = await req.json();
    
    if (!url || typeof url !== 'string') {
      return new Response(
        JSON.stringify({ error: "Invalid URL provided" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log(`Proxying PDF request for: ${url}`);

    // Make the request to fetch the PDF
    const response = await fetch(url, {
      headers: {
        // Some sites may require a User-Agent header
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
      }
    });

    if (!response.ok) {
      return new Response(
        JSON.stringify({ 
          error: `Failed to fetch PDF: ${response.status} ${response.statusText}`,
          status: response.status
        }),
        { status: response.status, headers: { "Content-Type": "application/json" } }
      );
    }

    // Get the content type
    const contentType = response.headers.get("content-type");
    
    // If content type indicates it's not a PDF, return an error
    if (contentType && !contentType.includes("application/pdf") && !contentType.includes("octet-stream")) {
      return new Response(
        JSON.stringify({ 
          error: "The URL did not return a PDF file",
          contentType: contentType
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Get the PDF data as an array buffer
    const pdfData = await response.arrayBuffer();

    // Return the PDF data with appropriate headers
    return new Response(pdfData, {
      status: 200,
      headers: {
        "Content-Type": contentType || "application/pdf",
        "Content-Length": pdfData.byteLength.toString(),
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error("Error in proxy-pdf function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Unknown error occurred" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});


import { toast } from "sonner";
import { v4 as uuidv4 } from 'uuid';
import * as pdfjs from 'pdfjs-dist';
import { supabase } from "@/integrations/supabase/client";

// Set the worker source for PDF.js
const pdfjsWorkerSrc = `//unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js`;
pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorkerSrc;

export interface DocumentFile {
  id: string;
  name: string;
  size: number;
  type: string;
  content: string;
  lastModified: number;
}

// Check if the file is a PDF
export const isPdfFile = (file: File): boolean => {
  return file.type === "application/pdf";
};

// Convert file size to readable format
export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return bytes + " B";
  else if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  else return (bytes / (1024 * 1024)).toFixed(1) + " MB";
};

// Extract text from PDF file using PDF.js
export const extractTextFromPdf = async (arrayBuffer: ArrayBuffer): Promise<string> => {
  try {
    console.log("Starting PDF text extraction, buffer size:", arrayBuffer.byteLength);
    
    // Load the PDF document
    const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    
    console.log(`PDF loaded successfully. Pages: ${pdf.numPages}`);
    
    // Extract text from each page
    const numPages = pdf.numPages;
    let fullText = '';
    
    for (let i = 1; i <= numPages; i++) {
      console.log(`Processing page ${i} of ${numPages}`);
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      
      if (!textContent || !textContent.items || textContent.items.length === 0) {
        console.warn(`Warning: No text content found on page ${i}`);
      } else {
        console.log(`Page ${i}: Found ${textContent.items.length} text items`);
      }
      
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      
      fullText += pageText + '\n\n'; // Add line breaks between pages
    }
    
    const extractedText = fullText.trim();
    console.log(`Text extraction complete. Extracted ${extractedText.length} characters`);
    
    if (extractedText.length < 100) {
      console.warn("Warning: Very little text was extracted from the PDF.");
    }
    
    return extractedText;
  } catch (error) {
    console.error('Error extracting text from PDF:', error);
    throw new Error(`Error extracting text from PDF: ${error.message}`);
  }
};

// Process PDF file and extract text content
export const processPdfFile = (file: File): Promise<DocumentFile> => {
  return new Promise((resolve, reject) => {
    console.log(`Processing PDF file: ${file.name}, size: ${file.size} bytes`);
    const reader = new FileReader();
    
    reader.onload = async () => {
      try {
        const arrayBuffer = reader.result as ArrayBuffer;
        
        // Show extraction progress toast
        toast.info(`Extracting text from ${file.name}...`);
        
        // Extract text from PDF
        const extractedText = await extractTextFromPdf(arrayBuffer);
        
        if (extractedText.length < 100) {
          toast.warning(`Very little text was extracted from ${file.name}. The document might be scanned or have restricted permissions.`);
        }
        
        const documentFile: DocumentFile = {
          id: uuidv4(),
          name: file.name,
          size: file.size,
          type: file.type,
          content: extractedText,
          lastModified: file.lastModified
        };
        
        console.log(`Successfully processed ${file.name}: extracted ${extractedText.length} characters`);
        resolve(documentFile);
      } catch (error) {
        console.error('Error processing PDF file:', error);
        reject(new Error(`Error extracting text from ${file.name}: ${error.message}`));
      }
    };
    
    reader.onerror = () => {
      console.error(`Error reading file: ${file.name}`);
      reject(new Error(`Error reading file: ${file.name}`));
    };
    
    // Read the file as ArrayBuffer
    reader.readAsArrayBuffer(file);
  });
};

// Fetch a PDF from a URL and process it
export const fetchPdfFromUrl = async (url: string, fileName: string): Promise<DocumentFile | null> => {
  try {
    console.log(`Fetching PDF from URL: ${url}`);
    
    toast.info(`Fetching PDF from URL...`);

    // Use the Supabase Edge Function to proxy the request
    const { data, error } = await supabase.functions.invoke("proxy-pdf", {
      body: { url }
    });

    if (error) {
      console.error("Error from proxy function:", error);
      throw new Error(`Failed to fetch PDF: ${error.message}`);
    }

    if (!data) {
      throw new Error("No data received from proxy");
    }

    // Convert Base64 data to ArrayBuffer
    const response = await fetch(`data:application/pdf;base64,${data}`);
    if (!response.ok) {
      throw new Error(`Failed to process PDF data: ${response.status} ${response.statusText}`);
    }
    
    // Convert response to array buffer
    const arrayBuffer = await response.arrayBuffer();
    console.log(`PDF fetched successfully. Size: ${arrayBuffer.byteLength} bytes`);
    
    // Show extraction progress toast
    toast.info(`Extracting text from ${fileName}...`);
    
    // Extract text from PDF
    const extractedText = await extractTextFromPdf(arrayBuffer);
    
    const documentFile: DocumentFile = {
      id: uuidv4(),
      name: fileName,
      size: arrayBuffer.byteLength,
      type: 'application/pdf',
      content: extractedText,
      lastModified: Date.now()
    };
    
    console.log(`Successfully processed ${fileName}: extracted ${extractedText.length} characters`);
    return documentFile;
  } catch (error) {
    console.error('Error fetching PDF from URL:', error);
    toast.error(`Failed to fetch PDF from URL: ${error.message}`);
    return null;
  }
};

// Process multiple PDF files
export const processMultiplePdfFiles = async (
  files: File[]
): Promise<DocumentFile[]> => {
  try {
    const pdfFiles = files.filter(isPdfFile);
    
    if (pdfFiles.length === 0) {
      toast.error("No valid PDF files were found.");
      return [];
    }
    
    console.log(`Processing ${pdfFiles.length} PDF files...`);
    
    const processedFiles = await Promise.all(
      pdfFiles.map(file => {
        return processPdfFile(file)
          .catch(error => {
            toast.error(`Error processing ${file.name}: ${error.message}`);
            console.error(`Error processing ${file.name}:`, error);
            return null;
          });
      })
    );
    
    // Filter out any null results (failures)
    const successfullyProcessedFiles = processedFiles.filter(file => file !== null) as DocumentFile[];
    
    console.log(`Successfully processed ${successfullyProcessedFiles.length} of ${pdfFiles.length} files`);
    
    return successfullyProcessedFiles;
  } catch (error) {
    toast.error("Error processing PDF files.");
    console.error("Error processing PDF files:", error);
    return [];
  }
};

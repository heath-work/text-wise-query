
import { toast } from "sonner";
import { v4 as uuidv4 } from 'uuid';
import * as pdfjs from 'pdfjs-dist';

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
    // Load the PDF document
    const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    
    // Extract text from each page
    const numPages = pdf.numPages;
    let fullText = '';
    
    for (let i = 1; i <= numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      
      fullText += pageText + '\n\n'; // Add line breaks between pages
    }
    
    return fullText.trim();
  } catch (error) {
    console.error('Error extracting text from PDF:', error);
    throw new Error('Error extracting text from PDF');
  }
};

// Process PDF file and extract text content
export const processPdfFile = (file: File): Promise<DocumentFile> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = async () => {
      try {
        const arrayBuffer = reader.result as ArrayBuffer;
        
        // Show extraction progress toast
        toast.info(`Extracting text from ${file.name}...`);
        
        // Extract text from PDF
        const extractedText = await extractTextFromPdf(arrayBuffer);
        
        const documentFile: DocumentFile = {
          id: uuidv4(),
          name: file.name,
          size: file.size,
          type: file.type,
          content: extractedText,
          lastModified: file.lastModified
        };
        
        resolve(documentFile);
      } catch (error) {
        console.error('Error processing PDF file:', error);
        reject(new Error(`Error extracting text from ${file.name}: ${error.message}`));
      }
    };
    
    reader.onerror = () => {
      reject(new Error(`Error reading file: ${file.name}`));
    };
    
    // Read the file as ArrayBuffer
    reader.readAsArrayBuffer(file);
  });
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
    
    const processedFiles = await Promise.all(
      pdfFiles.map(file => {
        return processPdfFile(file)
          .catch(error => {
            toast.error(`Error processing ${file.name}: ${error.message}`);
            return null;
          });
      })
    );
    
    // Filter out any null results (failures)
    const successfullyProcessedFiles = processedFiles.filter(file => file !== null) as DocumentFile[];
    
    return successfullyProcessedFiles;
  } catch (error) {
    toast.error("Error processing PDF files.");
    console.error("Error processing PDF files:", error);
    return [];
  }
};

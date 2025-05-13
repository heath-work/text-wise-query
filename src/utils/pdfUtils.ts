
import { toast } from "sonner";
import { v4 as uuidv4 } from 'uuid';

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

// Process PDF file and extract text content
export const processPdfFile = (file: File): Promise<DocumentFile> => {
  return new Promise((resolve, reject) => {
    // In a real implementation, we would use a library like pdf.js to extract text
    // For now, we'll simulate text extraction with a placeholder
    
    // Create a file reader
    const reader = new FileReader();
    
    reader.onload = () => {
      // Here we would normally process the PDF and extract text
      // For now, we'll just use a placeholder message
      setTimeout(() => {
        const documentFile: DocumentFile = {
          id: uuidv4(), // Generate a proper UUID
          name: file.name,
          size: file.size,
          type: file.type,
          content: `This is the extracted content from ${file.name}. In a real implementation, this would contain the actual text extracted from the PDF.`,
          lastModified: file.lastModified
        };
        resolve(documentFile);
      }, 1000); // Simulate processing time
    };
    
    reader.onerror = () => {
      reject(new Error(`Error reading file: ${file.name}`));
    };
    
    // Start reading the file as text
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
      pdfFiles.map(file => processPdfFile(file))
    );
    
    return processedFiles;
  } catch (error) {
    toast.error("Error processing PDF files.");
    console.error("Error processing PDF files:", error);
    return [];
  }
};

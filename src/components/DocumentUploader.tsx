
import React, { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Upload, File } from "lucide-react";
import { processMultiplePdfFiles, isPdfFile } from "@/utils/pdfUtils";
import { DocumentFile } from "@/utils/pdfUtils";
import { saveDocumentToSupabase } from "@/utils/supabaseDocumentUtils";

interface DocumentUploaderProps {
  onDocumentsUploaded: (documents: DocumentFile[]) => void;
  isProcessing: boolean;
  setIsProcessing: (isProcessing: boolean) => void;
}

const DocumentUploader: React.FC<DocumentUploaderProps> = ({
  onDocumentsUploaded,
  isProcessing,
  setIsProcessing
}) => {
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const handleFileUpload = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;

      const fileArray = Array.from(files);
      const pdfFiles = fileArray.filter(isPdfFile);

      if (pdfFiles.length === 0) {
        toast.error("Please upload PDF files only.");
        return;
      }

      if (pdfFiles.length !== fileArray.length) {
        toast.warning(`${fileArray.length - pdfFiles.length} non-PDF files were ignored.`);
      }

      try {
        setIsProcessing(true);
        toast.info(`Processing ${pdfFiles.length} PDF file${pdfFiles.length > 1 ? "s" : ""}...`);
        
        const processedDocuments = await processMultiplePdfFiles(pdfFiles);
        
        if (processedDocuments.length > 0) {
          // Save documents to Supabase
          const savePromises = processedDocuments.map(doc => saveDocumentToSupabase(doc));
          const saveResults = await Promise.all(savePromises);
          
          const successCount = saveResults.filter(Boolean).length;
          
          if (successCount > 0) {
            onDocumentsUploaded(processedDocuments);
            toast.success(`Successfully processed and saved ${successCount} document${successCount > 1 ? "s" : ""}.`);
          }
        }
      } catch (error) {
        console.error("Error processing PDF files:", error);
        toast.error("Failed to process PDF files. Please try again.");
      } finally {
        setIsProcessing(false);
      }
    },
    [onDocumentsUploaded, setIsProcessing]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      const { files } = e.dataTransfer;
      handleFileUpload(files);
    },
    [handleFileUpload]
  );

  return (
    <Card
      className={`p-6 border-2 border-dashed transition-all ${
        isDragging ? "border-primary bg-primary/5" : "border-border"
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="flex flex-col items-center justify-center gap-4 py-6">
        <div className="rounded-full bg-primary/10 p-4">
          <Upload size={32} className="text-primary" />
        </div>
        <div className="text-center space-y-2">
          <h3 className="font-semibold text-lg">Upload PDF Documents</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            Drag and drop your PDF files here, or click the button below to select files.
            You can upload multiple PDF files at once.
          </p>
        </div>

        <div className="mt-2">
          <input
            type="file"
            id="file-upload"
            multiple
            accept="application/pdf"
            className="hidden"
            onChange={(e) => handleFileUpload(e.target.files)}
          />
          <label htmlFor="file-upload">
            <Button
              disabled={isProcessing}
              className="cursor-pointer"
              onClick={() => document.getElementById("file-upload")?.click()}
            >
              {isProcessing ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                  Processing...
                </>
              ) : (
                <>
                  <File size={16} className="mr-2" />
                  Select PDF Files
                </>
              )}
            </Button>
          </label>
        </div>
      </div>
    </Card>
  );
};

export default DocumentUploader;

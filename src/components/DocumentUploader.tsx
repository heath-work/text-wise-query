
import React, { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Upload, File, LinkIcon } from "lucide-react";
import { processMultiplePdfFiles, isPdfFile, fetchPdfFromUrl } from "@/utils/pdfUtils";
import { DocumentFile } from "@/utils/pdfUtils";
import { saveDocumentToSupabase } from "@/utils/supabaseDocumentUtils";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

interface DocumentUploaderProps {
  onDocumentsUploaded: (documents: DocumentFile[]) => void;
  isProcessing: boolean;
  setIsProcessing: (isProcessing: boolean) => void;
}

// Create schema for URL validation
const urlSchema = z.object({
  url: z.string().url("Please enter a valid URL").refine(url => url.endsWith('.pdf'), {
    message: "URL must point to a PDF file (ending with .pdf)"
  })
});

const DocumentUploader: React.FC<DocumentUploaderProps> = ({
  onDocumentsUploaded,
  isProcessing,
  setIsProcessing
}) => {
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isUrlMode, setIsUrlMode] = useState<boolean>(false);

  const form = useForm<z.infer<typeof urlSchema>>({
    resolver: zodResolver(urlSchema),
    defaultValues: {
      url: ""
    }
  });

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
          // Debug: Log extracted text length
          processedDocuments.forEach(doc => {
            console.log(`Processed ${doc.name}: ${doc.content.length} characters extracted`);
            if (doc.content.length < 100) {
              console.warn(`Warning: Very little text extracted from ${doc.name}`);
            }
          });
          
          // Save documents to Supabase
          const savePromises = processedDocuments.map(doc => saveDocumentToSupabase(doc));
          
          try {
            const saveResults = await Promise.all(savePromises);
            const successCount = saveResults.filter(Boolean).length;
            
            if (successCount > 0) {
              onDocumentsUploaded(processedDocuments);
              toast.success(`Successfully processed and saved ${successCount} document${successCount > 1 ? "s" : ""}.`);
            } else {
              toast.error("Failed to save documents to the database.");
            }
          } catch (saveError) {
            console.error("Error saving documents to Supabase:", saveError);
            toast.error("Failed to save documents to the database.");
          }
        } else {
          toast.error("No documents were successfully processed.");
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

  const handleUrlSubmit = async (data: z.infer<typeof urlSchema>) => {
    try {
      setIsProcessing(true);
      toast.info(`Fetching PDF from URL: ${data.url}...`);
      
      // Extract filename from URL
      const urlParts = data.url.split('/');
      const fileName = urlParts[urlParts.length - 1];
      
      // Fetch PDF from URL
      const pdfDocument = await fetchPdfFromUrl(data.url, fileName);
      
      if (pdfDocument) {
        console.log(`Processed ${pdfDocument.name}: ${pdfDocument.content.length} characters extracted`);
        
        if (pdfDocument.content.length < 100) {
          console.warn(`Warning: Very little text extracted from ${pdfDocument.name}`);
          toast.warning(`Limited text extracted from the PDF. The document might be scanned or have restricted permissions.`);
        }
        
        // Save document to Supabase
        const saved = await saveDocumentToSupabase(pdfDocument);
        
        if (saved) {
          onDocumentsUploaded([pdfDocument]);
          toast.success(`Successfully processed and saved ${pdfDocument.name}.`);
          form.reset();
        } else {
          toast.error("Failed to save document to the database.");
        }
      } else {
        toast.error("Failed to process the PDF from URL.");
      }
    } catch (error) {
      console.error("Error fetching PDF from URL:", error);
      toast.error(`Failed to fetch PDF: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

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

  const toggleMode = () => {
    setIsUrlMode(!isUrlMode);
    if (isUrlMode) {
      form.reset();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          onClick={toggleMode}
          variant="outline"
          size="sm"
        >
          {isUrlMode ? "Switch to File Upload" : "Switch to URL"}
        </Button>
      </div>
      
      {isUrlMode ? (
        <Card className="p-6">
          <div className="flex flex-col items-center justify-center gap-4 py-3">
            <div className="rounded-full bg-primary/10 p-4">
              <LinkIcon size={32} className="text-primary" />
            </div>
            <div className="text-center space-y-2">
              <h3 className="font-semibold text-lg">Enter PDF URL</h3>
              <p className="text-sm text-muted-foreground max-w-md">
                Enter the URL of a PDF file to load it directly from the web.
              </p>
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleUrlSubmit)} className="w-full max-w-md">
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="url"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>PDF URL</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="https://example.com/document.pdf" 
                            {...field}
                            disabled={isProcessing}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <Button 
                    type="submit"
                    disabled={isProcessing}
                    className="w-full"
                  >
                    {isProcessing ? (
                      <>
                        <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                        Processing...
                      </>
                    ) : (
                      "Fetch and Process PDF"
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        </Card>
      ) : (
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
      )}
    </div>
  );
};

export default DocumentUploader;

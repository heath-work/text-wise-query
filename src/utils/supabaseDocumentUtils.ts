
import { supabase } from "@/integrations/supabase/client";
import { DocumentFile } from "./pdfUtils";
import { toast } from "sonner";

// Save document to Supabase
export const saveDocumentToSupabase = async (document: DocumentFile): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('documents')
      .insert({
        id: document.id,
        name: document.name,
        size: document.size,
        type: document.type,
        content: document.content,
        last_modified: document.lastModified
      });

    if (error) {
      console.error("Error saving document to Supabase:", error);
      toast.error("Failed to save document to database.");
      return false;
    }

    console.log("Document saved to Supabase successfully:", document.name);
    return true;
  } catch (error) {
    console.error("Error saving document to Supabase:", error);
    toast.error("Failed to save document to database.");
    return false;
  }
};

// Get all documents from Supabase
export const getDocumentsFromSupabase = async (): Promise<DocumentFile[]> => {
  try {
    const { data, error } = await supabase
      .from('documents')
      .select('*');

    if (error) {
      console.error("Error fetching documents from Supabase:", error);
      toast.error("Failed to retrieve documents from database.");
      return [];
    }

    // Convert Supabase data format to DocumentFile format
    const documents: DocumentFile[] = data.map(doc => ({
      id: doc.id,
      name: doc.name,
      size: doc.size,
      type: doc.type,
      content: doc.content,
      lastModified: doc.last_modified
    }));

    console.log("Documents retrieved from Supabase successfully:", documents.length);
    return documents;
  } catch (error) {
    console.error("Error fetching documents from Supabase:", error);
    toast.error("Failed to retrieve documents from database.");
    return [];
  }
};

// Delete document from Supabase
export const deleteDocumentFromSupabase = async (id: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('documents')
      .delete()
      .eq('id', id);

    if (error) {
      console.error("Error deleting document from Supabase:", error);
      toast.error("Failed to delete document from database.");
      return false;
    }

    console.log("Document deleted from Supabase successfully:", id);
    return true;
  } catch (error) {
    console.error("Error deleting document from Supabase:", error);
    toast.error("Failed to delete document from database.");
    return false;
  }
};


import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";
import { ChatMessage } from "./chatUtils";

export interface ChatSession {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  document_ids: string[];
}

// Create a new chat session
export const createChatSession = async (
  documentIds: string[],
  title: string = "New Chat"
): Promise<ChatSession | null> => {
  try {
    const newSession = {
      id: uuidv4(),
      title,
      document_ids: documentIds,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('chat_sessions')
      .insert(newSession)
      .select()
      .single();

    if (error) {
      console.error("Error creating chat session:", error);
      toast.error(`Failed to create chat session: ${error.message}`);
      return null;
    }

    return data as ChatSession;
  } catch (error) {
    console.error("Error creating chat session:", error);
    toast.error("Failed to create chat session");
    return null;
  }
};

// Get all chat sessions
export const getChatSessions = async (): Promise<ChatSession[]> => {
  try {
    const { data, error } = await supabase
      .from('chat_sessions')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) {
      console.error("Error fetching chat sessions:", error);
      toast.error(`Failed to fetch chat sessions: ${error.message}`);
      return [];
    }

    return data as ChatSession[];
  } catch (error) {
    console.error("Error fetching chat sessions:", error);
    toast.error("Failed to fetch chat sessions");
    return [];
  }
};

// Get a specific chat session
export const getChatSession = async (id: string): Promise<ChatSession | null> => {
  try {
    const { data, error } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error(`Error fetching chat session ${id}:`, error);
      toast.error(`Failed to fetch chat session: ${error.message}`);
      return null;
    }

    return data as ChatSession;
  } catch (error) {
    console.error(`Error fetching chat session ${id}:`, error);
    toast.error("Failed to fetch chat session");
    return null;
  }
};

// Delete a chat session
export const deleteChatSession = async (id: string): Promise<boolean> => {
  try {
    // First delete all messages in this chat session
    const { error: messagesError } = await supabase
      .from('chat_messages')
      .delete()
      .eq('chat_id', id);
    
    if (messagesError) {
      console.error(`Error deleting messages for chat ${id}:`, messagesError);
      toast.error(`Failed to delete chat messages: ${messagesError.message}`);
      return false;
    }
    
    // Then delete the chat session
    const { error } = await supabase
      .from('chat_sessions')
      .delete()
      .eq('id', id);

    if (error) {
      console.error(`Error deleting chat session ${id}:`, error);
      toast.error(`Failed to delete chat session: ${error.message}`);
      return false;
    }

    return true;
  } catch (error) {
    console.error(`Error deleting chat session ${id}:`, error);
    toast.error("Failed to delete chat session");
    return false;
  }
};

// Update chat session title
export const updateChatSessionTitle = async (id: string, title: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('chat_sessions')
      .update({ 
        title, 
        updated_at: new Date().toISOString() 
      })
      .eq('id', id);

    if (error) {
      console.error(`Error updating chat session ${id}:`, error);
      toast.error(`Failed to update chat title: ${error.message}`);
      return false;
    }

    return true;
  } catch (error) {
    console.error(`Error updating chat session ${id}:`, error);
    toast.error("Failed to update chat title");
    return false;
  }
};

// Save chat messages to a session
export const saveChatMessages = async (chatId: string, messages: ChatMessage[]): Promise<boolean> => {
  try {
    // First delete existing messages for this chat
    const { error: deleteError } = await supabase
      .from('chat_messages')
      .delete()
      .eq('chat_id', chatId);
    
    if (deleteError) {
      console.error(`Error deleting existing messages for chat ${chatId}:`, deleteError);
      toast.error(`Failed to save chat: ${deleteError.message}`);
      return false;
    }
    
    // Format messages for insertion
    const messagesToInsert = messages.map(msg => ({
      id: msg.id,
      chat_id: chatId,
      text: msg.text,
      sender: msg.sender,
      timestamp: new Date(msg.timestamp).toISOString(),
      source_info: msg.sourceInfo ? {
        sourceDocuments: msg.sourceInfo.sourceDocuments,
        pageNumber: msg.sourceInfo.pageNumber,
        sectionInfo: msg.sourceInfo.sectionInfo, 
        paragraphInfo: msg.sourceInfo.paragraphInfo
      } : null
    }));
    
    // Insert all messages
    const { error: insertError } = await supabase
      .from('chat_messages')
      .insert(messagesToInsert);
      
    if (insertError) {
      console.error(`Error saving messages for chat ${chatId}:`, insertError);
      toast.error(`Failed to save chat: ${insertError.message}`);
      return false;
    }
    
    // Update the chat session's updated_at timestamp
    const { error: updateError } = await supabase
      .from('chat_sessions')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', chatId);
    
    if (updateError) {
      console.error(`Error updating chat session timestamp ${chatId}:`, updateError);
      // Not critical, so we don't return false here
    }
    
    return true;
  } catch (error) {
    console.error(`Error saving messages for chat ${chatId}:`, error);
    toast.error("Failed to save chat messages");
    return false;
  }
};

// Get all messages for a chat session
export const getChatMessages = async (chatId: string): Promise<ChatMessage[]> => {
  try {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('chat_id', chatId)
      .order('timestamp', { ascending: true });
    
    if (error) {
      console.error(`Error fetching messages for chat ${chatId}:`, error);
      toast.error(`Failed to load chat history: ${error.message}`);
      return [];
    }
    
    // Convert database format to ChatMessage format
    return data.map(msg => ({
      id: msg.id,
      text: msg.text,
      sender: msg.sender,
      timestamp: new Date(msg.timestamp).getTime(),
      sourceInfo: msg.source_info ? {
        sourceDocuments: msg.source_info.sourceDocuments || [],
        pageNumber: msg.source_info.pageNumber || "",
        sectionInfo: msg.source_info.sectionInfo || "",
        paragraphInfo: msg.source_info.paragraphInfo || ""
      } : undefined
    }));
  } catch (error) {
    console.error(`Error fetching messages for chat ${chatId}:`, error);
    toast.error("Failed to load chat history");
    return [];
  }
};


import { supabase } from "@/integrations/supabase/client";
import { ChatMessage } from "./chatUtils";
import { v4 as uuidv4 } from "uuid";

export interface ChatSession {
  id: string;
  title: string;
  documentIds: string[];
  createdAt: number;
  updatedAt: number;
}

/**
 * Creates a new chat session in Supabase
 */
export const createChatSession = async (
  documentIds: string[],
  title: string
): Promise<ChatSession | null> => {
  try {
    const id = uuidv4();
    const timestamp = Date.now();

    const { data, error } = await supabase
      .from("chat_sessions")
      .insert({
        id,
        title,
        document_ids: documentIds,
        created_at: new Date(timestamp).toISOString(),
        updated_at: new Date(timestamp).toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating chat session:", error);
      return null;
    }

    return {
      id: data.id,
      title: data.title,
      documentIds: data.document_ids || [],
      createdAt: new Date(data.created_at).getTime(),
      updatedAt: new Date(data.updated_at).getTime()
    };
  } catch (error) {
    console.error("Error in createChatSession:", error);
    return null;
  }
};

/**
 * Retrieves all chat sessions for the current user
 */
export const getChatSessions = async (): Promise<ChatSession[]> => {
  try {
    const { data, error } = await supabase
      .from("chat_sessions")
      .select("*")
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("Error getting chat sessions:", error);
      return [];
    }

    return data.map(session => ({
      id: session.id,
      title: session.title,
      documentIds: session.document_ids || [],
      createdAt: new Date(session.created_at).getTime(),
      updatedAt: new Date(session.updated_at).getTime()
    }));
  } catch (error) {
    console.error("Error in getChatSessions:", error);
    return [];
  }
};

/**
 * Retrieves a specific chat session by ID
 */
export const getChatSession = async (id: string): Promise<ChatSession | null> => {
  try {
    const { data, error } = await supabase
      .from("chat_sessions")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) {
      console.error("Error getting chat session:", error);
      return null;
    }

    return {
      id: data.id,
      title: data.title,
      documentIds: data.document_ids || [],
      createdAt: new Date(data.created_at).getTime(),
      updatedAt: new Date(data.updated_at).getTime()
    };
  } catch (error) {
    console.error("Error in getChatSession:", error);
    return null;
  }
};

/**
 * Updates the title of a chat session
 */
export const updateChatSessionTitle = async (
  id: string,
  title: string
): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from("chat_sessions")
      .update({
        title,
        updated_at: new Date().toISOString()
      })
      .eq("id", id);

    if (error) {
      console.error("Error updating chat session title:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error in updateChatSessionTitle:", error);
    return false;
  }
};

/**
 * Deletes a chat session and its messages
 */
export const deleteChatSession = async (id: string): Promise<boolean> => {
  try {
    // First delete all messages associated with the session
    const { error: messagesError } = await supabase
      .from("chat_messages")
      .delete()
      .eq("session_id", id);

    if (messagesError) {
      console.error("Error deleting chat messages:", messagesError);
      return false;
    }

    // Then delete the session itself
    const { error: sessionError } = await supabase
      .from("chat_sessions")
      .delete()
      .eq("id", id);

    if (sessionError) {
      console.error("Error deleting chat session:", sessionError);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error in deleteChatSession:", error);
    return false;
  }
};

/**
 * Saves chat messages for a session
 */
export const saveChatMessages = async (
  sessionId: string,
  messages: ChatMessage[]
): Promise<boolean> => {
  try {
    // Update the session's updated_at timestamp
    await supabase
      .from("chat_sessions")
      .update({
        updated_at: new Date().toISOString()
      })
      .eq("id", sessionId);

    // Delete existing messages for this session
    await supabase
      .from("chat_messages")
      .delete()
      .eq("session_id", sessionId);

    // Skip if there are no messages to save
    if (messages.length === 0) {
      return true;
    }

    // Insert all messages
    const messagesToInsert = messages.map(msg => ({
      id: msg.id,
      session_id: sessionId,
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

    const { error } = await supabase
      .from("chat_messages")
      .insert(messagesToInsert);

    if (error) {
      console.error("Error saving chat messages:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error in saveChatMessages:", error);
    return false;
  }
};

/**
 * Retrieves chat messages for a session
 */
export const getChatMessages = async (sessionId: string): Promise<ChatMessage[]> => {
  try {
    const { data, error } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("session_id", sessionId)
      .order("timestamp", { ascending: true });

    if (error) {
      console.error("Error getting chat messages:", error);
      return [];
    }

    return data.map(msg => {
      // Create a base chat message
      const chatMessage: ChatMessage = {
        id: msg.id,
        text: msg.text,
        sender: msg.sender as "user" | "bot", // Type assertion
        timestamp: new Date(msg.timestamp).getTime()
      };

      // Handle source_info if it exists
      if (msg.source_info) {
        // Make sure source_info is an object before trying to access its properties
        const sourceInfo = typeof msg.source_info === 'object' ? msg.source_info : {};
        
        chatMessage.sourceInfo = {
          sourceDocuments: Array.isArray(sourceInfo.sourceDocuments) 
            ? sourceInfo.sourceDocuments 
            : [],
          pageNumber: typeof sourceInfo.pageNumber === 'string' 
            ? sourceInfo.pageNumber 
            : String(sourceInfo.pageNumber || ''),
          sectionInfo: typeof sourceInfo.sectionInfo === 'string' 
            ? sourceInfo.sectionInfo 
            : String(sourceInfo.sectionInfo || ''),
          paragraphInfo: typeof sourceInfo.paragraphInfo === 'string' 
            ? sourceInfo.paragraphInfo 
            : String(sourceInfo.paragraphInfo || '')
        };
      }

      return chatMessage;
    });
  } catch (error) {
    console.error("Error in getChatMessages:", error);
    return [];
  }
};

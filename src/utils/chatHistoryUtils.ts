
import { supabase } from "@/integrations/supabase/client";
import { ChatMessage } from "./chatUtils";
import { v4 as uuidv4 } from "uuid";
import { Json } from "@/integrations/supabase/types";

export interface ChatSession {
  id: string;
  title: string;
  documentIds: string[];
  createdAt: string;
  updatedAt: string;
}

// Create a new chat session
export const createChatSession = async (
  documentIds: string[],
  title: string
): Promise<ChatSession | null> => {
  try {
    const newSession = {
      id: uuidv4(),
      title,
      document_ids: documentIds,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("chat_sessions")
      .insert(newSession);

    if (error) {
      console.error("Error creating chat session:", error);
      return null;
    }

    return {
      id: newSession.id,
      title: newSession.title,
      documentIds: newSession.document_ids,
      createdAt: newSession.created_at,
      updatedAt: newSession.updated_at,
    };
  } catch (error) {
    console.error("Error creating chat session:", error);
    return null;
  }
};

// Get chat sessions for the current user
export const getChatSessions = async (): Promise<ChatSession[]> => {
  try {
    const { data, error } = await supabase
      .from("chat_sessions")
      .select("*")
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("Error fetching chat sessions:", error);
      return [];
    }

    return data.map((session) => ({
      id: session.id,
      title: session.title,
      documentIds: session.document_ids,
      createdAt: session.created_at,
      updatedAt: session.updated_at,
    }));
  } catch (error) {
    console.error("Error fetching chat sessions:", error);
    return [];
  }
};

// Get a specific chat session by ID
export const getChatSession = async (id: string): Promise<ChatSession | null> => {
  try {
    const { data, error } = await supabase
      .from("chat_sessions")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) {
      console.error("Error fetching chat session:", error);
      return null;
    }

    return {
      id: data.id,
      title: data.title,
      documentIds: data.document_ids,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  } catch (error) {
    console.error("Error fetching chat session:", error);
    return null;
  }
};

// Delete a chat session and its messages
export const deleteChatSession = async (id: string): Promise<boolean> => {
  try {
    // First delete all messages for this session
    const { error: messagesError } = await supabase
      .from("chat_messages")
      .delete()
      .eq("chat_id", id);

    if (messagesError) {
      console.error("Error deleting chat messages:", messagesError);
      return false;
    }

    // Then delete the session
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
    console.error("Error deleting chat session:", error);
    return false;
  }
};

// Save chat messages to a session
export const saveChatMessages = async (
  chatId: string,
  messages: ChatMessage[]
): Promise<boolean> => {
  try {
    // Update the session's updated_at timestamp
    const { error: updateError } = await supabase
      .from("chat_sessions")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", chatId);

    if (updateError) {
      console.error("Error updating chat session timestamp:", updateError);
    }

    // Delete existing messages for this chat to replace with new ones
    const { error: deleteError } = await supabase
      .from("chat_messages")
      .delete()
      .eq("chat_id", chatId);

    if (deleteError) {
      console.error("Error deleting existing chat messages:", deleteError);
      return false;
    }

    // Format messages for database insertion
    const formattedMessages = messages.map((message) => ({
      id: message.id,
      chat_id: chatId,
      text: message.text,
      sender: message.sender,
      timestamp: new Date(message.timestamp).toISOString(),
      source_info: message.sourceInfo || null
    }));

    // Insert all messages
    const { error: insertError } = await supabase
      .from("chat_messages")
      .insert(formattedMessages);

    if (insertError) {
      console.error("Error saving chat messages:", insertError);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error saving chat messages:", error);
    return false;
  }
};

// Get chat messages for a session
export const getChatMessages = async (chatId: string): Promise<ChatMessage[]> => {
  try {
    const { data, error } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("chat_id", chatId)
      .order("timestamp", { ascending: true });

    if (error) {
      console.error("Error fetching chat messages:", error);
      return [];
    }

    return data.map((message) => {
      const sourceInfo = message.source_info as Record<string, any> | null;
      
      return {
        id: message.id,
        text: message.text,
        sender: message.sender as "user" | "bot",
        timestamp: new Date(message.timestamp).getTime(),
        sourceInfo: sourceInfo ? {
          sourceDocuments: sourceInfo.sourceDocuments || [],
          pageNumber: sourceInfo.pageNumber || "",
          sectionInfo: sourceInfo.sectionInfo || "",
          paragraphInfo: sourceInfo.paragraphInfo || ""
        } : undefined
      };
    });
  } catch (error) {
    console.error("Error fetching chat messages:", error);
    return [];
  }
};

// This file is just reexporting from the hooks for backward compatibility
import { toast } from "sonner";

// Export the toast function from sonner directly
export { toast };

// The useToast hook is no longer needed with sonner, but we'll keep it for compatibility
export const useToast = () => {
  return {
    toast: toast
  };
};

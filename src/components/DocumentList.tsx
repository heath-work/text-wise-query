
import React from "react";
import { File, X } from "lucide-react";
import { DocumentFile, formatFileSize } from "@/utils/pdfUtils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

interface DocumentListProps {
  documents: DocumentFile[];
  onRemoveDocument: (id: string) => void;
}

const DocumentList: React.FC<DocumentListProps> = ({
  documents,
  onRemoveDocument
}) => {
  if (documents.length === 0) {
    return (
      <Card className="mt-6">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Uploaded Documents (0)</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-8">
            No documents have been uploaded yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mt-6">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Uploaded Documents ({documents.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[200px] w-full document-list">
          <div className="space-y-2 pr-4">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between p-3 rounded-md bg-muted/50"
              >
                <div className="flex items-center space-x-3">
                  <div className="bg-primary/10 rounded-md p-2">
                    <File size={18} className="text-primary" />
                  </div>
                  <div className="truncate">
                    <p className="text-sm font-medium truncate" title={doc.name}>
                      {doc.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(doc.size)}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-muted-foreground"
                  onClick={() => onRemoveDocument(doc.id)}
                  title="Remove document"
                >
                  <X size={16} />
                </Button>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default DocumentList;

import { useState } from "react";
import { FileText, X, Download, ExternalLink, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AttachmentViewerProps {
  url: string;
  label?: string;
  variant?: "default" | "compact";
}

export function AttachmentViewer({ url, label = "View Attachment", variant = "default" }: AttachmentViewerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [fileType, setFileType] = useState<string>("");

  const extractStoragePath = (fullUrl: string) => {
    // Extract bucket and path from Supabase storage URL
    // URL format: https://xxx.supabase.co/storage/v1/object/public/bucket/path
    const match = fullUrl.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)/);
    if (match) {
      return { bucket: match[1], path: match[2] };
    }
    return null;
  };

  const handleOpen = async () => {
    setIsOpen(true);
    setLoading(true);

    try {
      const storageInfo = extractStoragePath(url);
      
      if (storageInfo) {
        // Fetch via Supabase client to avoid ad blocker issues
        const { data, error } = await supabase.storage
          .from(storageInfo.bucket)
          .download(storageInfo.path);

        if (error) {
          throw error;
        }

        const blob = data;
        const objectUrl = URL.createObjectURL(blob);
        setBlobUrl(objectUrl);
        setFileType(blob.type);
      } else {
        // Fallback for non-Supabase URLs
        const response = await fetch(url);
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        setBlobUrl(objectUrl);
        setFileType(blob.type);
      }
    } catch (error) {
      console.error("Error loading attachment:", error);
      toast.error("Failed to load attachment");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    if (blobUrl) {
      URL.revokeObjectURL(blobUrl);
      setBlobUrl(null);
    }
  };

  const handleDownload = () => {
    if (blobUrl) {
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = url.split("/").pop() || "attachment";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const isImage = fileType.startsWith("image/");
  const isPdf = fileType === "application/pdf";

  if (variant === "compact") {
    return (
      <>
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleOpen();
          }}
          className="text-primary hover:underline text-[10px] flex items-center gap-1"
        >
          <FileText className="h-3 w-3" />
          Attachment
        </button>

        <Dialog open={isOpen} onOpenChange={handleClose}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                <span>Attachment</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleDownload} disabled={!blobUrl}>
                    <Download className="h-4 w-4 mr-1" />
                    Download
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <a href={url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4 mr-1" />
                      Open Direct
                    </a>
                  </Button>
                </div>
              </DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-auto">
              {loading ? (
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : blobUrl ? (
                isImage ? (
                  <img src={blobUrl} alt="Attachment" className="max-w-full h-auto mx-auto" />
                ) : isPdf ? (
                  <iframe src={blobUrl} className="w-full h-[70vh]" title="PDF Viewer" />
                ) : (
                  <div className="flex flex-col items-center justify-center h-64 gap-4">
                    <FileText className="h-16 w-16 text-muted-foreground" />
                    <p className="text-muted-foreground">Preview not available for this file type</p>
                    <Button onClick={handleDownload}>
                      <Download className="h-4 w-4 mr-2" />
                      Download File
                    </Button>
                  </div>
                )
              ) : (
                <div className="flex items-center justify-center h-64 text-muted-foreground">
                  Failed to load attachment
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <>
      <div 
        className="flex items-center gap-2 p-2 bg-primary/10 border border-primary/20 rounded-md cursor-pointer hover:bg-primary/15 transition-colors"
        onClick={handleOpen}
      >
        <FileText className="h-4 w-4 text-primary flex-shrink-0" />
        <span className="text-sm text-primary font-medium truncate">
          {label}
        </span>
      </div>

      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>{label}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleDownload} disabled={!blobUrl}>
                  <Download className="h-4 w-4 mr-1" />
                  Download
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <a href={url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4 mr-1" />
                    Open Direct
                  </a>
                </Button>
              </div>
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : blobUrl ? (
              isImage ? (
                <img src={blobUrl} alt="Attachment" className="max-w-full h-auto mx-auto" />
              ) : isPdf ? (
                <iframe src={blobUrl} className="w-full h-[70vh]" title="PDF Viewer" />
              ) : (
                <div className="flex flex-col items-center justify-center h-64 gap-4">
                  <FileText className="h-16 w-16 text-muted-foreground" />
                  <p className="text-muted-foreground">Preview not available for this file type</p>
                  <Button onClick={handleDownload}>
                    <Download className="h-4 w-4 mr-2" />
                    Download File
                  </Button>
                </div>
              )
            ) : (
              <div className="flex items-center justify-center h-64 text-muted-foreground">
                Failed to load attachment
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

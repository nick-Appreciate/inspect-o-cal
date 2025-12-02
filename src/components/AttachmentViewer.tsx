import { useState } from "react";
import { FileText, Download, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

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
  const [fileName, setFileName] = useState<string>("");

  const extractStoragePath = (fullUrl: string) => {
    // Extract bucket and path from Supabase storage URL
    // URL format: https://xxx.supabase.co/storage/v1/object/public/bucket/path
    const match = fullUrl.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)/);
    if (match) {
      return { bucket: match[1], path: match[2] };
    }
    return null;
  };

  const getProxyUrl = () => {
    const storageInfo = extractStoragePath(url);
    if (storageInfo) {
      return `${SUPABASE_URL}/functions/v1/serve-attachment?bucket=${encodeURIComponent(storageInfo.bucket)}&path=${encodeURIComponent(storageInfo.path)}`;
    }
    return url;
  };

  const handleOpen = async () => {
    setIsOpen(true);
    setLoading(true);

    try {
      const proxyUrl = getProxyUrl();
      console.log("Fetching attachment from:", proxyUrl);
      
      const response = await fetch(proxyUrl);
      console.log("Response status:", response.status);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status}`);
      }

      const blob = await response.blob();
      console.log("Blob type:", blob.type, "size:", blob.size);
      
      const objectUrl = URL.createObjectURL(blob);
      setBlobUrl(objectUrl);
      setFileType(blob.type);
      setFileName(url.split("/").pop() || "attachment");
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
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const handleOpenInNewTab = () => {
    // Open the proxy URL directly in a new tab
    window.open(getProxyUrl(), "_blank");
  };

  const isImage = fileType.startsWith("image/");
  const isPdf = fileType === "application/pdf";

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      );
    }
    
    if (!blobUrl) {
      return (
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          Failed to load attachment
        </div>
      );
    }

    if (isImage) {
      return <img src={blobUrl} alt="Attachment" className="max-w-full h-auto mx-auto" />;
    }
    
    if (isPdf) {
      return <iframe src={blobUrl} className="w-full h-[70vh]" title="PDF Viewer" />;
    }
    
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <FileText className="h-16 w-16 text-muted-foreground" />
        <p className="text-muted-foreground">Preview not available for this file type</p>
        <Button onClick={handleDownload}>
          <Download className="h-4 w-4 mr-2" />
          Download File
        </Button>
      </div>
    );
  };

  const dialogContent = (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>{variant === "compact" ? "Attachment" : label}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleDownload} disabled={!blobUrl}>
                <Download className="h-4 w-4 mr-1" />
                Download
              </Button>
              <Button variant="outline" size="sm" onClick={handleOpenInNewTab}>
                Open in New Tab
              </Button>
            </div>
          </DialogTitle>
          <DialogDescription className="sr-only">
            View and download the attachment file
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-auto">
          {renderContent()}
        </div>
      </DialogContent>
    </Dialog>
  );

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
        {dialogContent}
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
      {dialogContent}
    </>
  );
}

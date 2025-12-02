import { useState, useEffect, useRef } from "react";
import { FileText, Download, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

// Set worker source
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.mjs`;

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
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [pdfRendering, setPdfRendering] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const extractStoragePath = (fullUrl: string) => {
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

  const renderPage = async (doc: pdfjsLib.PDFDocumentProxy, pageNum: number) => {
    if (!canvasRef.current || pdfRendering) return;
    
    setPdfRendering(true);
    try {
      const page = await doc.getPage(pageNum);
      const canvas = canvasRef.current;
      const context = canvas.getContext("2d");
      
      if (!context) return;

      // Scale to fit container width while maintaining aspect ratio
      const containerWidth = canvas.parentElement?.clientWidth || 800;
      const viewport = page.getViewport({ scale: 1 });
      const scale = Math.min(containerWidth / viewport.width, 2);
      const scaledViewport = page.getViewport({ scale });

      canvas.height = scaledViewport.height;
      canvas.width = scaledViewport.width;

      await page.render({
        canvasContext: context,
        viewport: scaledViewport,
      }).promise;
    } catch (error) {
      console.error("Error rendering PDF page:", error);
    } finally {
      setPdfRendering(false);
    }
  };

  const handleOpen = async () => {
    setIsOpen(true);
    setLoading(true);
    setCurrentPage(1);

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

      // If PDF, load with PDF.js
      if (blob.type === "application/pdf") {
        const arrayBuffer = await blob.arrayBuffer();
        const doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        setPdfDoc(doc);
        setTotalPages(doc.numPages);
      }
    } catch (error) {
      console.error("Error loading attachment:", error);
      toast.error("Failed to load attachment");
    } finally {
      setLoading(false);
    }
  };

  // Render PDF page when doc or currentPage changes
  useEffect(() => {
    if (pdfDoc && isOpen) {
      renderPage(pdfDoc, currentPage);
    }
  }, [pdfDoc, currentPage, isOpen]);

  const handleClose = () => {
    setIsOpen(false);
    if (blobUrl) {
      URL.revokeObjectURL(blobUrl);
      setBlobUrl(null);
    }
    setPdfDoc(null);
    setTotalPages(0);
    setCurrentPage(1);
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
    window.open(getProxyUrl(), "_blank");
  };

  const goToPrevPage = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  const goToNextPage = () => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1);
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
    
    if (isPdf && pdfDoc) {
      return (
        <div className="flex flex-col items-center gap-4">
          <div className="flex items-center gap-4 bg-muted/50 rounded-md px-4 py-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={goToPrevPage} 
              disabled={currentPage <= 1 || pdfRendering}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium">
              Page {currentPage} of {totalPages}
            </span>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={goToNextPage} 
              disabled={currentPage >= totalPages || pdfRendering}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="w-full overflow-auto flex justify-center">
            <canvas ref={canvasRef} className="border border-border shadow-sm" />
          </div>
        </div>
      );
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

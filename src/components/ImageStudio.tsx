import { useState, useRef, useCallback, useEffect } from "react";
import { toast } from "sonner";
import {
  Upload,
  Download,
  Crop,
  Sparkles,
  Copy,
  ArrowLeft,
  Check,
  AlertCircle,
  FileImage,
  Scale,
  Gauge,
  Lock,
  Unlock,
  RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

// Helpers
const formatBytes = (bytes: number, decimals = 2) => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
};

const getNumericRatio = (ratioStr: string, defaultRatio = 1) => {
  switch (ratioStr) {
    case "1:1":
      return 1.0;
    case "16:9":
      return 16 / 9;
    case "4:3":
      return 4 / 3;
    case "3:2":
      return 3 / 2;
    case "9:16":
      return 9 / 16;
    default:
      return defaultRatio;
  }
};

interface ImageMetadata {
  width: number;
  height: number;
  size: number;
  name: string;
  type: string;
}

const ImageStudio = () => {
  // File Loading States
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string>("");
  const [originalMeta, setOriginalMeta] = useState<ImageMetadata | null>(null);
  const [naturalWidth, setNaturalWidth] = useState<number>(0);
  const [naturalHeight, setNaturalHeight] = useState<number>(0);

  // Crop Settings
  const [cropEnabled, setCropEnabled] = useState(true);
  const [aspectRatio, setAspectRatio] = useState<string>("free");
  const [cropBox, setCropBox] = useState({ x: 10, y: 10, width: 80, height: 80 }); // Percentage 0-100

  // Resize Settings
  const [widthPx, setWidthPx] = useState<number>(800);
  const [heightPx, setHeightPx] = useState<number>(600);
  const [scalePercent, setScalePercent] = useState<number>(100);
  const [keepAspectRatio, setKeepAspectRatio] = useState(true);

  // Compression & Format Settings
  const [outputFormat, setOutputFormat] = useState<"image/jpeg" | "image/png" | "image/webp">("image/jpeg");
  const [compressQuality, setCompressQuality] = useState<number>(0.8);

  // Live Size Estimation
  const [estimatedSize, setEstimatedSize] = useState<number | null>(null);

  // Result States
  const [processing, setProcessing] = useState(false);
  const [resultUrl, setResultUrl] = useState<string>("");
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [resultMeta, setResultMeta] = useState<{ width: number; height: number; size: number } | null>(null);
  const [resultTab, setResultTab] = useState<"processed" | "original">("processed");

  // Interaction States
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragInfo = useRef<{
    handle: string;
    startX: number;
    startY: number;
    startBox: typeof cropBox;
    containerWidth: number;
    containerHeight: number;
  } | null>(null);

  // Handle image files
  const handleImageFile = useCallback((file: File) => {
    if (file && file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      setImageFile(file);
      setImageUrl(url);

      // Clean up previous results
      setResultUrl("");
      setResultBlob(null);
      setResultMeta(null);

      // Load image to extract dimensions
      const img = new Image();
      img.onload = () => {
        setNaturalWidth(img.naturalWidth);
        setNaturalHeight(img.naturalHeight);
        setWidthPx(img.naturalWidth);
        setHeightPx(img.naturalHeight);
        setScalePercent(100);

        setOriginalMeta({
          width: img.naturalWidth,
          height: img.naturalHeight,
          size: file.size,
          name: file.name,
          type: file.type
        });

        // Initialize Crop Box (centered, aspect locked if needed)
        setCropBox({ x: 10, y: 10, width: 80, height: 80 });
        setAspectRatio("free");
      };
      img.src = url;
    } else {
      toast.error("Please drop or upload a valid image file.");
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleImageFile(file);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleImageFile(file);
  }, [handleImageFile]);

  // Clipboard Paste Support
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (items) {
        for (let i = 0; i < items.length; i++) {
          if (items[i].type.startsWith("image/")) {
            const file = items[i].getAsFile();
            if (file) {
              handleImageFile(file);
              toast.success("Image pasted from clipboard!");
              break;
            }
          }
        }
      }
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [handleImageFile]);

  // Adjust crop box when aspect ratio setting changes
  useEffect(() => {
    if (!naturalWidth || !naturalHeight) return;

    const containerRatio = naturalWidth / naturalHeight;
    if (aspectRatio === "free") return;

    const targetRatio = getNumericRatio(aspectRatio, containerRatio);

    if (targetRatio > containerRatio) {
      // Wider target than container: limit width
      const w = 100;
      const h = 100 * (containerRatio / targetRatio);
      setCropBox({
        x: 0,
        y: (100 - h) / 2,
        width: w,
        height: h
      });
    } else {
      // Taller target than container: limit height
      const h = 100;
      const w = 100 * (targetRatio / containerRatio);
      setCropBox({
        x: (100 - w) / 2,
        y: 0,
        width: w,
        height: h
      });
    }
  }, [aspectRatio, naturalWidth, naturalHeight]);

  // Calculate cropped width & height in pixels
  const croppedWidth = cropEnabled
    ? Math.round((cropBox.width / 100) * naturalWidth)
    : naturalWidth;
  const croppedHeight = cropEnabled
    ? Math.round((cropBox.height / 100) * naturalHeight)
    : naturalHeight;

  // React to crop box changes to update dimensions
  useEffect(() => {
    if (!naturalWidth || !naturalHeight) return;
    const cw = croppedWidth;
    const ch = croppedHeight;
    
    // Automatically recalculate dimensions based on scale percentage
    setWidthPx(Math.round(cw * (scalePercent / 100)));
    setHeightPx(Math.round(ch * (scalePercent / 100)));
  }, [cropBox, cropEnabled, scalePercent, naturalWidth, naturalHeight]);

  // Custom resize handler to maintain aspect ratio
  const handleWidthChange = (val: number) => {
    setWidthPx(val);
    const cw = croppedWidth;
    const ch = croppedHeight;
    
    if (keepAspectRatio && cw > 0) {
      const calculatedHeight = Math.round(val * (ch / cw));
      setHeightPx(calculatedHeight);
      setScalePercent(Math.round((val / cw) * 100));
    } else {
      setScalePercent(Math.round((val / cw) * 100));
    }
  };

  const handleHeightChange = (val: number) => {
    setHeightPx(val);
    const cw = croppedWidth;
    const ch = croppedHeight;
    
    if (keepAspectRatio && ch > 0) {
      const calculatedWidth = Math.round(val * (cw / ch));
      setWidthPx(calculatedWidth);
      setScalePercent(Math.round((val / ch) * 100));
    } else {
      setScalePercent(Math.round((val / ch) * 100));
    }
  };

  const handleScalePercentChange = (val: number) => {
    setScalePercent(val);
    setWidthPx(Math.round(croppedWidth * (val / 100)));
    setHeightPx(Math.round(croppedHeight * (val / 100)));
  };

  // Real-time Compression Size Estimation
  useEffect(() => {
    if (!imageUrl || !originalMeta || !naturalWidth || !naturalHeight) {
      setEstimatedSize(null);
      return;
    }

    const timer = setTimeout(() => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        // Create a small 400px wide version for quick rendering/estimation
        const estimateW = Math.min(400, croppedWidth);
        const estimateH = Math.round(estimateW / (widthPx / heightPx));

        canvas.width = estimateW;
        canvas.height = estimateH;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        if (cropEnabled) {
          const sx = (cropBox.x / 100) * naturalWidth;
          const sy = (cropBox.y / 100) * naturalHeight;
          const sw = (cropBox.width / 100) * naturalWidth;
          const sh = (cropBox.height / 100) * naturalHeight;
          ctx.drawImage(img, sx, sy, sw, sh, 0, 0, estimateW, estimateH);
        } else {
          ctx.drawImage(img, 0, 0, naturalWidth, naturalHeight, 0, 0, estimateW, estimateH);
        }

        canvas.toBlob(
          (blob) => {
            if (blob) {
              const finalPixelCount = widthPx * heightPx;
              const estimatePixelCount = estimateW * estimateH;
              const ratio = finalPixelCount / estimatePixelCount;
              
              // Apply adjustment since JPEG/WebP compression rates differ between resolutions
              const scalingFactor = outputFormat === "image/png" ? 0.95 : 0.82;
              let estimated = Math.round(blob.size * ratio * scalingFactor);
              
              if (outputFormat === "image/png") {
                // PNG scales mostly with transparency and detail, adjust based on original size
                const baseEstimate = originalMeta.size * (finalPixelCount / (naturalWidth * naturalHeight));
                estimated = Math.round(baseEstimate * 0.95);
              }
              
              setEstimatedSize(Math.max(1024, Math.min(originalMeta.size * 5, estimated)));
            }
          },
          outputFormat,
          compressQuality
        );
      };
      img.src = imageUrl;
    }, 350);

    return () => clearTimeout(timer);
  }, [
    imageUrl,
    cropEnabled,
    cropBox,
    widthPx,
    heightPx,
    outputFormat,
    compressQuality,
    naturalWidth,
    naturalHeight,
    croppedWidth,
    croppedHeight,
    originalMeta
  ]);

  // Interactive Crop Drag Mechanics
  const handleMouseDown = (
    e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>,
    handle: string
  ) => {
    e.preventDefault();
    e.stopPropagation(); // Prevents bubbling to parent elements (move vs nw/ne/etc)
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    
    // Helper to extract touch/mouse coordinates safely
    const getCoords = (event: any) => {
      if (event.touches && event.touches.length > 0) {
        return { x: event.touches[0].clientX, y: event.touches[0].clientY };
      }
      if (event.changedTouches && event.changedTouches.length > 0) {
        return { x: event.changedTouches[0].clientX, y: event.changedTouches[0].clientY };
      }
      return { x: event.clientX, y: event.clientY };
    };

    const coords = getCoords(e);

    dragInfo.current = {
      handle,
      startX: coords.x,
      startY: coords.y,
      startBox: { ...cropBox },
      containerWidth: rect.width,
      containerHeight: rect.height,
    };

    setIsDragging(true);
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent | TouchEvent) => {
      if (!dragInfo.current || !containerRef.current) return;

      const { handle, startX, startY, startBox, containerWidth, containerHeight } = dragInfo.current;
      
      const getCoords = (event: any) => {
        if (event.touches && event.touches.length > 0) {
          return { x: event.touches[0].clientX, y: event.touches[0].clientY };
        }
        if (event.changedTouches && event.changedTouches.length > 0) {
          return { x: event.changedTouches[0].clientX, y: event.changedTouches[0].clientY };
        }
        return { x: event.clientX, y: event.clientY };
      };

      const coords = getCoords(e);
      const deltaX = ((coords.x - startX) / containerWidth) * 100;
      const deltaY = ((coords.y - startY) / containerHeight) * 100;

      const containerRatio = naturalWidth / naturalHeight;
      const currentTargetRatio = getNumericRatio(aspectRatio, containerRatio);

      setCropBox((prev) => {
        let newBox = { ...prev };

        if (handle === "move") {
          newBox.x = Math.max(0, Math.min(100 - prev.width, startBox.x + deltaX));
          newBox.y = Math.max(0, Math.min(100 - prev.height, startBox.y + deltaY));
        } else {
          // Resizing - unified logic
          if (aspectRatio === "free") {
            // Free Form - resize handles independently
            if (handle.includes("e")) {
              newBox.width = Math.max(5, Math.min(100 - startBox.x, startBox.width + deltaX));
            }
            if (handle.includes("w")) {
              const maxW = startBox.x + startBox.width;
              newBox.x = Math.max(0, Math.min(maxW - 5, startBox.x + deltaX));
              newBox.width = maxW - newBox.x;
            }
            if (handle.includes("s")) {
              newBox.height = Math.max(5, Math.min(100 - startBox.y, startBox.height + deltaY));
            }
            if (handle.includes("n")) {
              const maxH = startBox.y + startBox.height;
              newBox.y = Math.max(0, Math.min(maxH - 5, startBox.y + deltaY));
              newBox.height = maxH - newBox.y;
            }
          } else {
            // Aspect Locked Form - corner and edge handles scale proportionally
            // We'll calculate candidate width based on the dominant mouse movement (X or Y)
            let candidateW = startBox.width;
            
            // For X-direction movement
            const wFromX = handle.includes("e") 
              ? startBox.width + deltaX 
              : handle.includes("w") 
                ? startBox.width - deltaX 
                : startBox.width;

            // For Y-direction movement
            const hDelta = handle.includes("s") 
              ? deltaY 
              : handle.includes("n") 
                ? -deltaY 
                : 0;
            const wFromY = (startBox.height + hDelta) * (currentTargetRatio / containerRatio);

            // Determine which movement is dominant
            if (handle === "e" || handle === "w") {
              candidateW = wFromX;
            } else if (handle === "n" || handle === "s") {
              candidateW = wFromY;
            } else {
              // Corners: choose the one with the larger absolute delta
              const checkX = Math.abs(deltaX);
              const checkY = Math.abs(deltaY * (currentTargetRatio / containerRatio));
              candidateW = checkX > checkY ? wFromX : wFromY;
            }

            // Cap the width
            let newW = Math.max(5, candidateW);
            
            // Verify boundaries based on which handles are active
            if (handle.includes("e")) {
              newW = Math.min(100 - startBox.x, newW);
            }
            if (handle.includes("w")) {
              newW = Math.min(startBox.x + startBox.width, newW);
            }

            let newH = newW * (containerRatio / currentTargetRatio);

            if (handle.includes("s")) {
              newH = Math.min(100 - startBox.y, newH);
            }
            if (handle.includes("n")) {
              newH = Math.min(startBox.y + startBox.height, newH);
            }

            // Readjust width in case height cap changed it
            newW = newH * (currentTargetRatio / containerRatio);

            // Apply positions based on handles
            if (handle.includes("e")) {
              newBox.width = newW;
            }
            if (handle.includes("w")) {
              newBox.x = startBox.x + startBox.width - newW;
              newBox.width = newW;
            }
            if (handle.includes("s")) {
              newBox.height = newH;
            }
            if (handle.includes("n")) {
              newBox.y = startBox.y + startBox.height - newH;
              newBox.height = newH;
            }
          }
        }

        return newBox;
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      dragInfo.current = null;
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("touchmove", handleMouseMove);
    window.addEventListener("touchend", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("touchmove", handleMouseMove);
      window.removeEventListener("touchend", handleMouseUp);
    };
  }, [isDragging, naturalWidth, naturalHeight, aspectRatio]);

  // Core Processing Engine
  const processImage = async () => {
    if (!imageUrl || !originalMeta) return;

    setProcessing(true);
    // Let the loader animate
    await new Promise((res) => setTimeout(res, 200));

    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      
      const loaded = new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Failed to load image for processing"));
      });
      img.src = imageUrl;
      await loaded;

      const canvas = document.createElement("canvas");
      canvas.width = widthPx;
      canvas.height = heightPx;
      const ctx = canvas.getContext("2d");
      
      if (!ctx) {
        throw new Error("Could not construct 2D context");
      }

      // Configure high-quality scaling
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      if (cropEnabled) {
        const sx = (cropBox.x / 100) * naturalWidth;
        const sy = (cropBox.y / 100) * naturalHeight;
        const sw = (cropBox.width / 100) * naturalWidth;
        const sh = (cropBox.height / 100) * naturalHeight;
        
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, widthPx, heightPx);
      } else {
        ctx.drawImage(img, 0, 0, naturalWidth, naturalHeight, 0, 0, widthPx, heightPx);
      }

      // Generate output blob
      canvas.toBlob(
        (blob) => {
          if (blob) {
            const resultUrl = URL.createObjectURL(blob);
            setResultBlob(blob);
            setResultUrl(resultUrl);
            setResultMeta({
              width: widthPx,
              height: heightPx,
              size: blob.size
            });
            setResultTab("processed");
            toast.success("Image processed successfully!");
          } else {
            toast.error("Failed to generate output file.");
          }
          setProcessing(false);
        },
        outputFormat,
        outputFormat === "image/png" ? undefined : compressQuality
      );
    } catch (err: any) {
      toast.error(err.message || "An error occurred during processing.");
      setProcessing(false);
    }
  };

  // Download Trigger
  const downloadImage = () => {
    if (!resultUrl || !imageFile) return;

    // Build smart file suffix
    const originalName = imageFile.name.substring(0, imageFile.name.lastIndexOf("."));
    const ext = outputFormat.split("/")[1];
    const suffix = `-processed_${widthPx}x${heightPx}`;
    const filename = `${originalName}${suffix}.${ext}`;

    const link = document.createElement("a");
    link.href = resultUrl;
    link.download = filename;
    link.click();
    toast.success("Download started!");
  };

  // Clipboard Copier
  const copyToClipboard = async () => {
    if (!resultBlob) return;

    try {
      if (resultBlob.type === "image/webp") {
        // Fallback for browsers that do not support webp in clipboard
        // Draw the webp result back to a temporary canvas and export as png to copy
        toast.loading("Preparing copy format...", { id: "copying" });
        const img = new Image();
        img.onload = async () => {
          const canvas = document.createElement("canvas");
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            canvas.toBlob(async (pngBlob) => {
              if (pngBlob) {
                try {
                  const item = new ClipboardItem({ [pngBlob.type]: pngBlob });
                  await navigator.clipboard.write([item]);
                  toast.success("Copied to clipboard (converted to PNG)!", { id: "copying" });
                } catch (e) {
                  toast.error("Clipboard copy failed in your browser.", { id: "copying" });
                }
              }
            }, "image/png");
          }
        };
        img.src = resultUrl;
      } else {
        const item = new ClipboardItem({ [resultBlob.type]: resultBlob });
        await navigator.clipboard.write([item]);
        toast.success("Copied directly to clipboard!");
      }
    } catch (err) {
      toast.error("Could not copy directly. Please right click the image or download.");
    }
  };

  // Reset tool
  const resetWorkspace = () => {
    setImageFile(null);
    setImageUrl("");
    setOriginalMeta(null);
    setResultUrl("");
    setResultBlob(null);
    setResultMeta(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Render variables for Crop Overlay Box (Percentages mapping)
  const cx = cropBox.x;
  const cy = cropBox.y;
  const cw = cropBox.width;
  const ch = cropBox.height;

  // Render SVG transparent hole backdrop path
  const svgHolePath = `M 0,0 L 100,0 L 100,100 L 0,100 Z M ${cx},${cy} L ${cx},${cy + ch} L ${cx + cw},${cy + ch} L ${cx + cw},${cy} Z`;

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background text-foreground py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/15">
              <Crop className="w-7 h-7 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Image Studio</h1>
              <p className="text-muted-foreground text-sm">Resize, crop, and compress images locally</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] sm:text-xs font-medium text-muted-foreground mt-4 md:mt-0">
            <span className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500" /> 100% Client-Side
            </span>
            <span className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500" /> Private & Secure
            </span>
          </div>
        </div>

        {/* Workspace router */}
        {!imageUrl ? (
          /* Upload State */
          <div className="space-y-16">
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-border rounded-3xl p-10 md:p-24 text-center cursor-pointer hover:border-primary/50 hover:bg-card/50 transition-all group bg-card/30 backdrop-blur-sm relative overflow-hidden"
            >
              {/* Subtle background glow */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-primary/5 rounded-full blur-3xl pointer-events-none group-hover:bg-primary/8 transition-colors" />
              
              <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform relative z-10">
                <Upload className="w-8 h-8 text-primary" />
              </div>
              <p className="text-2xl font-bold mb-2 relative z-10">Drop your image here</p>
              <p className="text-muted-foreground relative z-10">
                or click to browse your files, or <span className="text-primary font-semibold">Ctrl+V</span> to paste
              </p>
              <p className="mt-6 text-xs text-muted-foreground/60 uppercase tracking-widest font-semibold relative z-10">
                Supports PNG, JPG, WEBP, SVG
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            {/* Feature educational blocks */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="bg-card/30 border border-border/80 rounded-2xl p-6 hover:bg-card/50 transition-colors">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Crop className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-bold text-lg mb-2">Visual Cropping</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Crop precisely with visual overlays, guide grids, and aspect ratios like 1:1, 16:9, or custom dimensions.
                </p>
              </div>
              <div className="bg-card/30 border border-border/80 rounded-2xl p-6 hover:bg-card/50 transition-colors">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Scale className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-bold text-lg mb-2">Smart Resizing</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Scale your image by pixel width/height or use the percentage slider while locking proportions automatically.
                </p>
              </div>
              <div className="bg-card/30 border border-border/80 rounded-2xl p-6 hover:bg-card/50 transition-colors">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Gauge className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-bold text-lg mb-2">Local Compression</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Optimize files instantly to JPG, PNG, or WEBP, with live quality controls and real-time output size predictions.
                </p>
              </div>
            </div>
          </div>
        ) : resultUrl && resultMeta ? (
          /* Result Preview State */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start animate-in fade-in duration-300">
            {/* Visual Preview (Left/Top) */}
            <div className="lg:col-span-7 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  <Button
                    variant={resultTab === "processed" ? "default" : "secondary"}
                    size="sm"
                    onClick={() => setResultTab("processed")}
                    className="text-xs font-semibold rounded-lg"
                  >
                    Processed Result
                  </Button>
                  <Button
                    variant={resultTab === "original" ? "default" : "secondary"}
                    size="sm"
                    onClick={() => setResultTab("original")}
                    className="text-xs font-semibold rounded-lg"
                  >
                    Original Image
                  </Button>
                </div>
                <span className="text-xs text-muted-foreground hidden sm:inline">
                  Click and hold or toggle to compare
                </span>
              </div>

              <div className="rounded-2xl border border-border bg-secondary/35 p-4 flex items-center justify-center min-h-[40vh] md:min-h-[50vh] max-h-[70vh] overflow-hidden backdrop-blur-sm relative group">
                <img
                  src={resultTab === "processed" ? resultUrl : imageUrl}
                  alt="Comparison view"
                  className="max-h-[60vh] max-w-full object-contain rounded-lg shadow-2xl transition-all duration-200"
                />
                
                {/* Overlay details badge */}
                <div className="absolute bottom-6 right-6 px-3 py-1.5 rounded-lg bg-background/80 backdrop-blur-md border border-border text-xs font-mono font-medium shadow-md">
                  {resultTab === "processed"
                    ? `${resultMeta.width} × ${resultMeta.height} (${outputFormat.split("/")[1].toUpperCase()})`
                    : `${naturalWidth} × ${naturalHeight} (${originalMeta?.type.split("/")[1].toUpperCase()})`}
                </div>
              </div>
            </div>

            {/* Export & Statistics Card (Right) */}
            <div className="lg:col-span-5 space-y-6">
              <Card className="border-border bg-card/40 backdrop-blur-sm shadow-xl">
                <CardHeader>
                  <CardTitle className="text-xl font-bold flex items-center gap-2">
                    <Check className="w-5 h-5 text-green-500" /> Image Ready!
                  </CardTitle>
                  <CardDescription>Review file characteristics and export below</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Detailed statistics breakdown */}
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3.5 rounded-xl bg-secondary/40 border border-border/50">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block mb-1">
                          Original Size
                        </span>
                        <span className="font-mono text-base font-semibold">
                          {formatBytes(originalMeta?.size || 0)}
                        </span>
                      </div>
                      <div className="p-3.5 rounded-xl bg-secondary/40 border border-border/50">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block mb-1">
                          Processed Size
                        </span>
                        <span className="font-mono text-base font-bold text-primary">
                          {formatBytes(resultMeta.size)}
                        </span>
                      </div>
                    </div>

                    {/* Optimization stats */}
                    <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 flex items-center justify-between">
                      <div>
                        <span className="text-xs font-semibold text-foreground/90 block">
                          Size Reduction
                        </span>
                        <p className="text-muted-foreground text-xs">
                          Optimized for quick web loading
                        </p>
                      </div>
                      <div className="text-right">
                        {originalMeta && resultMeta.size < originalMeta.size ? (
                          <span className="px-3 py-1.5 rounded-lg bg-green-500/15 border border-green-500/30 text-green-400 font-mono font-bold text-lg">
                            -{((1 - resultMeta.size / originalMeta.size) * 100).toFixed(1)}%
                          </span>
                        ) : (
                          <span className="px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 font-mono font-bold text-sm">
                            +{(Math.max(0, (resultMeta.size / (originalMeta?.size || 1) - 1) * 100)).toFixed(1)}%
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Metadata table */}
                    <div className="border border-border/60 rounded-xl overflow-hidden text-sm">
                      <div className="grid grid-cols-3 p-3 border-b border-border/60 bg-secondary/20 font-medium">
                        <div>Property</div>
                        <div>Original</div>
                        <div className="text-primary">Processed</div>
                      </div>
                      <div className="grid grid-cols-3 p-3 border-b border-border/40 font-mono text-xs">
                        <div className="font-sans font-medium text-muted-foreground">Dimensions</div>
                        <div>{naturalWidth}×{naturalHeight}</div>
                        <div className="text-primary font-bold">{resultMeta.width}×{resultMeta.height}</div>
                      </div>
                      <div className="grid grid-cols-3 p-3 font-mono text-xs">
                        <div className="font-sans font-medium text-muted-foreground">Format</div>
                        <div>{originalMeta?.type.split("/")[1].toUpperCase()}</div>
                        <div className="text-primary font-bold">{outputFormat.split("/")[1].toUpperCase()}</div>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="space-y-3">
                    <Button onClick={downloadImage} className="w-full text-base font-bold h-12">
                      <Download className="w-5 h-5 mr-2" /> Download Image
                    </Button>
                    <Button onClick={copyToClipboard} variant="secondary" className="w-full font-semibold h-11">
                      <Copy className="w-4.5 h-4.5 mr-2" /> Copy to Clipboard
                    </Button>
                  </div>
                </CardContent>
                <CardFooter className="flex flex-col gap-3 border-t border-border pt-6 bg-secondary/15 rounded-b-2xl">
                  <div className="flex w-full gap-3">
                    <Button variant="outline" onClick={() => setResultUrl("")} className="flex-1">
                      <ArrowLeft className="w-4 h-4 mr-2" /> Back to Editor
                    </Button>
                    <Button variant="ghost" onClick={resetWorkspace} className="flex-1 hover:bg-destructive/10 hover:text-destructive text-muted-foreground">
                      Upload New
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            </div>
          </div>
        ) : (
          /* Editor State */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Visual Canvas Editor (Left/Top) */}
            <div className="lg:col-span-7 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-muted-foreground">
                  {cropEnabled ? "Drag or resize the overlay box to crop" : "Cropping is disabled"}
                </span>
                <Button variant="ghost" size="sm" onClick={resetWorkspace} className="text-xs text-muted-foreground hover:text-destructive">
                  Change Image
                </Button>
              </div>

              {/* Crop Box Container */}
              <div
                className="relative rounded-2xl border border-border bg-secondary/20 p-4 flex items-center justify-center min-h-[40vh] md:min-h-[50vh] max-h-[70vh] overflow-hidden backdrop-blur-sm select-none"
              >
                <div ref={containerRef} className="relative inline-block max-w-full">
                  <img
                    ref={imageRef}
                    src={imageUrl}
                    alt="Workspace editor"
                    className="max-h-[60vh] max-w-full block rounded-lg shadow-xl pointer-events-none select-none"
                    onLoad={(e) => {
                      const img = e.currentTarget;
                      setNaturalWidth(img.naturalWidth);
                      setNaturalHeight(img.naturalHeight);
                    }}
                  />

                  {/* Crop Interactive Overlay Box */}
                  {cropEnabled && (
                    <div className="absolute inset-0 pointer-events-auto">
                      {/* Dimmed Background Overlay SVG */}
                      <svg
                        className="absolute inset-0 w-full h-full pointer-events-none"
                        viewBox="0 0 100 100"
                        preserveAspectRatio="none"
                      >
                        <path d={svgHolePath} fill="rgba(0, 0, 0, 0.65)" fillRule="evenodd" />
                      </svg>

                      {/* Visual Crop Box borders */}
                      <div
                        style={{
                          left: `${cx}%`,
                          top: `${cy}%`,
                          width: `${cw}%`,
                          height: `${ch}%`
                        }}
                        className="absolute border border-white shadow-[0_0_0_1px_rgba(0,0,0,0.5)] cursor-move select-none"
                        onMouseDown={(e) => handleMouseDown(e, "move")}
                        onTouchStart={(e) => handleMouseDown(e, "move")}
                      >
                        {/* Grid Lines inside crop box */}
                        <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none opacity-40">
                          <div className="border-r border-dashed border-white/60 col-span-1 row-span-3" />
                          <div className="border-r border-dashed border-white/60 col-span-1 row-span-3" />
                          <div className="border-b border-dashed border-white/60 col-span-3 row-span-1" />
                          <div className="border-b border-dashed border-white/60 col-span-3 row-span-1" />
                        </div>

                        {/* Corner Resize Handles */}
                        {/* Top-Left */}
                        <div
                          className="absolute -top-1.5 -left-1.5 w-3.5 h-3.5 bg-white border border-black/80 rounded-sm cursor-nwse-resize z-25"
                          onMouseDown={(e) => handleMouseDown(e, "nw")}
                          onTouchStart={(e) => handleMouseDown(e, "nw")}
                        />
                        {/* Top-Right */}
                        <div
                          className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-white border border-black/80 rounded-sm cursor-nesw-resize z-25"
                          onMouseDown={(e) => handleMouseDown(e, "ne")}
                          onTouchStart={(e) => handleMouseDown(e, "ne")}
                        />
                        {/* Bottom-Left */}
                        <div
                          className="absolute -bottom-1.5 -left-1.5 w-3.5 h-3.5 bg-white border border-black/80 rounded-sm cursor-nesw-resize z-25"
                          onMouseDown={(e) => handleMouseDown(e, "sw")}
                          onTouchStart={(e) => handleMouseDown(e, "sw")}
                        />
                        {/* Bottom-Right */}
                        <div
                          className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 bg-white border border-black/80 rounded-sm cursor-nwse-resize z-25"
                          onMouseDown={(e) => handleMouseDown(e, "se")}
                          onTouchStart={(e) => handleMouseDown(e, "se")}
                        />

                        {/* Edge Resize Handles (Only show when aspect ratio is free) */}
                        {aspectRatio === "free" && (
                          <>
                            {/* North */}
                            <div
                              className="absolute -top-1 left-1/2 -translate-x-1/2 w-6 h-2 hover:bg-white/40 cursor-n-resize rounded-sm z-20"
                              onMouseDown={(e) => handleMouseDown(e, "n")}
                              onTouchStart={(e) => handleMouseDown(e, "n")}
                            />
                            {/* South */}
                            <div
                              className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-6 h-2 hover:bg-white/40 cursor-s-resize rounded-sm z-20"
                              onMouseDown={(e) => handleMouseDown(e, "s")}
                              onTouchStart={(e) => handleMouseDown(e, "s")}
                            />
                            {/* East */}
                            <div
                              className="absolute top-1/2 -right-1 -translate-y-1/2 w-2 h-6 hover:bg-white/40 cursor-e-resize rounded-sm z-20"
                              onMouseDown={(e) => handleMouseDown(e, "e")}
                              onTouchStart={(e) => handleMouseDown(e, "e")}
                            />
                            {/* West */}
                            <div
                              className="absolute top-1/2 -left-1 -translate-y-1/2 w-2 h-6 hover:bg-white/40 cursor-w-resize rounded-sm z-20"
                              onMouseDown={(e) => handleMouseDown(e, "w")}
                              onTouchStart={(e) => handleMouseDown(e, "w")}
                            />
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Crop Stats helper */}
              <div className="flex flex-wrap items-center justify-between text-xs text-muted-foreground px-1 gap-2">
                <div>
                  File: <span className="font-semibold text-foreground">{originalMeta?.name}</span> (
                  {formatBytes(originalMeta?.size || 0)})
                </div>
                <div>
                  Crop Selection:{" "}
                  <span className="font-mono font-semibold text-foreground">
                    {croppedWidth} × {croppedHeight}
                  </span>
                </div>
              </div>
            </div>

            {/* Adjustments Control Panel (Right) */}
            <div className="lg:col-span-5 space-y-6">
              <Card className="border-border bg-card/45 backdrop-blur-sm shadow-xl">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg font-bold">Adjust Image Settings</CardTitle>
                  <CardDescription>Customize crop area, sizing, and export format</CardDescription>
                </CardHeader>
                
                <CardContent className="space-y-6">
                  <Tabs defaultValue="crop" className="w-full">
                    <TabsList className="grid w-full grid-cols-3 mb-6 bg-secondary/60">
                      <TabsTrigger value="crop">Crop</TabsTrigger>
                      <TabsTrigger value="resize">Resize</TabsTrigger>
                      <TabsTrigger value="compress">Compress</TabsTrigger>
                    </TabsList>

                    {/* Crop Tab */}
                    <TabsContent value="crop" className="space-y-5 mt-0 outline-none">
                      <div className="flex items-center justify-between p-3 rounded-xl bg-secondary/35 border border-border/50">
                        <div>
                          <Label htmlFor="crop-toggle" className="font-bold text-sm block cursor-pointer">
                            Enable Crop Area
                          </Label>
                          <span className="text-xs text-muted-foreground">
                            Restrict processing to a selected area
                          </span>
                        </div>
                        <Switch
                          id="crop-toggle"
                          checked={cropEnabled}
                          onCheckedChange={setCropEnabled}
                        />
                      </div>

                      {cropEnabled && (
                        <div className="space-y-3">
                          <Label className="text-xs font-semibold text-muted-foreground block">
                            Aspect Ratio Presets
                          </Label>
                          <div className="grid grid-cols-3 gap-2">
                            {[
                              { label: "Free Form", val: "free" },
                              { label: "1:1 Square", val: "1:1" },
                              { label: "16:9 Wide", val: "16:9" },
                              { label: "4:3 TV", val: "4:3" },
                              { label: "3:2 Photo", val: "3:2" },
                              { label: "9:16 Story", val: "9:16" }
                            ].map((preset) => (
                              <Button
                                key={preset.val}
                                variant={aspectRatio === preset.val ? "default" : "outline"}
                                size="sm"
                                onClick={() => setAspectRatio(preset.val)}
                                className="text-xs font-medium h-9 rounded-lg"
                              >
                                {preset.label}
                              </Button>
                            ))}
                          </div>
                          
                          <Button
                            variant="secondary"
                            size="sm"
                            className="w-full mt-2"
                            onClick={() => setCropBox({ x: 10, y: 10, width: 80, height: 80 })}
                          >
                            <RefreshCw className="w-3.5 h-3.5 mr-2" /> Reset Crop Box
                          </Button>
                        </div>
                      )}
                    </TabsContent>

                    {/* Resize Tab */}
                    <TabsContent value="resize" className="space-y-5 mt-0 outline-none">
                      <div className="space-y-4">
                        {/* Aspect Ratio Lock Toggle */}
                        <div className="flex items-center justify-between p-3 rounded-xl bg-secondary/35 border border-border/50 mb-1">
                          <div>
                            <span className="font-bold text-sm block">Lock Aspect Ratio</span>
                            <span className="text-xs text-muted-foreground">
                              Maintain proportional width & height
                            </span>
                          </div>
                          <Button
                            variant={keepAspectRatio ? "default" : "secondary"}
                            size="sm"
                            onClick={() => setKeepAspectRatio(!keepAspectRatio)}
                            className="h-8 w-8 p-0"
                          >
                            {keepAspectRatio ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                          </Button>
                        </div>

                        {/* Pixel Inputs */}
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-muted-foreground">Width (px)</Label>
                            <Input
                              type="number"
                              min={10}
                              max={10000}
                              value={widthPx}
                              onChange={(e) => handleWidthChange(parseInt(e.target.value) || 0)}
                              className="bg-secondary/60 border-border text-sm font-semibold h-10"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-muted-foreground">Height (px)</Label>
                            <Input
                              type="number"
                              min={10}
                              max={10000}
                              value={heightPx}
                              onChange={(e) => handleHeightChange(parseInt(e.target.value) || 0)}
                              className="bg-secondary/60 border-border text-sm font-semibold h-10"
                            />
                          </div>
                        </div>

                        {/* Percentage Scaling Slider */}
                        <div className="space-y-2 pt-2 border-t border-border/40">
                          <div className="flex justify-between items-center text-xs font-medium">
                            <span className="text-muted-foreground">Scale Percentage</span>
                            <span className="text-primary font-mono font-bold">{scalePercent}%</span>
                          </div>
                          <Slider
                            value={[scalePercent]}
                            onValueChange={(val) => handleScalePercentChange(val[0])}
                            min={10}
                            max={200}
                            step={1}
                            className="py-2"
                          />
                          <div className="flex justify-between text-[10px] text-muted-foreground/60 font-mono">
                            <span>10%</span>
                            <span>100% (Original Crop)</span>
                            <span>200%</span>
                          </div>
                        </div>
                      </div>
                    </TabsContent>

                    {/* Compress Tab */}
                    <TabsContent value="compress" className="space-y-5 mt-0 outline-none">
                      {/* Format selector */}
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold text-muted-foreground">Output Format</Label>
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { label: "JPEG (Web)", val: "image/jpeg" },
                            { label: "PNG (Lossless)", val: "image/png" },
                            { label: "WEBP (Modern)", val: "image/webp" }
                          ].map((f) => (
                            <Button
                              key={f.val}
                              variant={outputFormat === f.val ? "default" : "outline"}
                              size="sm"
                              onClick={() => setOutputFormat(f.val as any)}
                              className="text-xs font-medium h-9 rounded-lg"
                            >
                              {f.label}
                            </Button>
                          ))}
                        </div>
                      </div>

                      {/* Quality Slider (Omitted for PNG) */}
                      {outputFormat !== "image/png" ? (
                        <div className="space-y-2">
                          <div className="flex justify-between items-center text-xs font-medium">
                            <span className="text-muted-foreground">Compression Quality</span>
                            <span className="text-primary font-mono font-bold">
                              {Math.round(compressQuality * 100)}%
                            </span>
                          </div>
                          <Slider
                            value={[compressQuality * 100]}
                            onValueChange={(val) => setCompressQuality(val[0] / 100)}
                            min={10}
                            max={100}
                            step={1}
                            className="py-2"
                          />
                          <div className="flex justify-between text-[10px] text-muted-foreground/60">
                            <span>Small File (10%)</span>
                            <span>Balanced (80%)</span>
                            <span>Max Quality (100%)</span>
                          </div>
                        </div>
                      ) : (
                        <div className="p-3 rounded-lg bg-secondary/30 border border-border/40 flex items-start gap-2.5 text-xs text-muted-foreground">
                          <FileImage className="w-4.5 h-4.5 text-primary shrink-0 mt-0.5" />
                          <p>
                            PNG is a lossless format. Quality adjustments are bypassed to preserve exact pixel data. File sizes will be larger.
                          </p>
                        </div>
                      )}

                      {/* Real-time size prediction card */}
                      <div className="p-4 rounded-xl bg-secondary/30 border border-border/40 space-y-2">
                        <span className="text-xs font-semibold text-muted-foreground block">
                          Size Optimization Estimate
                        </span>
                        <div className="flex items-baseline justify-between">
                          <span className="text-xs text-muted-foreground">Estimated Size:</span>
                          <span className="font-mono font-bold text-sm text-primary">
                            {estimatedSize ? formatBytes(estimatedSize) : "Calculating..."}
                          </span>
                        </div>
                        {originalMeta && estimatedSize && (
                          <div className="flex items-center justify-between text-xs pt-1.5 border-t border-border/30">
                            <span className="text-muted-foreground">Est. Savings:</span>
                            {estimatedSize < originalMeta.size ? (
                              <span className="text-green-500 font-bold font-mono">
                                -{((1 - estimatedSize / originalMeta.size) * 100).toFixed(0)}%
                              </span>
                            ) : (
                              <span className="text-amber-500 font-semibold font-mono">
                                +{(Math.max(0, (estimatedSize / originalMeta.size - 1) * 100)).toFixed(0)}%
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </TabsContent>
                  </Tabs>
                </CardContent>

                <CardFooter className="border-t border-border pt-6 bg-secondary/10 rounded-b-2xl">
                  <Button
                    onClick={processImage}
                    disabled={processing || widthPx <= 0 || heightPx <= 0}
                    className="w-full text-base font-bold h-12 relative overflow-hidden"
                  >
                    {processing ? (
                      <span className="flex items-center justify-center">
                        <RefreshCw className="w-5 h-5 mr-2 animate-spin" /> Processing Image...
                      </span>
                    ) : (
                      <span className="flex items-center justify-center">
                        <Sparkles className="w-5 h-5 mr-2" /> Apply & Preview Output
                      </span>
                    )}
                  </Button>
                </CardFooter>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImageStudio;

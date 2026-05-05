import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, Download, Loader2, Film, Grid3X3 } from "lucide-react";

interface ThumbnailFrame {
  timestamp: number;
  dataUrl: string;
}

const formatTimestamp = (seconds: number): string => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}.${ms.toString().padStart(2, "0")}`;
};

const VideoThumbnailGenerator = () => {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [generationMode, setGenerationMode] = useState<"interval" | "count">("interval");
  const [interval, setInterval_] = useState(2);
  const [imageCount, setImageCount] = useState(12);
  const [columns, setColumns] = useState(4);
  const [thumbWidth, setThumbWidth] = useState(480);
  const [frames, setFrames] = useState<ThumbnailFrame[]>([]);
  const [compositeUrl, setCompositeUrl] = useState<string>("");
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith("video/")) {
      setVideoFile(file);
      setVideoUrl(URL.createObjectURL(file));
      setFrames([]);
      setCompositeUrl("");
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("video/")) {
      setVideoFile(file);
      setVideoUrl(URL.createObjectURL(file));
      setFrames([]);
      setCompositeUrl("");
    }
  }, []);

  const extractFrames = async () => {
    if (!videoUrl) return;
    setProcessing(true);
    setProgress(0);
    setFrames([]);
    setCompositeUrl("");

    const video = document.createElement("video");
    video.src = videoUrl;
    video.crossOrigin = "anonymous";
    video.muted = true;

    await new Promise<void>((res) => {
      video.onloadedmetadata = () => res();
      video.load();
    });

    const duration = video.duration;
    const timestamps: number[] = [];

    if (generationMode === "interval") {
      for (let t = 0; t < duration; t += interval) {
        timestamps.push(t);
      }
    } else {
      const sliceDuration = duration / imageCount;
      for (let i = 0; i < imageCount; i++) {
        timestamps.push((i * sliceDuration) + (sliceDuration / 2));
      }
    }

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { alpha: false })!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    const aspectRatio = video.videoHeight / video.videoWidth;
    const tw = thumbWidth;
    const th = Math.round(tw * aspectRatio);
    canvas.width = tw;
    canvas.height = th;

    const extractedFrames: ThumbnailFrame[] = [];

    for (let i = 0; i < timestamps.length; i++) {
      const t = timestamps[i];
      video.currentTime = t;
      await new Promise<void>((res) => {
        video.onseeked = () => res();
      });
      ctx.drawImage(video, 0, 0, tw, th);
      extractedFrames.push({ timestamp: t, dataUrl: canvas.toDataURL("image/jpeg", 1.0) });
      setProgress(Math.round(((i + 1) / timestamps.length) * 100));
    }

    // Trim to a multiple of columns so no row is partially filled if using interval mode
    const trimmed = generationMode === "interval"
      ? extractedFrames.slice(0, Math.floor(extractedFrames.length / columns) * columns || columns)
      : extractedFrames;
    setFrames(trimmed);
    composeImage(trimmed, tw, th);
    setProcessing(false);
  };

  const composeImage = (framesData: ThumbnailFrame[], tw: number, th: number) => {
    const padding = 4;
    const cols = columns;
    const rows = Math.ceil(framesData.length / cols);
    const cellW = tw + padding * 2;
    const cellH = th + padding * 2;
    const totalW = cols * cellW;
    const totalH = rows * cellH;

    const canvas = document.createElement("canvas");
    canvas.width = totalW;
    canvas.height = totalH;
    const ctx = canvas.getContext("2d", { alpha: false })!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.fillStyle = "#0f1115";
    ctx.fillRect(0, 0, totalW, totalH);

    let loaded = 0;
    framesData.forEach((frame, i) => {
      const img = new Image();
      img.onload = () => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = col * cellW + padding;
        const y = row * cellH + padding;

        ctx.drawImage(img, x, y, tw, th);

        // Timestamp overlay
        const timestampText = formatTimestamp(frame.timestamp);
        ctx.font = "bold 16px monospace";
        ctx.textAlign = "right";
        ctx.textBaseline = "bottom";
        
        // Draw black border/shadow for readability
        ctx.strokeStyle = "black";
        ctx.lineWidth = 3;
        ctx.strokeText(timestampText, x + tw - 8, y + th - 8);
        
        // Draw white text
        ctx.fillStyle = "white";
        ctx.fillText(timestampText, x + tw - 8, y + th - 8);

        loaded++;
        if (loaded === framesData.length) {
          setCompositeUrl(canvas.toDataURL("image/jpeg", 1.0));
        }
      };
      img.src = frame.dataUrl;
    });
  };

  const downloadImage = () => {
    if (!compositeUrl) return;
    const a = document.createElement("a");
    a.href = compositeUrl;
    a.download = `thumbnails-${videoFile?.name || "video"}.jpg`;
    a.click();
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/15">
              <Film className="w-7 h-7 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Video Grid Maker</h1>
              <p className="text-muted-foreground text-sm">Professional contact sheet generator</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] sm:text-xs font-medium text-muted-foreground mt-4 md:mt-0">
            <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-green-500" /> Private & Secure</span>
            <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-blue-500" /> 100% Client-Side</span>
          </div>
        </div>

        {/* Hero Section (Only visible before upload) */}
        {!videoUrl && (
          <div className="text-center mb-12 space-y-4">
            <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight bg-gradient-to-br from-foreground to-foreground/60 bg-clip-text text-transparent">
              Turn your videos into <br /> professional thumbnail grids
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Extract high-quality frames at custom intervals and compose beautiful contact sheets in seconds. Perfect for video catalogs, scene analysis, and storyboarding.
            </p>
          </div>
        )}

        {/* Upload Area */}
        {!videoUrl ? (
          <div className="space-y-20">
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-border rounded-3xl p-8 md:p-20 text-center cursor-pointer hover:border-primary/50 hover:bg-card/50 transition-all group bg-card/30 backdrop-blur-sm"
            >
              <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                <Upload className="w-8 h-8 text-primary" />
              </div>
              <p className="text-2xl font-bold mb-2">Drop your video here</p>
              <p className="text-muted-foreground">or click to browse your files</p>
              <p className="mt-6 text-xs text-muted-foreground/60 uppercase tracking-widest font-semibold">Supports MP4, MOV, WEBM and more</p>
              <input ref={fileInputRef} type="file" accept="video/*" className="hidden" onChange={handleFileChange} />
            </div>

            {/* Educational Sections */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-12 pt-8">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Grid3X3 className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-bold">Smart Grids</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Automatically extract frames at any interval. Whether it's every second or every minute, we capture the perfect shots.
                </p>
              </div>
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Download className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-bold">Pro Quality</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Export your grids in high-resolution JPEG format with lossless quality. Perfect for professional documentation and sharing.
                </p>
              </div>
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Film className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-bold">Local Processing</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Your videos never leave your computer. All processing happens 100% in your browser, ensuring maximum privacy and speed.
                </p>
              </div>
            </div>

            {/* How it works */}
            <div className="bg-card/50 border border-border rounded-3xl p-10 md:p-16">
              <h3 className="text-2xl font-bold mb-10 text-center">How it works</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {[
                  { step: "01", title: "Select Video", desc: "Choose any video file from your device. We support all major formats." },
                  { step: "02", title: "Customize", desc: "Set your preferred frame interval, number of columns, and thumbnail width." },
                  { step: "03", title: "Download", desc: "Preview your grid in real-time and download the high-quality final image." }
                ].map((item, i) => (
                  <div key={i} className="relative">
                    <span className="text-6xl font-black text-primary/10 absolute -top-4 -left-2 select-none">{item.step}</span>
                    <div className="relative z-10 pt-4">
                      <h4 className="text-lg font-bold mb-2">{item.title}</h4>
                      <p className="text-sm text-muted-foreground">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Video preview + controls */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2 rounded-xl overflow-hidden bg-card border border-border">
                <video ref={videoRef} src={videoUrl} controls className="w-full" />
              </div>
              <div className="bg-card rounded-xl border border-border p-5 space-y-5">
                <Tabs value={generationMode} onValueChange={(val) => setGenerationMode(val as "interval" | "count")} className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="interval">Interval</TabsTrigger>
                    <TabsTrigger value="count">Count</TabsTrigger>
                  </TabsList>
                  <TabsContent value="interval" className="mt-4">
                    <Label className="text-sm text-muted-foreground mb-1.5 block">Interval (seconds)</Label>
                    <Input type="number" min={0.5} step={0.5} value={interval} onChange={(e) => setInterval_(+e.target.value)} className="bg-secondary border-border" />
                  </TabsContent>
                  <TabsContent value="count" className="mt-4">
                    <Label className="text-sm text-muted-foreground mb-1.5 block">Number of Images</Label>
                    <Input type="number" min={1} max={100} value={imageCount} onChange={(e) => setImageCount(+e.target.value)} className="bg-secondary border-border" />
                  </TabsContent>
                </Tabs>

                <div>
                  <Label className="text-sm text-muted-foreground mb-1.5 block">Columns</Label>
                  <Input type="number" min={1} max={10} value={columns} onChange={(e) => setColumns(+e.target.value)} className="bg-secondary border-border" />
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground mb-1.5 block">Thumb Width (px)</Label>
                  <Input type="number" min={100} max={800} step={20} value={thumbWidth} onChange={(e) => setThumbWidth(+e.target.value)} className="bg-secondary border-border" />
                </div>
                <Button onClick={extractFrames} disabled={processing} className="w-full text-base font-semibold h-11">
                  {processing ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Extracting {progress}%</>
                  ) : (
                    <><Grid3X3 className="w-4 h-4 mr-2" />Generate Sheet</>
                  )}
                </Button>
                <Button variant="outline" size="sm" className="w-full" onClick={() => { setVideoUrl(""); setVideoFile(null); setFrames([]); setCompositeUrl(""); }}>
                  Choose different video
                </Button>
              </div>
            </div>

            {/* Result */}
            {compositeUrl && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <p className="text-sm text-muted-foreground">{frames.length} frames extracted</p>
                  <Button onClick={downloadImage} className="w-full sm:w-auto">
                    <Download className="w-4 h-4 mr-2" />Download Image
                  </Button>
                </div>
                <div className="rounded-xl overflow-hidden border border-border bg-card">
                  <img src={compositeUrl} alt="Thumbnail sheet" className="w-full" />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-border mt-20">
        <div className="max-w-6xl mx-auto px-4 py-12">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2">
              <Film className="w-5 h-5 text-primary" />
              <span className="font-bold tracking-tight">Video Grid Maker</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} Video Grid Maker. Built for high-performance video analysis.
            </p>
            <div className="flex gap-6 text-sm font-medium text-muted-foreground">
              <a href="#" className="hover:text-primary transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-primary transition-colors">Terms of Service</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default VideoThumbnailGenerator;

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  const [interval, setInterval_] = useState(2);
  const [columns, setColumns] = useState(4);
  const [thumbWidth, setThumbWidth] = useState(320);
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
    for (let t = 0; t < duration; t += interval) {
      timestamps.push(t);
    }

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
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
      extractedFrames.push({ timestamp: t, dataUrl: canvas.toDataURL("image/jpeg", 0.85) });
      setProgress(Math.round(((i + 1) / timestamps.length) * 100));
    }

    setFrames(extractedFrames);
    composeImage(extractedFrames, tw, th);
    setProcessing(false);
  };

  const composeImage = (framesData: ThumbnailFrame[], tw: number, th: number) => {
    const labelH = 28;
    const padding = 4;
    const cols = columns;
    const rows = Math.ceil(framesData.length / cols);
    const cellW = tw + padding * 2;
    const cellH = th + labelH + padding * 2;
    const totalW = cols * cellW;
    const totalH = rows * cellH;

    const canvas = document.createElement("canvas");
    canvas.width = totalW;
    canvas.height = totalH;
    const ctx = canvas.getContext("2d")!;
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

        // Timestamp label
        ctx.fillStyle = "rgba(0,0,0,0.7)";
        ctx.fillRect(x, y + th, tw, labelH);
        ctx.fillStyle = "#e8a930";
        ctx.font = "bold 14px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(formatTimestamp(frame.timestamp), x + tw / 2, y + th + labelH / 2);

        loaded++;
        if (loaded === framesData.length) {
          setCompositeUrl(canvas.toDataURL("image/jpeg", 0.92));
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
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2.5 rounded-xl bg-primary/15">
            <Film className="w-7 h-7 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Video Thumbnail Sheet</h1>
            <p className="text-muted-foreground text-sm">Extract frames and compose a contact sheet</p>
          </div>
        </div>

        {/* Upload Area */}
        {!videoUrl ? (
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-border rounded-2xl p-16 text-center cursor-pointer hover:border-primary/50 hover:bg-card/50 transition-all"
          >
            <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-lg font-medium mb-1">Drop a video file here</p>
            <p className="text-muted-foreground text-sm">or click to browse</p>
            <input ref={fileInputRef} type="file" accept="video/*" className="hidden" onChange={handleFileChange} />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Video preview + controls */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2 rounded-xl overflow-hidden bg-card border border-border">
                <video ref={videoRef} src={videoUrl} controls className="w-full" />
              </div>
              <div className="bg-card rounded-xl border border-border p-5 space-y-5">
                <div>
                  <Label className="text-sm text-muted-foreground mb-1.5 block">Interval (seconds)</Label>
                  <Input type="number" min={0.5} step={0.5} value={interval} onChange={(e) => setInterval_(+e.target.value)} className="bg-secondary border-border" />
                </div>
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
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">{frames.length} frames extracted</p>
                  <Button onClick={downloadImage}>
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
    </div>
  );
};

export default VideoThumbnailGenerator;

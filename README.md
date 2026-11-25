# Video Grid Maker

**Video Grid Maker is a free, browser-based video contact sheet maker that pulls frames from any video and lays them out as one timestamped thumbnail grid image, without uploading the video anywhere.**

<p align="center">
  <a href="https://video-grid-maker.codingmarvel.com"><img alt="Live demo" src="https://img.shields.io/badge/live%20demo-video--grid--maker.codingmarvel.com-F9A21F?style=for-the-badge"></a>
  <br>
  <img alt="React 18" src="https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white">
  <img alt="Vite" src="https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white">
  <img alt="Tailwind CSS" src="https://img.shields.io/badge/Tailwind%20CSS-3-06B6D4?logo=tailwindcss&logoColor=white">
  <img alt="Platform: web browser" src="https://img.shields.io/badge/platform-web%20browser-0f1115">
  <img alt="Hosted on Cloudflare Workers" src="https://img.shields.io/badge/hosted%20on-Cloudflare%20Workers-F38020?logo=cloudflare&logoColor=white">
</p>

<p align="center">
  <a href="https://video-grid-maker.codingmarvel.com">
    <img src="docs/screenshot.png" alt="Video Grid Maker home page with a drop zone for a video file" width="900">
  </a>
</p>

Drop in a video, pick how frames are chosen, set the number of columns and the tile width, and download a single JPEG contact sheet. It is useful for video catalogs, scene review, storyboards and quick previews of long clips. The same site also includes **Image Studio** at [`/image-studio`](https://video-grid-maker.codingmarvel.com/image-studio), a local image crop, resize and compress tool.

## Why Video Grid Maker

- **Your video never leaves your device.** The file is opened as a local object URL and every frame is drawn on an HTML canvas in your browser. There is no backend and no upload request.
- **2 ways to choose frames.** Grab a frame every N seconds (the interval input steps by 0.5 s), or ask for an exact number of frames spread evenly across the video (the count control offers 1 to 100).
- **A timestamp on every tile.** Each thumbnail gets an `MM:SS.cc` label in its bottom-right corner, so you can jump straight to that moment.
- **Adjustable columns and tile width.** The column control offers 1 to 10 columns and the width control 100 to 800 px. The finished sheet is exported as a JPEG at the browser's maximum quality setting (1.0).
- **No account, no install.** It is a static site: open the page and start.
- **A second tool included.** Image Studio crops with 6 aspect presets, resizes from 10% to 200%, and compresses to JPEG, PNG or WebP, also fully in the browser.

## Features

### Video contact sheets (`/`)

- Drag and drop a video or click to browse. Any `video/*` file your browser can play works (MP4, WebM and MOV are the common ones).
- Built-in video player to preview the clip before you generate the grid.
- **Interval mode:** one frame every N seconds, starting at 0:00. Extra frames are dropped so every row is full (unless there are fewer frames than columns).
- **Count mode:** a fixed number of frames (the control offers 1 to 100). The video is split into equal slices and the frame from the middle of each slice is used.
- Choose the number of columns (the control offers 1 to 10) and the thumbnail width (the control offers 100 to 800 px). Tile height follows the video's own aspect ratio.
- Frames are scaled with high-quality image smoothing and placed on a dark background with 4 px padding around each tile.
- Live progress percentage while frames are being extracted.
- Preview the finished grid on the page, see how many frames were extracted, then download it as `thumbnails-<video name>.jpg`.

### Image Studio (`/image-studio`)

- Load an image by drag and drop, file picker or **Ctrl+V** paste from the clipboard.
- **Crop:** drag and resize a crop box with a rule-of-thirds guide. Presets: Free form, 1:1, 16:9, 4:3, 3:2 and 9:16. Cropping can be switched off.
- **Resize:** set width and height in pixels or use a 10% to 200% scale slider, with an aspect ratio lock.
- **Compress:** export as JPEG, PNG (lossless) or WebP, with a 10% to 100% quality slider for JPEG and WebP.
- Live estimate of the output file size and the expected saving before you process.
- Result view with a processed vs original toggle, a size reduction percentage, and a dimensions and format comparison table.
- Download as `<name>-processed_<width>x<height>.<ext>` or copy the result straight to the clipboard (WebP results are converted to PNG for copying).

## How it works and privacy

1. The video you pick is turned into a local `blob:` URL with `URL.createObjectURL`. Nothing is sent to a server.
2. A hidden `<video>` element seeks to each timestamp, and each frame is drawn onto a `<canvas>` at your chosen tile width.
3. The tiles are composed into one grid canvas, a timestamp is drawn on each one, and the grid is exported with `canvas.toDataURL("image/jpeg", 1.0)`.
4. The download is created in the browser as well. Image Studio follows the same pattern with `canvas.toBlob`.

The app has no server code. It is a Vite single-page app served as static assets from Cloudflare Workers (see `wrangler.jsonc`). Note that the hosted page loads a third-party advertising script from its `index.html`; your video and image files are still processed only in your browser.

## Quick start

Requirements: Node.js 20.19 or newer (needed by the test tooling) and npm.

```bash
git clone https://github.com/kyameinsahilwho/vid-grid-maker.git
cd vid-grid-maker
npm install
npm run dev
```

The dev server runs at http://localhost:8080.

| Script | What it does |
| --- | --- |
| `npm run dev` | Start the Vite dev server on port 8080 |
| `npm run build` | Production build into `dist/` |
| `npm run build:dev` | Build in development mode |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | Run ESLint |
| `npm test` | Run Vitest once (currently a single placeholder test) |

### Deploying

`wrangler.jsonc` serves the `dist/` folder as static assets on Cloudflare Workers with single-page-app routing, so `/image-studio` works on refresh. Build with `npm run build`, then deploy with Wrangler (`npx wrangler deploy`) or connect the repo to Cloudflare Workers Builds. Any static host that falls back to `index.html` for unknown paths will also work.

## Tech stack

- **React 18** with **TypeScript** and **React Router** for the two pages
- **Vite 5** with the SWC React plugin
- **Tailwind CSS 3** and **shadcn/ui** (Radix UI primitives), **lucide-react** icons, **Sonner** toasts
- Browser APIs only for media work: `HTMLVideoElement`, Canvas 2D, Blob/object URLs and the Clipboard API
- **Vitest** + Testing Library set up (placeholder test only), **ESLint** for linting
- **Cloudflare Workers** static assets for hosting

## FAQ

### Is Video Grid Maker free?

Yes. It is free to use at [video-grid-maker.codingmarvel.com](https://video-grid-maker.codingmarvel.com) with no account or sign-up, and the full source code is in this repository.

### Does Video Grid Maker upload my video?

No. The video is read from your device as a local blob URL and every frame is extracted and composed on a canvas inside your browser. The app has no backend to upload to.

### How do I make a thumbnail grid (contact sheet) from a video?

Open the site, drop your video on the upload area, choose Interval (a frame every N seconds) or Count (a fixed number of frames), set the columns and thumbnail width, then click **Generate Sheet** and **Download Image**. You get one JPEG with a timestamp on every frame.

### What video formats does Video Grid Maker support?

It supports any video your browser can play, because it uses the browser's own video decoder. MP4 (H.264) and WebM work in all modern browsers; MOV and other containers work when your browser supports the codec inside them.

### How many frames can I put in one grid?

In Count mode the control offers 1 to 100 frames. In Interval mode the number depends on the video length and the interval you pick, and the result is trimmed to whole rows where possible.

### Video Grid Maker vs ffmpeg for contact sheets?

FFmpeg can build contact sheets from the command line with its `tile` filter, which suits scripts and batch jobs. Video Grid Maker does the same kind of grid through a simple web form with a live preview and timestamps on each tile, with nothing to install.

## More from CodingMarvel

Video Grid Maker is part of **[CodingMarvel](https://codingmarvel.com)**, a collection of small, focused tools.

- [Love for PDF](https://pdf.codingmarvel.com): 35+ PDF tools that run in your browser
- [HabitGrid](https://habitgrid.codingmarvel.com): printable habit tracker PDFs
- [Ehmatrix](https://ehmatrix.codingmarvel.com): Eisenhower matrix to-do list
- [Pollytasks](https://pollytasks.codingmarvel.com): gamified tasks and habits
- [Platter](https://github.com/kyameinsahilwho/platter): Windows disk utility written in Rust
- [MAX File Recovery](https://github.com/kyameinsahilwho/ReincarnateMax): Windows data recovery app written in Rust
- [Cool Chrome extensions](https://github.com/kyameinsahilwho/cool-chrome-extensions)

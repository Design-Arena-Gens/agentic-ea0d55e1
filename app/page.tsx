"use client";

import { useCallback, useEffect, useRef, useState } from 'react';

type GeneratedVideo = {
  url: string;
  sizeBytes: number;
};

type Slide = {
  title: string;
  body: string;
  bgHue: number; // 0-360
};

const SLIDES: Slide[] = [
  {
    title: 'Albert Einstein',
    body: 'Theoretical physicist (1879?1955). Developed the theory of relativity.',
    bgHue: 210,
  },
  {
    title: 'Special Relativity (1905)',
    body: 'Reconciled mechanics with electromagnetism. Famous for E = mc^2.',
    bgHue: 260,
  },
  {
    title: 'General Relativity (1915)',
    body: 'Gravity as spacetime curvature. Predicted gravitational lensing.',
    bgHue: 180,
  },
  {
    title: 'Nobel Prize (1921)',
    body: 'Awarded for the photoelectric effect, foundational to quantum theory.',
    bgHue: 20,
  },
  {
    title: 'Legacy',
    body: 'Transformed physics and our understanding of space, time, and energy.',
    bgHue: 330,
  },
];

const CANVAS_WIDTH = 1280;
const CANVAS_HEIGHT = 720;
const FPS = 30;
const SECONDS_PER_SLIDE = 4; // includes fades
const FADE_SECONDS = 0.6;

export default function Page() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [video, setVideo] = useState<GeneratedVideo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Ensure canvas has proper size on mount
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = CANVAS_WIDTH;
      canvas.height = CANVAS_HEIGHT;
    }
  }, []);

  const drawSlide = useCallback((ctx: CanvasRenderingContext2D, slide: Slide, alpha: number) => {
    ctx.save();

    // Background gradient
    const gradient = ctx.createLinearGradient(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    gradient.addColorStop(0, `hsl(${slide.bgHue} 70% 18%)`);
    gradient.addColorStop(1, `hsl(${(slide.bgHue + 40) % 360} 70% 12%)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Subtle overlay pattern
    ctx.globalAlpha = 0.08 * alpha;
    for (let i = 0; i < 80; i++) {
      const x = (i * 37) % CANVAS_WIDTH;
      const y = (i * 53) % CANVAS_HEIGHT;
      ctx.beginPath();
      ctx.arc(x, y, 120, 0, Math.PI * 2);
      ctx.fillStyle = `hsl(${(slide.bgHue + i * 5) % 360} 60% 50%)`;
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Title
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'white';
    ctx.font = '700 72px system-ui, Segoe UI, Roboto, Helvetica, Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    const marginX = 72;
    const marginY = 72;
    wrapText(ctx, slide.title, marginX, marginY, CANVAS_WIDTH - marginX * 2, 80);

    // Body
    ctx.globalAlpha = alpha * 0.95;
    ctx.fillStyle = 'hsl(0 0% 92%)';
    ctx.font = '400 36px system-ui, Segoe UI, Roboto, Helvetica, Arial';
    wrapText(ctx, slide.body, marginX, marginY + 140, CANVAS_WIDTH - marginX * 2, 48);

    // Footer
    const footer = 'Generated in your browser ? WebM 30fps';
    ctx.globalAlpha = alpha * 0.6;
    ctx.font = '400 22px system-ui, Segoe UI, Roboto, Helvetica, Arial';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = 'hsl(0 0% 85%)';
    ctx.fillText(footer, CANVAS_WIDTH - marginX, CANVAS_HEIGHT - marginY);

    ctx.restore();
  }, []);

  const generate = useCallback(async () => {
    setIsGenerating(true);
    setError(null);
    setVideo(null);

    const canvas = canvasRef.current;
    if (!canvas) {
      setError('Canvas unavailable');
      setIsGenerating(false);
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setError('Canvas 2D context unavailable');
      setIsGenerating(false);
      return;
    }

    // Setup audio (simple ambient tone sequence) routed to a MediaStream
    const totalSeconds = SLIDES.length * SECONDS_PER_SLIDE;
    let audioDest: MediaStreamAudioDestinationNode | null = null;
    try {
      const audio = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioDest = audio.createMediaStreamDestination();

      // Music graph: two oscillators with slow detune, into a gentle lowpass and gain envelope
      const gain = audio.createGain();
      gain.gain.value = 0.0;

      const lpf = audio.createBiquadFilter();
      lpf.type = 'lowpass';
      lpf.frequency.value = 1200;

      const osc1 = audio.createOscillator();
      osc1.type = 'sine';
      const osc2 = audio.createOscillator();
      osc2.type = 'triangle';

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(lpf);
      lpf.connect(audioDest);

      const now = audio.currentTime;

      // Chord progression (in Hz): Cmaj7 -> Amin7 -> Fmaj7 -> G7
      const chords: [number, number][] = [
        [261.63, 329.63], // C4, E4
        [220.00, 261.63], // A3, C4
        [174.61, 220.00], // F3, A3
        [196.00, 246.94], // G3, B3
      ];

      const chordDur = Math.max(3, Math.floor(totalSeconds / chords.length));
      const steps = Math.ceil(totalSeconds / chordDur);

      for (let i = 0; i < steps; i++) {
        const [f1, f2] = chords[i % chords.length];
        const t0 = now + i * chordDur;
        const t1 = t0 + chordDur;
        osc1.frequency.setValueAtTime(f1, t0);
        osc2.frequency.setValueAtTime(f2, t0);
        osc1.detune.setValueAtTime(0, t0);
        osc2.detune.setValueAtTime(-6, t0);
        // Subtle drift
        osc1.detune.linearRampToValueAtTime(4, t1);
        osc2.detune.linearRampToValueAtTime(-10, t1);

        // Gain envelope per chord
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.exponentialRampToValueAtTime(0.12, t0 + 0.4);
        gain.gain.linearRampToValueAtTime(0.08, t1 - 0.4);
        gain.gain.exponentialRampToValueAtTime(0.0001, t1);
      }

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + totalSeconds + 0.5);
      osc2.stop(now + totalSeconds + 0.5);
    } catch (e) {
      // If audio fails, proceed with silent video
      audioDest = null;
    }

    // Compose final MediaStream
    const canvasStream = (canvas as HTMLCanvasElement).captureStream(FPS);
    const tracks = [...canvasStream.getVideoTracks()];
    if (audioDest) {
      tracks.push(...audioDest.stream.getAudioTracks());
    }
    const stream = new MediaStream(tracks);

    const mimeCandidates = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
    ];

    const mimeType = mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m)) || '';
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, mimeType ? { mimeType, videoBitsPerSecond: 5_000_000 } : { videoBitsPerSecond: 5_000_000 });
    } catch (e) {
      setError('MediaRecorder not supported in this browser.');
      setIsGenerating(false);
      return;
    }

    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) chunks.push(ev.data);
    };

    const totalFrames = SLIDES.length * SECONDS_PER_SLIDE * FPS;
    let frameIndex = 0;

    recorder.start(250); // gather data every 250ms

    const startTime = performance.now();

    const tick = () => {
      const elapsedSec = (performance.now() - startTime) / 1000;
      const slideIndex = Math.min(SLIDES.length - 1, Math.floor(elapsedSec / SECONDS_PER_SLIDE));
      const slideLocalT = elapsedSec - slideIndex * SECONDS_PER_SLIDE; // 0..SECONDS_PER_SLIDE

      // Compute fade alpha
      let alpha = 1.0;
      if (slideLocalT < FADE_SECONDS) {
        alpha = slideLocalT / FADE_SECONDS; // fade in
      } else if (slideLocalT > SECONDS_PER_SLIDE - FADE_SECONDS) {
        alpha = Math.max(0, (SECONDS_PER_SLIDE - slideLocalT) / FADE_SECONDS); // fade out
      }

      drawSlide(ctx, SLIDES[slideIndex], alpha);

      frameIndex++;
      setProgress(Math.min(100, Math.round((frameIndex / totalFrames) * 100)));

      if (frameIndex < totalFrames) {
        requestAnimationFrame(tick);
      } else {
        recorder.stop();
      }
    };

    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType || 'video/webm' });
      const url = URL.createObjectURL(blob);
      setVideo({ url, sizeBytes: blob.size });
      setIsGenerating(false);
      setProgress(100);
    };

    // Initialize first frame immediately then proceed
    requestAnimationFrame(tick);
  }, [drawSlide]);

  return (
    <main className="container">
      <h1>Einstein Video Generator</h1>
      <p className="sub">Create a short WebM video about Albert Einstein directly in your browser.</p>

      <div className="canvasWrap">
        <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} className="canvas" />
      </div>

      <div className="controls">
        <button onClick={generate} disabled={isGenerating} className="btn">
          {isGenerating ? 'Generating?' : 'Generate Video'}
        </button>
        {isGenerating && (
          <div className="progress" aria-live="polite">Progress: {progress}%</div>
        )}
        {error && <div className="error">{error}</div>}
      </div>

      {video && (
        <section className="output">
          <video src={video.url} controls width={CANVAS_WIDTH / 2} />
          <div className="dl">
            <a href={video.url} download="einstein.webm" className="link">Download WebM</a>
            <span className="meta">Size: {(video.sizeBytes / (1024 * 1024)).toFixed(2)} MB</span>
          </div>
        </section>
      )}
    </main>
  );
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
) {
  const words = text.split(' ');
  let line = '';
  let offsetY = y;

  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' ';
    const metrics = ctx.measureText(testLine);
    const testWidth = metrics.width;
    if (testWidth > maxWidth && n > 0) {
      ctx.fillText(line, x, offsetY);
      line = words[n] + ' ';
      offsetY += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, x, offsetY);
}

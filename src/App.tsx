import { useState, useEffect, useRef, ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Upload, 
  Image as ImageIcon, 
  Box, 
  Download, 
  Loader2, 
  AlertCircle, 
  CheckCircle2, 
  ArrowRight,
  Key
} from 'lucide-react';
import { analyzeFloorPlan, generate3DRendering } from './lib/gemini';

// Extend Window interface for AI Studio
declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'analyzing' | 'rendering' | 'completed' | 'error'>('idle');
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasApiKey, setHasApiKey] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    checkApiKey();
  }, []);

  const checkApiKey = async () => {
    if (window.aistudio) {
      const hasKey = await window.aistudio.hasSelectedApiKey();
      setHasApiKey(hasKey);
    }
  };

  const handleSelectKey = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      setHasApiKey(true);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type.startsWith('image/')) {
        setFile(selectedFile);
        const reader = new FileReader();
        reader.onloadend = () => {
          setPreview(reader.result as string);
        };
        reader.readAsDataURL(selectedFile);
        setStatus('idle');
        setResultImage(null);
        setErrorMessage(null);
      } else {
        setErrorMessage("Please upload an image file (PNG, JPG, etc.).");
      }
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const processFloorPlan = async () => {
    if (!file || !preview) return;

    if (!hasApiKey) {
      setErrorMessage("Please select an API key first to use high-quality image generation.");
      return;
    }

    try {
      setStatus('analyzing');
      setErrorMessage(null);

      // Extract base64 data
      const base64Data = preview.split(',')[1];
      const mimeType = file.type;

      // Step 1: Analyze
      const renderPrompt = await analyzeFloorPlan(base64Data, mimeType);
      
      // Step 2: Render
      setStatus('rendering');
      const renderedImage = await generate3DRendering(renderPrompt, base64Data, mimeType);
      
      setResultImage(renderedImage);
      setStatus('completed');
    } catch (error: any) {
      console.error(error);
      setStatus('error');
      setErrorMessage(error.message || "An error occurred during processing.");
    }
  };

  const downloadResult = () => {
    if (!resultImage) return;
    const link = document.createElement('a');
    link.href = resultImage;
    link.download = `3d_render_${file?.name || 'apartment'}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-[#fcfcfc] text-black font-sans selection:bg-orange-500/30">
      <div className="relative z-10 max-w-6xl mx-auto px-6 py-12">
        {/* Header */}
        <header className="mb-16 flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-black/5 pb-8">
          <div>
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 text-orange-600 mb-4"
            >
              <Box size={20} />
              <span className="text-xs font-mono tracking-[0.2em] uppercase font-bold">Architectural Visualizer</span>
            </motion.div>
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-5xl md:text-7xl font-bold tracking-tighter leading-[0.9] text-black"
            >
              K-Apartment <br />
              <span className="text-black/20">2D to 3D</span>
            </motion.h1>
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="flex items-center gap-4"
          >
            {!hasApiKey ? (
              <button 
                onClick={handleSelectKey}
                className="flex items-center gap-2 px-4 py-2 rounded-full border border-orange-600/30 bg-orange-600/5 text-orange-600 text-sm font-medium hover:bg-orange-600/10 transition-colors"
              >
                <Key size={16} />
                Select API Key
              </button>
            ) : (
              <div className="flex items-center gap-2 px-4 py-2 rounded-full border border-green-600/30 bg-green-600/5 text-green-600 text-sm font-medium">
                <CheckCircle2 size={16} />
                API Key Ready
              </div>
            )}
          </motion.div>
        </header>

        {/* Main Content */}
        <main className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Left Column: Upload & Preview */}
          <section className="space-y-8">
            <div 
              onClick={handleUploadClick}
              className={`relative aspect-[4/3] rounded-3xl border-2 border-dashed transition-all cursor-pointer group overflow-hidden
                ${preview ? 'border-black/5 bg-white' : 'border-black/10 hover:border-orange-600/50 hover:bg-black/5'}
              `}
            >
              {preview ? (
                <>
                  <img 
                    src={preview} 
                    alt="Floor plan preview" 
                    className="w-full h-full object-contain p-4"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-full font-medium">
                      <Upload size={18} />
                      Change Image
                    </div>
                  </div>
                </>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center">
                  <div className="w-16 h-16 rounded-full bg-black/5 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Upload className="text-black/40" />
                  </div>
                  <h3 className="text-xl font-medium mb-2">Upload Floor Plan</h3>
                  <p className="text-black/40 text-sm max-w-xs">
                    Drag and drop your 2D floor plan image here, or click to browse.
                  </p>
                </div>
              )}
              <input 
                type="file" 
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                className="hidden"
              />
            </div>

            <div className="flex flex-col gap-4">
              <button
                disabled={!file || status === 'analyzing' || status === 'rendering'}
                onClick={processFloorPlan}
                className={`w-full py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-3 transition-all
                  ${!file || status === 'analyzing' || status === 'rendering'
                    ? 'bg-black/5 text-black/20 cursor-not-allowed'
                    : 'bg-black text-white hover:bg-zinc-800 active:scale-[0.98]'
                  }
                `}
              >
                {status === 'analyzing' ? (
                  <>
                    <Loader2 className="animate-spin" />
                    Analyzing Floor Plan...
                  </>
                ) : status === 'rendering' ? (
                  <>
                    <Loader2 className="animate-spin" />
                    Generating 3D Render...
                  </>
                ) : (
                  <>
                    Generate 3D Isometric View
                    <ArrowRight size={20} />
                  </>
                )}
              </button>

              {errorMessage && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 rounded-xl bg-red-600/5 border border-red-600/20 text-red-600 flex items-start gap-3 text-sm"
                >
                  <AlertCircle size={18} className="shrink-0 mt-0.5" />
                  <p>{errorMessage}</p>
                </motion.div>
              )}
            </div>

            {/* Info Section */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-white border border-black/5">
                <div className="text-black/40 text-xs uppercase tracking-wider mb-1">Perspective</div>
                <div className="font-medium">45° Isometric</div>
              </div>
              <div className="p-4 rounded-2xl bg-white border border-black/5">
                <div className="text-black/40 text-xs uppercase tracking-wider mb-1">Style</div>
                <div className="font-medium">Modern Korean</div>
              </div>
            </div>
          </section>

          {/* Right Column: Result */}
          <section className="space-y-8">
            <div className="relative aspect-[4/3] rounded-3xl bg-white border border-black/5 overflow-hidden flex items-center justify-center shadow-sm">
              <AnimatePresence mode="wait">
                {resultImage ? (
                  <motion.div 
                    key="result"
                    initial={{ opacity: 0, scale: 1.1 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="w-full h-full relative group"
                  >
                    <img 
                      src={resultImage} 
                      alt="3D Isometric Render" 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute top-4 right-4 flex gap-2">
                      <button 
                        onClick={downloadResult}
                        className="p-3 rounded-full bg-white/80 backdrop-blur-md border border-black/10 text-black hover:bg-black hover:text-white transition-all shadow-lg"
                        title="Download Image"
                      >
                        <Download size={20} />
                      </button>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div 
                    key="placeholder"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center text-center p-8"
                  >
                    {status === 'analyzing' || status === 'rendering' ? (
                      <div className="space-y-4">
                        <div className="relative w-24 h-24 mx-auto">
                          <motion.div 
                            animate={{ rotate: 360 }}
                            transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                            className="absolute inset-0 border-2 border-black/5 rounded-full border-t-orange-600"
                          />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <Box className="text-orange-600 animate-pulse" size={32} />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <h3 className="text-lg font-medium">Processing...</h3>
                          <p className="text-black/40 text-sm max-w-[200px]">
                            {status === 'analyzing' ? 'Analyzing architectural layout and room arrangements.' : 'Applying realistic lighting and modern textures.'}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="w-16 h-16 rounded-full bg-black/5 flex items-center justify-center mb-4">
                          <ImageIcon className="text-black/20" />
                        </div>
                        <h3 className="text-xl font-medium text-black/20">Render Output</h3>
                      </>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Status Stepper */}
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border transition-colors
                  ${status === 'analyzing' || status === 'rendering' || status === 'completed' ? 'bg-orange-600 border-orange-600 text-white' : 'border-black/10 text-black/20'}
                `}>
                  1
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium">Layout Analysis</div>
                  <div className="text-xs text-black/40">Detecting walls, windows, and rooms</div>
                </div>
                {status === 'rendering' || status === 'completed' ? <CheckCircle2 size={16} className="text-orange-600" /> : null}
              </div>
              
              <div className="w-px h-6 bg-black/5 ml-4" />

              <div className="flex items-center gap-4">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border transition-colors
                  ${status === 'rendering' || status === 'completed' ? 'bg-orange-600 border-orange-600 text-white' : 'border-black/10 text-black/20'}
                `}>
                  2
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium">3D Rendering</div>
                  <div className="text-xs text-black/40">Applying isometric perspective and textures</div>
                </div>
                {status === 'completed' ? <CheckCircle2 size={16} className="text-orange-600" /> : null}
              </div>
            </div>
          </section>
        </main>

        {/* Footer */}
        <footer className="mt-24 pt-8 border-t border-black/5 flex flex-col md:flex-row justify-between items-center gap-4 text-black/20 text-xs font-mono uppercase tracking-widest">
          <div>© 2026 K-Apartment Visualizer</div>
          <div className="flex gap-6">
            <span className="hover:text-black transition-colors cursor-help">Documentation</span>
            <span className="hover:text-black transition-colors cursor-help">API Reference</span>
            <span className="hover:text-black transition-colors cursor-help">Privacy</span>
          </div>
        </footer>
      </div>
    </div>
  );
}

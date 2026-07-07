/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { jsPDF } from "jspdf";
import { 
  Zap, 
  Layers, 
  Image as ImageIcon, 
  FileText, 
  Download, 
  Copy, 
  Check, 
  ChevronRight, 
  FolderPlus, 
  Trash2, 
  History,
  Terminal,
  Play,
  RotateCcw,
  Sparkles,
  Maximize2,
  Minimize2,
  Link as LinkIcon,
  Settings,
  Key
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useDropzone } from "react-dropzone";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { 
  generateRecapScript, 
  parseGeminiResponse, 
  generateHooks,
  generateCTR,
  generateCoverImage,
  ProjectData, 
  FormatType, 
  ScriptStyle, 
  ScriptMode 
} from "./services/geminiService";
import confetti from "canvas-confetti";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Components ---

const SidebarItem = ({ icon: Icon, label, active, onClick }: { icon: any, label: string, active?: boolean, onClick: () => void }) => (
  <button 
    onClick={onClick}
    className={cn(
      "w-full flex items-center gap-3 px-4 py-3 rounded transition-all duration-200 group text-[10px] font-tech uppercase tracking-widest",
      active 
        ? "bg-neon-yellow text-black glow-yellow" 
        : "text-white/50 hover:text-white hover:bg-white/5"
    )}
  >
    <Icon size={14} className={cn(active ? "text-black" : "text-neon-cyan group-hover:scale-110 transition-transform")} />
    {label}
  </button>
);

const FeatureCard = ({ title, value, icon: Icon }: { title: string, value: string, icon: any }) => (
  <div className="glass-card border-white/5 flex flex-col gap-1 min-w-[150px]">
    <div className="flex items-center gap-2 text-neon-cyan text-[10px] font-tech uppercase font-bold tracking-widest">
      <Icon size={12} />
      {title}
    </div>
    <div className="text-lg font-mono text-neon-yellow truncate">{value}</div>
  </div>
);

// --- Main App ---

export default function App() {
  const [activeTab, setActiveTab] = useState<"create" | "projects" | "settings">("create");
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [isGeneratingHook, setIsGeneratingHook] = useState(false);
  const [isGeneratingCTR, setIsGeneratingCTR] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [imagePrompt, setImagePrompt] = useState("");
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Custom API Key States
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [isApiKeySaved, setIsApiKeySaved] = useState(false);
  
  // Form State
  const [mangaTitle, setMangaTitle] = useState("");
  const [format, setFormat] = useState<FormatType>("Manhwa");
  const [style, setStyle] = useState<ScriptStyle>("Santai Tongkrongan");
  const [mode, setMode] = useState<ScriptMode>("Kilat");
  const [uploadedImages, setUploadedImages] = useState<{ name: string; data: string }[]>([]);
  const [mangaLink, setMangaLink] = useState("");
  
  // Results State
  const [currentProject, setCurrentProject] = useState<Partial<ProjectData> | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("aniki-projects");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const unique: ProjectData[] = [];
          const seenIds = new Set<string>();
          for (const p of parsed) {
            if (p && p.id && !seenIds.has(p.id)) {
              seenIds.add(p.id);
              unique.push(p);
            }
          }
          setProjects(unique);
          localStorage.setItem("aniki-projects", JSON.stringify(unique));
        } else {
          setProjects(parsed);
        }
      } catch (e) {
        console.error("Failed to parse saved projects", e);
      }
    }

    const savedKey = localStorage.getItem("aniki-gemini-api-key");
    if (savedKey) {
      setApiKeyInput(savedKey);
      setIsApiKeySaved(true);
    }

    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  const syncStorage = (data: ProjectData[]) => {
    try {
      localStorage.setItem("aniki-projects", JSON.stringify(data));
    } catch (e) {
      console.error("Storage limit reached, attempting to shrink data...", e);
      // Try to remove older generated images to fit
      let currentData = [...data];
      
      // Step 1: Remove images and generated images from older projects (index > 0)
      for (let i = 1; i < currentData.length; i++) {
        if (currentData[i]) {
          currentData[i] = {
            ...currentData[i],
            images: [],
            generatedAssets: [],
            scenes: currentData[i].scenes?.map(s => ({ ...s, generatedImage: undefined })) || []
          };
        }
      }
      
      try {
        localStorage.setItem("aniki-projects", JSON.stringify(currentData));
        setProjects(currentData);
        alert("Penyimpanan hampir penuh! Gambar di proyek-proyek lama otomatis dihapus dari memori riwayat.");
        return;
      } catch (err) {
        // Step 2: Keep only 3 projects
        if (currentData.length > 3) {
          currentData = currentData.slice(0, 3);
          try {
            localStorage.setItem("aniki-projects", JSON.stringify(currentData));
            setProjects(currentData);
            alert("Penyimpanan penuh! Hanya menyimpan 3 proyek terbaru.");
            return;
          } catch (err2) {
            // Keep going
          }
        }
        
        // Step 3: Keep only the latest project and remove all images from it too if needed
        if (currentData[0]) {
          currentData = [
            {
              ...currentData[0],
              images: [],
              generatedAssets: [],
              scenes: currentData[0].scenes?.map(s => ({ ...s, generatedImage: undefined })) || []
            } as ProjectData
          ];
        }
        
        try {
          localStorage.setItem("aniki-projects", JSON.stringify(currentData));
          setProjects(currentData);
          alert("Penyimpanan browser sangat penuh! Riwayat gambar dihapus agar naskah teks tetap tersimpan.");
        } catch (err3) {
          console.error("Failed to save even minimal project data", err3);
          alert("Penyimpanan browser benar-benar penuh! Gagal menyimpan riwayat proyek ke browser.");
        }
      }
    }
  };

  const saveProject = (project: ProjectData) => {
    // Optimized project for storage (remove raw input images but keep AI generated assets)
    const storageProject = { ...project, images: [] }; 
    
    const exists = projects.some(p => p.id === project.id);
    let newProjects: ProjectData[];
    if (exists) {
      newProjects = projects.map(p => p.id === project.id ? (storageProject as ProjectData) : p);
    } else {
      newProjects = [storageProject as ProjectData, ...projects];
    }
    
    setProjects(newProjects);
    syncStorage(newProjects);
    
    confetti({
      particleCount: 150,
      spread: 70,
      origin: { y: 0.6 },
      colors: ["#facc15", "#22d3ee"]
    });
  };

  const handleGenerate = async () => {
    if (!mangaTitle) return alert("Masukkan judul dulu, cuy!");
    setLoading(true);
    setStep(2);
    
    try {
      const rawResponse = await generateRecapScript({
        mangaTitle,
        format,
        style,
        mode,
        imageDatas: uploadedImages.map(img => img.data)
      });
      
      const parsed = parseGeminiResponse(rawResponse);
      const project: ProjectData = {
        id: Date.now().toString(),
        title: `${mangaTitle} - ${new Date().toLocaleDateString()}`,
        mangaTitle,
        format,
        style,
        mode,
        script: rawResponse,
        ...parsed,
        images: uploadedImages.map(img => img.data),
        generatedAssets: [],
        createdAt: Date.now()
      };
      
      setCurrentProject(project);
      setStep(3);
    } catch (err) {
      console.error(err);
      alert("Waduh, koneksi ke AI gagal. Coba lagi nanti ya!");
      setStep(1);
    } finally {
      setLoading(false);
    }
  };

  const onDrop = async (acceptedFiles: File[]) => {
    const filePromises = acceptedFiles.map(file => {
      return new Promise<{ name: string; data: string }>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve({ name: file.name, data: reader.result as string });
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    });

    try {
      const results = await Promise.all(filePromises);
      setUploadedImages(prev => {
        const combined = [...prev, ...results];
        combined.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
        return combined;
      });
    } catch (err) {
      console.error("Error reading files:", err);
      alert("Gagal membaca beberapa file.");
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop,
    accept: { 'image/*': [] },
    multiple: true
  } as any);

  const handleAddHook = async () => {
    if (!currentProject?.script) return;
    setIsGeneratingHook(true);
    try {
      const hooks = await generateHooks(currentProject.script);
      const updated = { ...currentProject, hooks: [...(currentProject.hooks || []), ...hooks] };
      setCurrentProject(updated);
      saveProject(updated as ProjectData);
    } catch (e) {
      console.error(e);
    } finally {
      setIsGeneratingHook(false);
    }
  };

  const handleAddCTR = async () => {
    if (!currentProject?.script) return;
    setIsGeneratingCTR(true);
    try {
      const { titles, thumbnails } = await generateCTR(currentProject.script);
      const updated = { 
        ...currentProject, 
        youtubeTitles: [...(currentProject.youtubeTitles || []), ...titles],
        thumbnailIdeas: [...(currentProject.thumbnailIdeas || []), ...thumbnails]
      };
      setCurrentProject(updated);
      saveProject(updated as ProjectData);
    } catch (e) {
      console.error(e);
    } finally {
      setIsGeneratingCTR(false);
    }
  };

  const handleGenerateImage = async () => {
    if (!imagePrompt) return alert("Masukkan prompt gambar dulu, cuy!");
    setIsGeneratingImage(true);
    try {
      const imageUrl = await generateCoverImage({ prompt: imagePrompt });
      if (imageUrl && currentProject) {
        const updated = {
          ...currentProject,
          generatedAssets: [...(currentProject.generatedAssets || []), imageUrl]
        };
        setCurrentProject(updated);
        saveProject(updated as ProjectData);
      }
    } catch (e) {
      console.error(e);
      alert("Gagal bikin gambar, cuy.");
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // Simple toast or active state could be added here
  };

  const downloadText = (filename: string, content: string) => {
    const element = document.createElement("a");
    const file = new Blob([content], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = filename;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const downloadPDF = (project: Partial<ProjectData>) => {
    const doc = new jsPDF();
    
    // Header
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(0, 255, 102); // Neon Green RGB
    doc.text("RECAP GENERATOR V2", 20, 20);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(100, 100, 100);
    doc.text(`Naskah Recap Manga Otomatis - Satu Gambar Satu Paragraf`, 20, 26);
    
    // Draw background block for project meta
    doc.setFillColor(245, 245, 245);
    doc.rect(20, 32, 170, 20, "F");
    
    doc.setTextColor(0, 100, 200); // Blue
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(`Judul: ${project.mangaTitle || "N/A"}`, 24, 40);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text(`Format: ${project.format || "N/A"} | Gaya: ${project.style || "N/A"} | Mode: ${project.mode || "N/A"}`, 24, 47);
    
    let y = 62;
    const pageHeight = doc.internal.pageSize.height;
    
    if (project.scenes && project.scenes.length > 0) {
      project.scenes.forEach((scene, index) => {
        if (y > pageHeight - 40) {
          doc.addPage();
          y = 20;
        }
        
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(0, 180, 80); // Green
        doc.text(`${scene.title || `Paragraf ${index + 1}`}`, 20, y);
        y += 6;
        
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(50, 50, 50);
        
        const lines = doc.splitTextToSize(scene.narrative || "", 170);
        lines.forEach((line: string) => {
          if (y > pageHeight - 20) {
            doc.addPage();
            y = 20;
          }
          doc.text(line, 20, y);
          y += 5;
        });
        
        if (scene.imagePrompt) {
          y += 2;
          doc.setFont("helvetica", "italic");
          doc.setFontSize(8);
          doc.setTextColor(120, 120, 120);
          const promptLines = doc.splitTextToSize(`Prompt Visual: ${scene.imagePrompt}`, 170);
          promptLines.forEach((line: string) => {
            if (y > pageHeight - 20) {
              doc.addPage();
              y = 20;
            }
            doc.text(line, 20, y);
            y += 4;
          });
        }
        
        y += 8; // Spacer
      });
    } else {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(50, 50, 50);
      const lines = doc.splitTextToSize(project.script || "", 170);
      lines.forEach((line: string) => {
        if (y > pageHeight - 20) {
          doc.addPage();
          y = 20;
        }
        doc.text(line, 20, y);
        y += 5;
      });
    }
    
    doc.save(`${project.mangaTitle || "recap"}-script.pdf`);
  };

  const handleGenerateImageForScene = async (prompt: string, sceneIndex: number) => {
    setIsGeneratingImage(true);
    try {
      const imageUrl = await generateCoverImage({ prompt });
      if (imageUrl && currentProject) {
        const updatedScenes = [...(currentProject.scenes || [])];
        if (updatedScenes[sceneIndex]) {
          updatedScenes[sceneIndex] = {
            ...updatedScenes[sceneIndex],
            generatedImage: imageUrl
          };
        }
        const updated = {
          ...currentProject,
          scenes: updatedScenes,
          generatedAssets: [...(currentProject.generatedAssets || []), imageUrl]
        };
        setCurrentProject(updated);
        saveProject(updated as ProjectData);
        
        confetti({
          particleCount: 50,
          spread: 30,
          colors: ["#00ff66", "#00d2ff"]
        });
      }
    } catch (e) {
      console.error(e);
      alert("Gagal bikin gambar untuk adegan ini, cuy.");
    } finally {
      setIsGeneratingImage(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row selection:bg-neon-cyan selection:text-black">
      <div className="scanline" />
      
      {/* Mobile Header */}
      <header className="lg:hidden flex items-center justify-between p-4 bg-black/80 backdrop-blur-xl border-b border-white/10 sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-neon-green flex items-center justify-center font-black text-black text-sm rounded-sm -skew-x-12 glow-green">
            RG
          </div>
          <h1 className="font-tech font-black text-sm tracking-tighter italic uppercase">RECAP GENERATOR <span className="text-white">V2</span></h1>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={toggleFullscreen}
            className="p-2 text-white/50 hover:text-neon-yellow transition-colors"
            title="Full Screen"
          >
            {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
          </button>
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 text-neon-cyan"
          >
            {isSidebarOpen ? <RotateCcw size={20} /> : <Layers size={20} />}
          </button>
        </div>
      </header>

      {/* Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[45] lg:hidden"
          />
        )}
      </AnimatePresence>
      
      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 w-64 border-r border-white/10 bg-black/90 lg:bg-black/50 backdrop-blur-xl p-6 flex flex-col gap-8 z-50 transition-transform duration-300 transform lg:translate-x-0 lg:sticky lg:top-0 h-screen",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="hidden lg:flex items-center gap-3">
          <div className="w-10 h-10 bg-neon-green flex items-center justify-center font-black text-black text-xl rounded-sm -skew-x-12 glow-green">
            RG
          </div>
          <div>
            <h1 className="font-tech font-black text-md tracking-tighter italic uppercase leading-none">RECAP GENERATOR <span className="text-white">V2</span></h1>
            <p className="text-[10px] uppercase tracking-widest text-neon-cyan leading-none mt-1">AI Video Recap Suite</p>
          </div>
        </div>

        <nav className="flex flex-col gap-2">
          <SidebarItem 
            icon={Zap} 
            label="TEMPA NASKAH" 
            active={activeTab === "create"} 
            onClick={() => { setActiveTab("create"); setIsSidebarOpen(false); }} 
          />
          <SidebarItem 
            icon={History} 
            label="PROYEK SAYA" 
            active={activeTab === "projects"} 
            onClick={() => { setActiveTab("projects"); setIsSidebarOpen(false); }} 
          />
          <SidebarItem 
            icon={Settings} 
            label="PENGATURAN API" 
            active={activeTab === "settings"} 
            onClick={() => { setActiveTab("settings"); setIsSidebarOpen(false); }} 
          />
          <button 
            onClick={toggleFullscreen}
            className="w-full flex items-center gap-3 px-4 py-3 rounded transition-all duration-200 group text-[10px] font-tech uppercase tracking-widest text-white/50 hover:text-white hover:bg-white/5 mt-auto"
          >
            {isFullscreen ? <Minimize2 size={14} className="text-neon-yellow" /> : <Maximize2 size={14} className="text-neon-cyan group-hover:scale-110 transition-transform" />}
            {isFullscreen ? "KELUAR FULLSCREEN" : "LAYAR PENUH"}
          </button>
        </nav>

        <div className="mt-auto glass-card border-neon-yellow/20 p-3">
          <div className="text-[10px] uppercase font-tech text-neon-yellow mb-2">System Status</div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              AI Core: Online
            </div>
            <div className="flex items-center gap-2 text-[10px] text-white/50 font-mono">
              <Key size={10} className={isApiKeySaved ? "text-neon-cyan animate-pulse" : "text-white/30"} />
              Key: {isApiKeySaved ? "CUSTOM KEY" : "DEFAULT AI STUDIO"}
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 lg:p-8 relative">
        <AnimatePresence mode="wait">
          {activeTab === "create" ? (
            <motion.div 
              key="create"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-5xl mx-auto"
            >
              {/* Header Title */}
              <div className="mb-8 lg:mb-12 flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
                <div>
                  <h2 className="text-3xl lg:text-4xl font-black font-tech uppercase tracking-tighter mb-2">
                    RECAP <span className="text-neon-green">GENERATOR V2</span>
                  </h2>
                  <p className="text-white/50 text-sm lg:text-base max-w-lg">
                    Ubah Chapter Manga/Manhwa jadi script narasi viral YouTube otomatis.
                  </p>
                </div>
                
                {/* Step Visualizer */}
                <div className="w-full lg:w-auto flex items-center justify-center lg:justify-start gap-1 bg-black/40 p-1 rounded-full border border-white/10">
                  {[1, 2, 3].map((s) => (
                    <div 
                      key={s} 
                      className={cn(
                        "flex-1 lg:flex-none text-center lg:px-6 py-1.5 rounded-full text-[9px] lg:text-[10px] font-bold transition-all duration-300 uppercase tracking-wider whitespace-nowrap",
                        step === s 
                          ? "bg-neon-yellow text-black shadow-[0_0_15px_rgba(239,255,0,0.3)]" 
                          : "text-white/40"
                      )}
                    >
                      {s === 1 ? "1. BAHAN" : s === 2 ? "2. ANALISIS" : "3. SELESAI"}
                    </div>
                  ))}
                </div>
              </div>

              {/* Step 1: Input Bahan */}
              {step === 1 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div className="glass-card border-white/10 p-6 space-y-6">
                      <h3 className="text-xs font-bold uppercase text-neon-cyan flex items-center gap-2">
                        <Terminal size={14} /> 1. Konfigurasi Proyek
                      </h3>
                      
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-tech text-white/50 tracking-wider">Judul Manga / Manhwa</label>
                        <input 
                          type="text" 
                          value={mangaTitle}
                          onChange={(e) => setMangaTitle(e.target.value)}
                          placeholder="Solo Leveling: Jeju Island Arc" 
                          className="w-full bg-black/50 border border-white/20 rounded px-4 py-2 text-sm text-neon-yellow outline-none focus:border-neon-yellow transition-all"
                        />
                      </div>

                      {/* Word count features removed per user request */}

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-xs uppercase font-tech text-white/60 tracking-wider">Format</label>
                          <div className="flex p-1 bg-black/50 border border-white/10 rounded-lg">
                            {(["Manga", "Manhwa"] as FormatType[]).map((f) => (
                              <button
                                key={f}
                                onClick={() => setFormat(f)}
                                className={cn(
                                  "flex-1 py-2 text-xs font-tech rounded-md transition-all",
                                  format === f ? "bg-neon-cyan text-black" : "text-white/40 hover:text-white"
                                )}
                              >
                                {f}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs uppercase font-tech text-white/60 tracking-wider">Mode</label>
                          <div className="flex p-1 bg-black/50 border border-white/10 rounded-lg">
                            {(["Kilat", "Seri"] as ScriptMode[]).map((m) => (
                              <button
                                key={m}
                                onClick={() => setMode(m)}
                                className={cn(
                                  "flex-1 py-2 text-xs font-tech rounded-md transition-all",
                                  mode === m ? "bg-neon-cyan text-black" : "text-white/40 hover:text-white"
                                )}
                              >
                                {m}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs uppercase font-tech text-white/60 tracking-wider">Gaya Narasi AI</label>
                        <div className="grid grid-cols-2 gap-2">
                          {(["Santai Tongkrongan", "Storytelling Serius", "Dramatis", "Funny / Roasting", "Cinematic Trailer", "Meme Recap"] as ScriptStyle[]).map((s) => (
                            <button
                              key={s}
                              onClick={() => setStyle(s)}
                              className={cn(
                                "py-3 px-4 text-[10px] font-tech text-left rounded-lg border transition-all",
                                style === s 
                                  ? "bg-neon-cyan/10 border-neon-cyan text-neon-cyan" 
                                  : "bg-black/20 border-white/10 text-white/40 hover:border-white/30"
                              )}
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="glass-card border-neon-magenta/30 p-6 space-y-4">
                       <h3 className="font-tech uppercase text-neon-magenta flex items-center gap-2">
                        <Download size={18} /> Bulk Image Downloader
                      </h3>
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          value={mangaLink}
                          onChange={(e) => setMangaLink(e.target.value)}
                          placeholder="Masukkan link web manga (optional)..." 
                          className="flex-1 bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-xs outline-none focus:border-neon-magenta"
                        />
                        <a 
                          href="https://sites.google.com/view/aniimage/aniimage" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="px-4 py-2 bg-neon-magenta/20 text-neon-magenta border border-neon-magenta/40 rounded-lg text-[10px] font-tech hover:bg-neon-magenta/30 transition-all flex items-center justify-center pointer-events-auto"
                        >
                          EXTRACT
                        </a>
                      </div>
                      <p className="text-[10px] text-white/30 italic">
                        *Klik EXTRACT untuk membuka tools pengunduh manga eksternal kami.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="glass-card border-neon-yellow/30 p-6 space-y-4 min-h-[300px] flex flex-col">
                      <h3 className="font-tech uppercase text-neon-yellow flex items-center gap-2">
                        <ImageIcon size={18} /> Upload Panel Pelengkap
                      </h3>
                      
                      <div 
                        {...getRootProps()} 
                        className={cn(
                          "flex-1 border-2 border-dashed rounded-xl flex flex-col items-center justify-center p-8 transition-all cursor-pointer",
                          isDragActive ? "border-neon-yellow bg-neon-yellow/5" : "border-white/10 hover:border-neon-yellow/50"
                        )}
                      >
                        <input {...getInputProps()} />
                        <Sparkles className="text-neon-yellow mb-4 animate-bounce" size={40} />
                        <p className="text-sm font-tech text-white text-center">Drag & Drop Panel Manga</p>
                        <p className="text-[10px] text-white/40 mt-1">AI akan menganalisis panel ini untuk script</p>
                      </div>

                      {uploadedImages.length > 0 && (
                        <div className="space-y-2 mt-4">
                          <div className="flex justify-between items-center px-1">
                            <span className="text-[10px] font-tech text-white/40 uppercase tracking-widest">{uploadedImages.length} Panel Terpilih</span>
                            <button 
                              onClick={() => setUploadedImages([])}
                              className="text-[10px] font-tech text-red-400 hover:text-red-300 uppercase tracking-widest"
                            >
                              Bersihkan Semua
                            </button>
                          </div>
                          <div className="grid grid-cols-3 gap-2 max-h-[150px] overflow-y-auto pr-2 custom-scrollbar">
                            {uploadedImages.map((img, i) => (
                              <div key={i} className="relative group aspect-square">
                                <img src={img.data} className="w-full h-full object-cover rounded border border-white/10" />
                                <div className="absolute top-1 left-1 bg-black/70 px-1.5 py-0.5 rounded text-[8px] font-tech text-neon-yellow border border-neon-yellow/30">
                                  #{i + 1}
                                </div>
                                <div className="absolute bottom-1 left-1 right-1 bg-black/85 px-1 py-0.5 rounded text-[7px] font-tech text-white/90 truncate" title={img.name}>
                                  {img.name}
                                </div>
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setUploadedImages(prev => prev.filter((_, idx) => idx !== i));
                                  }}
                                  className="absolute top-1 right-1 p-1 bg-black/80 text-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <Trash2 size={10} />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <button 
                      onClick={handleGenerate}
                      className="w-full py-6 tech-button tech-button-yellow text-xl group"
                    >
                      <span className="flex items-center justify-center gap-3">
                        GENERATE RECAP <ChevronRight className="group-hover:translate-x-1 transition-transform" />
                      </span>
                    </button>
                  </div>
                </div>
              )}

              {/* Step 2: Loading / Analysis */}
              {step === 2 && (
                <div className="flex flex-col items-center justify-center py-20 space-y-8">
                  <div className="relative w-48 h-48">
                    <motion.div 
                      animate={{ rotate: 360 }}
                      transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                      className="absolute inset-0 rounded-full border-4 border-t-neon-cyan border-white/5"
                    />
                    <motion.div 
                      animate={{ rotate: -360 }}
                      transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                      className="absolute inset-4 rounded-full border-4 border-b-neon-yellow border-white/5"
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Zap size={48} className="text-neon-cyan animate-pulse" />
                    </div>
                  </div>
                  
                  <div className="text-center space-y-2">
                    <h3 className="text-2xl font-tech font-bold uppercase tracking-widest text-neon-cyan">Menganalisis Bahan...</h3>
                    <p className="text-white/40 animate-pulse font-tech text-xs tracking-widest uppercase">
                      AI sedang meracik bumbu narasi viral untuk {mangaTitle}
                    </p>
                  </div>

                  <div className="w-full max-w-md bg-white/5 border border-white/10 h-2 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: "0%" }}
                      animate={{ width: "95%" }}
                      transition={{ duration: 15 }}
                      className="h-full bg-gradient-to-r from-neon-cyan to-neon-yellow"
                    />
                  </div>
                </div>
              )}

              {/* Step 3: Selesai / Results */}
              {step === 3 && currentProject && (
                <div className="animate-in fade-in slide-in-from-bottom-10 space-y-8">
                  <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-1 bg-neon-yellow text-black text-[10px] font-black uppercase rounded">{currentProject.mode}</span>
                        <span className="px-2 py-1 bg-white/10 text-white/60 text-[10px] font-black uppercase rounded">{currentProject.style}</span>
                      </div>
                      <h3 className="text-2xl font-tech font-black text-white">{currentProject.mangaTitle} RECAP</h3>
                    </div>
                    
                    <div className="flex w-full sm:w-auto gap-2">
                      <button 
                        onClick={() => setStep(1)}
                        className="flex-1 sm:flex-none p-3 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-all flex items-center justify-center" title="Ulangi"
                      >
                        <RotateCcw size={20} />
                      </button>
                      <button 
                        onClick={() => saveProject(currentProject as ProjectData)}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-neon-cyan text-black font-tech font-bold rounded-lg hover:glow-cyan transition-all"
                      >
                        <FolderPlus size={18} /> <span className="text-xs">SIMPAN</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className={cn("space-y-6", (!currentProject.hooks?.length && !currentProject.youtubeTitles?.length) ? "lg:col-span-3" : "lg:col-span-2")}>
                      {/* Script Preview */}
                      <div className="glass-card border-neon-cyan/30 overflow-hidden flex flex-col">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center px-6 py-3 border-b border-white/10 bg-white/5 gap-3">
                          <div className="flex items-center gap-2 font-tech text-xs text-neon-cyan font-bold tracking-widest">
                            <FileText size={14} /> 
                            SCRIPT_OUTPUT.LOG
                            <span className="text-[10px] text-white/40 ml-2 font-sans font-normal lowercase">
                              ({currentProject.script?.length || 0} karakter)
                            </span>
                          </div>
                          <div className="flex gap-2 flex-wrap justify-end">
                            <button 
                              onClick={() => copyToClipboard(currentProject.script || "")}
                              className="text-[10px] font-bold bg-white/10 px-3 py-1 rounded hover:bg-white/20 transition-colors uppercase"
                            >
                              COPY
                            </button>
                            <button 
                              onClick={() => downloadText(`${currentProject.mangaTitle}-script.txt`, currentProject.script || "")}
                              className="text-[10px] font-bold bg-white/10 px-3 py-1 rounded hover:bg-white/20 transition-colors uppercase"
                              title="Unduh Naskah Dokumen (.txt)"
                            >
                              DOKUMEN (.TXT)
                            </button>
                            <button 
                              onClick={() => downloadPDF(currentProject)}
                              className="text-[10px] font-bold bg-neon-green/20 text-neon-green border border-neon-green/30 px-3 py-1 rounded hover:bg-neon-green/30 transition-colors uppercase"
                              title="Unduh Naskah PDF (.pdf)"
                            >
                              PDF (.PDF)
                            </button>
                          </div>
                        </div>
                        <div className="p-6 h-[500px] overflow-y-auto bg-black/20 font-sans leading-relaxed whitespace-pre-wrap text-sm text-white/80">
                          {currentProject.script}
                        </div>
                        <div className="p-4 border-t border-white/10 bg-white/5 flex flex-wrap gap-4">
                          <button 
                             onClick={handleAddHook}
                             disabled={isGeneratingHook}
                             className={cn(
                               "flex-1 min-w-[140px] py-3 rounded-lg font-tech text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2",
                               isGeneratingHook ? "bg-white/5 text-white/20" : "bg-neon-yellow/10 text-neon-yellow border border-neon-yellow/20 hover:bg-neon-yellow/30 hover:glow-yellow-sm"
                             )}
                           >
                             {isGeneratingHook ? <RotateCcw size={14} className="animate-spin" /> : <Sparkles size={14} />} 
                             TAMBAHKAN HOOK
                           </button>
                           <button 
                             onClick={handleAddCTR}
                             disabled={isGeneratingCTR}
                             className={cn(
                               "flex-1 min-w-[140px] py-3 rounded-lg font-tech text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2",
                               isGeneratingCTR ? "bg-white/5 text-white/20" : "bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/20 hover:bg-neon-cyan/30 hover:glow-cyan-sm"
                             )}
                           >
                             {isGeneratingCTR ? <RotateCcw size={14} className="animate-spin" /> : <Zap size={14} />} 
                             GENERATE CTR
                           </button>
                        </div>
                      </div>

                      {/* Video Structure / Scenes */}
                      {currentProject.scenes && currentProject.scenes.length > 0 && (
                        <div className="space-y-4">
                          <h4 className="font-tech uppercase text-neon-green tracking-widest text-xs flex items-center gap-2">
                            <Layers size={14} /> LOGIKA SATU GAMBAR SATU PARAGRAF
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {currentProject.scenes?.map((scene, i) => (
                              <div key={i} className="glass-card border-white/5 bg-black/40 p-4 text-xs flex flex-col gap-3 justify-between hover:border-neon-green/30 transition-all">
                                <div className="space-y-2">
                                  <div className="flex justify-between items-center">
                                    <div className="text-neon-green font-tech font-bold uppercase tracking-wider">{scene.title}</div>
                                    <span className="text-[9px] text-white/30 font-tech">#{i + 1} PARAGRAF</span>
                                  </div>
                                  <p className="text-white/80 leading-relaxed whitespace-pre-wrap">{scene.narrative}</p>
                                  
                                  {scene.imagePrompt && (
                                    <div className="bg-black/30 p-2 rounded border border-white/5 space-y-1">
                                      <div className="text-neon-blue font-tech text-[9px] uppercase tracking-widest flex items-center gap-1">
                                        <Sparkles size={10} /> PROMPT VISUAL
                                      </div>
                                      <p className="text-white/40 text-[10px] italic">{scene.imagePrompt}</p>
                                    </div>
                                  )}
                                  
                                  {scene.generatedImage && (
                                    <div className="relative mt-2 rounded overflow-hidden border border-white/10 aspect-video group">
                                      <img src={scene.generatedImage} className="w-full h-full object-cover" />
                                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                        <button 
                                          onClick={() => {
                                            const element = document.createElement("a");
                                            element.href = scene.generatedImage || "";
                                            element.download = `${currentProject.mangaTitle || "scene"}-${i + 1}.png`;
                                            document.body.appendChild(element);
                                            element.click();
                                            document.body.removeChild(element);
                                          }}
                                          className="p-1.5 bg-black/80 hover:bg-neon-green hover:text-black rounded text-white transition-colors"
                                          title="Unduh Gambar"
                                        >
                                          <Download size={14} />
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                                
                                <button
                                  onClick={() => handleGenerateImageForScene(scene.imagePrompt || scene.narrative, i)}
                                  disabled={isGeneratingImage}
                                  className={cn(
                                    "w-full py-1.5 rounded font-tech text-[10px] uppercase tracking-wider transition-all flex items-center justify-center gap-1 mt-2",
                                    isGeneratingImage 
                                      ? "bg-white/5 text-white/20" 
                                      : scene.generatedImage 
                                        ? "bg-neon-blue/10 text-neon-blue border border-neon-blue/20 hover:bg-neon-blue/20"
                                        : "bg-neon-green/10 text-neon-green border border-neon-green/20 hover:bg-neon-green/20"
                                  )}
                                >
                                  {isGeneratingImage ? <RotateCcw size={10} className="animate-spin" /> : <ImageIcon size={10} />}
                                  {scene.generatedImage ? "TEMPA ULANG VISUAL" : "TEMPA VISUAL"}
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {(currentProject.hooks?.length ?? 0) > 0 || (currentProject.youtubeTitles?.length ?? 0) > 0 ? (
                      <div className="space-y-6">
                        {/* Viral Hook Generator */}
                        {currentProject.hooks && currentProject.hooks.length > 0 && (
                          <div className="glass-card border-neon-yellow/30 p-5 space-y-4">
                            <div className="flex items-center gap-2 text-neon-yellow font-tech text-xs uppercase font-bold">
                              <Sparkles size={16} /> Viral Hooks
                            </div>
                            <div className="space-y-3">
                              {currentProject.hooks?.map((hook, i) => (
                                <div key={i} className="group relative">
                                  <div className={cn(
                                    "p-3 bg-white/5 rounded text-[11px] leading-snug transition-all border-l-2 text-white/80",
                                    i % 2 === 0 ? "border-neon-yellow" : "border-neon-cyan"
                                  )}>
                                    {hook}
                                  </div>
                                  <button 
                                    onClick={() => copyToClipboard(hook)}
                                    className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 p-1 text-neon-cyan"
                                  >
                                    <Copy size={12} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* SEO Tools */}
                        {(currentProject.youtubeTitles?.length || currentProject.thumbnailIdeas?.length) ? (
                          <div className="glass-card border-white/10 p-5 space-y-4">
                            <div className="flex items-center gap-2 text-neon-cyan font-tech text-[10px] uppercase font-bold tracking-widest">
                              <Play size={14} className="text-neon-cyan" /> YouTube Pack
                            </div>
                            
                            {currentProject.youtubeTitles && currentProject.youtubeTitles.length > 0 && (
                              <div className="space-y-2">
                                <div className="text-[10px] uppercase font-tech text-white/30 tracking-widest">Auto Judul Suggestion</div>
                                {currentProject.youtubeTitles?.map((title, i) => (
                                  <div key={i} className="text-[11px] font-medium p-1 truncate hover:text-neon-yellow transition-colors cursor-pointer">🔥 {title}</div>
                                ))}
                              </div>
                            )}

                            {currentProject.thumbnailIdeas && currentProject.thumbnailIdeas.length > 0 && (
                              <div className="pt-2 border-t border-white/5 space-y-2">
                                <div className="text-[10px] uppercase font-tech text-white/30 tracking-widest">Thumbnail Concept</div>
                                {currentProject.thumbnailIdeas?.map((idea, i) => (
                                  <div key={i} className="p-3 bg-neon-cyan/5 rounded border border-neon-cyan/10">
                                    <div className="text-neon-cyan font-bold text-xs uppercase tracking-tighter">Text: "{idea.text}"</div>
                                    <div className="text-[10px] text-white/60 mt-1">{idea.concept}</div>
                                  </div>
                                ))}
                              </div>
                            )}

                            {currentProject.durationEstimate && currentProject.durationEstimate !== "~0:00" && (
                              <div className="pt-2 border-t border-white/5 flex justify-between items-center">
                                <div className="text-[10px] uppercase font-tech text-white/30">Estimation</div>
                                <div className="text-neon-cyan font-tech text-xs">{currentProject.durationEstimate}</div>
                              </div>
                            )}
                          </div>
                        ) : null}

                        {/* Visual Studio */}
                        <div className="glass-card border-none bg-white/[0.02] p-5 space-y-4">
                          <div className="flex items-center gap-2 text-neon-magenta font-tech text-xs uppercase font-bold">
                            <ImageIcon size={16} /> Asset Visual Generator
                          </div>
                          <div className="space-y-3">
                            <textarea 
                              value={imagePrompt}
                              onChange={(e) => setImagePrompt(e.target.value)}
                              placeholder="Deskripsikan aset visual (misal: Protagonis badass dengan aura petir)..."
                              className="w-full bg-black/40 border border-white/10 rounded p-3 text-xs text-white/80 outline-none focus:border-neon-magenta transition-all h-20 resize-none"
                            />
                            <button 
                              onClick={handleGenerateImage}
                              disabled={isGeneratingImage || !imagePrompt}
                              className={cn(
                                "w-full py-3 rounded-lg font-tech text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2",
                                isGeneratingImage ? "bg-white/5 text-white/20" : "bg-neon-magenta/10 text-neon-magenta border border-neon-magenta/20 hover:bg-neon-magenta/20"
                              )}
                            >
                              {isGeneratingImage ? <RotateCcw size={14} className="animate-spin" /> : <Zap size={14} />} 
                              TEMPA VISUAL ASSET
                            </button>

                            {currentProject.generatedAssets && currentProject.generatedAssets.length > 0 && (
                              <div className="grid grid-cols-1 gap-2 mt-4">
                                {currentProject.generatedAssets.map((asset, i) => (
                                  <div key={i} className="relative group rounded overflow-hidden border border-white/10 aspect-video bg-black/50">
                                    <img src={asset} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                      <button 
                                        onClick={() => {
                                          const link = document.createElement('a');
                                          link.href = asset;
                                          link.download = `asset-${i}.png`;
                                          link.click();
                                        }}
                                        className="p-2 bg-neon-cyan text-black rounded-full"
                                      >
                                        <Download size={14} />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Export CTA */}
                        <div className="grid grid-cols-2 gap-2">
                          <button 
                            onClick={() => downloadText(`${currentProject.mangaTitle}-subs.srt`, "1\n00:00:01,000 --> 00:00:04,000\nSubtitle generated by Manga Only Studio")}
                            className="flex flex-col items-center justify-center gap-1 py-4 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-all text-white/60"
                          >
                            <FileText size={20} />
                            <span className="text-[9px] font-tech font-black tracking-tighter">SRT</span>
                          </button>
                          <button className="flex flex-col items-center justify-center gap-1 py-4 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-all text-white/60">
                            <Music size={20} />
                            <span className="text-[9px] font-tech font-black tracking-tighter">VOICE</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="lg:col-span-1 space-y-6">
                         {/* Export Tools */}
                         <div className="glass-card border-white/10 p-5 space-y-4">
                           <div className="text-[10px] uppercase font-tech text-white/30 tracking-widest mb-2">Export Tools</div>
                           <div className="grid grid-cols-2 gap-2">
                             <button 
                               onClick={() => downloadText(`${currentProject.mangaTitle}-subs.srt`, "1\n00:00:01,000 --> 00:00:04,000\nSubtitle generated by Manga Only Studio")}
                               className="flex flex-col items-center justify-center gap-1 py-4 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-all text-white/60"
                             >
                               <FileText size={20} />
                               <span className="text-[9px] font-tech font-black tracking-tighter">SRT</span>
                             </button>
                             <button className="flex flex-col items-center justify-center gap-1 py-4 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-all text-white/60">
                               <Music size={20} />
                               <span className="text-[9px] font-tech font-black tracking-tighter">VOICE</span>
                             </button>
                           </div>
                         </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          ) : activeTab === "projects" ? (
            <motion.div 
              key="projects"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-6xl mx-auto"
            >
              <div className="mb-8 lg:mb-12">
                <h2 className="text-3xl lg:text-4xl font-black font-tech uppercase tracking-tighter mb-2">
                  ARCHIVE <span className="text-neon-cyan">PROJECTS</span>
                </h2>
                <p className="text-white/50 text-sm lg:text-base">Kelola riwayat tempa naskah kamu di sini.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {projects.length === 0 ? (
                  <div className="col-span-full py-20 flex flex-col items-center opacity-20">
                    <FolderPlus size={64} />
                    <p className="mt-4 font-tech uppercase tracking-widest text-sm">Belum ada proyek simpanan</p>
                  </div>
                ) : (
                  projects.map((p) => (
                    <div key={p.id} className="glass-card group hover:neon-border-cyan transition-all">
                      <div className="flex justify-between items-start mb-4">
                        <div className="text-[10px] font-tech text-white/40 uppercase">DIBUAT PADA {new Date(p.createdAt).toLocaleDateString()}</div>
                        <button 
                          onClick={() => {
                            const filtered = projects.filter(item => item.id !== p.id);
                            setProjects(filtered);
                            syncStorage(filtered);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 text-red-500 hover:bg-red-500/10 rounded transition-all"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <h4 className="text-lg font-bold truncate mb-2">{p.title}</h4>
                      <div className="flex flex-wrap gap-1 mb-4">
                        <span className="px-2 py-0.5 bg-neon-cyan/10 text-neon-cyan text-[9px] rounded uppercase font-tech">{p.format}</span>
                        <span className="px-2 py-0.5 bg-neon-yellow/10 text-neon-yellow text-[9px] rounded uppercase font-tech">{p.mode}</span>
                        <span className="px-2 py-0.5 bg-white/5 text-white/40 text-[9px] rounded uppercase font-tech">{p.style}</span>
                        {p.generatedAssets && p.generatedAssets.length > 0 && (
                          <span className="px-2 py-0.5 bg-neon-magenta/10 text-neon-magenta text-[9px] rounded uppercase font-tech">
                            {p.generatedAssets.length} Visual Assets
                          </span>
                        )}
                      </div>
                      <button 
                        onClick={() => {
                          setCurrentProject(p);
                          setStep(3);
                          setActiveTab("create");
                        }}
                        className="w-full py-2 bg-white/5 hover:bg-neon-cyan hover:text-black transition-all rounded text-[10px] font-tech uppercase tracking-widest"
                      >
                        BUKA PROYEK
                      </button>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="settings"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-2xl mx-auto"
            >
              <div className="mb-8 lg:mb-12">
                <h2 className="text-3xl lg:text-4xl font-black font-tech uppercase tracking-tighter mb-2">
                  PENGATURAN <span className="text-neon-cyan">API KEY</span>
                </h2>
                <p className="text-white/50 text-sm lg:text-base">Gunakan Google AI Studio API Key Anda sendiri untuk melompati batas kuota bawaan.</p>
              </div>

              <div className="glass-card border-white/10 p-6 space-y-6">
                <div className="flex items-center gap-3 border-b border-white/10 pb-4">
                  <Key size={24} className="text-neon-cyan animate-pulse" />
                  <div>
                    <h3 className="font-tech text-xs uppercase tracking-widest text-white">Google AI Studio (Gemini) API Key</h3>
                    <p className="text-[10px] text-white/40 font-mono">Kunci ini disimpan dengan aman di penyimpanan lokal (localStorage) browser Anda.</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-tech text-white/50 tracking-wider">Masukkan API Key Gemini Anda</label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input 
                        type="password" 
                        value={apiKeyInput}
                        onChange={(e) => setApiKeyInput(e.target.value)}
                        placeholder="AIzaSy..." 
                        className="flex-1 bg-black/50 border border-white/20 rounded px-4 py-2.5 text-xs text-neon-yellow outline-none focus:border-neon-cyan font-mono transition-all animate-pulse-slow"
                      />
                      <div className="flex gap-2">
                        <button 
                          onClick={() => {
                            if (!apiKeyInput.trim()) {
                              alert("API Key tidak boleh kosong, cuy!");
                              return;
                            }
                            localStorage.setItem("aniki-gemini-api-key", apiKeyInput.trim());
                            setIsApiKeySaved(true);
                            confetti({
                              particleCount: 80,
                              spread: 50,
                              colors: ["#22d3ee"]
                            });
                            alert("API Key kustom berhasil tersimpan!");
                          }}
                          className="px-5 py-2.5 bg-neon-cyan text-black text-[10px] font-tech uppercase tracking-widest font-bold rounded hover:bg-neon-cyan/80 transition-all shadow-[0_0_15px_rgba(34,211,238,0.2)]"
                        >
                          SIMPAN
                        </button>
                        {isApiKeySaved && (
                          <button 
                            onClick={() => {
                              localStorage.removeItem("aniki-gemini-api-key");
                              setApiKeyInput("");
                              setIsApiKeySaved(false);
                              alert("Kunci kustom telah dihapus. Sistem akan beralih menggunakan Kunci Default.");
                            }}
                            className="px-4 py-2 bg-red-500/10 text-red-500 border border-red-500/20 text-[10px] font-tech uppercase tracking-widest rounded hover:bg-red-500/25 transition-all"
                          >
                            HAPUS
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white/5 border border-white/5 rounded-lg p-5 space-y-3 text-xs text-white/70 leading-relaxed">
                  <h4 className="font-tech text-[10px] uppercase tracking-wider text-neon-yellow">Cara Mendapatkan API Key Gratis:</h4>
                  <ol className="list-decimal list-inside space-y-1.5 text-white/60">
                    <li>Buka platform <a href="https://aistudio.google.com/" target="_blank" rel="noopener noreferrer" className="text-neon-cyan hover:underline inline-flex items-center gap-1 font-semibold">Google AI Studio <LinkIcon size={12} className="inline" /></a></li>
                    <li>Masuk menggunakan akun Google Anda.</li>
                    <li>Klik tombol <strong className="text-white">"Get API key"</strong> di sudut kiri atas.</li>
                    <li>Klik tombol <strong className="text-white">"Create API key"</strong>, pilih proyek baru atau yang sudah ada, lalu salin kuncinya.</li>
                    <li>Tempelkan kunci tersebut pada kolom di atas lalu klik <strong className="text-neon-cyan font-bold">SIMPAN</strong>!</li>
                  </ol>
                  <p className="text-[10px] text-white/40 italic pt-2 border-t border-white/5">
                    *Catatan: API Key Anda tidak pernah dikirim ke server kami atau pihak ketiga manapun. Semua interaksi terhubung langsung dari browser Anda ke endpoint resmi Google Gemini API client-side.
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>


    </div>
  );
}

const Music = ({ size, className }: { size?: number, className?: string }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width={size || 24} 
    height={size || 24} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <path d="M9 18V5l12-2v13" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="18" cy="16" r="3" />
  </svg>
);


import { GoogleGenAI, Type } from "@google/genai";

export const geminiModel = "gemini-3.5-flash"; // Using recommended latest flash model

const getAI = () => {
  const customKey = typeof window !== "undefined" ? localStorage.getItem("aniki-gemini-api-key") : null;
  const apiKey = customKey || process.env.GEMINI_API_KEY || "";
  if (!apiKey) {
    throw new Error("API Key tidak ditemukan! Harap lengkapi API Key Google AI Studio di menu 'PENGATURAN API' terlebih dahulu.");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
};

export type ScriptStyle = "Santai Tongkrongan" | "Storytelling Serius" | "Dramatis" | "Funny / Roasting" | "Cinematic Trailer" | "Meme Recap";
export type ScriptMode = "Kilat" | "Seri";
export type FormatType = "Manga" | "Manhwa";

export interface ProjectData {
  id: string;
  title: string;
  mangaTitle: string;
  format: FormatType;
  style: ScriptStyle;
  mode: ScriptMode;
  script: string;
  hooks: string[];
  youtubeTitles: string[];
  thumbnailIdeas: { text: string; concept: string }[];
  durationEstimate: string;
  scenes: { title: string; narrative: string; imagePrompt?: string; generatedImage?: string }[];
  images: string[]; // base64 inputs
  generatedAssets: string[]; // base64 outputs
  createdAt: number;
}

export interface GenerateImageParams {
  prompt: string;
  aspectRatio?: "1:1" | "3:4" | "4:3" | "9:16" | "16:9";
}

export async function generateCoverImage(params: GenerateImageParams) {
  const { prompt, aspectRatio = "16:9" } = params;

  const response = await getAI().models.generateContent({
    model: "gemini-3.1-flash-lite-image",
    contents: {
      parts: [
        {
          text: `Create a high-quality manga/manhwa style cover illustration. 
          Subject: ${prompt}. 
          Style: Vibrant colors, dynamic composition, professional digital art, anime aesthetic.`,
        },
      ],
    },
    config: {
      imageConfig: {
        aspectRatio: aspectRatio,
      },
    },
  });

  for (const part of response.candidates[0].content.parts) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  return null;
}

export interface GenerateScriptParams {
  mangaTitle: string;
  format: FormatType;
  style: ScriptStyle;
  mode: ScriptMode;
  imageDatas?: string[]; // array of base64 strings
}

export async function generateRecapScript(params: GenerateScriptParams) {
  const { mangaTitle, format, style, mode, imageDatas } = params;

  const styleContext = {
    "Santai Tongkrongan": "Gaya YouTuber santai, pakai gue/lu/cuy, asyik, kayak lagi cerita ke temen. Sering pakai kata 'anjir', 'parah sih', 'fix', 'gila'. Nyantai tapi to the point, langsung menceritakan inti adegan tanpa bertele-tele.",
    "Storytelling Serius": "Gaya YouTuber narasi mendalam, fokus pada emosi dan detail alur, padat, lugas, dan efisien dalam menyampaikan plot cerita tanpa berputar-putar.",
    "Dramatis": "Gaya YouTuber dramatis, fokus pada intensitas aksi dan ketegangan plot tanpa menggunakan kalimat puitis atau kata-kata mendayu.",
    "Funny / Roasting": "Gaya YouTuber roasting, penuh sarkasme kocak, ngetawain kelakuan karakter, to-the-point, cepat, dan sangat ekspresif.",
    "Cinematic Trailer": "Gaya YouTuber trailer, singkat, padat, penuh kalimat-kalimat punchy yang langsung menyambar ke inti misteri tanpa basa-basi.",
    "Meme Recap": "Gaya YouTuber meme, sangat cepat, sarkatis, referensial, tidak bertele-tele, langsung menceritakan kejadian konyolnya."
  }[style];

  const modeContext = {
    "Kilat": "Recap singkat padat dalam 1-3 chapter. Fokus pada inti konflik.",
    "Seri": "Script panjang detail per chapter, dramatis, dengan alur yang runtut."
  }[mode];

  const prompt = `
    Kamu adalah Content Creator Manga Recap (YouTuber) terbaik "Manga Only Studio" yang punya gaya bercerita sangat asyik, santai, dan TO THE POINT.
    Tugasmu adalah membuat NASKAH VIDEO RECAP MANGA yang DETAIL, LENGKAP, dan MENGALIR dari ${format} berjudul "${mangaTitle}".
    
    MODE: ${modeContext}
    GAYA BAHASA: ${styleContext} (Pastikan narasi terasa sangat natural, mengalir, tanpa basa-basi berlebih).

    STRUKTUR (SATU GAMBAR SATU PARAGRAF - MUTLAK):
    - Cerita wajib dibagi menjadi beberapa adegan berurutan.
    - PENTING: Jumlah adegan ('scenes') di dalam list wajib persis sama dengan jumlah gambar/panel manga yang diunggah oleh pengguna (Jika ada ${imageDatas?.length || 0} gambar diunggah, maka hasilkan tepat ${imageDatas?.length || 0} adegan).
    - Setiap adegan (scene) menceritakan isi dan dialog dari gambar/panel manga yang bersangkutan secara urut (Adegan 1 untuk gambar ke-1, Adegan 2 untuk gambar ke-2, dst).
    - Setiap adegan memiliki tepat SATU paragraf narasi cerita (bahasa Indonesia) dan SATU prompt visual deskripsi gambar (bahasa Inggris) yang sangat detail agar penggambaran karakternya sesuai aslinya.
    - Output wajib dalam JSON terstruktur sesuai skema.

    ATURAN EMAS DAN PENTING (WAJIB DIPATUHI SECARA MUTLAK):
    1. WAJIB MEMULAI KALIMAT PERTAMA NASKAH DENGAN: "diawal cerita .... " (Gunakan format persis seperti ini di awal hasil generatemu).
    2. JANGAN PERNAH MEMASUKKAN KATA '[ADADEGAN:.....]' ATAU MARKER SCENE APAPUN: Hilangkan semua penanda adegan, judul babak, kurung siku, dan penomoran. Output harus murni berupa narasi paragraf tanpa marker sama sekali.
    3. JANGAN BASA-BASI HINGGA BERTELE-TELE: Langsung bahas ke inti cerita dari detik pertama! Jangan lakukan pembukaan bertele-tele, sapaan penonton, perkenalan diri, atau basa-basi apa pun. Fokus langsung to the point.
    4. JANGAN DIRANGKUM (NO SUMMARY): Ceritakan setiap peristiwa secara runtut sesuai dengan panel. Namun, ingat bahwa menceritakan secara detail bukan berarti menambahkan kata-kata puitis atau deskripsi panjang lebar yang tidak ada di gelembung teks. Ceritakan kejadiannya secara efisien, praktis, tetapi lengkap semua dialognya masuk.
    5. PENALAAN MEMBACA DARI KANAN KE KIRI (RTL - Right-to-Left): Ingat ini adalah ${format}, cara membacanya harus sesuai tata letak standar dari KANAN ke KIRI untuk setiap bagian panel di gambar. Hubungkan tiap panel secara urut.
    6. WAJIB MEMASUKKAN SEMUA GELEMBUNG DIALOG / PROLOG / MONOLOG / TEKS: Semua teks narasi, prolog, balon ucapan dialog karakter, dan gumaman kata batin yang ada di gambar harus masuk ke dalam narasi naskah! JANGAN ADA SATUPUN YANG TERLEWAT! Sampaikan semua percakapan tersebut ke dalam narasi bahasa Indonesia yang luwes dan asyik. Jangan melenceng dari teks asli panel.
    7. HINDARI SOUND EFFECT (SFX).
    8. TAHU SELURUH ALUR CERITA (SUDAH PARIPURNA).
    9. JANGAN HALU (AKURAT).
    10. JANGAN LEBAY, PUITIS, ATAU BERTELE-TELE (TO THE POINT).
    11. KONSISTENSI KARAKTER DAN PRESISI (WAJIB): Deskripsi visual pada 'imagePrompt' harus mendeskripsikan secara detail ciri fisik karakter utama (gaya & warna rambut, jenis pakaian, ekspresi wajah) yang dicocokkan persis dengan visual panel manga asli yang diunggah, agar hasil generator gambar tetap konsisten dari adegan ke adegan.
  `;

  const contents: any[] = [{ text: prompt }];
  
  if (imageDatas && imageDatas.length > 0) {
    imageDatas.forEach((data) => {
      contents.push({
        inlineData: {
          mimeType: "image/jpeg",
          data: data.split(",")[1]
        }
      });
    });
  }

  const response = await getAI().models.generateContent({
    model: geminiModel,
    contents: { parts: contents },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          script: {
            type: Type.STRING,
            description: "Naskah narasi video utuh gabungan seluruh paragraf secara logis."
          },
          scenes: {
            type: Type.ARRAY,
            description: "Daftar adegan dengan logika satu adegan/gambar berpasangan dengan satu paragraf.",
            items: {
              type: Type.OBJECT,
              properties: {
                title: {
                  type: Type.STRING,
                  description: "Judul adegan, misal 'Adegan 1', 'Adegan 2', dst."
                },
                narrative: {
                  type: Type.STRING,
                  description: "Satu paragraf narasi cerita bahasa Indonesia yang sangat detail, asyik, santai, dan to-the-point."
                },
                imagePrompt: {
                  type: Type.STRING,
                  description: "Deskripsi visual adegan dalam bahasa Inggris yang detail untuk generator gambar (misal: 'A high-contrast manga scene showing...')"
                }
              },
              required: ["title", "narrative", "imagePrompt"]
            }
          }
        },
        required: ["script", "scenes"]
      }
    }
  });

  return response.text;
}

export async function generateHooks(script: string) {
  const prompt = `
    Berdasarkan alur cerita manga yang dramatis berikut, buatlah 3 variasi Kalimat Pembuka (Gripping Opening) yang sanggup langsung menarik pembaca ke dalam atmosfer cerita.
    Gunakan gaya bahasa yang provokatif, emosional, atau penuh misteri.
    
    ALUR CERITA:
    ${script.substring(0, 3000)}
    
    Berikan output dalam list sederhana tanpa judul tambahan.
  `;

  const response = await getAI().models.generateContent({
    model: geminiModel,
    contents: { parts: [{ text: prompt }] }
  });
  return response.text.split("\n").filter(l => l.trim()).map(l => l.replace(/^\d+\.\s*/, "").replace(/^-\s*/, "").trim());
}

export async function generateCTR(script: string) {
  const prompt = `
    Berdasarkan alur cerita manga berikut, buatlah:
    1. 5 Judul yang menggugah rasa penasaran (Story-driven titles).
    2. 3 Konsep Visual untuk Thumbnail yang merepresentasikan momen paling ikonik atau emosional.
    
    ALUR CERITA:
    ${script.substring(0, 2000)}
    
    Format Output:
    [TITLES]
    - (Judul 1)
    - (Judul 2)
    ...
    [THUMBNAILS]
    - Teks: (Teks yang ada di thumbnail) | Konsep: (Deskripsi visual thumbnail yang dramatis)
    ...
  `;

  const response = await getAI().models.generateContent({
    model: geminiModel,
    contents: { parts: [{ text: prompt }] }
  });
  
  const raw = response.text;
  const titles = raw.match(/\[TITLES\]([\s\S]*?)\[THUMBNAILS\]/)?.[1]?.trim().split("\n").filter(l => l.trim()).map(l => l.replace(/^-\s*/, "").trim()) || [];
  const thumbnailsRaw = raw.match(/\[THUMBNAILS\]([\s\S]*)/)?.[1]?.trim().split("\n").filter(l => l.trim()) || [];
  
  const thumbnails = thumbnailsRaw.map(t => {
    const parts = t.split("|");
    return {
      text: parts[0]?.replace(/^-\s*Teks:\s*/, "").replace(/^-\s*/, "").trim() || "Ide",
      concept: parts[1]?.replace(/^Konsep:\s*/, "").trim() || t
    };
  });

  return { titles, thumbnails };
}

export function parseGeminiResponse(rawText: string) {
  let scenes: { title: string; narrative: string; imagePrompt?: string }[] = [];
  let script = "";

  try {
    const cleanJson = rawText.trim().replace(/^```json\s*/i, "").replace(/```$/, "").trim();
    const parsed = JSON.parse(cleanJson);
    if (parsed.scenes && Array.isArray(parsed.scenes)) {
      scenes = parsed.scenes;
      script = parsed.scenes.map((s: any) => s.narrative).join("\n\n");
    }
  } catch (e) {
    // Legacy fallback
  }

  // If JSON parsing failed or scenes are empty, do legacy parsing
  if (scenes.length === 0) {
    script = rawText;
    const cleanText = rawText.replace(/\[(ADADEGAN|SCENE):.*?\]/g, "").trim();
    if (cleanText) {
      const paragraphs = cleanText.split(/\n\s*\n+/).map(p => p.trim()).filter(Boolean);
      if (paragraphs.length > 1) {
        paragraphs.forEach((p, idx) => {
          scenes.push({
            title: `Alur ${idx + 1}`,
            narrative: p,
            imagePrompt: `Manga illustration of: ${p.substring(0, 100)}`
          });
        });
      } else {
        scenes.push({
          title: "Naskah Utama",
          narrative: cleanText,
          imagePrompt: `Manga illustration of: ${cleanText.substring(0, 100)}`
        });
      }
    }
  }

  return {
    hooks: [], 
    scenes,
    youtubeTitles: [],
    thumbnailIdeas: [],
    durationEstimate: "~" + Math.ceil(script.split(/\s+/).length / 130) + ":00",
    script
  };
}

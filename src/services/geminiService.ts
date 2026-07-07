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
    "Santai Tongkrongan": `Gaya YouTuber santai, pakai kata 'gue/lu/cuy/gitu/auto/anjir/singkat cerita'. Sangat ringkas, seru, asyik, dan langsung ke inti adegan tanpa basa-basi bertele-tele atau mengulang-ulang percakapan. 
Wajib ikuti gaya bercerita dari contoh naskah berikut:
---
"Ya singkat cerita setelah ai merasa tenang,tak lama kemudian ibu Eiji datang sambil membawakan segelas teh hitam cuy. Dan waktu ai nyoba ,dia auto terkejut karna teh itu sangat enak gitu. Dan tentunya itu bikin ibu Eiji merasa senang cuy. 
Yah singkatnya disini mereka itu terus ngobrol dan jadi lebih akrab gitu. 

Nah setelah moment hangat barusan, ai pun izin buat pulang cuy.
Dan Eiji langsung nawarin diri buat nganter ai sampai ke stasiun. 
Akan tetapi hal itu malah ditolak oleh ai cuy dengan alasan, kalau Eiji terlalu baik, nanti dia mudah merasa kesepian ketika tak ada Eiji lagi gitu. 
 Selain itu ai nambahinlagi cuy, kalau Eiji tak perlu hawatir, karna setelah bertemu Eiji dia akhirnya punya alasan lagi untuk tetap hidup.
Yah Eiji pun akhirnya cuma bisa tersenyum lembut cuy."
---`,
    "Storytelling Serius": "Gaya YouTuber narasi mendalam, fokus pada emosi dan detail alur secara ringkas, padat, lugas, dan efisien dalam menyampaikan plot cerita tanpa berputar-putar.",
    "Dramatis": "Gaya YouTuber dramatis, fokus pada intensitas aksi dan ketegangan plot tanpa menggunakan kalimat puitis atau kata-kata mendayu. Sangat ringkas, dinamis, dan langsung ke inti konflik.",
    "Funny / Roasting": "Gaya YouTuber roasting, penuh sarkasme kocak, ngetawain kelakuan karakter, to-the-point, sangat cepat, ringkas, dan ekspresif.",
    "Cinematic Trailer": "Gaya YouTuber trailer, sangat singkat, sangat padat, penuh kalimat-kalimat punchy yang langsung menyambar ke inti misteri tanpa basa-basi.",
    "Meme Recap": "Gaya YouTuber meme, sangat cepat, sarkatis, referensial, tidak bertele-tele, langsung menceritakan kejadian konyolnya secara ringkas."
  }[style];

  const modeContext = {
    "Kilat": "Recap singkat padat dalam 1-3 chapter. Fokus pada inti konflik.",
    "Seri": "Script panjang detail per chapter, dramatis, dengan alur yang runtut."
  }[mode];

  const prompt = `
    Kamu adalah Content Creator Manga Recap (YouTuber) terbaik "Manga Only Studio" yang punya gaya bercerita sangat asyik, santai, dan TO THE POINT.
    Tugasmu adalah membuat NASKAH VIDEO RECAP MANGA yang RINGKAS, PADAT, dan MENGALIR dari ${format} berjudul "${mangaTitle}".
    
    MODE: ${modeContext}
    GAYA BAHASA: ${styleContext} (Pastikan narasi terasa sangat alami, mengalir, tanpa bertele-tele).

    STRUKTUR (SATU GAMBAR / IMAGE SATU PARAGRAF):
    - Cerita wajib dibagi menjadi beberapa segmen gambar berurutan (Image 1, Image 2, dst.).
    - Setiap segmen mewakili tepat SATU gambar/adegan, yang memiliki tepat SATU paragraf narasi ringkas (bahasa Indonesia, panjang 2-5 kalimat padat) dan SATU prompt visual deskripsi gambar (bahasa Inggris) yang mewakili kejadian di gambar tersebut.
    - Judul adegan wajib dinamai dengan format: "Image 1", "Image 2", dst.
    - Output wajib dalam JSON terstruktur sesuai skema.

    ATURAN EMAS DAN PENTING (WAJIB DIPATUHI SECARA MUTLAK):
    1. WAJIB MEMULAI KALIMAT PERTAMA NASKAH DENGAN: "diawal cerita .... " (Gunakan format persis seperti ini di awal hasil generatemu).
    2. JANGAN PERNAH MEMASUKKAN KATA '[ADADEGAN:.....]' ATAU MARKER SCENE APAPUN di dalam narasi: Hilangkan semua penanda adegan, judul babak, kurung siku, dan penomoran dari teks narasi utama.
    3. JANGAN BASA-BASI DAN JANGAN TERLALU DETAIL: Langsung bahas ke inti cerita dari detik pertama! Jangan lakukan pembukaan bertele-tele, sapaan penonton, perkenalan diri, atau basa-basi apa pun. Jangan mengulang-ulang percakapan secara berputar-putar.
    4. SANGAT RINGKAS DAN TO THE POINT (CONCISE): Ceritakan kejadiannya secara efisien, praktis, seru, langsung menceritakan inti peristiwa atau garis besar dialognya tanpa berputar-putar. Fokus pada pacing yang cepat dan mengalir.
    5. PENALAAN MEMBACA DARI KANAN KE KIRI (RTL - Right-to-Left): Ingat ini adalah ${format}, cara membacanya harus sesuai tata letak standar dari KANAN ke KIRI untuk setiap bagian panel di gambar. Hubungkan tiap panel secara urut.
    6. MASUKKAN GELEMBUNG DIALOG SECARA RINGKAS: Narasi harus mencakup dialog, prolog, monolog, dan gumaman batin karakter, namun sampaikan secara ringkas dan tidak bertele-tele. Jangan ada dialog panjang yang ditulis berulang-ulang.
    7. HINDARI SOUND EFFECT (SFX).
    8. TAHU SELURUH ALUR CERITA (SUDAH PARIPURNA).
    9. JANGAN HALU (AKURAT).
    10. JANGAN LEBAY, PUITIS, ATAU BERTELE-TELE (TO THE POINT).
    11. GABUNGKAN ALUR CERITA: Pada properti 'script' utama di JSON, gabungkan seluruh paragraf narasi tersebut secara urut dengan pemisah baris kosong ganda (double newline) TANPA menambahkan label penanda apa pun (jangan tulis "IMAGE 1", "HALAMAN 1", "Image", atau "Halaman") agar naskah bersih dan bisa langsung dibaca dengan lancar.
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
                  description: "Judul adegan, misal 'Image 1', 'Image 2', dst."
                },
                narrative: {
                  type: Type.STRING,
                  description: "Satu paragraf narasi cerita bahasa Indonesia yang sangat ringkas, asyik, santai, dan to-the-point."
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
      scenes = parsed.scenes.map((s: any, idx: number) => {
        let title = s.title || `Image ${idx + 1}`;
        // Normalize any returned titles that might contain "halaman" or similar
        if (title.toLowerCase().includes("halaman")) {
          title = title.replace(/halaman/i, "Image");
        }
        return {
          title,
          narrative: s.narrative,
          imagePrompt: s.imagePrompt
        };
      });
      script = scenes.map((s: any) => s.narrative).join("\n\n");
    }
  } catch (e) {
    // Legacy fallback
  }

  // If JSON parsing failed or scenes are empty, do legacy parsing
  if (scenes.length === 0) {
    const cleanText = rawText.replace(/\[(ADADEGAN|SCENE):.*?\]/g, "").trim();
    if (cleanText) {
      const paragraphs = cleanText.split(/\n\s*\n+/).map(p => p.trim()).filter(Boolean);
      if (paragraphs.length > 1) {
        paragraphs.forEach((p, idx) => {
          scenes.push({
            title: `Image ${idx + 1}`,
            narrative: p,
            imagePrompt: `Manga illustration of: ${p.substring(0, 100)}`
          });
        });
        script = scenes.map((s: any) => s.narrative).join("\n\n");
      } else {
        scenes.push({
          title: "Image 1",
          narrative: cleanText,
          imagePrompt: `Manga illustration of: ${cleanText.substring(0, 100)}`
        });
        script = cleanText;
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

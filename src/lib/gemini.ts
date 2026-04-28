import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

// 1. 공통으로 사용하는 재시도(Retry) 로직
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let lastError: any;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      const isTransient = error.message?.includes('503') || 
                          error.message?.includes('429') || 
                          error.message?.toLowerCase().includes('high demand') ||
                          error.message?.toLowerCase().includes('too many requests');
      
      if (isTransient && i < maxRetries - 1) {
        const delay = Math.pow(2, i) * 1000 + Math.random() * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

// 2. 도면 분석 및 프롬프트 생성 (Step 1)
export async function analyzeFloorPlan(base64Image: string, mimeType: string): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  
  const prompt = `
    You are an expert architectural visualizer and interior designer. 
    Analyze the provided 2D Korean apartment floor plan image and write a highly detailed, descriptive prompt in English for an image generation model to create a photorealistic 3D isometric render.

    Follow these mandatory instructions strictly:

    [1. STRUCTURAL & CAMERA SETUP - CRITICAL ROTATION LOCK]
    - Viewpoint: TRUE ORTHOGRAPHIC PROJECTION. True mathematical isometric projection, orthographic camera, parallel projection, zero perspective, no vanishing points, uniform architectural scale.
    - VISUAL ANCHOR (DO NOT RANDOMIZE ROTATION): The BOTTOM-RIGHT corner of the original 2D floor plan MUST be the closest point to the camera. Place this specific corner at the bottom-center of the rendered image. The layout must extend upwards and backwards from this fixed foreground corner.
    - Mathematical Isometric Angles: All vertical architectural lines (walls, doors) must be perfectly parallel to the vertical edges of the image frame. The horizontal walls extending from the bottom-right corner must recede at exactly 30-degree angles.
    - No Foreshortening (Uniform Scale): Objects at the back of the apartment must be rendered at the exact same scale as objects at the front. Parallel lines must remain permanently parallel and never converge.
    - Fidelity: Use the solid black regions and dense outlines of the provided image as absolute physical boundaries. It must be a 1:1 extrusion of the 2D map into 3D.
    - Background: A pure solid white (#FFFFFF) background outside the floor plan outline with ZERO environmental shadows or terrain.
    - BANNED WORDS: Do not use the words "perspective", "camera lens", "wide angle", or "vanishing point" anywhere in your generated prompt.

    [2. INTERIOR STYLE & MATERIALS]
    - Theme: Modern Korean apartment interior, warm, cozy, and highly realistic.
    - Flooring: Light oak hardwood floors for living spaces (거실) and bedrooms (침실). Grey porcelain tiles for the entryway (현관), bathrooms (욕실), and balconies (발코니).
    - Walls: Clean white interior walls.

    [3. FURNITURE PLACEMENT (CRITICAL)]
    - Accurately identify room zones and explicitly describe placing modern furniture inside them:
      * Living Room (거실): A grey fabric sofa, a small wooden coffee table, a wall-mounted TV on the opposite wall, and a soft rug.
      * Kitchen/Dining (주방/식당): White kitchen cabinets, a marble countertop, and a 4-seater wooden dining table with chairs.
      * Bedrooms (침실/드레스룸): A double bed with neat white bedding, a wooden nightstand, and built-in closets.
      * Bathrooms (욕실): Glass shower booth or bathtub, modern ceramic toilet, and sink.

    [4. LIGHTING & RENDERING QUALITY]
    - Lighting: Soft natural sunlight coming from the balcony windows, realistic soft shadows, global illumination.
    - Rendering Style: Architectural rendering, photorealistic, Unreal Engine 5 style, Octane render, highly detailed, 8k resolution.
    - Mandatory Keywords: Explicitly include the phrase "True mathematical isometric projection, orthographic camera, parallel projection, zero perspective, no vanishing points, uniform architectural scale." in your final prompt.

    Return ONLY the final detailed prompt string that will be fed directly into the image generator. Do not include any conversational text, introductions, or markdown formatting.
  `;

  const response = await withRetry(() => ai.models.generateContent({
    // ✅ 화가 모델 대신 '천재 설계사' 모델을 씁니다.
    // 무료 할당량을 생각하면 "gemini-1.5-flash"를, 
    // 최고의 분석력을 원하면 "gemini-1.5-pro"를 쓰세요.
    model: "gemini-2.5-pro", 
    contents: {
      parts: [
        { inlineData: { data: base64Image, mimeType } },
        { text: prompt }
      ]
    }
  }));

  return response.text || "A highly detailed, photorealistic 3D isometric rendering of a modern Korean apartment floor plan, featuring light wood floors, grey tile balconies, fully furnished living room with grey sofa, modern white kitchen, and soft natural lighting from the balcony.";
}

// 3. 실제 3D 이미지 렌더링 (Step 2)
export async function generate3DRendering(prompt: string, base64Image: string, mimeType: string): Promise<string> {
  const apiKey = (process.env as any).API_KEY || process.env.GEMINI_API_KEY;
  const ai = new GoogleGenAI({ apiKey });

  const response = await withRetry(() => ai.models.generateContent({
    // ✅ 여기는 그대로 '화가' 모델을 유지합니다.
    model: 'gemini-3.1-flash-image-preview',
    contents: {
      parts: [
        { inlineData: { data: base64Image, mimeType } }, 
        { text: prompt } 
      ],
    },
    config: {
      imageConfig: {
        aspectRatio: "1:1",
        imageSize: "1K"
      }
    },
  }));

  for (const part of response.candidates[0].content.parts) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }

  throw new Error("Failed to generate image.");
}
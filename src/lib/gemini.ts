import { GoogleGenAI, Modality } from "@google/genai";

export type ViewDirection = 'NW' | 'NE' | 'SE' | 'SW';

const DIRECTION_CONFIG: Record<ViewDirection, {
  foregroundCorner: string;
  backgroundCorner: string;
  visibleWalls: string;
  recedingDescription: string;
}> = {
  NE: {
    foregroundCorner: 'TOP-RIGHT corner of the original 2D floor plan (the North-East / NE corner)',
    backgroundCorner: 'BOTTOM-LEFT corner (South-West / SW)',
    visibleWalls: 'the NORTH and EAST exterior walls',
    recedingDescription: 'The north wall recedes towards the upper-left at exactly 30 degrees, and the east wall recedes towards the upper-right at exactly 30 degrees. The foreground NE corner sits at the bottom-center of the image.',
  },
  NW: {
    foregroundCorner: 'TOP-LEFT corner of the original 2D floor plan (the North-West / NW corner)',
    backgroundCorner: 'BOTTOM-RIGHT corner (South-East / SE)',
    visibleWalls: 'the NORTH and WEST exterior walls',
    recedingDescription: 'The west wall recedes towards the upper-left at exactly 30 degrees, and the north wall recedes towards the upper-right at exactly 30 degrees. The foreground NW corner sits at the bottom-center of the image.',
  },
  SE: {
    foregroundCorner: 'BOTTOM-RIGHT corner of the original 2D floor plan (the South-East / SE corner)',
    backgroundCorner: 'TOP-LEFT corner (North-West / NW)',
    visibleWalls: 'the SOUTH and EAST exterior walls',
    recedingDescription: 'The east wall recedes towards the upper-left at exactly 30 degrees, and the south wall recedes towards the upper-right at exactly 30 degrees. The foreground SE corner sits at the bottom-center of the image.',
  },
  SW: {
    foregroundCorner: 'BOTTOM-LEFT corner of the original 2D floor plan (the South-West / SW corner)',
    backgroundCorner: 'TOP-RIGHT corner (North-East / NE)',
    visibleWalls: 'the SOUTH and WEST exterior walls',
    recedingDescription: 'The south wall recedes towards the upper-left at exactly 30 degrees, and the west wall recedes towards the upper-right at exactly 30 degrees. The foreground SW corner sits at the bottom-center of the image.',
  },
};

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

export async function analyzeFloorPlan(
  base64Image: string,
  mimeType: string,
  direction: ViewDirection,
): Promise<string> {
  const apiKey = (process.env as any).API_KEY || process.env.GEMINI_API_KEY;
  const ai = new GoogleGenAI({ apiKey });
  const cfg = DIRECTION_CONFIG[direction];

  const prompt = `
    You are an expert architectural visualizer and interior designer.
    Analyze the provided 2D Korean apartment floor plan image and write a highly detailed, descriptive prompt in English for an image generation model to create a photorealistic 3D isometric render.

    Follow these mandatory instructions strictly:

    [1. STRUCTURAL & CAMERA SETUP - CRITICAL ROTATION LOCK]
    - Viewpoint: TRUE ORTHOGRAPHIC PROJECTION. True mathematical isometric projection, orthographic camera, parallel projection, zero perspective, no vanishing points, uniform architectural scale.
    - VIEW DIRECTION: ${direction} isometric view. The viewer is looking down at the apartment from the ${direction} direction.
    - VISUAL ANCHOR (DO NOT RANDOMIZE ROTATION): The ${cfg.foregroundCorner} MUST be the closest point to the camera. The ${cfg.backgroundCorner} must be in the deep background at the top of the image. ${cfg.visibleWalls} must be clearly visible.
    - RECEDING WALLS: ${cfg.recedingDescription}
    - Mathematical Isometric Angles: All vertical architectural lines (walls, doors) must be perfectly parallel to the vertical edges of the image frame.
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
    - Rendering Style: Architectural rendering, photorealistic, highly detailed.
    - Mandatory Keywords: Explicitly include the phrase "True mathematical isometric projection, orthographic camera, parallel projection, zero perspective, no vanishing points, uniform architectural scale, ${direction} viewpoint" in your final prompt.

    Return ONLY the final detailed prompt string that will be fed directly into the image generator. Do not include any conversational text, introductions, or markdown formatting.
  `;

  const response = await withRetry(() => ai.models.generateContent({
    model: "gemini-2.5-pro",
    contents: {
      parts: [
        { inlineData: { data: base64Image, mimeType } },
        { text: prompt }
      ]
    }
  }));

  return response.text || `A highly detailed, photorealistic 3D isometric rendering of a modern Korean apartment floor plan viewed from the ${direction} direction, with ${cfg.foregroundCorner} closest to the camera. Light wood floors, grey tile balconies, fully furnished living room with grey sofa, modern white kitchen, soft natural lighting from the balcony. True mathematical isometric projection, orthographic camera, parallel projection, zero perspective, no vanishing points, uniform architectural scale, ${direction} viewpoint.`;
}

export async function generate3DRendering(
  prompt: string,
  base64Image: string,
  mimeType: string,
): Promise<string> {
  const apiKey = (process.env as any).API_KEY || process.env.GEMINI_API_KEY;
  const ai = new GoogleGenAI({ apiKey });

  const response = await withRetry(() => ai.models.generateContent({
    model: 'gemini-2.5-flash-image-preview',
    contents: {
      parts: [
        { inlineData: { data: base64Image, mimeType } },
        { text: prompt }
      ],
    },
    config: {
      responseModalities: [Modality.IMAGE],
    },
  }));

  const parts = response.candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    if (part.inlineData?.data) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }

  throw new Error("Failed to generate image. The model did not return any image data.");
}

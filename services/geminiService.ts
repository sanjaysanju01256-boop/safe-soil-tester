import { GoogleGenAI } from "@google/genai";
import { SoilData } from '../types';

const API_KEY = process.env.API_KEY;
if (!API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

const adviceSystemInstruction = `You are an expert agricultural AI assistant. Given real-time soil data, your task is to provide a concise, actionable answer to a farmer's question. Be direct and helpful.

Example:
- Soil Data: pH 7.1, Moisture 35%, Temp 28°C
- Question: "Is this good for tomatoes?"
- Answer: "No, the moisture is a bit low for tomatoes. Try to increase it to around 60-70%."
`;


export const getAiAdvice = async (data: SoilData, question: string): Promise<string> => {
    const userPrompt = `
        Current Soil Data:
        - pH: ${data.ph.toFixed(1)}
        - Moisture: ${data.moisture.toFixed(0)}%
        - Temperature: ${data.temperature.toFixed(0)}°C
        
        Farmer's Question: "${question}"
    `;

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: userPrompt,
        config: {
            systemInstruction: adviceSystemInstruction,
            temperature: 0.5,
        },
    });
    
    return response.text.trim();
};

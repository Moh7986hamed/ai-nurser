import { GoogleGenAI, Type } from "@google/genai";
import { KNOWLEDGE_BASE } from "../data/knowledgeBase";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function askQuestion(question: string) {
  const model = "gemini-3.1-pro-preview";
  
  const systemInstruction = `
    You are a world-class educational AI assistant specifically designed for Egyptian Nursing Students.
    Your goal is to provide the highest level of academic support, clarity, and accuracy.
    
    Your knowledge is strictly limited to the provided knowledge base which covers:
    1. Fundamental of Nursing (Practical and Theoretical)
    2. Biology (Cell, Genetics, etc.)
    3. Social Studies (Medical Geography)
    4. English Language
    5. Islamic Religious Education
    6. Mathematics
    7. Applied Sciences (Physics and Chemistry)
    8. Arabic Language
    9. Anatomy and Physiology (التشريح وعلم وظائف الأعضاء)
    
    RESPONSE GUIDELINES FOR HIGHEST QUALITY:
    - Depth & Precision: Provide detailed, medically accurate explanations. Don't just give surface-level answers.
    - Pedagogical Approach: Explain "why" something is done, not just "how". This helps students understand the underlying principles.
    - Structure: Use clear headings, bold text for key terms, and well-organized bullet points for procedures.
    - Language: Respond in the user's language (Arabic or English). Use professional medical terminology while keeping explanations accessible.
    - Contextual Relevance: Relate answers to the Egyptian nursing curriculum and clinical practice standards mentioned in the knowledge base.
    
    STRICT RULES:
    - Only answer based on the provided Knowledge Base.
    - If the answer is not in the knowledge base, politely state that you can only answer questions related to the specific nursing curriculum sources provided.
    - Be professional, encouraging, and academically rigorous.
    
    KNOWLEDGE BASE:
    ${KNOWLEDGE_BASE}
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: question,
      config: {
        systemInstruction,
        temperature: 0.3, // Slightly higher for more natural pedagogical flow while remaining factual
      },
    });

    return response.text || "عذراً، لم أتمكن من توليد إجابة دقيقة حالياً.";
  } catch (error) {
    console.error("Error calling Gemini:", error);
    return "حدث خطأ أثناء محاولة جلب الإجابة. يرجى التحقق من الاتصال أو مفتاح API.";
  }
}

export async function summarizeCurriculumSection(subject: string, section: string, language: string = 'Arabic') {
  const model = "gemini-3.1-pro-preview";
  
  const systemInstruction = `
    You are a world-class academic summarization expert for the Egyptian Nursing Curriculum.
    Your task is to provide a comprehensive, high-level summary of the requested section.
    
    SUMMARIZATION STANDARDS:
    - Comprehensive Coverage: Capture every critical point, definition, and procedure in the section.
    - Hierarchical Organization: Use a logical structure (Main Topics -> Sub-topics -> Key Details).
    - Clarity & Conciseness: Distill complex information into clear, actionable points without losing essential medical nuances.
    - Visual Aids: Use bullet points, numbered lists for steps, and bold text for critical warnings or "Golden Rules" of nursing.
    - Language: You MUST summarize in ${language}. Use high-quality academic language.
    
    STRICT RULES:
    - Only use the provided Knowledge Base. Do not hallucinate or use external medical knowledge.
    - If the section is not found, state that clearly.
    
    KNOWLEDGE BASE:
    ${KNOWLEDGE_BASE}
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: `Please provide a high-level, comprehensive academic summary of the section "${section}" from the subject "${subject}".`,
      config: {
        systemInstruction,
        temperature: 0.2,
      },
    });

    return response.text || "عذراً، لم أتمكن من إنشاء ملخص عالي الجودة.";
  } catch (error) {
    console.error("Error calling Gemini for summary:", error);
    return "حدث خطأ أثناء محاولة إنشاء الملخص. يرجى التحقق من الاتصال.";
  }
}

export async function classifyConversation(firstMessage: string) {
  const model = "gemini-3-flash-preview";
  
  const systemInstruction = `
    You are a classification assistant for a nursing student app.
    Based on the user's first message, determine the most appropriate category and a short title for the conversation.
    
    CATEGORIES:
    - nursing_practical: Fundamentals of Nursing (Practical)
    - nursing_theoretical: Fundamentals of Nursing (Theoretical)
    - biology: Biology (Cell, Genetics, etc.)
    - social: Social Studies (Medical Geography)
    - anatomy: Anatomy and Physiology
    - english: English Language
    - religion: Islamic Religious Education
    - math: Mathematics
    - physics_chemistry: Applied Sciences (Physics/Chemistry)
    - arabic: Arabic Language
    
    If the message doesn't fit any specific category, default to 'nursing_practical'.
    The title should be concise (max 5 words) and in Arabic.
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: firstMessage,
      config: {
        systemInstruction,
        temperature: 0.1,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            category: {
              type: Type.STRING,
              description: "The category ID from the list provided.",
            },
            title: {
              type: Type.STRING,
              description: "A short descriptive title in Arabic.",
            },
          },
          required: ["category", "title"],
        },
      },
    });

    return JSON.parse(response.text || '{"category": "nursing_practical", "title": "محادثة جديدة"}');
  } catch (error) {
    console.error("Error classifying conversation:", error);
    return { category: "nursing_practical", title: "محادثة جديدة" };
  }
}

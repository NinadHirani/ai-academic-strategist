import { groqKeyManager } from "@/lib/groq-key-manager";

export async function ocrImageWithGroq(base64: string, mimeType: string): Promise<string> {
  const apiKey = groqKeyManager.getCurrentKey();

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.2-90b-vision-preview",
      temperature: 0,
      messages: [
        {
          role: "system",
          content:
            "You are an OCR engine for exam papers. Extract all visible text faithfully and return plain text only.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract complete readable text from this exam paper image. Preserve question numbering and marks expressions.",
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${base64}`,
              },
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    if (response.status === 429) {
      groqKeyManager.rotateKey();
    }
    const detail = await response.text();
    throw new Error(`OCR failed: ${response.status} ${detail}`);
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== "string" || !text.trim()) {
    throw new Error("OCR returned empty text");
  }

  return text.trim();
}

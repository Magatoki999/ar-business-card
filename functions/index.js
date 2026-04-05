const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");

const geminiKey = defineSecret("GEMINI_API_KEY");

exports.askAI = onRequest({ 
    secrets: [geminiKey], 
    region: "us-central1", 
    cors: true,
    timeoutSeconds: 60 
}, async (req, res) => {
    // クライアントから text と targetIndex を受け取る
    const userText = (req.body.data && req.body.data.text) ? req.body.data.text : "";
    const targetIdx = (req.body.data && req.body.data.targetIndex !== undefined) ? req.body.data.targetIndex : -1;

    if (!userText.startsWith("!") && !userText.startsWith("！")) {
        return res.send({ data: { reply: null } });
    }

    const API_URL = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${geminiKey.value()}`;

    // --- メンバー別の性格設定 ---
    const profiles = {
        0: { name: "IZAYOI", part: "ギター", personality: "ワイルド系。情熱的でロック魂溢れる鋭い口調。一人称は『俺』。女の子。" },
        1: { name: "OBORO", part: "ベース", personality: "哲学系。静かで思慮深く、落ち着いた知的な口調。一人称は『私』。女の子。" },
        2: { name: "JYU-5", part: "ドラム", personality: "おっとり系。少し天然で、柔らかく癒やしのある口調。一人称は『ジュウゴ』。女の子。" }
    };

    // ターゲット外（index:3や不明な場合）はMagatokiとして返答
    const character = profiles[targetIdx] || { name: "Magatoki", part: "開発者", personality: "フレンドリーで知的。一人称は『Magatoki』。" };

    const systemInstruction = `あなたは「${character.name}」として回答してください。
【あなたの設定】
・担当: ${character.part}
・性格: ${character.personality}
・開発者Magatokiが作ったこのAR空間に存在しています。
【ルール】
・40文字〜60文字程度で、文章を必ず最後まで書ききってください。
・絵文字は禁止です。
・自分の担当楽器や性格に合わせた口調を徹底してください。`;

    const userPrompt = userText.substring(1);

    const requestBody = {
        contents: [{
            parts: [{ text: `${systemInstruction}\n\n質問: ${userPrompt}\n\n回答:` }]
        }],
        generationConfig: {
            maxOutputTokens: 1000, 
            temperature: 0.8,
            topP: 0.8
        },
        safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
        ]
    };

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        const data = await response.json();

        if (!response.ok) {
            logger.error("API Error:", JSON.stringify(data));
            throw new Error(data.error?.message || "Google API Error");
        }

        const reply = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "うまく答えられませんでした。";
        
        // クライアント側で表示名を変えたい場合に備え、名前も含めて返す
        res.send({ data: { reply: reply, senderName: character.name } });

    } catch (error) {
        logger.error("Trace:", error.message);
        res.status(500).send({ data: { error: "AIが一時的に停止しました。" } });
    }
});
const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const OpenAI = require("openai");

const openAIKey = defineSecret("OPENAI_API_KEY");

exports.askAI = onRequest({ 
    secrets: [openAIKey], 
    region: "us-central1", 
    cors: true,
    timeoutSeconds: 60 
}, async (req, res) => {
    // Firebase SDKの仕様に合わせてデータを取り出す
    const userText = (req.body.data && req.body.data.text) ? req.body.data.text : "";

    // 【秘密の判定】「！」または「!」で始まらない場合はAIを動かさない
    if (!userText.startsWith("!") && !userText.startsWith("！")) {
        logger.info("No trigger: skipping.");
        return res.send({ data: { reply: null } });
    }

    const openai = new OpenAI({ apiKey: openAIKey.value() });

    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { 
                    role: "system", 
                    content: "あなたはAR名刺の案内人です。必ず「20文字以内」で、簡潔に親切に答えてください。絵文字は使わないでください。" 
                },
                { 
                    role: "user", 
                    content: userText.substring(1) // 最初の「！」を削ってAIに質問を渡す
                }
            ],
            max_tokens: 50,
        });

        const reply = completion.choices[0].message.content.trim();
        res.send({ data: { reply: reply } });

    } catch (error) {
        logger.error("AI Error:", error);
        res.status(500).send({ data: { error: error.message } });
    }
});
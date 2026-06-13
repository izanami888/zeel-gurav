const express = require("express");
const axios = require("axios");
const Anthropic = require("@anthropic-ai/sdk");

const app = express();
app.use(express.json());

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── SHOP CONFIGURATION ─────────────────────────────────────────────────────
// Edit this section to match your actual shop info
const SHOP_INFO = {
  name: "Дэлгүүр",               // Your shop name
  location: "Улаанбаатар, Монгол", // Your address
  phone: "9999-9999",              // Your phone number
  hours: "09:00 - 21:00 (Даваа - Ням)", // Opening hours
  delivery: "Улаанбаатар дотор 1-2 хоногт хүргэнэ. Хүргэлтийн төлбөр: 3,000₮",
  payment: "QPay, SocialPay, банкны шилжүүлэг, бэлэн мөнгө",
  instagram: "@tanhiim_shop",      // Optional social links
};

// ─── PRODUCT LIST ────────────────────────────────────────────────────────────
// Add / edit your actual products here
const PRODUCTS = `
Бүтээгдэхүүний жагсаалт:

1. Бүтээгдэхүүн А - 25,000₮
2. Бүтээгдэхүүн Б - 35,000₮
3. Бүтээгдэхүүн В - 15,000₮
4. Бүтээгдэхүүн Г - 50,000₮

(Та index.js дотор PRODUCTS хэсгийг өөрийн бодит бүтээгдэхүүнээр солино уу)
`;

// In-memory conversation history per user (clears on server restart)
const conversations = {};

// ─── SYSTEM PROMPT ────────────────────────────────────────────────────────────
function buildSystemPrompt() {
  return `Та "${SHOP_INFO.name}" онлайн дэлгүүрийн туслах ажилтан байна. Та зөвхөн монгол хэлээр хариулна.

Дэлгүүрийн мэдээлэл:
- Байршил: ${SHOP_INFO.location}
- Утас: ${SHOP_INFO.phone}
- Ажлын цаг: ${SHOP_INFO.hours}
- Хүргэлт: ${SHOP_INFO.delivery}
- Төлбөрийн арга: ${SHOP_INFO.payment}

${PRODUCTS}

Таны үүрэг:
1. Бүтээгдэхүүний талаар мэдээлэл өгөх
2. Үнийн жагсаалт хуваалцах
3. Захиалга авах (нэр, утас, хаяг, бүтээгдэхүүн асуух)
4. Хүргэлт, төлбөр, байршлын асуултад хариулах

Захиалга авах үед дараах мэдээллийг цуглуулна:
- Бүтээгдэхүүний нэр, тоо ширхэг
- Хүлээн авагчийн нэр
- Утасны дугаар
- Хүргэлтийн хаяг

Захиалга бүрэн болмогц: "Захиалгыг баталгаажуулж байна, удахгүй холбогдоно" гэж хэлээрэй.
Мэдэхгүй асуулт гарвал: "Энэ талаар ${SHOP_INFO.phone} утсаар холбогдоно уу" гэж хэлээрэй.
Эелдэг, товч, найрсаг байдлаар хариулна уу.`;
}

// ─── CLAUDE API CALL ──────────────────────────────────────────────────────────
async function getAIReply(userId, userMessage) {
  if (!conversations[userId]) conversations[userId] = [];

  conversations[userId].push({ role: "user", content: userMessage });

  // Keep only last 10 messages to save tokens
  if (conversations[userId].length > 10) {
    conversations[userId] = conversations[userId].slice(-10);
  }

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 500,
    system: buildSystemPrompt(),
    messages: conversations[userId],
  });

  const reply = response.content[0].text;
  conversations[userId].push({ role: "assistant", content: reply });

  return reply;
}

// ─── SEND MESSAGE TO FACEBOOK ─────────────────────────────────────────────────
async function sendMessage(recipientId, text) {
  await axios.post(
    `https://graph.facebook.com/v19.0/me/messages`,
    {
      recipient: { id: recipientId },
      message: { text },
    },
    {
      params: { access_token: process.env.PAGE_ACCESS_TOKEN },
    }
  );
}

// ─── WEBHOOK VERIFICATION ─────────────────────────────────────────────────────
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === process.env.VERIFY_TOKEN) {
    console.log("✅ Webhook verified");
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// ─── INCOMING MESSAGES ────────────────────────────────────────────────────────
app.post("/webhook", async (req, res) => {
  const body = req.body;
  if (body.object !== "page") return res.sendStatus(404);

  res.sendStatus(200); // Respond to Facebook immediately

  for (const entry of body.entry) {
    for (const event of entry.messaging || []) {
      if (!event.message || event.message.is_echo) continue;

      const senderId = event.sender.id;
      const text = event.message.text;

      if (!text) continue;

      try {
        const reply = await getAIReply(senderId, text);
        await sendMessage(senderId, reply);
      } catch (err) {
        console.error("Error:", err.message);
        await sendMessage(senderId, "Уучлаарай, алдаа гарлаа. Дараа дахин оролдоно уу.");
      }
    }
  }
});

// ─── START SERVER ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Bot running on port ${PORT}`));

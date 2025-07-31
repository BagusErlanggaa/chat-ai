// File untuk debug masalah
require("dotenv").config()

console.log("🔍 DEBUGGING ERLANN CHAT APP")
console.log("=" * 50)

// Check environment variables
console.log("📋 Environment Check:")
console.log("- NODE_ENV:", process.env.NODE_ENV || "not set")
console.log("- PORT:", process.env.PORT || "not set")
console.log("- API Key:", process.env.GOOGLE_GENERATIVE_AI_API_KEY ? "✅ Set" : "❌ Not set")

if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
  console.log("\n❌ API KEY TIDAK DITEMUKAN!")
  console.log("Solusi:")
  console.log("1. Buat file .env di root folder")
  console.log("2. Tambahkan: GOOGLE_GENERATIVE_AI_API_KEY=your_api_key_here")
  console.log("3. Restart server")
  process.exit(1)
}

// Test API connection
async function testGeminiAPI() {
  try {
    console.log("\n🧪 Testing Gemini API...")

    const { streamText } = require("ai")
    const { google } = require("@ai-sdk/google")

    const result = await streamText({
      model: google("gemini-1.5-flash"),
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: "Say hello in Indonesian" },
      ],
      maxTokens: 50,
    })

    let response = ""
    for await (const delta of result.textStream) {
      response += delta
    }

    console.log("✅ API Test Success!")
    console.log("Response:", response)
  } catch (error) {
    console.log("❌ API Test Failed!")
    console.log("Error:", error.message)

    if (error.message.includes("API key")) {
      console.log("\n🔑 API Key Issues:")
      console.log("- Pastikan API key valid")
      console.log("- Cek di https://aistudio.google.com/apikey")
      console.log("- Pastikan tidak ada spasi di awal/akhir")
    }

    if (error.message.includes("quota")) {
      console.log("\n⏰ Quota Issues:")
      console.log("- API quota habis")
      console.log("- Tunggu beberapa menit")
      console.log("- Atau upgrade plan di Google AI Studio")
    }
  }
}

// Run tests
testGeminiAPI()

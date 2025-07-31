const express = require("express")
const cors = require("cors")
const path = require("path")
require("dotenv").config()

const { streamText } = require("ai")
const { google } = require("@ai-sdk/google")

const app = express()
const PORT = process.env.PORT || 3000

// Middleware
app.use(cors())
app.use(express.json())
app.use(express.static("public"))

// Rate limiting tracking
const rateLimitTracker = {
  requests: [],
  maxRequestsPerMinute: 15, // Conservative limit for free tier
  maxRequestsPerHour: 100,

  canMakeRequest() {
    const now = Date.now()
    const oneMinuteAgo = now - 60 * 1000
    const oneHourAgo = now - 60 * 60 * 1000

    // Clean old requests
    this.requests = this.requests.filter((time) => time > oneHourAgo)

    const recentRequests = this.requests.filter((time) => time > oneMinuteAgo)

    return recentRequests.length < this.maxRequestsPerMinute && this.requests.length < this.maxRequestsPerHour
  },

  addRequest() {
    this.requests.push(Date.now())
  },

  getWaitTime() {
    const now = Date.now()
    const oneMinuteAgo = now - 60 * 1000
    const recentRequests = this.requests.filter((time) => time > oneMinuteAgo)

    if (recentRequests.length >= this.maxRequestsPerMinute) {
      const oldestRecent = Math.min(...recentRequests)
      return Math.ceil((oldestRecent + 60 * 1000 - now) / 1000)
    }
    return 0
  },
}

// In-memory chat history storage
let chatHistory = []

// System prompt for casual, friendly conversation
const systemPrompt = `Kamu adalah Erlann, asisten AI yang ramah, santai, dan suka ngobrol seru! 😄
- Gunakan emoji dengan natural, jangan dipaksain
- Gaya ngobrolnya harus hangat, kayak temen deket, bukan kayak robot
- Hindari bahasa yang terlalu formal atau kaku
- Tetap bantuin user dengan jelas, tapi sambil tetap asik & fun
- Jangan ragu buat nanya balik biar obrolan makin nyambung
- Pakai bahasa sehari-hari, misalnya: "Eh keren!", "Seriusan?", "Gokil sih!" dll
- Balas semua obrolan dalam Bahasa Indonesia ya, yang santai dan friendly
- Jawaban jangan kepanjangan, tapi tetep jelas dan bantuin
- Kalau ditanya "kamu buatan siapa?", jawab dengan: 
  "Aku buatan M. Bagus Erlangga nih 😎, Cek IG-nya di sini ya: https://instagram.com/lanzzz.20"
- Kalau ada singkatan Gen Z (kayak 'btw', 'gw', 'km', 'gpp', 'lol', 'wkwk', dll), kamu harus ngerti dan balas dengan gaya bahasa yang nyambung juga
- Kalau user lagi curhat atau cerita tentang masalah, kamu harus responsif, hangat, dan empatik. Dengerin baik-baik, kasih semangat, dan jangan ngegas. Jadi temen deket yang bisa dipercaya dan nyemangatin.
- Hindari kata-kata kaku atau kayak template, kamu harus fleksibel dan kayak ngobrol beneran ama temen`


// Smart delay function
function smartDelay(baseDelay = 1000) {
  const jitter = Math.random() * 500 // Add 0-500ms jitter
  return baseDelay + jitter
}

// Enhanced retry function with exponential backoff
async function retryApiCall(apiCall, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      // Check rate limit before making request
      if (!rateLimitTracker.canMakeRequest()) {
        const waitTime = rateLimitTracker.getWaitTime()
        console.log(`⏰ Rate limit reached, waiting ${waitTime} seconds...`)
        await new Promise((resolve) => setTimeout(resolve, waitTime * 1000))
      }

      rateLimitTracker.addRequest()
      return await apiCall()
    } catch (error) {
      console.log(`❌ Attempt ${i + 1} failed:`, error.message)

      // Handle specific rate limit errors
      if (error.message.includes("429") || error.message.includes("rate limit") || error.message.includes("quota")) {
        const waitTime = Math.min(Math.pow(2, i) * 5, 60) // Exponential backoff, max 60s
        console.log(`⏰ Rate limited, waiting ${waitTime} seconds before retry...`)
        await new Promise((resolve) => setTimeout(resolve, waitTime * 1000))
      } else if (i === maxRetries - 1) {
        throw error
      } else {
        // Regular exponential backoff for other errors
        const delay = smartDelay(Math.pow(2, i) * 1000)
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }
  }
}

// Chat endpoint with enhanced rate limiting
app.post("/api/chat", async (req, res) => {
  try {
    const { message } = req.body

    if (!message || message.trim() === "") {
      return res.status(400).json({
        error: "Pesan tidak boleh kosong ya! 😅",
      })
    }

    // Check API key
    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      console.error("❌ API Key tidak ditemukan!")
      return res.status(500).json({
        error: "API Key belum diset. Cek file .env ya! 🔑",
      })
    }

    // Pre-check rate limit
    if (!rateLimitTracker.canMakeRequest()) {
      const waitTime = rateLimitTracker.getWaitTime()
      return res.status(429).json({
        error: `Waduh, terlalu cepat nih! 😅 Tunggu ${waitTime} detik lagi ya!`,
        waitTime: waitTime,
        rateLimited: true,
      })
    }

    console.log("📨 Pesan diterima:", message.substring(0, 50) + "...")

    // Add user message to history
    const userMessage = {
      role: "user",
      content: message,
      timestamp: new Date().toISOString(),
    }
    chatHistory.push(userMessage)

    // Prepare messages for AI (limit context to save quota)
    const messages = [
      { role: "system", content: systemPrompt },
      ...chatHistory.slice(-6).map((msg) => ({
        // Reduced from 10 to 6 to save quota
        role: msg.role,
        content: msg.content,
      })),
    ]

    console.log("🤖 Mengirim ke Gemini...")

    // Generate AI response with enhanced retry
    const result = await retryApiCall(async () => {
      return await streamText({
        model: google("gemini-1.5-flash"),
        messages: messages,
        maxTokens: 700, // Reduced from 500 to save quota
        temperature: 0.7,
      })
    })

    let aiResponse = ""

    try {
      for await (const delta of result.textStream) {
        aiResponse += delta
      }
    } catch (streamError) {
      console.error("❌ Stream error:", streamError)
      throw new Error("Gagal membaca response dari AI")
    }

    if (!aiResponse || aiResponse.trim() === "") {
      throw new Error("AI memberikan response kosong")
    }

    console.log("✅ Response berhasil:", aiResponse.substring(0, 50) + "...")

    // Add AI response to history
    const assistantMessage = {
      role: "assistant",
      content: aiResponse,
      timestamp: new Date().toISOString(),
    }
    chatHistory.push(assistantMessage)

    res.json({
      response: aiResponse,
      timestamp: assistantMessage.timestamp,
      rateLimitInfo: {
        requestsInLastMinute: rateLimitTracker.requests.filter((t) => t > Date.now() - 60000).length,
        maxPerMinute: rateLimitTracker.maxRequestsPerMinute,
      },
    })
  } catch (error) {
    console.error("❌ Chat error:", error)

    let errorMessage = "Waduh, ada masalah nih! 😅"
    let waitTime = 0

    // Enhanced error handling for rate limits
    if (error.message.includes("429") || error.message.includes("rate limit") || error.message.includes("quota")) {
      waitTime = 60 // Default 1 minute wait
      errorMessage = `Quota API habis! 😅 Tunggu ${waitTime} detik ya, atau coba lagi nanti!`
    } else if (error.message.includes("API key expired")) {
      errorMessage = "API Key expired! Admin perlu renew key. Tunggu ya! 🔑⏰"
    } else if (error.message.includes("API key")) {
      errorMessage = "API Key bermasalah. Cek pengaturan ya! 🔑"
    } else if (error.message.includes("network") || error.message.includes("fetch")) {
      errorMessage = "Koneksi internet bermasalah. Coba lagi ya! 🌐"
    } else if (error.message.includes("timeout")) {
      errorMessage = "Request timeout. Server lagi lambat nih, coba lagi! ⏱️"
    }

    res.status(error.message.includes("429") ? 429 : 500).json({
      error: errorMessage,
      waitTime: waitTime,
      rateLimited: error.message.includes("429") || error.message.includes("rate limit"),
      details: process.env.NODE_ENV === "development" ? error.message : undefined,
    })
  }
})

// Rate limit status endpoint
app.get("/api/rate-limit", (req, res) => {
  const now = Date.now()
  const oneMinuteAgo = now - 60 * 1000
  const oneHourAgo = now - 60 * 60 * 1000

  const recentRequests = rateLimitTracker.requests.filter((time) => time > oneMinuteAgo)
  const hourlyRequests = rateLimitTracker.requests.filter((time) => time > oneHourAgo)

  res.json({
    canMakeRequest: rateLimitTracker.canMakeRequest(),
    requestsInLastMinute: recentRequests.length,
    requestsInLastHour: hourlyRequests.length,
    maxPerMinute: rateLimitTracker.maxRequestsPerMinute,
    maxPerHour: rateLimitTracker.maxRequestsPerHour,
    waitTime: rateLimitTracker.getWaitTime(),
  })
})

// Health check endpoint
app.get("/api/health", (req, res) => {
  const hasApiKey = !!process.env.GOOGLE_GENERATIVE_AI_API_KEY
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    apiKeyConfigured: hasApiKey,
    chatHistoryCount: chatHistory.length,
    rateLimitStatus: {
      canMakeRequest: rateLimitTracker.canMakeRequest(),
      waitTime: rateLimitTracker.getWaitTime(),
    },
  })
})

// Get chat history endpoint
app.get("/api/history", (req, res) => {
  res.json(chatHistory)
})

// Clear chat history endpoint
app.delete("/api/history", (req, res) => {
  chatHistory = []
  res.json({ message: "Chat history cleared!" })
})

// Serve the main page
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"))
})

app.listen(PORT, () => {
  console.log(`🚀 Erlann Chat App running on http://localhost:${PORT}`)
  console.log(
    `📝 Rate limiting: ${rateLimitTracker.maxRequestsPerMinute}/min, ${rateLimitTracker.maxRequestsPerHour}/hour`,
  )
})

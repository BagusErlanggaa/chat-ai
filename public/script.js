class GeminiChat {
  constructor() {
    this.chatMessages = document.getElementById("chatMessages")
    this.chatForm = document.getElementById("chatForm")
    this.messageInput = document.getElementById("messageInput")
    this.sendBtn = document.getElementById("sendBtn")
    this.clearBtn = document.getElementById("clearBtn")
    this.loading = document.getElementById("loading")
    this.sidebar = document.getElementById("sidebar")
    this.sidebarToggle = document.getElementById("sidebarToggle")
    this.toggleSidebar = document.getElementById("toggleSidebar")
    this.newChatBtn = document.getElementById("newChatBtn")
    this.chatHistory = document.getElementById("chatHistory")

    this.currentChatId = "current"
    this.chatSessions = new Map()
    this.rateLimitCooldown = false

    this.init()
  }

  async init() {
    // Set welcome message timestamp
    document.getElementById("welcomeTime").textContent = this.formatTime(new Date())

    // Check connection and rate limit status
    await this.checkConnection()
    this.startRateLimitMonitoring()

    // Event listeners
    this.chatForm.addEventListener("submit", (e) => this.handleSubmit(e))
    this.clearBtn.addEventListener("click", () => this.clearCurrentChat())
    this.sidebarToggle.addEventListener("click", () => this.toggleSidebarVisibility())
    this.toggleSidebar.addEventListener("click", () => this.toggleSidebarVisibility())
    this.newChatBtn.addEventListener("click", () => this.createNewChat())

    this.messageInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        this.handleSubmit(e)
      }
    })

    // Load chat history on page load
    this.loadChatHistory()
    this.initializeChatSessions()

    // Focus on input
    this.messageInput.focus()

    // Handle mobile sidebar
    this.handleMobileLayout()
  }

  startRateLimitMonitoring() {
    // Check rate limit status every 30 seconds
    setInterval(async () => {
      try {
        const response = await fetch("/api/rate-limit")
        const data = await response.json()

        if (!data.canMakeRequest) {
          this.rateLimitCooldown = true
          this.updateSendButtonState()

          if (data.waitTime > 0) {
            this.showRateLimitWarning(data.waitTime)
          }
        } else {
          this.rateLimitCooldown = false
          this.updateSendButtonState()
        }
      } catch (error) {
        console.error("Rate limit check failed:", error)
      }
    }, 30000)
  }

  showRateLimitWarning(waitTime) {
    const warningMsg = `⏰ Rate limit aktif! Tunggu ${waitTime} detik sebelum kirim pesan lagi ya!`
    this.addMessage(warningMsg, "ai")
  }

  updateSendButtonState() {
    if (this.rateLimitCooldown) {
      this.sendBtn.disabled = true
      this.sendBtn.innerHTML = `
        <span class="send-text">Tunggu...</span>
        <span class="send-icon">⏰</span>
      `
    } else {
      this.sendBtn.disabled = false
      this.sendBtn.innerHTML = `
        <span class="send-text">Kirim</span>
        <span class="send-icon">🚀</span>
      `
    }
  }

  handleMobileLayout() {
    if (window.innerWidth <= 768) {
      this.sidebar.classList.add("collapsed")
    }

    window.addEventListener("resize", () => {
      if (window.innerWidth <= 768) {
        this.sidebar.classList.add("collapsed")
      } else {
        this.sidebar.classList.remove("collapsed")
      }
    })
  }

  toggleSidebarVisibility() {
    this.sidebar.classList.toggle("collapsed")
  }

  createNewChat() {
    const chatId = "chat_" + Date.now()
    const chatTitle = `Chat ${this.chatSessions.size + 1}`

    // Save current chat if it has messages
    if (this.currentChatId === "current") {
      const currentMessages = this.getCurrentMessages()
      if (currentMessages.length > 0) {
        this.chatSessions.set(this.currentChatId, {
          title: this.generateChatTitle(currentMessages[0]),
          messages: currentMessages,
          timestamp: new Date(),
        })
      }
    }

    // Create new chat session
    this.currentChatId = chatId
    this.chatSessions.set(chatId, {
      title: chatTitle,
      messages: [],
      timestamp: new Date(),
    })

    // Clear current chat display
    this.clearChatDisplay()

    // Update sidebar
    this.updateChatHistory()

    // Focus input
    this.messageInput.focus()
  }

  generateChatTitle(firstMessage) {
    if (!firstMessage) return "Chat Baru"

    const content = firstMessage.content || firstMessage
    const words = content.split(" ").slice(0, 4).join(" ")
    return words.length > 30 ? words.substring(0, 30) + "..." : words
  }

  getCurrentMessages() {
    const messages = []
    const messageElements = this.chatMessages.querySelectorAll(".message:not(.welcome-message .message)")

    messageElements.forEach((element) => {
      const isUser = element.classList.contains("user-message")
      const content = element.querySelector(".message-content p").textContent
      const timeElement = element.querySelector(".message-time")
      const timestamp = timeElement ? timeElement.textContent : new Date().toISOString()

      messages.push({
        role: isUser ? "user" : "assistant",
        content: content,
        timestamp: timestamp,
      })
    })

    return messages
  }

  clearChatDisplay() {
    // Keep welcome message, remove others
    const welcomeMessage = document.querySelector(".welcome-message")
    this.chatMessages.innerHTML = ""
    this.chatMessages.appendChild(welcomeMessage)
  }

  updateChatHistory() {
    this.chatHistory.innerHTML = ""

    // Add current chat
    const currentItem = this.createHistoryItem("current", "Chat Saat Ini", "Mulai percakapan...", "Sekarang")
    if (this.currentChatId === "current") {
      currentItem.classList.add("active")
    }
    this.chatHistory.appendChild(currentItem)

    // Add other chats (newest first)
    const sortedChats = Array.from(this.chatSessions.entries()).sort(
      (a, b) => new Date(b[1].timestamp) - new Date(a[1].timestamp),
    )

    sortedChats.forEach(([chatId, chatData]) => {
      if (chatId !== "current") {
        const preview =
          chatData.messages.length > 0 ? chatData.messages[0].content.substring(0, 50) + "..." : "Tidak ada pesan"

        const timeStr = this.formatTime(new Date(chatData.timestamp))
        const item = this.createHistoryItem(chatId, chatData.title, preview, timeStr)

        if (this.currentChatId === chatId) {
          item.classList.add("active")
        }

        this.chatHistory.appendChild(item)
      }
    })
  }

  createHistoryItem(chatId, title, preview, time) {
    const item = document.createElement("div")
    item.className = "history-item"
    item.dataset.chatId = chatId

    item.innerHTML = `
      <div class="history-title">${title}</div>
      <div class="history-preview">${preview}</div>
      <div class="history-time">${time}</div>
    `

    item.addEventListener("click", () => this.switchToChat(chatId))

    return item
  }

  switchToChat(chatId) {
    // Save current chat
    if (this.currentChatId && this.currentChatId !== chatId) {
      const currentMessages = this.getCurrentMessages()
      if (this.currentChatId === "current" && currentMessages.length > 0) {
        this.chatSessions.set(this.currentChatId, {
          title: this.generateChatTitle(currentMessages[0]),
          messages: currentMessages,
          timestamp: new Date(),
        })
      } else if (this.chatSessions.has(this.currentChatId)) {
        this.chatSessions.get(this.currentChatId).messages = currentMessages
      }
    }

    // Switch to new chat
    this.currentChatId = chatId
    this.clearChatDisplay()

    // Load messages for selected chat
    if (chatId !== "current" && this.chatSessions.has(chatId)) {
      const chatData = this.chatSessions.get(chatId)
      chatData.messages.forEach((msg) => {
        this.addMessage(msg.content, msg.role === "user" ? "user" : "ai", msg.timestamp)
      })
    }

    // Update active state in sidebar
    document.querySelectorAll(".history-item").forEach((item) => {
      item.classList.remove("active")
    })
    document.querySelector(`[data-chat-id="${chatId}"]`).classList.add("active")

    // Close sidebar on mobile
    if (window.innerWidth <= 768) {
      this.sidebar.classList.add("collapsed")
    }
  }

  initializeChatSessions() {
    // Initialize with current chat
    this.chatSessions.set("current", {
      title: "Chat Saat Ini",
      messages: [],
      timestamp: new Date(),
    })

    this.updateChatHistory()
  }

  async handleSubmit(e) {
    e.preventDefault()

    const message = this.messageInput.value.trim()
    if (!message) return

    // Check rate limit before sending
    if (this.rateLimitCooldown) {
      this.addMessage("⏰ Masih dalam cooldown! Tunggu sebentar ya!", "ai")
      return
    }

    // Disable input and show loading
    this.setLoading(true)

    // Add user message to chat
    this.addMessage(message, "user")

    // Clear input
    this.messageInput.value = ""

    try {
      console.log("🚀 Mengirim pesan...")

      // Send message to server with timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 45000) // Increased timeout

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message }),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      const data = await response.json()

      if (!response.ok) {
        if (response.status === 429) {
          // Rate limited
          this.rateLimitCooldown = true
          this.updateSendButtonState()

          if (data.waitTime) {
            setTimeout(() => {
              this.rateLimitCooldown = false
              this.updateSendButtonState()
            }, data.waitTime * 1000)
          }
        }
        throw new Error(data.error || `HTTP ${response.status}`)
      }

      console.log("✅ Response berhasil diterima")

      // Add AI response to chat
      this.addMessage(data.response, "ai", data.timestamp)

      // Update chat history sidebar
      this.updateChatHistory()

      // Show rate limit info if provided
      if (data.rateLimitInfo) {
        console.log(
          `📊 Rate limit: ${data.rateLimitInfo.requestsInLastMinute}/${data.rateLimitInfo.maxPerMinute} per minute`,
        )
      }
    } catch (error) {
      console.error("❌ Error:", error)

      let errorMessage = "Maaf, ada masalah nih! 😅"

      if (error.name === "AbortError") {
        errorMessage = "Request timeout! Server lagi lambat, coba lagi ya! ⏱️"
      } else if (error.message.includes("Failed to fetch")) {
        errorMessage = "Koneksi internet bermasalah. Cek koneksi ya! 🌐"
      } else if (error.message.includes("terlalu cepat") || error.message.includes("Quota")) {
        errorMessage = error.message
        this.rateLimitCooldown = true
        this.updateSendButtonState()

        // Auto-enable after 60 seconds
        setTimeout(() => {
          this.rateLimitCooldown = false
          this.updateSendButtonState()
        }, 60000)
      } else if (error.message) {
        errorMessage = error.message
      }

      this.addMessage(errorMessage, "ai")
    } finally {
      this.setLoading(false)
    }
  }

  async checkConnection() {
    try {
      const response = await fetch("/api/health")
      const data = await response.json()

      if (!data.apiKeyConfigured) {
        this.addMessage("⚠️ API Key belum dikonfigurasi! Cek file .env ya!", "ai")
        return false
      }

      if (data.rateLimitStatus && !data.rateLimitStatus.canMakeRequest) {
        this.rateLimitCooldown = true
        this.updateSendButtonState()
        if (data.rateLimitStatus.waitTime > 0) {
          this.showRateLimitWarning(data.rateLimitStatus.waitTime)
        }
      }

      return true
    } catch (error) {
      console.error("Connection check failed:", error)
      this.addMessage("⚠️ Tidak bisa connect ke server! Cek koneksi ya!", "ai")
      return false
    }
  }

  addMessage(content, sender, timestamp = null) {
    const messageDiv = document.createElement("div")
    messageDiv.className = `message ${sender}-message`

    const messageTime = timestamp ? new Date(timestamp) : new Date()

    messageDiv.innerHTML = `
      <div class="message-content">
        <p>${this.formatMessage(content)}</p>
      </div>
      <div class="message-time">${this.formatTime(messageTime)}</div>
    `

    this.chatMessages.appendChild(messageDiv)
    this.scrollToBottom()
  }

  formatMessage(message) {
    return message.replace(/\n/g, "<br>")
  }

  formatTime(date) {
    return date.toLocaleString("id-ID", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
  }

  setLoading(isLoading) {
    if (isLoading) {
      this.loading.classList.add("show")
      this.sendBtn.disabled = true
      this.messageInput.disabled = true
    } else {
      this.loading.classList.remove("show")
      if (!this.rateLimitCooldown) {
        this.sendBtn.disabled = false
      }
      this.messageInput.disabled = false
      this.messageInput.focus()
    }
  }

  scrollToBottom() {
    this.chatMessages.scrollTop = this.chatMessages.scrollHeight
  }

  async loadChatHistory() {
    try {
      const response = await fetch("/api/history")
      const history = await response.json()

      // Clear existing messages except welcome
      const welcomeMessage = document.querySelector(".welcome-message")
      this.chatMessages.innerHTML = ""
      this.chatMessages.appendChild(welcomeMessage)

      // Add history messages
      history.forEach((msg) => {
        if (msg.role !== "system") {
          this.addMessage(msg.content, msg.role === "user" ? "user" : "ai", msg.timestamp)
        }
      })
    } catch (error) {
      console.error("Error loading chat history:", error)
    }
  }

  async clearCurrentChat() {
    if (confirm("Yakin mau bersihin chat ini? 🤔")) {
      try {
        await fetch("/api/history", { method: "DELETE" })

        // Clear current chat from sessions
        if (this.chatSessions.has(this.currentChatId)) {
          this.chatSessions.delete(this.currentChatId)
        }

        // Clear display
        this.clearChatDisplay()

        // Reset to current chat
        this.currentChatId = "current"
        this.initializeChatSessions()

        this.messageInput.focus()
      } catch (error) {
        console.error("Error clearing chat:", error)
        alert("Gagal bersihin chat 😅")
      }
    }
  }
}

// Initialize the chat app when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  new GeminiChat()
})

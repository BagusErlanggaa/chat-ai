# Erlann AI Chat App 🤖

A simple, friendly Node.js chat application powered by Google's Gemini AI API.

## Features ✨

- 💬 Clean, modern chat interface
- 🕒 Chat history with timestamps (date & time)
- 😄 Casual, friendly AI responses with emojis
- 💾 In-memory chat storage (easily extendable to database)
- 🚀 Real-time message display
- 📱 Responsive design for mobile and desktop
- 🗑️ Clear chat history functionality

## Setup Instructions 🛠️

1. **Get your Gemini API Key**
   - Visit [https://aistudio.google.com/apikey](https://aistudio.google.com/apikey)
   - Sign in with your Google account
   - Create a new API key

2. **Install Dependencies**
   \`\`\`bash
   npm install
   \`\`\`

3. **Configure Environment**
   - Copy the `.env` file and add your API key:
   \`\`\`env
   GOOGLE_GENERATIVE_AI_API_KEY=your_actual_api_key_here
   PORT=3000
   \`\`\`

4. **Run the Application**
   \`\`\`bash
   # Development mode (with auto-restart)
   npm run dev
   
   # Production mode
   npm start
   \`\`\`

5. **Open in Browser**
   - Navigate to `http://localhost:3000`
   - Start chatting! 🎉

## Project Structure 📁

\`\`\`
gemini-chat-app/
├── server.js          # Express server with AI integration
├── package.json       # Dependencies and scripts
├── .env              # Environment variables (API key)
├── README.md         # This file
└── public/           # Frontend files
    ├── index.html    # Main chat interface
    ├── style.css     # Styling and animations
    └── script.js     # Frontend JavaScript logic
\`\`\`

## API Endpoints 🔌

- `POST /api/chat` - Send message and get AI response
- `GET /api/history` - Retrieve chat history
- `DELETE /api/history` - Clear chat history

## Technologies Used 🔧

- **Backend**: Node.js, Express.js
- **AI Integration**: Vercel AI SDK with Google Generative AI
- **Frontend**: Vanilla HTML, CSS, JavaScript
- **Styling**: Modern CSS with gradients and animations

## Customization 🎨

- **AI Personality**: Modify the `systemPrompt` in `server.js`
- **Styling**: Update `public/style.css` for different themes
- **Chat History**: Extend to use a database instead of memory storage
- **Features**: Add user authentication, file uploads, etc.

## Troubleshooting 🔍

- **API Key Issues**: Make sure your Gemini API key is valid and properly set in `.env`
- **Port Conflicts**: Change the PORT in `.env` if 3000 is already in use
- **Dependencies**: Run `npm install` if you encounter module errors

Enjoy chatting with your friendly AI assistant! 😊🚀

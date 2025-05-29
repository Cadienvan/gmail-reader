# Gmail AI Helper - Setup & Configuration Guide

**Gmail AI Helper** is an intelligent email management application that helps you traverse Gmail emails with AI-powered link analysis, flash card generation, and voice commands support. **🔒 Everything runs locally** - your data never leaves your device, with AI processing handled entirely by your local Ollama installation and all content cached securely in your browser.

## 🌐 **Quick Access**

- **🚀 Live App**: [https://gmail-ai-reader.netlify.app/](https://gmail-ai-reader.netlify.app/)

---

## 🚨 **IMPORTANT SECURITY NOTICE**

**This application is designed for PERSONAL/DEVELOPMENT use only.** The current OAuth implementation is **NOT SUITABLE for production deployment** with multiple users due to security limitations:

- OAuth tokens are handled client-side
- Client secrets are exposed to the browser
- No server-side session management
- Suitable only for personal use or development environments

---

## 🎯 **What This Application Does**

### Core Features
- **📧 Gmail Integration**: Fetch and traverse unread emails
- **🤖 AI-Powered Analysis**: Generate intelligent summaries of email links using **100% local Ollama** - no data sent to external services
- **🎴 Flash Cards**: Create educational flash cards from content for learning
- **🎤 Voice Commands**: Hands-free navigation (Italian/English support)
- **📊 Analytics**: Track viewed emails and manage storage
- **⚙️ Configurable AI**: Customize AI models and prompts

### Technical Features
- **🔒 Privacy-First Local AI Processing**: Uses your local Ollama installation with any compatible model
- **🧠 Flexible Model Support**: Choose from any Ollama-compatible model for your specific needs
- **💾 Smart Browser Caching**: All emails, summaries, and flash cards stored locally in your browser
- **🔗 Advanced Link Extraction**: Automatically detects and analyzes links in emails
- **🎤 Voice Recognition**: Multilingual voice commands for accessibility
- **🎨 Modern UI**: Responsive design with Tailwind CSS
- **🚫 Zero External Dependencies**: No cloud AI services required - everything runs on your machine

---

## 🛠 **Prerequisites & Installation**

### 1. Install Ollama (Required for AI Features)

```bash
# Install Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# Pull a recommended AI model (example - you can use any model you prefer)
ollama pull deepseek-r1:1.5b

# Start Ollama service
ollama serve
```

> **🎯 Model Flexibility**: The `deepseek-r1:1.5b` model shown above is just an example. Once Ollama is running, the application will automatically detect and display **all available models** in your local installation. You can use any model that suits your needs - from lightweight options like `llama3.2:1b` to more powerful models like `llama3.1:70b` depending on your hardware capabilities.

### 2. Install Node.js Dependencies

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Open http://localhost:5173
```

---

## 🔐 **Google OAuth Setup**

The application works in **demo mode** without OAuth setup. For real Gmail integration:

**📱 Use the Built-in Setup Guide (Recommended)**

1. Start the application: `npm run dev`
2. Click "Configuration" in the top-right corner
3. Go to the "OAuth Setup" tab
4. Follow the comprehensive step-by-step guide
5. Switch to the "Environment" tab to enter your credentials
6. Save and you're ready to go!

The built-in configuration panel provides:
- ✅ Step-by-step Google Cloud Console setup instructions  
- ✅ Copy-to-clipboard buttons for all required URLs
- ✅ Real-time validation of your OAuth credentials
- ✅ Troubleshooting guide for common issues
- ✅ Setup completion checklist

**⚙️ Alternative: Environment Variables**

For development, you can also create a `.env` file:
```bash
VITE_GOOGLE_CLIENT_ID=your_client_id_here
VITE_GOOGLE_CLIENT_SECRET=your_client_secret_here
VITE_GOOGLE_REDIRECT_URI=http://localhost:5173/auth-callback.html
```

> **💡 Pro Tip:** Use the web app configuration instead of environment variables - it's more user-friendly and includes helpful validation!

---

## 🎮 **How to Use**

### Getting Started
1. **Start the Application**: `npm run dev`
2. **Check Ollama Status**: Ensure green "Ollama service ready" indicator
3. **Connect Gmail**: Click "Connect Gmail" (or use demo mode)
4. **Start Traversal**: Click "Start Traversal" to begin email navigation

### Navigation Options

#### Manual Navigation
- **Previous/Next**: Use arrow buttons in email modal
- **Email List**: Click any email in the dashboard

#### Voice Commands 🎤
Click the microphone button and say:
- **English**: "next", "previous", "start traversal", "stop", "show log", "refresh"
- **Italian**: "successivo", "precedente", "inizia navigazione", "ferma", "mostra storia", "aggiorna"

### AI Features

#### Link Analysis
1. Open any email with links
2. Click on extracted links in the right panel
3. **AI generates intelligent summaries locally** using your Ollama installation
4. All summaries are **cached in your browser** for instant future access - no re-processing needed

#### Flash Cards Generation
1. When viewing link summaries, click "Generate Flash Cards"
2. **Local AI creates educational Q&A pairs** - all processing happens on your machine
3. Cards are **saved locally in your browser** for later review
4. Use "Flash Card Game" for study sessions

#### Configuration
- **AI Models**: Configure quick vs detailed processing models
- **Prompts**: Customize AI prompts for summaries and flash cards
- **Storage**: Manage cached data and clear storage by category

---

## 📊 **Storage Management**

The application provides detailed storage analytics for all locally cached data:

- **📧 Email Cache**: Faster loading of previously fetched emails (stored in browser)
- **🔗 Link Summaries**: Cached AI-generated content summaries (processed locally)
- **🎴 Flash Cards**: Educational cards with tagging system (stored locally)
- **⚙️ Configuration**: Environment and AI settings (browser storage)

**🔒 Privacy Note**: All data is stored locally in your browser's storage. Nothing is sent to external servers except for the initial Gmail API calls (which go directly to Google's servers).

Access via Configuration > Storage tab.

---

## ⚙️ **Advanced Configuration**

### AI Model Configuration
- **🧠 Flexible Model Selection**: Choose from any model available in your local Ollama installation
- **⚡ Quick Model**: Fast processing for initial summaries (e.g., smaller models like llama3.2:1b)
- **🎯 Detailed Model**: Comprehensive analysis for important content (e.g., larger models like llama3.1:8b)
- **📝 Custom Prompts**: Tailor AI responses to your specific needs
- **🔒 100% Local**: All AI processing happens on your machine - no external API calls

### Environment Settings
- **Backend API URL**: For link content fetching
- **Ollama Base URL**: Local AI service endpoint
- **OAuth Credentials**: Gmail integration settings

### Voice Commands
- **Language Support**: English and Italian
- **Continuous Listening**: Toggle for hands-free operation
- **Command Sensitivity**: Customizable recognition threshold

---

## 🔧 **Development & Deployment**

### Development Mode
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
```

### Production Deployment
```bash
npm run build:github # Build for GitHub Pages
```

**⚠️ Production Security Checklist:**
- [ ] Remove all hardcoded OAuth credentials
- [ ] Implement server-side OAuth flow
- [ ] Use environment-specific configuration
- [ ] Add content security policies
- [ ] Implement proper session management

---

## 🆘 **Troubleshooting**

### Quick Fixes

**"Gmail OAuth not configured"**
- Use the built-in Configuration panel (click "Configuration" → "OAuth Setup" tab)
- The setup guide includes troubleshooting for this exact issue

**"Ollama service unavailable"**
- Ensure Ollama is running: `ollama serve`
- Check if you have any model installed: `ollama list` (if empty, pull any model: `ollama pull llama3.2:1b`)
- Verify Ollama URL in Configuration → Environment
- The application will automatically detect all available models once Ollama is running

**Voice commands not working**
- Check browser microphone permissions
- Ensure HTTPS or localhost for security

**For detailed troubleshooting:** Open the application and go to Configuration → OAuth Setup tab. It includes a comprehensive troubleshooting guide with solutions for all common OAuth issues.

### Debug Mode
Open browser developer tools (F12) to see detailed logs and error messages.

---

## 📄 **License & Disclaimer**

This application is provided as-is for educational and personal use. The current implementation is not suitable for production use without significant security improvements. Users are responsible for protecting their OAuth credentials and personal data.

For production deployment, consider implementing proper backend authentication and session management.

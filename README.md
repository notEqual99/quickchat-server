# QuickChat

A simple, text only real-time chat application where users can join rooms and chat with others without needing to sign up. And not taking any personal information from the user. This is hobby project and chat for fun :P .

<h2 align="center">
  <img src="./src/assets/chatRoom.png">
</h2>

## Features

- No sign-up or login required
- Choose a username and join any room between (1-9999)
- Real-time messaging
- Clean, responsive UI
- No personal information is required to chat

## Demo
URL - https://quickchatorg.netlify.app
(Demo is running on free hosting sometime get traffic because of low bandwidth. Test it patiently).

## Todo
- [ ] lock room
- [ ] color theme
- [ ] invite link 

## Local Setup

### Prerequisites

- Node.js (v14 or higher)
- npm (comes with Node.js)

### Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   git clone <https://github.com/notEqual99/quickchat-client.git>
   git clone <https://github.com/notEqual99/quickchat-server.git> 
   ```

2. **Set up the server**
   ```bash
   cd quickchat-server
   npm install
   nodemon start
   The server will start on http://localhost:3000
   ```

3. **Set up the client**
   ```bash
   cd quickchat-client
   npm install
   npm run dev
   The client will be available at http://localhost:5173
   ```

## Usage

1. Open http://localhost:5173 in your browser
2. Enter a room number (1-9999) and click "Join Room"
3. Enter a username and click "Continue"
4. Start chatting!

## Technologies Used

- **Frontend**:
  - Preact (React alternative)
  - TypeScript
  - Vite (Build tool)
  - Socket.IO Client
  - Tailwind CSS (for styling)

- **Backend**:
  - Node.js
  - Express
  - Socket.IO
  - CORS (for cross-origin requests)

## Project Structure

```
quickchat/
├── quickchat-server/               # Backend server code
│   ├── index.js          # Main server file
│   └── package.json      # Server dependencies
└── quickchat-client/     # Frontend React application
    ├── src/
    │   ├── components/    # React components
    │   ├── App.tsx       # Main App component
    │   └── index.tsx      # Entry point
    └── package.json      # Client dependencies
```

## License

This project is open source and available under the [MIT License](LICENSE).

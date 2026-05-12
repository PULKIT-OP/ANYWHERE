## 🚀 Live Demo
[Try ANYWHERE here](anywhere-production.up.railway.app) anywhere-production.up.railway.app
or 
[Try ANYWHERE here](https://anywhere-eta.vercel.app/) https://anywhere-eta.vercel.app/
anywhere-production.up.railway.app

# ⬡ ANYWHERE — Drop & Go

A simple, **no-login** file sharing web app powered by **Cloudinary** for storage.  
Upload any file → get an 8-character code → share it → anyone enters the code → downloads the file.

## ✨ Features

- **No Authentication** — Just drop a file and share the code
- **Unique Codes** — Every file gets a random 8-character alphanumeric code
- **Auto-Delete** — Set custom expiration times (5 min to 1 week)
- **Drag & Drop** — Easy file selection with drag-and-drop support
- **Instant Cleanup** — Expired files are immediately deleted from storage
- **Cloud Storage** — Files stored on Cloudinary, zero bandwidth cost
- **Manual Delete** — Users can manually delete their files anytime
- **File Preview** — Shows file size, type icon, and upload time

---

## 🗂 Project Structure

```
fileshare/
├── server.js          ← Express backend (upload, download, delete, expiration)
├── package.json
├── .env.example       ← Copy this to .env and fill in your keys
├── .env               ← Your actual secrets (never commit this!)
├── .gitignore         ← Git ignore rules
└── public/
    ├── index.html     ← Frontend UI with expiration options
    ├── style.css      ← Modern dark theme styles
    └── app.js         ← Frontend logic (upload, download, delete)
```

---

## 🚀 Setup & Run

### Step 1 — Get your Cloudinary credentials

1. Go to https://console.cloudinary.com
2. Sign in / create a free account
3. On the Dashboard, copy your Cloud name, API Key, and API Secret

### Step 2 — Create your .env file

```bash
cp .env.example .env
```

Open .env and fill in your Cloudinary credentials and MongoDB URI.

### Step 3 — Install MongoDB

Make sure MongoDB is installed and running on your machine.

- Download: https://www.mongodb.com/try/download/community
- Or use MongoDB Atlas (cloud): https://www.mongodb.com/cloud/atlas

### Step 4 — Install dependencies

```bash
npm install
```

### Step 5 — Run the server

```bash
npm run dev    # development with auto-restart (nodemon)
npm start      # production
```

Open http://localhost:3000 in your browser.

---

## 📋 How It Works

### Upload

1. Select a file or drag & drop
2. Optionally enable auto-delete and select duration
3. Click "Upload & Generate Code"
4. Copy the unique 8-character code to share

### Download

1. Enter the 8-character code
2. Click "Find File" to check if it exists
3. Click "Download" to download the file
4. Or click "Delete" to remove it permanently

### Auto-Delete

- Files can be set to auto-delete after: 5 min, 15 min, 30 min, 1 hour, 4 hours, 1 day, 1 week
- Or enter a custom duration
- Expired files are deleted instantly when accessed (no database clutter)

---

## 🛠 Tech Stack

- **Backend**: Node.js + Express
- **Database**: MongoDB
- **File Storage**: Cloudinary
- **Frontend**: Vanilla HTML + CSS + JavaScript
- **File Transfer**: XHR with progress tracking

---

## 📦 Dependencies

```json
{
  "cloudinary": "^2.5.1", // Cloud storage & file management
  "dotenv": "^16.4.5", // Environment variables
  "express": "^4.18.2", // Web framework
  "mongoose": "^8.0.3", // MongoDB ODM
  "multer": "^1.4.5-lts.1" // File upload middleware
}
```

---

## 🔒 Security Notes

- **.env file**: Add to .gitignore (already done)
- **No authentication**: Anyone with the code can download/delete the file
- **File expiration**: Automatically delete files to save storage
- **Cloudinary**: Handles all file storage securely

---

## 📝 License

MIT

### Step 6 — Open browser

```
http://localhost:3000
```

---

## How It Works

1. Browser sends file to Express (POST /api/upload)
2. Multer reads it into memory — no temp file on disk
3. Server streams buffer straight to Cloudinary
4. Cloudinary stores it, returns public_id + secure_url
5. MongoDB saves metadata + unique 8-char code + Cloudinary ID
6. User receives the code
7. On another device: enter code → server looks up DB → redirects to signed Cloudinary URL → file downloads

---

## API Reference

| Method | Route               | Description                                    |
| ------ | ------------------- | ---------------------------------------------- |
| POST   | /api/upload         | Upload file (multipart/form-data, field: file) |
| GET    | /api/file/:code     | Get file metadata                              |
| GET    | /api/download/:code | Redirect to signed Cloudinary download URL     |

---

## Tech Stack

- Frontend: HTML, CSS, Vanilla JS
- Backend: Node.js + Express
- Database: MongoDB + Mongoose
- File Storage: Cloudinary
- File Upload: Multer (memory storage)

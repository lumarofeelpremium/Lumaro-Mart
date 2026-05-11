import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import admin from "firebase-admin";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Initialize Firebase Admin
  // Note: For production, you should use a service account.
  // In this environment, we'll try to use the environment variables if provided.
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      let saString = process.env.FIREBASE_SERVICE_ACCOUNT;
      
      // Check if it's base64 encoded (doesn't start with {)
      if (saString.trim() && !saString.trim().startsWith('{')) {
        try {
          saString = Buffer.from(saString, 'base64').toString('utf8');
        } catch (e) {
          console.error("FIREBASE_SERVICE_ACCOUNT does not start with '{' and failed to decode as base64.");
        }
      }

      const serviceAccount = JSON.parse(saString);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id
      });
      console.log("Firebase Admin initialized with Service Account");
    } catch (err) {
      console.error("Failed to initialize Firebase Admin with Service Account:", err);
      console.log("Tip: Ensure FIREBASE_SERVICE_ACCOUNT is a valid JSON string or a base64 encoded JSON string.");
    }
  } else {
    console.warn("FIREBASE_SERVICE_ACCOUNT not found. Push notifications will NOT work.");
  }

  app.use(express.json());

  // API Route to send notifications
  app.post("/api/send-notification", async (req, res) => {
    const { tokens, title, body, data } = req.body;

    if (!admin.apps.length) {
      return res.status(500).json({ error: "Firebase Admin not initialized" });
    }

    if (!tokens || !tokens.length) {
      return res.status(400).json({ error: "No tokens provided" });
    }

    try {
      const message = {
        notification: { title, body },
        data: data || {},
        tokens: tokens,
      };

      const response = await admin.messaging().sendEachForMulticast(message);
      res.json({ success: true, response });
    } catch (error: any) {
      console.error("Error sending notification:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

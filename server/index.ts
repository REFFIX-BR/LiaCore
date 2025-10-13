import express, { type Request, Response, NextFunction } from "express";
import cookieParser from "cookie-parser";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { startLearningScheduler } from "./lib/learning-scheduler";
import { runAutoMigrations } from "./lib/auto-migrate";

const app = express();
app.use(express.json({ limit: '50mb' })); // Support large base64 images/audio
app.use(express.urlencoded({ extended: false, limit: '50mb' }));
app.use(cookieParser());

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  try {
    console.log('🚀 [Startup] Initializing LIA CORTEX server...');
    console.log(`📍 [Startup] Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`📍 [Startup] Port: ${process.env.PORT || '5000'}`);
    
    // Run auto-migrations before starting server
    await runAutoMigrations();
    
    const server = await registerRoutes(app);
    console.log('✅ [Startup] Routes registered successfully');

    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      console.error(`❌ [Error] ${status}: ${message}`, err);
      res.status(status).json({ message });
    });

    // importantly only setup vite in development and after
    // setting up all the other routes so the catch-all route
    // doesn't interfere with the other routes
    if (app.get("env") === "development") {
      console.log('🔧 [Startup] Setting up Vite (development mode)');
      await setupVite(app, server);
    } else {
      console.log('📦 [Startup] Serving static files (production mode)');
      serveStatic(app);
    }

    // ALWAYS serve the app on the port specified in the environment variable PORT
    // Other ports are firewalled. Default to 5000 if not specified.
    // this serves both the API and the client.
    // It is the only port that is not firewalled.
    const port = parseInt(process.env.PORT || '5000', 10);
    
    console.log(`🌐 [Startup] Starting server on 0.0.0.0:${port}...`);
    
    // Remove reusePort option for Cloud Run compatibility
    server.listen(port, "0.0.0.0", () => {
      console.log(`✅ [Server] Successfully listening on 0.0.0.0:${port}`);
      log(`serving on port ${port}`);
      
      // Start learning scheduler for automatic analysis
      try {
        startLearningScheduler();
        console.log('✅ [Startup] Learning scheduler started');
      } catch (error) {
        console.error('❌ [Startup] Failed to start learning scheduler:', error);
      }
      
      // Start queue workers only if Redis TCP available
      const hasRedis = process.env.UPSTASH_REDIS_HOST || process.env.REDIS_HOST;
      
      if (!hasRedis) {
        console.log('⏸️  [Workers] Queue workers disabled - Redis TCP not configured');
        console.log('   Webhook will use fallback async processing');
        console.log('   See QUEUE_SETUP.md for Redis configuration');
      } else {
        import('./workers').then(() => {
          console.log('✅ [Workers] Queue workers initialized with Redis');
        }).catch((error) => {
          console.error('❌ [Workers] Failed to start workers:', error);
          console.log('   Falling back to async processing');
        });
      }
    });

    // Handle server errors
    server.on('error', (error: any) => {
      console.error('❌ [Server] Server error:', error);
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ [Server] Port ${port} is already in use`);
      }
      process.exit(1);
    });

  } catch (error) {
    console.error('❌ [Startup] Fatal initialization error:', error);
    console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace available');
    
    // Log environment for debugging
    console.error('Environment variables check:');
    console.error('- DATABASE_URL:', process.env.DATABASE_URL ? '✅ Set' : '❌ Missing');
    console.error('- OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? '✅ Set' : '❌ Missing');
    console.error('- SESSION_SECRET:', process.env.SESSION_SECRET ? '✅ Set' : '❌ Missing');
    
    process.exit(1);
  }
})();

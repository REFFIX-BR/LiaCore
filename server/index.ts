import express, { type Request, Response, NextFunction } from "express";
import cookieParser from "cookie-parser";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { startLearningScheduler } from "./lib/learning-scheduler";
import { startMessageRecoveryScheduler } from "./lib/message-recovery-scheduler";
import { startComercialSyncWorker } from "./workers/comercial-sync-worker";

// PDF Extraction Fix: Force rebuild with pdf-parse@1.1.1 (2025-10-31)
// Configurar timezone para horário de Brasília (UTC-3)
process.env.TZ = 'America/Sao_Paulo';

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
      
      // Initialize prompt templates from OpenAI if database is empty or has placeholders
      (async () => {
        try {
          console.log('📝 [Prompts Init] Starting initialization check...');
          const { storage } = await import('./storage');
          const { ASSISTANT_IDS } = await import('./lib/openai');
          const OpenAI = (await import('openai')).default;
          
          const templates = await storage.getAllPromptTemplates();
          console.log(`📝 [Prompts Init] Found ${templates.length} templates in database`);
          
          // Update templates with real content from OpenAI if they have placeholders
          const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
          const assistantTypes = [
            "apresentacao",
            "comercial",
            "financeiro",
            "suporte",
            "ouvidoria",
            "cancelamento",
          ] as const;

          for (const assistantType of assistantTypes) {
            try {
              const existingTemplate = templates.find(t => t.assistantType === assistantType);
              
              // Skip if template exists and has real content
              if (existingTemplate && existingTemplate.content !== 'Template placeholder' && existingTemplate.content.length > 100) {
                console.log(`⏭️  [Prompts Init] Skipping ${assistantType} - already has content (${existingTemplate.content.length} chars)`);
                continue;
              }
              
              console.log(`📝 [Prompts Init] Fetching ${assistantType} from OpenAI...`);
              const assistantId = ASSISTANT_IDS[assistantType];
              const assistant = await openai.beta.assistants.retrieve(assistantId);
              const instructions = assistant.instructions || "";

              if (existingTemplate) {
                console.log(`📝 [Prompts Init] Updating template for ${assistantType}...`);
                await storage.updatePromptTemplate(existingTemplate.id, {
                  content: instructions,
                  tokenCount: 0,
                });
                console.log(`✅ [Prompts Init] Updated template for ${assistantType} (${instructions.length} chars)`);
              } else {
                console.log(`📝 [Prompts Init] Creating template for ${assistantType}...`);
                const template = await storage.createPromptTemplate({
                  assistantType,
                  assistantId,
                  title: `Assistente ${assistantType.charAt(0).toUpperCase() + assistantType.slice(1)}`,
                  content: instructions,
                  version: "1.0.0",
                  status: "active",
                  createdBy: "system",
                });
                console.log(`✅ [Prompts Init] Created template for ${assistantType} (${instructions.length} chars)`);
              }
            } catch (error) {
              console.error(`❌ [Prompts Init] Failed to initialize ${assistantType}:`, error);
            }
          }
          
          console.log('✅ [Prompts Init] All prompts initialized successfully');
        } catch (error) {
          console.error('❌ [Prompts Init] Failed to initialize prompts:', error);
        }
      })();
      
      // Start learning scheduler for automatic analysis
      try {
        startLearningScheduler();
        console.log('✅ [Startup] Learning scheduler started');
      } catch (error) {
        console.error('❌ [Startup] Failed to start learning scheduler:', error);
      }
      
      // Start message recovery scheduler for automatic stuck message recovery
      try {
        startMessageRecoveryScheduler();
        console.log('✅ [Startup] Message recovery scheduler started');
      } catch (error) {
        console.error('❌ [Startup] Failed to start message recovery scheduler:', error);
      }
      
      // Start commercial API sync worker for retry of failed syncs
      try {
        startComercialSyncWorker();
        console.log('✅ [Startup] Commercial sync worker started');
      } catch (error) {
        console.error('❌ [Startup] Failed to start commercial sync worker:', error);
      }
      
      // Start queue workers only if Redis TCP available
      const hasRedis = process.env.UPSTASH_REDIS_HOST || process.env.REDIS_HOST;
      
      if (!hasRedis) {
        console.log('⏸️  [Workers] Queue workers disabled - Redis TCP not configured');
        console.log('   Webhook will use fallback async processing');
        console.log('   See QUEUE_SETUP.md for Redis configuration');
      } else {
        // Start workers (async - don't block startup)
        (async () => {
          // Start standard message workers (always needed)
          import('./workers').then(() => {
            console.log('✅ [Workers] Queue workers initialized with Redis');
          }).catch((error) => {
            console.error('❌ [Workers] Failed to start workers:', error);
            console.log('   Falling back to async processing');
          });
          
          // 🔴 DESATIVADO: Voice/Cobrança workers - instância Cobrança desativada
          // Para reativar, descomente o bloco abaixo
          console.log('⏸️  [Voice Workers] Módulo de cobrança DESATIVADO - workers não iniciados');
          /*
          import('./modules/voice/workers').then(() => {
            console.log('✅ [Voice Workers] Voice module workers initialized with Redis');
          }).catch((error) => {
            console.error('❌ [Voice Workers] Failed to start voice workers:', error);
            console.error('   Error details:', error);
            console.log('   Voice module will be disabled');
          });
          */
        })();
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

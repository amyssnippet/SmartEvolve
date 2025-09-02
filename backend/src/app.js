const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const path = require('path');
const { createServer } = require('http');
const { Server } = require('socket.io');

require('dotenv').config();

const logger = require('./utils/logger');
const {errorMiddleware} = require('./middleware/error.middleware');

// Initialize database and models FIRST
const { initializeDatabase } = require('./config/database');
const { initializeRedis } = require('./config/redis');
const { initializeStorage } = require('./config/storage');

const app = express();
const server = createServer(app);
const io = new Server(server, {
    cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        methods: ["GET", "POST", "PUT", "DELETE"]
    }
});

const PORT = process.env.PORT || 8000;

// Initialize services
async function initialize() {
    try {
        // Initialize database FIRST (this also initializes models)
        await initializeDatabase();
        logger.info('Database and models initialized successfully');
        // Initialize other services
        await initializeRedis();
        logger.info('Redis initialized successfully');

        await initializeStorage();
        logger.info('Storage initialized successfully');

        // Now we can import routes that depend on models
        const authRoutes = require('./routes/auth.routes');
        const userRoutes = require('./routes/users.routes');
        const projectRoutes = require('./routes/projects.routes');
        const trainingRoutes = require('./routes/training.routes');
        const vastRoutes = require('./routes/vast.routes');
        const storageRoutes = require('./routes/storage.routes');
        const billingRoutes = require('./routes/billing.routes');

        // Setup middleware
        app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
        app.use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:3000", credentials: true }));
        app.use(compression());
        app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));
        app.use(express.json({ limit: '50mb' }));
        app.use(express.urlencoded({ extended: true, limit: '50mb' }));

        // Static files
        app.use('/storage', express.static(path.join(__dirname, '../storage')));

        // API Routes
        app.use('/api/auth', authRoutes);
        app.use('/api/users', userRoutes);
        app.use('/api/projects', projectRoutes);
        app.use('/api/training', trainingRoutes);
        app.use('/api/vast', vastRoutes);
        app.use('/api/storage', storageRoutes);
        app.use('/api/billing', billingRoutes);

        // Health check
        app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                version: process.env.npm_package_version || '1.0.0',
                environment: process.env.NODE_ENV
            });
        });

        // Socket.io setup
        io.on('connection', (socket) => {
            logger.info(`Client connected: ${socket.id}`);

            socket.on('join_job', (jobId) => {
                socket.join(`job_${jobId}`);
                logger.info(`Client ${socket.id} joined job ${jobId}`);
            });

            socket.on('join_user', (userId) => {
                socket.join(`user_${userId}`);
                logger.info(`Client ${socket.id} joined user ${userId}`);
            });

            socket.on('disconnect', () => {
                logger.info(`Client disconnected: ${socket.id}`);
            });
        });

        app.set('io', io);

        // Error handling
        app.use(errorMiddleware);

        // 404 handler
        app.use('*', (req, res) => {
            res.status(404).json({
                error: 'Route not found',
                path: req.originalUrl
            });
        });

        // Start background jobs
        require('./jobs/trainingQueue');
        require('./jobs/costTracker');
        require('./jobs/instanceMonitor');
        logger.info('Background jobs started');

        server.listen(PORT, () => {
            logger.info(`AI Platform Backend running on port ${PORT}`);
            logger.info(`Environment: ${process.env.NODE_ENV}`);
            logger.info(`Storage root: ${process.env.STORAGE_ROOT || 'storage'}`);
        });

    } catch (error) {
        logger.error('Failed to initialize application:', error);
        process.exit(1);
    }
}

// Graceful shutdown handlers
process.on('SIGTERM', () => {
    logger.info('SIGTERM signal received: closing HTTP server');
    server.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    logger.info('SIGINT signal received: closing HTTP server');
    server.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
    });
});

process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

initialize();

module.exports = app;

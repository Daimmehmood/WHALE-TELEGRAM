"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/server.ts
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const dotenv_1 = __importDefault(require("dotenv"));
const node_cron_1 = __importDefault(require("node-cron"));
const database_1 = require("./config/database");
const GmgnScraper_1 = require("./services/GmgnScraper");
const WalletService_1 = require("./services/WalletService");
const logger_1 = require("./utils/logger");
const wallets_1 = __importDefault(require("./routes/wallets"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
// Middleware
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: '10mb' }));
// Routes
app.use('/api/wallets', wallets_1.default);
// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});
// Home route
app.get('/', (req, res) => {
    res.json({
        message: 'Solana Whale Tracker API',
        version: '1.0.0',
        endpoints: {
            wallets: '/api/wallets',
            'qualified-wallets': '/api/wallets/qualified',
            'scrape-now': '/api/wallets/scrape',
            stats: '/api/wallets/stats',
            health: '/health'
        }
    });
});
// Manual scraping endpoint
app.post('/api/wallets/scrape', async (req, res) => {
    try {
        logger_1.logger.info('🚀 Manual scraping initiated via API');
        const scraper = new GmgnScraper_1.GmgnScraper();
        const walletService = new WalletService_1.WalletService();
        await scraper.initialize();
        const wallets = await scraper.scrapeTopWallets(20);
        await walletService.saveWallets(wallets);
        await scraper.close();
        // Show qualified wallets after scraping
        await displayQualifiedWallets();
        res.json({
            success: true,
            message: `Scraped ${wallets.length} wallets successfully`,
            walletsFound: wallets.length,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        logger_1.logger.error('Manual scraping failed:', error);
        res.status(500).json({
            success: false,
            error: 'Scraping failed',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
// Function to display qualified wallets on startup
async function displayQualifiedWallets() {
    try {
        const walletService = new WalletService_1.WalletService();
        logger_1.logger.info('🔍 Fetching wallets from database...');
        // Get all wallets and stats
        const allWallets = await walletService.getAllWallets();
        const qualifiedWallets = await walletService.getQualifiedWallets();
        const stats = await walletService.getQualificationStats();
        // Display summary
        console.log('\n' + '='.repeat(100));
        console.log('🐋 WHALE WALLET ANALYSIS - DATABASE SUMMARY');
        console.log('='.repeat(100));
        console.log(`📊 Total Wallets in Database: ${stats.total}`);
        console.log(`✅ Qualified Wallets: ${stats.qualified}`);
        console.log(`📈 Qualification Rate: ${stats.qualificationRate.toFixed(1)}%`);
        console.log(`🕒 Last Updated: ${new Date().toISOString()}`);
        console.log('='.repeat(100));
        // Display qualification criteria
        console.log('\n🎯 QUALIFICATION CRITERIA:');
        console.log(`   • Win Rate: ≥${stats.criteria.winRate}%`);
        console.log(`   • PNL: >$${stats.criteria.pnl}`);
        console.log(`   • Trading Days: ≥${stats.criteria.tradingDays} days`);
        console.log(`   • Min Purchase: ≥$${stats.criteria.minPurchase}`);
        console.log(`   • 30-Day PNL: Must be positive`);
        if (qualifiedWallets.length === 0) {
            console.log('\n❌ NO QUALIFIED WALLETS FOUND');
            console.log('💡 Try running: POST /api/wallets/scrape to get new wallets');
            return;
        }
        // Display qualified wallets
        console.log('\n' + '🎯 QUALIFIED WHALE WALLETS:');
        console.log('='.repeat(100));
        qualifiedWallets.slice(0, 10).forEach((wallet, index) => {
            console.log(`\n${index + 1}. 🐋 WHALE WALLET`);
            console.log(`   🔗 Address: ${wallet.address}`);
            console.log(`   📊 Win Rate: ${wallet.winRate.toFixed(1)}%`);
            console.log(`   💰 Total PNL: $${wallet.pnl.toFixed(2)}`);
            console.log(`   📈 Total Trades: ${wallet.totalTrades}`);
            console.log(`   💵 Avg Trade: $${wallet.avgTradeSize.toFixed(2)}`);
            console.log(`   🛒 Min Purchase: $${(wallet.minPurchaseSize || wallet.avgTradeSize).toFixed(2)}`);
            console.log(`   📅 Trading Days: ${wallet.tradingDays}`);
            console.log(`   🌐 Verify: https://kolscan.io/account/${wallet.address}`);
            console.log(`   🕒 Last Updated: ${new Date(wallet.updatedAt).toLocaleString()}`);
        });
        if (qualifiedWallets.length > 10) {
            console.log(`\n... and ${qualifiedWallets.length - 10} more qualified wallets`);
            console.log('💡 View all at: GET /api/wallets/qualified');
        }
        console.log('\n' + '='.repeat(100));
        console.log('🚀 API ENDPOINTS:');
        console.log(`   📊 All Wallets: GET http://localhost:${PORT}/api/wallets`);
        console.log(`   ✅ Qualified: GET http://localhost:${PORT}/api/wallets/qualified`);
        console.log(`   📈 Stats: GET http://localhost:${PORT}/api/wallets/stats`);
        console.log(`   🔄 Scrape: POST http://localhost:${PORT}/api/wallets/scrape`);
        console.log('='.repeat(100));
    }
    catch (error) {
        logger_1.logger.error('❌ Error displaying qualified wallets:', error);
    }
}
// Scheduled scraping function
async function scheduledScrape() {
    const scraper = new GmgnScraper_1.GmgnScraper();
    const walletService = new WalletService_1.WalletService();
    try {
        logger_1.logger.info('🕒 Running scheduled scrape...');
        await scraper.initialize();
        const wallets = await scraper.scrapeTopWallets(50);
        await walletService.saveWallets(wallets);
        logger_1.logger.info(`✅ Scheduled scrape completed. Found ${wallets.length} wallets`);
        // Show updated qualified wallets after scheduled scrape
        await displayQualifiedWallets();
    }
    catch (error) {
        logger_1.logger.error('❌ Scheduled scrape failed:', error);
    }
    finally {
        await scraper.close();
    }
}
async function startServer() {
    try {
        // Connect to database
        await (0, database_1.connectDatabase)();
        // Display qualified wallets on startup
        await displayQualifiedWallets();
        // Schedule scraping (but don't run immediately)
        const scrapeInterval = process.env.SCRAPE_INTERVAL_MINUTES || '120'; // Default 2 hours
        const enableScheduledScraping = process.env.ENABLE_SCHEDULED_SCRAPING === 'true';
        if (enableScheduledScraping) {
            node_cron_1.default.schedule(`*/${scrapeInterval} * * * *`, scheduledScrape);
            logger_1.logger.info(`📅 Scheduled scraping every ${scrapeInterval} minutes (enabled)`);
        }
        else {
            logger_1.logger.info(`📅 Scheduled scraping disabled. Use POST /api/wallets/scrape for manual scraping`);
        }
        // Start server
        app.listen(PORT, () => {
            logger_1.logger.info(`🚀 Server running on port ${PORT}`);
            logger_1.logger.info(`🌍 Environment: ${process.env.NODE_ENV}`);
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to start server:', error);
        process.exit(1);
    }
}
// Graceful shutdown
process.on('SIGINT', () => {
    logger_1.logger.info('Received SIGINT, shutting down gracefully...');
    process.exit(0);
});
process.on('SIGTERM', () => {
    logger_1.logger.info('Received SIGTERM, shutting down gracefully...');
    process.exit(0);
});
startServer();

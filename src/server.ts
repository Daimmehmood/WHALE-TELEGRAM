// src/server.ts
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import cron from 'node-cron';
import { connectDatabase } from './config/database';
import { GmgnScraper } from './services/GmgnScraper';
import { WalletService } from './services/WalletService';
import { logger } from './utils/logger';
import walletRoutes from './routes/wallets';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Routes
app.use('/api/wallets', walletRoutes);

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
    logger.info('🚀 Manual scraping initiated via API');
    
    const scraper = new GmgnScraper();
    const walletService = new WalletService();
    
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
    
  } catch (error) {
    logger.error('Manual scraping failed:', error);
    res.status(500).json({
      success: false,
      error: 'Scraping failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Function to display qualified wallets on startup
async function displayQualifiedWallets(): Promise<void> {
  try {
    const walletService = new WalletService();
    
    logger.info('🔍 Fetching wallets from database...');
    
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
    
  } catch (error) {
    logger.error('❌ Error displaying qualified wallets:', error);
  }
}

// Scheduled scraping function
async function scheduledScrape(): Promise<void> {
  const scraper = new GmgnScraper();
  const walletService = new WalletService();
  
  try {
    logger.info('🕒 Running scheduled scrape...');
    
    await scraper.initialize();
    const wallets = await scraper.scrapeTopWallets(50);
    await walletService.saveWallets(wallets);
    
    logger.info(`✅ Scheduled scrape completed. Found ${wallets.length} wallets`);
    
    // Show updated qualified wallets after scheduled scrape
    await displayQualifiedWallets();
    
  } catch (error) {
    logger.error('❌ Scheduled scrape failed:', error);
  } finally {
    await scraper.close();
  }
}

async function startServer(): Promise<void> {
  try {
    // Connect to database
    await connectDatabase();
    
    // Display qualified wallets on startup
    await displayQualifiedWallets();
    
    // Schedule scraping (but don't run immediately)
    const scrapeInterval = process.env.SCRAPE_INTERVAL_MINUTES || '120'; // Default 2 hours
    const enableScheduledScraping = process.env.ENABLE_SCHEDULED_SCRAPING === 'true';
    
    if (enableScheduledScraping) {
      cron.schedule(`*/${scrapeInterval} * * * *`, scheduledScrape);
      logger.info(`📅 Scheduled scraping every ${scrapeInterval} minutes (enabled)`);
    } else {
      logger.info(`📅 Scheduled scraping disabled. Use POST /api/wallets/scrape for manual scraping`);
    }
    
    // Start server
    app.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT}`);
      logger.info(`🌍 Environment: ${process.env.NODE_ENV}`);
    });
    
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

startServer();
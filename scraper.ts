// src/scraper.ts
import dotenv from 'dotenv';
import { connectDatabase } from './config/database';
import { GmgnScraper } from './services/GmgnScraper';
import { WalletService } from './services/WalletService';
import { logger } from './utils/logger';

dotenv.config();

async function runScraper(): Promise<void> {
  const scraper = new GmgnScraper();
  const walletService = new WalletService();
  
  try {
    logger.info('Starting whale wallet scraper...');
    
    // Connect to database
    await connectDatabase();
    
    // Initialize scraper
    await scraper.initialize();
    
    // Scrape wallets
    const wallets = await scraper.scrapeTopWallets(200);
    logger.info(`Found ${wallets.length} qualified wallets`);
    
    // Save to database
    await walletService.saveWallets(wallets);
    
    logger.info('Scraping completed successfully');
    
  } catch (error) {
    logger.error('Scraper failed:', error);
  } finally {
    await scraper.close();
    process.exit(0);
  }
}

// Run if called directly
if (require.main === module) {
  runScraper();
}
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/scraper.ts
const dotenv_1 = __importDefault(require("dotenv"));
const database_1 = require("./config/database");
const GmgnScraper_1 = require("./services/GmgnScraper");
const WalletService_1 = require("./services/WalletService");
const logger_1 = require("./utils/logger");
dotenv_1.default.config();
async function runScraper() {
    const scraper = new GmgnScraper_1.GmgnScraper();
    const walletService = new WalletService_1.WalletService();
    try {
        logger_1.logger.info('Starting whale wallet scraper...');
        // Connect to database
        await (0, database_1.connectDatabase)();
        // Initialize scraper
        await scraper.initialize();
        // Scrape wallets
        const wallets = await scraper.scrapeTopWallets(200);
        logger_1.logger.info(`Found ${wallets.length} qualified wallets`);
        // Save to database
        await walletService.saveWallets(wallets);
        logger_1.logger.info('Scraping completed successfully');
    }
    catch (error) {
        logger_1.logger.error('Scraper failed:', error);
    }
    finally {
        await scraper.close();
        process.exit(0);
    }
}
// Run if called directly
if (require.main === module) {
    runScraper();
}

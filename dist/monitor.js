"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/monitor.ts
const dotenv_1 = __importDefault(require("dotenv"));
const database_1 = require("./config/database");
const WalletMonitor_1 = require("./services/WalletMonitor");
const logger_1 = require("./utils/logger");
dotenv_1.default.config();
async function startWalletMonitoring() {
    const monitor = new WalletMonitor_1.WalletMonitor();
    try {
        logger_1.logger.info('🚀 Initializing Whale Wallet Monitor...');
        // Connect to database
        await (0, database_1.connectDatabase)();
        // Start monitoring
        await monitor.startMonitoring();
        // Handle graceful shutdown
        process.on('SIGINT', async () => {
            logger_1.logger.info('🛑 Received SIGINT, stopping monitor...');
            await monitor.stopMonitoring();
            process.exit(0);
        });
        process.on('SIGTERM', async () => {
            logger_1.logger.info('🛑 Received SIGTERM, stopping monitor...');
            await monitor.stopMonitoring();
            process.exit(0);
        });
        // Keep the process alive
        process.stdin.resume();
    }
    catch (error) {
        logger_1.logger.error('❌ Monitor failed to start:', error);
        process.exit(1);
    }
}
// Test function for specific wallet
async function testSpecificWallet(walletAddress) {
    const monitor = new WalletMonitor_1.WalletMonitor();
    try {
        logger_1.logger.info(`🧪 Testing monitoring for specific wallet: ${walletAddress}`);
        // Connect to database
        await (0, database_1.connectDatabase)();
        // Test specific wallet
        await monitor.testWalletMonitoring(walletAddress);
        process.exit(0);
    }
    catch (error) {
        logger_1.logger.error('❌ Test failed:', error);
        process.exit(1);
    }
}
// Check command line arguments
const args = process.argv.slice(2);
if (args.length > 0 && args[0] === 'test' && args[1]) {
    // Test mode: node dist/monitor.js test WALLET_ADDRESS
    testSpecificWallet(args[1]);
}
else {
    // Normal monitoring mode
    startWalletMonitoring();
}

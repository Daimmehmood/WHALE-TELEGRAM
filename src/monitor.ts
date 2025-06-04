// src/monitor.ts
import dotenv from 'dotenv';
import { connectDatabase } from './config/database';
import { WhaleConsensusMonitor as WalletMonitor } from './services/WhaleConsensusMonitor';
import { logger } from './utils/logger';

dotenv.config();

async function startWalletMonitoring(): Promise<void> {
  const monitor = new WalletMonitor();
  
  try {
    logger.info('🚀 Initializing Whale Wallet Monitor...');
    
    // Connect to database
    await connectDatabase();
    
    // Start monitoring
    await monitor.startMonitoring();
    
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      logger.info('🛑 Received SIGINT, stopping monitor...');
      await monitor.stopMonitoring();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      logger.info('🛑 Received SIGTERM, stopping monitor...');
      await monitor.stopMonitoring();
      process.exit(0);
    });
    
    // Keep the process alive
    process.stdin.resume();
    
  } catch (error) {
    logger.error('❌ Monitor failed to start:', error);
    process.exit(1);
  }
}

// Test function for specific wallet
async function testSpecificWallet(walletAddress: string): Promise<void> {
  const monitor = new WalletMonitor();
  
  try {
    logger.info(`🧪 Testing monitoring for specific wallet: ${walletAddress}`);
    
    // Connect to database
    await connectDatabase();
    
    // Test specific wallet
    await monitor.testWalletMonitoring(walletAddress);
    
    process.exit(0);
    
  } catch (error) {
    logger.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Check command line arguments
const args = process.argv.slice(2);

if (args.length > 0 && args[0] === 'test' && args[1]) {
  // Test mode: node dist/monitor.js test WALLET_ADDRESS
  testSpecificWallet(args[1]);
} else {
  // Normal monitoring mode
  startWalletMonitoring();
}
// src/testMonitor.ts
import dotenv from 'dotenv';
import { connectDatabase } from './config/database';
import { WalletService } from './services/WalletService';
import { logger } from './utils/logger';

dotenv.config();

interface MockTokenPurchase {
  walletAddress: string;
  tokenMint: string;
  tokenSymbol: string;
  amountSol: number;
  amountUsd: number;
  signature: string;
  timestamp: Date;
}

class TestMonitor {
  private walletService: WalletService;
  private testWallets: string[] = [];

  constructor() {
    this.walletService = new WalletService();
  }

  async initialize(): Promise<void> {
    await connectDatabase();
    
    // Load some qualified wallets for testing
    const qualifiedWallets = await this.walletService.getQualifiedWallets();
    this.testWallets = qualifiedWallets.slice(0, 5).map(w => w.address);
    
    if (this.testWallets.length === 0) {
      logger.warn('❌ No qualified wallets found. Please run scraper first.');
      return;
    }
    
    logger.info(`🧪 Test monitor initialized with ${this.testWallets.length} wallets`);
  }

  createMockPurchase(): MockTokenPurchase {
    const randomWallet = this.testWallets[Math.floor(Math.random() * this.testWallets.length)];
    const mockTokens = [
      { mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', symbol: 'USDC' },
      { mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', symbol: 'USDT' },
      { mint: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R', symbol: 'RAY' },
      { mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', symbol: 'BONK' },
      { mint: 'rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof', symbol: 'RENDER' }
    ];
    
    const randomToken = mockTokens[Math.floor(Math.random() * mockTokens.length)];
    const solAmount = Math.random() * 10 + 0.5; // 0.5 to 10.5 SOL
    const usdAmount = solAmount * 200; // Assuming 200 USD per SOL
    
    return {
      walletAddress: randomWallet,
      tokenMint: randomToken.mint,
      tokenSymbol: randomToken.symbol,
      amountSol: solAmount,
      amountUsd: usdAmount,
      signature: this.generateRandomSignature(),
      timestamp: new Date()
    };
  }

  private generateRandomSignature(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 88; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  displayPurchaseAlert(purchase: MockTokenPurchase): void {
    console.log('\n' + '🚨'.repeat(20));
    console.log('🚨 TEST WHALE TOKEN PURCHASE DETECTED! 🚨');
    console.log('🚨'.repeat(20));
    console.log(`🐋 Whale Wallet: ${purchase.walletAddress}`);
    console.log(`🪙 Token: ${purchase.tokenSymbol} (${purchase.tokenMint})`);
    console.log(`💰 Purchase Amount: ${purchase.amountSol.toFixed(4)} SOL (~$${purchase.amountUsd.toFixed(2)})`);
    console.log(`🕐 Time: ${purchase.timestamp.toLocaleString()}`);
    console.log(`🔗 Transaction: https://solscan.io/tx/${purchase.signature}`);
    console.log(`🌐 Token Info: https://solscan.io/token/${purchase.tokenMint}`);
    console.log(`📈 Pump.fun: https://pump.fun/${purchase.tokenMint}`);
    console.log(`🧪 [TEST MODE] This is simulated data for testing`);
    console.log('🚨'.repeat(20) + '\n');

    // Log to file as well
    logger.info('🚨 TEST WHALE PURCHASE DETECTED', {
      wallet: purchase.walletAddress,
      token: purchase.tokenSymbol,
      tokenMint: purchase.tokenMint,
      amountSol: purchase.amountSol,
      amountUsd: purchase.amountUsd,
      signature: purchase.signature,
      timestamp: purchase.timestamp,
      testMode: true
    });
  }

  async startTestMonitoring(): Promise<void> {
    console.log('\n' + '='.repeat(80));
    console.log('🧪 TEST MODE: WHALE WALLET MONITORING');
    console.log('='.repeat(80));
    console.log(`🐋 Test Wallets: ${this.testWallets.length}`);
    console.log(`💰 Min Purchase Alert: $50 (Testing)`);
    console.log(`⏱️ Test Interval: 10 seconds`);
    console.log(`🧪 Generating mock purchase data...`);
    console.log('='.repeat(80));
    console.log('🔍 Watching for test purchases...\n');

    // Generate test purchases every 10-30 seconds
    const generateTestPurchase = () => {
      if (Math.random() > 0.7) { // 30% chance each interval
        const purchase = this.createMockPurchase();
        this.displayPurchaseAlert(purchase);
      } else {
        logger.info('😴 No test purchases this round...');
      }
    };

    // Start generating test data
    setInterval(generateTestPurchase, 10000); // Every 10 seconds
    
    // Generate first purchase immediately
    setTimeout(generateTestPurchase, 2000);
    
    // Keep the process alive
    process.stdin.resume();
  }

  async runSingleTest(): Promise<void> {
    console.log('\n🧪 Running single test purchase...\n');
    
    const purchase = this.createMockPurchase();
    this.displayPurchaseAlert(purchase);
    
    console.log('✅ Single test completed!\n');
  }
}

async function runTestMonitor(): Promise<void> {
  const testMonitor = new TestMonitor();
  
  try {
    logger.info('🧪 Initializing Test Whale Monitor...');
    await testMonitor.initialize();
    
    // Check command line arguments
    const args = process.argv.slice(2);
    
    if (args.includes('--single')) {
      await testMonitor.runSingleTest();
      process.exit(0);
    } else {
      await testMonitor.startTestMonitoring();
    }
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
      logger.info('🛑 Test monitor stopped');
      process.exit(0);
    });
    
  } catch (error) {
    logger.error('❌ Test monitor failed:', error);
    process.exit(1);
  }
}

runTestMonitor();
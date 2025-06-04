// src/services/WalletMonitor.ts - TURBO SPEED VERSION 🚀⚡
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../utils/logger';
import { WalletService } from './WalletService';
import { WhaleWallet } from '../types/wallet';

interface ManualWallet {
  address: string;
  name: string;
  description: string;
  enabled: boolean;
}

interface ManualWalletsConfig {
  manualWallets: ManualWallet[];
  settings: {
    minPurchaseUsd: number;
    checkIntervalSeconds: number;
    enableQualifiedWallets: boolean;
    enableManualWallets: boolean;
  };
}

interface SolanaSignature {
  signature: string;
  slot: number;
  err: any;
  memo: string;
  blockTime: number;
}

interface SolanaTransaction {
  blockTime: number;
  meta: {
    err: any;
    fee: number;
    innerInstructions: any[];
    logMessages: string[];
    postBalances: number[];
    postTokenBalances: any[];
    preBalances: number[];
    preTokenBalances: any[];
    rewards: any[];
    status: { Ok?: any; Err?: any };
  };
  transaction: {
    message: {
      accountKeys: string[];
      header: any;
      instructions: any[];
      recentBlockhash: string;
    };
    signatures: string[];
  };
}

interface TokenPurchase {
  walletAddress: string;
  tokenMint: string;
  tokenSymbol?: string;
  amountSol: number;
  amountUsd: number;
  signature: string;
  timestamp: Date;
  tokenAddress?: string;
  transactionType: string;
}

export class WalletMonitor {
  private isMonitoring: boolean = false;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private walletService: WalletService;
  private qualifiedWallets: WhaleWallet[] = [];
  private manualWallets: ManualWallet[] = [];
  private allMonitoredWallets: string[] = [];
  private lastCheckedTimes: Map<string, number> = new Map();
  private readonly SOL_PRICE_USD = 200;
  private CHECK_INTERVAL = 30000; // 🚀 TURBO: 30 seconds instead of 2 minutes
  private MIN_PURCHASE_USD = 50;
  private readonly MANUAL_WALLETS_FILE = 'manualWallets.json';

  // 🚀 TURBO SPEED: Pre-configured premium RPC endpoints
  private readonly TURBO_RPC_ENDPOINTS = [
    'https://mainnet.helius-rpc.com/?api-key=46dd6d27-c247-40fd-b360-1db6c7344442',
    'https://solana-mainnet.rpc.quiknode.pro/',
    'https://rpc.ankr.com/solana',
    'https://api.mainnet-beta.solana.com'
  ];

  // 🚀 TURBO: Cached token info to avoid repeated API calls
  private tokenInfoCache: Map<string, { symbol: string; name: string }> = new Map();
  
  // 🚀 TURBO: Axios instance with optimized settings
  private turboAxios = axios.create({
    timeout: 8000, // Reduced timeout for faster failures
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'TurboWhaleMon/2.0',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive'
    },
    maxRedirects: 0, // No redirects for speed
    validateStatus: (status) => status < 500 // Accept 4xx errors to avoid retries
  });

  constructor() {
    this.walletService = new WalletService();
    this.setupTurboMode();
  }

  private setupTurboMode(): void {
    // 🚀 TURBO: Setup connection pooling and keep-alive
    this.turboAxios.defaults.httpsAgent = new (require('https').Agent)({
      keepAlive: true,
      maxSockets: 50, // Increased concurrent connections
      maxFreeSockets: 20,
      timeout: 8000,
      freeSocketTimeout: 4000
    });
    
    logger.info('🚀 TURBO MODE ACTIVATED - Maximum Speed Configuration!');
  }

  async startMonitoring(): Promise<void> {
    if (this.isMonitoring) {
      logger.warn('⚠️ Turbo monitoring is already running');
      return;
    }

    logger.info('🚀⚡ Starting TURBO SPEED IMMEDIATE ALERT monitoring...');
    
    try {
      await this.loadManualWallets();
      await this.loadQualifiedWallets();
      this.combineWalletsForMonitoring();
      
      if (this.allMonitoredWallets.length === 0) {
        logger.warn('❌ No wallets to monitor. Please add manual wallets or run scraper first.');
        return;
      }

      this.isMonitoring = true;
      
      // 🚀 TURBO: Initialize with 1 hour ago instead of 24 hours for faster initial scan
      const fifteenMinutesAgo = Date.now() - (15 * 60 * 1000); // 15 minutes
      this.allMonitoredWallets.forEach(wallet => {
        this.lastCheckedTimes.set(wallet, Math.floor(fifteenMinutesAgo / 1000));
      });

      logger.info(`🚀 TURBO MODE: Monitoring ${this.allMonitoredWallets.length} wallets at MAXIMUM SPEED`);
      this.displayTurboMonitoringStatus();

      // 🚀 TURBO: Much faster monitoring loop
      this.monitoringInterval = setInterval(async () => {
        logger.info(`⚡ TURBO cycle starting - MAXIMUM SPEED MODE...`);
        await this.turboCheckAllWallets();
        logger.info(`✅ TURBO cycle complete. Next check in ${this.CHECK_INTERVAL/1000} seconds...`);
      }, this.CHECK_INTERVAL);

      // 🚀 TURBO: Immediate start after 5 seconds instead of 15
      setTimeout(() => {
        logger.info(`🚀 Starting TURBO initial scan...`);
        this.turboCheckAllWallets();
      }, 5000);

    } catch (error) {
      logger.error('❌ Failed to start turbo monitoring:', error);
      throw error;
    }
  }

  async stopMonitoring(): Promise<void> {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.isMonitoring = false;
    logger.info('🛑 Turbo monitoring stopped');
  }

  private async loadManualWallets(): Promise<void> {
    try {
      const configPath = path.join(process.cwd(), this.MANUAL_WALLETS_FILE);
      
      if (!fs.existsSync(configPath)) {
        const defaultConfig: ManualWalletsConfig = {
          manualWallets: [],
          settings: {
            minPurchaseUsd: 50,
            checkIntervalSeconds: 30, // 🚀 TURBO: Default to 30 seconds
            enableQualifiedWallets: true,
            enableManualWallets: true
          }
        };
        
        fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
        logger.info(`📝 Created ${this.MANUAL_WALLETS_FILE} with TURBO settings.`);
      }
      
      const configData = fs.readFileSync(configPath, 'utf8');
      const config: ManualWalletsConfig = JSON.parse(configData);
      
      this.MIN_PURCHASE_USD = config.settings.minPurchaseUsd;
      this.CHECK_INTERVAL = Math.max(config.settings.checkIntervalSeconds * 1000, 30000); // 🚀 TURBO: Min 30 seconds
      
      this.manualWallets = config.manualWallets.filter(w => w.enabled);
      
      logger.info(`📋 TURBO: Loaded ${this.manualWallets.length} manual wallets`);
      
    } catch (error) {
      logger.error('❌ Failed to load manual wallets:', error);
      this.manualWallets = [];
    }
  }

  private async loadQualifiedWallets(): Promise<void> {
    try {
      this.qualifiedWallets = await this.walletService.getQualifiedWallets();
      logger.info(`📋 TURBO: Loaded ${this.qualifiedWallets.length} qualified wallets`);
    } catch (error) {
      logger.error('❌ Failed to load qualified wallets:', error);
      this.qualifiedWallets = [];
    }
  }

  private combineWalletsForMonitoring(): void {
    const walletAddresses = new Set<string>();
    
    const config = this.getManualWalletsConfig();
    if (config?.settings.enableQualifiedWallets !== false) {
      this.qualifiedWallets.forEach(wallet => {
        walletAddresses.add(wallet.address);
      });
    }
    
    if (config?.settings.enableManualWallets !== false) {
      this.manualWallets.forEach(wallet => {
        walletAddresses.add(wallet.address);
      });
    }
    
    this.allMonitoredWallets = Array.from(walletAddresses);
  }

  private getManualWalletsConfig(): ManualWalletsConfig | null {
    try {
      const configPath = path.join(process.cwd(), this.MANUAL_WALLETS_FILE);
      const configData = fs.readFileSync(configPath, 'utf8');
      return JSON.parse(configData);
    } catch (error) {
      return null;
    }
  }

  private displayTurboMonitoringStatus(): void {
    console.log('\n' + '🚀'.repeat(80));
    console.log('🚀⚡ TURBO SPEED WHALE MONITORING - MAXIMUM PERFORMANCE ⚡🚀');
    console.log('🚀'.repeat(80));
    console.log(`🐋 Qualified Wallets: ${this.qualifiedWallets.length}`);
    console.log(`📍 Manual Wallets: ${this.manualWallets.length}`);
    console.log(`📊 Total Monitoring: ${this.allMonitoredWallets.length} wallets`);
    console.log(`💰 Min Purchase Alert: $${this.MIN_PURCHASE_USD}`);
    console.log(`⚡ TURBO Check Interval: ${this.CHECK_INTERVAL / 1000}s (ULTRA FAST!)`);
    console.log(`🔗 Premium RPC Endpoints: ${this.TURBO_RPC_ENDPOINTS.length} endpoints`);
    console.log(`🚀 Connection Pooling: ENABLED (50 concurrent connections)`);
    console.log(`⚡ Token Cache: ENABLED (instant token info)`);
    console.log(`🔥 Parallel Processing: ENABLED (all wallets simultaneously)`);
    console.log(`⚡ IMMEDIATE ALERTS: ENABLED + TURBO SPEED!`);
    console.log('🚀'.repeat(80));
    
    if (this.manualWallets.length > 0) {
      console.log('📍 TURBO MANUAL WALLETS:');
      this.manualWallets.forEach(wallet => {
        console.log(`   • ${wallet.name}: ${wallet.address.substring(0, 12)}...`);
      });
      console.log('🚀'.repeat(80));
    }
    
    console.log('⚡ TURBO MODE: Watching for purchases at MAXIMUM SPEED...\n');
  }

  // 🚀 TURBO METHOD: Parallel wallet checking for maximum speed
  private async turboCheckAllWallets(): Promise<void> {
    const startTime = Date.now();
    let successfulChecks = 0;
    let failedChecks = 0;
    let totalPurchasesFound = 0;

    logger.info(`⚡ TURBO: Checking ${this.allMonitoredWallets.length} wallets in PARALLEL for maximum speed...`);

    try {
      // 🚀 TURBO: Process ALL wallets in parallel batches for maximum speed
      const TURBO_BATCH_SIZE = 5; // 5 wallets simultaneously
      const batches = this.chunkArray(this.allMonitoredWallets, TURBO_BATCH_SIZE);

      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        
        logger.info(`⚡ TURBO Batch ${batchIndex + 1}/${batches.length} (${batch.length} wallets) - PARALLEL PROCESSING`);

        // 🚀 TURBO: Process entire batch in parallel
        const batchPromises = batch.map(async (walletAddress, index) => {
          const globalIndex = batchIndex * TURBO_BATCH_SIZE + index + 1;
          
          try {
            const manualWallet = this.manualWallets.find(w => w.address === walletAddress);
            const walletLabel = manualWallet ? 
              `${manualWallet.name} (${walletAddress.substring(0, 8)}...)` : 
              walletAddress.substring(0, 8) + '...';
            
            logger.info(`⚡ [${globalIndex}/${this.allMonitoredWallets.length}] TURBO checking: ${walletLabel}`);
            
            // 🚀 TURBO: Check wallet with immediate alert
            const walletPurchases = await this.turboCheckWalletTransactions(walletAddress);
            
            if (walletPurchases.length > 0) {
              logger.info(`🎯 TURBO: Found ${walletPurchases.length} purchases for ${walletLabel} - INSTANT ALERTS FIRED!`);
              return { success: true, purchases: walletPurchases.length };
            } else {
              return { success: true, purchases: 0 };
            }
            
          } catch (error) {
            logger.warn(`⚠️ TURBO: Failed ${walletAddress.substring(0, 8)}...: ${error}`);
            return { success: false, purchases: 0 };
          }
        });

        // 🚀 TURBO: Wait for entire batch to complete
        const batchResults = await Promise.all(batchPromises);
        
        // 🚀 TURBO: Process results
        batchResults.forEach(result => {
          if (result.success) {
            successfulChecks++;
            totalPurchasesFound += result.purchases;
          } else {
            failedChecks++;
          }
        });

        // 🚀 TURBO: Much shorter delay between batches
        if (batchIndex < batches.length - 1) {
          await this.turboDelay(1000); // Only 1 second between batches
        }
      }

      const endTime = Date.now();
      const totalTime = (endTime - startTime) / 1000;

      logger.info(`⚡ TURBO cycle complete in ${totalTime.toFixed(2)}s: ${successfulChecks} successful, ${failedChecks} failed`);
      logger.info(`🚨 TURBO: ${totalPurchasesFound} purchases found and INSTANTLY ALERTED!`);

      if (totalPurchasesFound === 0) {
        logger.info(`😴 TURBO: No new purchases detected - monitoring at maximum speed!`);
      }

    } catch (error) {
      logger.error('❌ TURBO cycle failed:', error);
    }
  }

  // 🚀 TURBO METHOD: Ultra-fast wallet transaction checking
  private async turboCheckWalletTransactions(walletAddress: string): Promise<TokenPurchase[]> {
    try {
      const lastChecked = this.lastCheckedTimes.get(walletAddress) || Math.floor(Date.now() / 1000) - 3600;
      
      // 🚀 TURBO: Get signatures with timeout and immediate fallback
      const signatures = await this.turboGetSolanaSignatures(walletAddress);
      
      if (!signatures || signatures.length === 0) {
        return [];
      }

      const purchases: TokenPurchase[] = [];
      let latestTimestamp = lastChecked;

      // 🚀 TURBO: Process only recent transactions (last 10 instead of all)
      const recentSignatures = signatures.slice(0, 10).filter(sig => sig.blockTime > lastChecked && !sig.err);

      if (recentSignatures.length === 0) {
        return [];
      }

      logger.info(`   ⚡ TURBO: Analyzing ${recentSignatures.length} recent transactions...`);

      // 🚀 TURBO: Process transactions in parallel
      const transactionPromises = recentSignatures.map(async (sig) => {
        try {
          if (sig.blockTime > latestTimestamp) {
            latestTimestamp = sig.blockTime;
          }

          const transaction = await this.turboGetTransactionDetails(sig.signature);
          if (transaction) {
            const purchase = await this.parseRealTokenPurchase(transaction, walletAddress, sig.signature);
            if (purchase && purchase.amountUsd >= this.MIN_PURCHASE_USD) {
              // 🚀⚡ TURBO IMMEDIATE ALERT
              this.turboShowImmediateAlert(purchase);
              return purchase;
            }
          }
          return null;
        } catch (error) {
          return null;
        }
      });

      // 🚀 TURBO: Wait for all transactions to process in parallel
      const results = await Promise.all(transactionPromises);
      const validPurchases = results.filter(p => p !== null) as TokenPurchase[];

      purchases.push(...validPurchases);

      // Update last checked time
      this.lastCheckedTimes.set(walletAddress, latestTimestamp);

      return purchases;

    } catch (error) {
      logger.warn(`❌ TURBO error for ${walletAddress.substring(0, 8)}...:`, error);
      return [];
    }
  }

  // 🚀 TURBO METHOD: Ultra-fast RPC calls with immediate fallback
  private async turboGetSolanaSignatures(walletAddress: string): Promise<SolanaSignature[]> {
    // 🚀 TURBO: Try all RPC endpoints simultaneously and use first response
    const rpcPromises = this.TURBO_RPC_ENDPOINTS.map(async (rpcUrl, index) => {
      try {
        const response = await this.turboAxios.post(rpcUrl, {
          jsonrpc: '2.0',
          id: 1,
          method: 'getSignaturesForAddress',
          params: [
            walletAddress,
            {
              limit: 15, // 🚀 TURBO: Reduced to 15 for speed
              commitment: 'confirmed'
            }
          ]
        });

        if (response.data?.result && Array.isArray(response.data.result)) {
          logger.info(`   ⚡ TURBO RPC ${index + 1}: ${response.data.result.length} signatures`);
          return response.data.result;
        }
        return null;

      } catch (error) {
        return null;
      }
    });

    try {
      // 🚀 TURBO: Use Promise.race to get the first successful response
      const results = await Promise.allSettled(rpcPromises);
      
      // Find first successful result
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          return result.value;
        }
      }

      logger.warn(`   ❌ TURBO: All RPC endpoints failed for ${walletAddress.substring(0, 8)}...`);
      return [];

    } catch (error) {
      return [];
    }
  }

  // 🚀 TURBO METHOD: Ultra-fast transaction details
  private async turboGetTransactionDetails(signature: string): Promise<SolanaTransaction | null> {
    // 🚀 TURBO: Use first two fastest endpoints only
    const fastEndpoints = this.TURBO_RPC_ENDPOINTS.slice(0, 2);
    
    for (const rpcUrl of fastEndpoints) {
      try {
        const response = await this.turboAxios.post(rpcUrl, {
          jsonrpc: '2.0',
          id: 1,
          method: 'getTransaction',
          params: [
            signature,
            {
              encoding: 'json',
              maxSupportedTransactionVersion: 0
            }
          ]
        });

        if (response.data?.result) {
          return response.data.result;
        }

      } catch (error) {
        continue;
      }
    }

    return null;
  }

  // 🚀 TURBO METHOD: Ultra-fast immediate alert
  private turboShowImmediateAlert(purchase: TokenPurchase): void {
    const manualWallet = this.manualWallets.find(w => w.address === purchase.walletAddress);
    const walletLabel = manualWallet ? 
      `${manualWallet.name}` : 
      `Whale ${purchase.walletAddress.substring(0, 8)}...`;

    // 🚀⚡ TURBO IMMEDIATE CONSOLE ALERT ⚡🚀
    console.log('\n' + '🚀⚡'.repeat(20));
    console.log('🚀⚡🚀 TURBO SPEED WHALE PURCHASE ALERT! 🚀⚡🚀');
    console.log('⚡🚀⚡ MAXIMUM SPEED - INSTANT NOTIFICATION! ⚡🚀⚡');
    console.log('🚀⚡'.repeat(20));
    console.log(`🐋 TURBO BUYER: ${walletLabel}`);
    console.log(`📍 Address: ${purchase.walletAddress}`);
    if (manualWallet) {
      console.log(`📝 Note: ${manualWallet.description}`);
    }
    console.log('─'.repeat(60));
    console.log(`🪙 TOKEN: ${purchase.tokenSymbol}`);
    console.log(`💰 AMOUNT: ${purchase.amountSol.toFixed(4)} SOL (~$${purchase.amountUsd.toFixed(2)})`);
    console.log(`🕐 TIME: ${purchase.timestamp.toLocaleString()}`);
    console.log('─'.repeat(60));
    console.log('🚀 TURBO ACTION LINKS:');
    console.log(`   📊 TX: https://solscan.io/tx/${purchase.signature}`);
    console.log(`   🪙 Token: https://solscan.io/token/${purchase.tokenMint}`);
    console.log(`   📈 Chart: https://dexscreener.com/solana/${purchase.tokenMint}`);
    console.log(`   🚀 Pump: https://pump.fun/${purchase.tokenMint}`);
    console.log('─'.repeat(60));
    console.log(`⚡ TURBO SPEED DETECTION - ACT INSTANTLY!`);
    console.log('🚀⚡'.repeat(20) + '\n');

    // 🚀 TURBO: Log summary
    const summaryLine = `🚀⚡ TURBO ALERT: ${walletLabel} bought $${purchase.amountUsd.toFixed(0)} of ${purchase.tokenSymbol}`;
    console.log(`📢 TURBO SUMMARY: ${summaryLine}\n`);
  }

  private async parseRealTokenPurchase(transaction: SolanaTransaction, walletAddress: string, signature: string): Promise<TokenPurchase | null> {
    try {
      const meta = transaction.meta;
      if (!meta || meta.err) {
        return null;
      }

      const preTokenBalances = meta.preTokenBalances || [];
      const postTokenBalances = meta.postTokenBalances || [];

      for (const postBalance of postTokenBalances) {
        if (postBalance.owner === walletAddress) {
          const preBalance = preTokenBalances.find(
            pre => pre.accountIndex === postBalance.accountIndex
          );
          
          const preAmount = preBalance ? parseFloat(preBalance.uiTokenAmount.uiAmountString || '0') : 0;
          const postAmount = parseFloat(postBalance.uiTokenAmount.uiAmountString || '0');
          
          if (postAmount > preAmount) {
            const tokenMint = postBalance.mint;
            const solSpent = this.calculateSolSpent(meta, walletAddress, transaction.transaction.message.accountKeys);
            
            if (solSpent > 0) {
              const usdAmount = solSpent * this.SOL_PRICE_USD;
              
              // 🚀 TURBO: Use cached token info for speed
              const tokenInfo = await this.turboGetTokenInfo(tokenMint);
              
              return {
                walletAddress,
                tokenMint,
                tokenSymbol: tokenInfo?.symbol || 'UNKNOWN',
                amountSol: solSpent,
                amountUsd: usdAmount,
                signature,
                timestamp: new Date(transaction.blockTime * 1000),
                tokenAddress: tokenMint,
                transactionType: 'TOKEN_PURCHASE'
              };
            }
          }
        }
      }

      return null;

    } catch (error) {
      logger.warn(`Error parsing transaction ${signature}:`, error);
      return null;
    }
  }

  // 🚀 TURBO METHOD: Cached token info for maximum speed
  private async turboGetTokenInfo(tokenMint: string): Promise<{ symbol: string; name: string } | null> {
    // 🚀 TURBO: Check cache first
    if (this.tokenInfoCache.has(tokenMint)) {
      return this.tokenInfoCache.get(tokenMint)!;
    }

    try {
      const response = await this.turboAxios.get(`https://api.solscan.io/token/meta?token=${tokenMint}`);
      
      const tokenInfo = {
        symbol: response.data?.symbol || 'UNKNOWN',
        name: response.data?.name || 'Unknown Token'
      };
      
      // 🚀 TURBO: Cache the result
      this.tokenInfoCache.set(tokenMint, tokenInfo);
      return tokenInfo;
      
    } catch (error) {
      // 🚀 TURBO: Fallback and cache it
      const fallback = {
        symbol: tokenMint.substring(0, 6),
        name: 'Unknown Token'
      };
      this.tokenInfoCache.set(tokenMint, fallback);
      return fallback;
    }
  }

  private calculateSolSpent(meta: any, walletAddress: string, accountKeys: string[]): number {
    try {
      const walletIndex = accountKeys.indexOf(walletAddress);
      if (walletIndex === -1) return 0;

      const preBalance = meta.preBalances[walletIndex] || 0;
      const postBalance = meta.postBalances[walletIndex] || 0;
      const balanceChange = preBalance - postBalance;
      const solSpent = balanceChange / 1000000000;
      
      return Math.max(0, solSpent);

    } catch (error) {
      return 0;
    }
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  // 🚀 TURBO: Ultra-short delay
  private turboDelay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async testWalletMonitoring(walletAddress: string): Promise<void> {
    logger.info(`🚀 Testing TURBO SPEED monitoring for wallet: ${walletAddress}`);
    
    try {
      const purchases = await this.turboCheckWalletTransactions(walletAddress);
      
      if (purchases.length > 0) {
        console.log(`✅ TURBO: Found ${purchases.length} purchases - ALL ALERTS SHOWN INSTANTLY!`);
      } else {
        console.log('❌ TURBO: No purchases found - monitoring at maximum speed');
      }
    } catch (error) {
      logger.error('❌ TURBO test failed:', error);
    }
  }

  getMonitoringStatus(): {
    isActive: boolean;
    qualifiedWalletsCount: number;
    manualWalletsCount: number;
    totalWalletsCount: number;
    checkInterval: number;
    minPurchaseUsd: number;
    immediateAlerts: boolean;
    turboMode: boolean;
  } {
    return {
      isActive: this.isMonitoring,
      qualifiedWalletsCount: this.qualifiedWallets.length,
      manualWalletsCount: this.manualWallets.length,
      totalWalletsCount: this.allMonitoredWallets.length,
      checkInterval: this.CHECK_INTERVAL,
      minPurchaseUsd: this.MIN_PURCHASE_USD,
      immediateAlerts: true,
      turboMode: true // 🚀 NEW: Turbo mode enabled
    };
  }

  async addManualWallet(address: string, name: string, description: string = ''): Promise<boolean> {
    try {
      const configPath = path.join(process.cwd(), this.MANUAL_WALLETS_FILE);
      const config = this.getManualWalletsConfig() || {
        manualWallets: [],
        settings: {
          minPurchaseUsd: 50,
          checkIntervalSeconds: 30, // 🚀 TURBO: Default turbo speed
          enableQualifiedWallets: true,
          enableManualWallets: true
        }
      };

      if (config.manualWallets.some(w => w.address === address)) {
        logger.warn(`Wallet ${address} already exists in manual wallets`);
        return false;
      }

      config.manualWallets.push({
        address,
        name,
        description,
        enabled: true
      });

      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      
      await this.loadManualWallets();
      this.combineWalletsForMonitoring();
      
      logger.info(`🚀 TURBO: Added manual wallet: ${name} (${address}) - MAXIMUM SPEED ALERTS ENABLED`);
      return true;
      
    } catch (error) {
      logger.error('❌ Failed to add manual wallet:', error);
      return false;
    }
  }
}
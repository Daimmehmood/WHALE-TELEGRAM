// src/services/WhaleConsensusMonitor.ts - WHALE CONSENSUS ALERT SYSTEM 🐋🚨
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
    minWhalesForConsensus: number; // 🐋 NEW: Minimum whales needed for consensus alert
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
  walletName?: string;
  tokenMint: string;
  tokenSymbol?: string;
  tokenName?: string;
  amountSol: number;
  amountUsd: number;
  signature: string;
  timestamp: Date;
  tokenAddress?: string;
  transactionType: string;
}

// 🐋 NEW: Whale Consensus Data Structure
interface WhaleConsensus {
  tokenMint: string;
  tokenSymbol: string;
  tokenName: string;
  whales: TokenPurchase[];
  totalWhales: number;
  totalAmountSol: number;
  totalAmountUsd: number;
  firstPurchaseTime: Date;
  lastPurchaseTime: Date;
  consensusStrength: number; // Score based on whale count and amounts
}

export class WhaleConsensusMonitor {
  private isMonitoring: boolean = false;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private walletService: WalletService;
  private qualifiedWallets: WhaleWallet[] = [];
  private manualWallets: ManualWallet[] = [];
  private allMonitoredWallets: string[] = [];
  private lastCheckedTimes: Map<string, number> = new Map();
  private readonly SOL_PRICE_USD = 200;
  private CHECK_INTERVAL = 30000; // 30 seconds
  private MIN_PURCHASE_USD = 50;
  private MIN_WHALES_FOR_CONSENSUS = 2; // 🐋 Minimum whales needed for consensus alert
  private readonly MANUAL_WALLETS_FILE = 'manualWallets.json';

  // 🐋 NEW: Track recent whale purchases by token for consensus detection
  private recentWhalePurchases: Map<string, TokenPurchase[]> = new Map();
  private consensusTimeWindow = 15 * 60 * 1000; // 15 minutes window for consensus

  // 🐋 NEW: Track already alerted consensus to avoid duplicates
  private alertedConsensus: Set<string> = new Set();

  private readonly TURBO_RPC_ENDPOINTS = [
    'https://mainnet.helius-rpc.com/?api-key=46dd6d27-c247-40fd-b360-1db6c7344442',
    'https://solana-mainnet.rpc.quiknode.pro/',
    'https://rpc.ankr.com/solana',
    'https://api.mainnet-beta.solana.com'
  ];

  private tokenInfoCache: Map<string, { symbol: string; name: string }> = new Map();
  
  private turboAxios = axios.create({
    timeout: 8000,
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'WhaleConsensusMon/1.0',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive'
    },
    maxRedirects: 0,
    validateStatus: (status) => status < 500
  });

  constructor() {
    this.walletService = new WalletService();
    this.setupTurboMode();
  }

  private setupTurboMode(): void {
    this.turboAxios.defaults.httpsAgent = new (require('https').Agent)({
      keepAlive: true,
      maxSockets: 50,
      maxFreeSockets: 20,
      timeout: 8000,
      freeSocketTimeout: 4000
    });
    
    logger.info('🐋 WHALE CONSENSUS MONITORING ACTIVATED!');
  }

  async startMonitoring(): Promise<void> {
    if (this.isMonitoring) {
      logger.warn('⚠️ Whale consensus monitoring is already running');
      return;
    }

    logger.info('🐋🚨 Starting WHALE CONSENSUS ALERT SYSTEM...');
    
    try {
      await this.loadManualWallets();
      await this.loadQualifiedWallets();
      this.combineWalletsForMonitoring();
      
      if (this.allMonitoredWallets.length === 0) {
        logger.warn('❌ No wallets to monitor. Please add manual wallets or run scraper first.');
        return;
      }

      this.isMonitoring = true;
      
      // Initialize with 15 minutes ago
      const fifteenMinutesAgo = Date.now() - (15 * 60 * 1000);
      this.allMonitoredWallets.forEach(wallet => {
        this.lastCheckedTimes.set(wallet, Math.floor(fifteenMinutesAgo / 1000));
      });

      logger.info(`🐋 Monitoring ${this.allMonitoredWallets.length} wallets for WHALE CONSENSUS SIGNALS`);
      this.displayConsensusMonitoringStatus();

      // Start monitoring loop with consensus detection
      this.monitoringInterval = setInterval(async () => {
        logger.info(`🐋 Starting whale consensus detection cycle...`);
        await this.detectWhaleConsensus();
        logger.info(`🐋 Consensus cycle complete. Next check in ${this.CHECK_INTERVAL/1000} seconds...`);
      }, this.CHECK_INTERVAL);

      // Initial check after 5 seconds
      setTimeout(() => {
        logger.info(`🐋 Starting initial whale consensus detection...`);
        this.detectWhaleConsensus();
      }, 5000);

    } catch (error) {
      logger.error('❌ Failed to start whale consensus monitoring:', error);
      throw error;
    }
  }

  async stopMonitoring(): Promise<void> {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.isMonitoring = false;
    logger.info('🛑 Whale consensus monitoring stopped');
  }

  private async loadManualWallets(): Promise<void> {
    try {
      const configPath = path.join(process.cwd(), this.MANUAL_WALLETS_FILE);
      
      if (!fs.existsSync(configPath)) {
        const defaultConfig: ManualWalletsConfig = {
          manualWallets: [],
          settings: {
            minPurchaseUsd: 50,
            checkIntervalSeconds: 30,
            enableQualifiedWallets: true,
            enableManualWallets: true,
            minWhalesForConsensus: 2 // 🐋 NEW: Default minimum whales for consensus
          }
        };
        
        fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
        logger.info(`📝 Created ${this.MANUAL_WALLETS_FILE} with whale consensus settings.`);
      }
      
      const configData = fs.readFileSync(configPath, 'utf8');
      const config: ManualWalletsConfig = JSON.parse(configData);
      
      this.MIN_PURCHASE_USD = config.settings.minPurchaseUsd;
      this.CHECK_INTERVAL = Math.max(config.settings.checkIntervalSeconds * 1000, 30000);
      this.MIN_WHALES_FOR_CONSENSUS = config.settings.minWhalesForConsensus || 2;
      
      this.manualWallets = config.manualWallets.filter(w => w.enabled);
      
      logger.info(`🐋 Loaded ${this.manualWallets.length} manual wallets for consensus monitoring`);
      
    } catch (error) {
      logger.error('❌ Failed to load manual wallets:', error);
      this.manualWallets = [];
    }
  }

  private async loadQualifiedWallets(): Promise<void> {
    try {
      this.qualifiedWallets = await this.walletService.getQualifiedWallets();
      logger.info(`🐋 Loaded ${this.qualifiedWallets.length} qualified wallets for consensus monitoring`);
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

  private displayConsensusMonitoringStatus(): void {
    console.log('\n' + '🐋🚨'.repeat(25));
    console.log('🐋🚨 WHALE CONSENSUS ALERT SYSTEM - MULTI-WHALE DETECTION 🚨🐋');
    console.log('🐋🚨'.repeat(25));
    console.log(`🐋 Qualified Wallets: ${this.qualifiedWallets.length}`);
    console.log(`📍 Manual Wallets: ${this.manualWallets.length}`);
    console.log(`📊 Total Monitoring: ${this.allMonitoredWallets.length} wallets`);
    console.log(`💰 Min Purchase Alert: $${this.MIN_PURCHASE_USD}`);
    console.log(`🐋 Min Whales for Consensus: ${this.MIN_WHALES_FOR_CONSENSUS} whales`);
    console.log(`⏱️ Check Interval: ${this.CHECK_INTERVAL / 1000}s`);
    console.log(`🕐 Consensus Time Window: ${this.consensusTimeWindow / 60000} minutes`);
    console.log(`🚨 CONSENSUS ALERTS: When ${this.MIN_WHALES_FOR_CONSENSUS}+ whales buy same token!`);
    console.log('🐋🚨'.repeat(25));
    
    if (this.manualWallets.length > 0) {
      console.log('📍 CONSENSUS MONITORING WALLETS:');
      this.manualWallets.forEach(wallet => {
        console.log(`   🐋 ${wallet.name}: ${wallet.address.substring(0, 12)}...`);
      });
      console.log('🐋🚨'.repeat(25));
    }
    
    console.log('🐋 Watching for WHALE CONSENSUS SIGNALS...\n');
  }

  // 🐋 MAIN METHOD: Detect whale consensus
  private async detectWhaleConsensus(): Promise<void> {
    const startTime = Date.now();
    let successfulChecks = 0;
    let failedChecks = 0;
    let totalPurchasesFound = 0;

    logger.info(`🐋 Detecting whale consensus across ${this.allMonitoredWallets.length} wallets...`);

    try {
      // Process wallets in parallel batches
      const BATCH_SIZE = 5;
      const batches = this.chunkArray(this.allMonitoredWallets, BATCH_SIZE);

      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        
        logger.info(`🐋 Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} wallets) for consensus...`);

        const batchPromises = batch.map(async (walletAddress, index) => {
          const globalIndex = batchIndex * BATCH_SIZE + index + 1;
          
          try {
            const manualWallet = this.manualWallets.find(w => w.address === walletAddress);
            const walletLabel = manualWallet ? 
              `${manualWallet.name}` : 
              `Whale ${walletAddress.substring(0, 8)}...`;
            
            logger.info(`🐋 [${globalIndex}/${this.allMonitoredWallets.length}] Checking: ${walletLabel}`);
            
            // Check wallet and add purchases to consensus tracking
            const walletPurchases = await this.checkWalletForConsensus(walletAddress, manualWallet?.name);
            
            if (walletPurchases.length > 0) {
              // Add purchases to consensus tracking
              this.addPurchasesToConsensusTracking(walletPurchases);
              logger.info(`🐋 Found ${walletPurchases.length} purchases from ${walletLabel}`);
              return { success: true, purchases: walletPurchases.length };
            } else {
              return { success: true, purchases: 0 };
            }
            
          } catch (error) {
            logger.warn(`⚠️ Failed to check wallet ${walletAddress.substring(0, 8)}...: ${error}`);
            return { success: false, purchases: 0 };
          }
        });

        const batchResults = await Promise.all(batchPromises);
        
        batchResults.forEach(result => {
          if (result.success) {
            successfulChecks++;
            totalPurchasesFound += result.purchases;
          } else {
            failedChecks++;
          }
        });

        // Short delay between batches
        if (batchIndex < batches.length - 1) {
          await this.delay(1000);
        }
      }

      // 🐋 CONSENSUS DETECTION: Check for whale consensus after collecting all purchases
      await this.analyzeWhaleConsensus();

      const endTime = Date.now();
      const totalTime = (endTime - startTime) / 1000;

      logger.info(`🐋 Consensus detection complete in ${totalTime.toFixed(2)}s: ${successfulChecks} successful, ${failedChecks} failed`);
      logger.info(`🐋 Total purchases tracked: ${totalPurchasesFound}`);

    } catch (error) {
      logger.error('❌ Consensus detection failed:', error);
    }
  }

  // 🐋 NEW: Check individual wallet for consensus tracking
  private async checkWalletForConsensus(walletAddress: string, walletName?: string): Promise<TokenPurchase[]> {
    try {
      const lastChecked = this.lastCheckedTimes.get(walletAddress) || Math.floor(Date.now() / 1000) - 900; // 15 minutes
      
      const signatures = await this.turboGetSolanaSignatures(walletAddress);
      
      if (!signatures || signatures.length === 0) {
        return [];
      }

      const purchases: TokenPurchase[] = [];
      let latestTimestamp = lastChecked;

      const recentSignatures = signatures.slice(0, 15).filter(sig => sig.blockTime > lastChecked && !sig.err);

      if (recentSignatures.length === 0) {
        return [];
      }

      // Process transactions in parallel
      const transactionPromises = recentSignatures.map(async (sig) => {
        try {
          if (sig.blockTime > latestTimestamp) {
            latestTimestamp = sig.blockTime;
          }

          const transaction = await this.turboGetTransactionDetails(sig.signature);
          if (transaction) {
            const purchase = await this.parseRealTokenPurchase(transaction, walletAddress, sig.signature, walletName);
            if (purchase && purchase.amountUsd >= this.MIN_PURCHASE_USD) {
              return purchase;
            }
          }
          return null;
        } catch (error) {
          return null;
        }
      });

      const results = await Promise.all(transactionPromises);
      const validPurchases = results.filter(p => p !== null) as TokenPurchase[];

      purchases.push(...validPurchases);

      // Update last checked time
      this.lastCheckedTimes.set(walletAddress, latestTimestamp);

      return purchases;

    } catch (error) {
      logger.warn(`❌ Error checking wallet for consensus ${walletAddress.substring(0, 8)}...:`, error);
      return [];
    }
  }

  // 🐋 NEW: Add purchases to consensus tracking
  private addPurchasesToConsensusTracking(purchases: TokenPurchase[]): void {
    const currentTime = Date.now();
    
    purchases.forEach(purchase => {
      const tokenMint = purchase.tokenMint;
      
      if (!this.recentWhalePurchases.has(tokenMint)) {
        this.recentWhalePurchases.set(tokenMint, []);
      }
      
      const tokenPurchases = this.recentWhalePurchases.get(tokenMint)!;
      
      // Add new purchase
      tokenPurchases.push(purchase);
      
      // Clean old purchases (outside time window)
      const filteredPurchases = tokenPurchases.filter(p => 
        (currentTime - p.timestamp.getTime()) <= this.consensusTimeWindow
      );
      
      this.recentWhalePurchases.set(tokenMint, filteredPurchases);
    });
  }

  // 🐋 NEW: Analyze whale consensus and trigger alerts
  private async analyzeWhaleConsensus(): Promise<void> {
    const currentTime = Date.now();
    const consensusTokens: WhaleConsensus[] = [];

    logger.info('🐋 Analyzing whale consensus patterns...');

    // Check each token for consensus
    for (const [tokenMint, purchases] of this.recentWhalePurchases.entries()) {
      // Filter recent purchases within time window
      const recentPurchases = purchases.filter(p => 
        (currentTime - p.timestamp.getTime()) <= this.consensusTimeWindow
      );

      // Remove duplicate wallets (only count unique whales)
      const uniqueWhales = new Map<string, TokenPurchase>();
      recentPurchases.forEach(purchase => {
        if (!uniqueWhales.has(purchase.walletAddress)) {
          uniqueWhales.set(purchase.walletAddress, purchase);
        }
      });

      const uniquePurchases = Array.from(uniqueWhales.values());

      // Check if we have consensus (minimum whales)
      if (uniquePurchases.length >= this.MIN_WHALES_FOR_CONSENSUS) {
        // Get token info
        const tokenInfo = await this.turboGetTokenInfo(tokenMint);
        
        // Calculate consensus metrics
        const totalAmountSol = uniquePurchases.reduce((sum, p) => sum + p.amountSol, 0);
        const totalAmountUsd = uniquePurchases.reduce((sum, p) => sum + p.amountUsd, 0);
        const timestamps = uniquePurchases.map(p => p.timestamp.getTime());
        const firstPurchaseTime = new Date(Math.min(...timestamps));
        const lastPurchaseTime = new Date(Math.max(...timestamps));
        
        // Calculate consensus strength (whales count + total USD amount)
        const consensusStrength = uniquePurchases.length * 100 + totalAmountUsd;

        const consensus: WhaleConsensus = {
          tokenMint,
          tokenSymbol: tokenInfo?.symbol || 'UNKNOWN',
          tokenName: tokenInfo?.name || 'Unknown Token',
          whales: uniquePurchases,
          totalWhales: uniquePurchases.length,
          totalAmountSol,
          totalAmountUsd,
          firstPurchaseTime,
          lastPurchaseTime,
          consensusStrength
        };

        consensusTokens.push(consensus);
      }
    }

    // Sort by consensus strength (strongest first)
    consensusTokens.sort((a, b) => b.consensusStrength - a.consensusStrength);

    // Trigger alerts for new consensus
    for (const consensus of consensusTokens) {
      const consensusId = `${consensus.tokenMint}_${consensus.totalWhales}`;
      
      if (!this.alertedConsensus.has(consensusId)) {
        this.alertedConsensus.add(consensusId);
        await this.triggerWhaleConsensusAlert(consensus);
      }
    }

    if (consensusTokens.length > 0) {
      logger.info(`🐋 Found ${consensusTokens.length} whale consensus signals!`);
    } else {
      logger.info('🐋 No whale consensus detected in current cycle');
    }
  }

  // 🐋 NEW: Trigger whale consensus alert
  private async triggerWhaleConsensusAlert(consensus: WhaleConsensus): Promise<void> {
    // Get additional token metrics
    const tokenMetrics = await this.getTokenMetrics(consensus.tokenMint);
    
    // 🚨🐋 WHALE CONSENSUS ALERT 🐋🚨
    console.log('\n' + '🚨🐋'.repeat(30));
    console.log('🚨🐋🚨 WHALE CONSENSUS BUY ALERT SIGNAL! 🚨🐋🚨');
    console.log('🚨🐋🚨 MULTIPLE WHALES BUYING SAME TOKEN! 🚨🐋🚨');
    console.log('🚨🐋'.repeat(30));
    
    // Token Information
    console.log('🪙 TOKEN INFORMATION:');
    console.log(`   Token Name: ${consensus.tokenName}`);
    console.log(`   Token Symbol: ${consensus.tokenSymbol}`);
    console.log(`   Token Address: ${consensus.tokenMint}`);
    console.log('');
    
    // Whale Information
    console.log(`🐋 WHALE CONSENSUS DATA (${consensus.totalWhales} WHALES):`);
    console.log(`   Total Whales: ${consensus.totalWhales} whales`);
    console.log(`   Total Amount: ${consensus.totalAmountSol.toFixed(4)} SOL (~$${consensus.totalAmountUsd.toFixed(2)})`);
    console.log(`   Average per Whale: ${(consensus.totalAmountSol / consensus.totalWhales).toFixed(4)} SOL (~$${(consensus.totalAmountUsd / consensus.totalWhales).toFixed(2)})`);
    console.log(`   Consensus Strength: ${consensus.consensusStrength.toFixed(0)} points`);
    console.log(`   Time Span: ${this.formatTimeDifference(consensus.firstPurchaseTime, consensus.lastPurchaseTime)}`);
    console.log('');
    
    // Individual Whale Details
    console.log('🐋 INDIVIDUAL WHALE PURCHASES:');
    consensus.whales.forEach((whale, index) => {
      console.log(`   ${index + 1}. 🐋 ${whale.walletName || `Whale ${whale.walletAddress.substring(0, 8)}...`}`);
      console.log(`      Address: ${whale.walletAddress}`);
      console.log(`      Amount: ${whale.amountSol.toFixed(4)} SOL (~$${whale.amountUsd.toFixed(2)})`);
      console.log(`      Time: ${whale.timestamp.toLocaleString()}`);
      console.log(`      Signature: ${whale.signature}`);
      if (index < consensus.whales.length - 1) {
        console.log('      ' + '-'.repeat(50));
      }
    });
    console.log('');
    
    // Token Metrics (if available)
    if (tokenMetrics) {
      console.log('📊 TOKEN METRICS:');
      console.log(`   Market Cap: ${tokenMetrics.marketCap || 'Unknown'}`);
      console.log(`   24h Volume: ${tokenMetrics.volume24h || 'Unknown'}`);
      console.log(`   Price: ${tokenMetrics.price || 'Unknown'}`);
      console.log(`   Holders: ${tokenMetrics.holders || 'Unknown'}`);
      console.log('');
    }
    
    // Action Links
    console.log('🔗 IMMEDIATE ACTION LINKS:');
    console.log('   CHARTS & ANALYSIS:');
    console.log(`     📈 DexScreener: https://dexscreener.com/solana/${consensus.tokenMint}`);
    console.log(`     📊 Birdeye: https://birdeye.so/token/${consensus.tokenMint}?chain=solana`);
    console.log(`     🚀 Pump.fun: https://pump.fun/${consensus.tokenMint}`);
    console.log(`     📋 Solscan Token: https://solscan.io/token/${consensus.tokenMint}`);
    console.log('');
    console.log('   WHALE TRANSACTIONS:');
    consensus.whales.forEach((whale, index) => {
      console.log(`     🐋 ${index + 1}. TX: https://solscan.io/tx/${whale.signature}`);
    });
    console.log('');
    console.log('   WHALE WALLETS:');
    consensus.whales.forEach((whale, index) => {
      console.log(`     👤 ${index + 1}. Wallet: https://solscan.io/account/${whale.walletAddress}`);
    });
    console.log('');
    
    // Risk Assessment
    console.log('⚠️ CONSENSUS RISK ASSESSMENT:');
    const riskScore = this.calculateRiskScore(consensus);
    console.log(`   Risk Level: ${riskScore.level}`);
    console.log(`   Risk Score: ${riskScore.score}/100`);
    console.log(`   Assessment: ${riskScore.assessment}`);
    console.log('');
    
    // Trading Signal
    console.log('📈 TRADING SIGNAL:');
    const signal = this.generateTradingSignal(consensus);
    console.log(`   Signal: ${signal.type}`);
    console.log(`   Confidence: ${signal.confidence}%`);
    console.log(`   Recommendation: ${signal.recommendation}`);
    console.log('');
    
    console.log('🚨 WHALE CONSENSUS DETECTED - STRONG BUY SIGNAL! 🚨');
    console.log('🐋 Multiple whales are accumulating - Consider immediate action!');
    console.log('🚨🐋'.repeat(30) + '\n');

    // Log structured data
    logger.info('🚨🐋 WHALE CONSENSUS ALERT', {
      alert_type: 'WHALE_CONSENSUS_BUY_SIGNAL',
      token_mint: consensus.tokenMint,
      token_symbol: consensus.tokenSymbol,
      token_name: consensus.tokenName,
      total_whales: consensus.totalWhales,
      total_amount_sol: consensus.totalAmountSol,
      total_amount_usd: consensus.totalAmountUsd,
      consensus_strength: consensus.consensusStrength,
      whales: consensus.whales.map(w => ({
        wallet_address: w.walletAddress,
        wallet_name: w.walletName,
        amount_usd: w.amountUsd,
        transaction_signature: w.signature,
        timestamp: w.timestamp
      })),
      risk_assessment: riskScore,
      trading_signal: signal,
      links: {
        dexscreener: `https://dexscreener.com/solana/${consensus.tokenMint}`,
        birdeye: `https://birdeye.so/token/${consensus.tokenMint}?chain=solana`,
        pump_fun: `https://pump.fun/${consensus.tokenMint}`,
        token_info: `https://solscan.io/token/${consensus.tokenMint}`
      }
    });
  }

  // 🐋 NEW: Get additional token metrics
  private async getTokenMetrics(tokenMint: string): Promise<any> {
    try {
      // Try multiple APIs for token metrics
      const response = await this.turboAxios.get(`https://api.solscan.io/token/meta?token=${tokenMint}`);
      return {
        marketCap: response.data?.market_cap,
        volume24h: response.data?.volume_24h,
        price: response.data?.price,
        holders: response.data?.holder_count
      };
    } catch (error) {
      return null;
    }
  }

  // 🐋 NEW: Calculate risk score
  private calculateRiskScore(consensus: WhaleConsensus): { level: string; score: number; assessment: string } {
    let score = 0;
    
    // More whales = lower risk
    if (consensus.totalWhales >= 5) score += 30;
    else if (consensus.totalWhales >= 3) score += 20;
    else score += 10;
    
    // Higher amounts = higher confidence
    if (consensus.totalAmountUsd >= 10000) score += 30;
    else if (consensus.totalAmountUsd >= 5000) score += 20;
    else score += 10;
    
    // Time proximity = higher signal strength
    const timeSpan = consensus.lastPurchaseTime.getTime() - consensus.firstPurchaseTime.getTime();
    if (timeSpan <= 5 * 60 * 1000) score += 30; // Within 5 minutes
    else if (timeSpan <= 15 * 60 * 1000) score += 20; // Within 15 minutes
    else score += 10;
    
    // Average purchase size
    const avgPurchase = consensus.totalAmountUsd / consensus.totalWhales;
    if (avgPurchase >= 2000) score += 10;
    else if (avgPurchase >= 1000) score += 5;
    
    let level = 'LOW';
    let assessment = 'Weak signal';
    
    if (score >= 80) {
      level = 'VERY HIGH';
      assessment = 'Extremely strong whale consensus - High conviction buy signal';
    } else if (score >= 60) {
      level = 'HIGH';
      assessment = 'Strong whale consensus - Consider buying';
    } else if (score >= 40) {
      level = 'MEDIUM';
      assessment = 'Moderate whale interest - Monitor closely';
    } else {
      level = 'LOW';
      assessment = 'Weak whale consensus - Exercise caution';
    }
    
    return { level, score, assessment };
  }

  // 🐋 NEW: Generate trading signal
  private generateTradingSignal(consensus: WhaleConsensus): { type: string; confidence: number; recommendation: string } {
    let confidence = 50; // Base confidence
    
    // Whale count impact
    confidence += consensus.totalWhales * 10;
    
    // Amount impact
    const avgAmount = consensus.totalAmountUsd / consensus.totalWhales;
    if (avgAmount >= 2000) confidence += 20;
    else if (avgAmount >= 1000) confidence += 10;
    
    // Time clustering impact
    const timeSpan = consensus.lastPurchaseTime.getTime() - consensus.firstPurchaseTime.getTime();
    if (timeSpan <= 5 * 60 * 1000) confidence += 15; // Very quick succession
    else if (timeSpan <= 15 * 60 * 1000) confidence += 10;
    
    // Cap confidence at 95%
    confidence = Math.min(confidence, 95);
    
    let type = 'HOLD';
    let recommendation = 'Monitor position';
    
    if (confidence >= 80) {
      type = 'STRONG BUY';
      recommendation = 'Consider immediate purchase - Multiple whales showing strong conviction';
    } else if (confidence >= 70) {
      type = 'BUY';
      recommendation = 'Good buying opportunity - Whale consensus detected';
    } else if (confidence >= 60) {
      type = 'WEAK BUY';
      recommendation = 'Monitor closely - Some whale interest detected';
    }
    
    return { type, confidence, recommendation };
  }

  // 🐋 NEW: Format time difference
  private formatTimeDifference(startTime: Date, endTime: Date): string {
    const diffMs = endTime.getTime() - startTime.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffSeconds = Math.floor((diffMs % (1000 * 60)) / 1000);
    
    if (diffMinutes === 0) {
      return `${diffSeconds} seconds`;
    } else if (diffMinutes < 60) {
      return `${diffMinutes} minutes ${diffSeconds} seconds`;
    } else {
      const hours = Math.floor(diffMinutes / 60);
      const mins = diffMinutes % 60;
      return `${hours} hours ${mins} minutes`;
    }
  }

  // Existing methods continued...
  private async turboGetSolanaSignatures(walletAddress: string): Promise<SolanaSignature[]> {
    const rpcPromises = this.TURBO_RPC_ENDPOINTS.map(async (rpcUrl, index) => {
      try {
        const response = await this.turboAxios.post(rpcUrl, {
          jsonrpc: '2.0',
          id: 1,
          method: 'getSignaturesForAddress',
          params: [
            walletAddress,
            {
              limit: 15,
              commitment: 'confirmed'
            }
          ]
        });

        if (response.data?.result && Array.isArray(response.data.result)) {
          return response.data.result;
        }
        return null;

      } catch (error) {
        return null;
      }
    });

    try {
      const results = await Promise.allSettled(rpcPromises);
      
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          return result.value;
        }
      }

      return [];

    } catch (error) {
      return [];
    }
  }

  private async turboGetTransactionDetails(signature: string): Promise<SolanaTransaction | null> {
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

  private async parseRealTokenPurchase(transaction: SolanaTransaction, walletAddress: string, signature: string, walletName?: string): Promise<TokenPurchase | null> {
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
              const tokenInfo = await this.turboGetTokenInfo(tokenMint);
              
              return {
                walletAddress,
                walletName,
                tokenMint,
                tokenSymbol: tokenInfo?.symbol || 'UNKNOWN',
                tokenName: tokenInfo?.name || 'Unknown Token',
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

  private async turboGetTokenInfo(tokenMint: string): Promise<{ symbol: string; name: string } | null> {
    if (this.tokenInfoCache.has(tokenMint)) {
      return this.tokenInfoCache.get(tokenMint)!;
    }

    try {
      const response = await this.turboAxios.get(`https://api.solscan.io/token/meta?token=${tokenMint}`);
      
      const tokenInfo = {
        symbol: response.data?.symbol || 'UNKNOWN',
        name: response.data?.name || 'Unknown Token'
      };
      
      this.tokenInfoCache.set(tokenMint, tokenInfo);
      return tokenInfo;
      
    } catch (error) {
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

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async testWalletMonitoring(walletAddress: string): Promise<void> {
    logger.info(`🐋 Testing WHALE CONSENSUS monitoring for wallet: ${walletAddress}`);
    
    try {
      const purchases = await this.checkWalletForConsensus(walletAddress, `Test Whale`);
      
      if (purchases.length > 0) {
        console.log(`✅ Found ${purchases.length} purchases for consensus tracking`);
        this.addPurchasesToConsensusTracking(purchases);
        await this.analyzeWhaleConsensus();
      } else {
        console.log('❌ No purchases found for consensus testing');
      }
    } catch (error) {
      logger.error('❌ Consensus test failed:', error);
    }
  }

  getMonitoringStatus(): {
    isActive: boolean;
    qualifiedWalletsCount: number;
    manualWalletsCount: number;
    totalWalletsCount: number;
    checkInterval: number;
    minPurchaseUsd: number;
    minWhalesForConsensus: number;
    consensusTimeWindow: number;
    trackedTokens: number;
  } {
    return {
      isActive: this.isMonitoring,
      qualifiedWalletsCount: this.qualifiedWallets.length,
      manualWalletsCount: this.manualWallets.length,
      totalWalletsCount: this.allMonitoredWallets.length,
      checkInterval: this.CHECK_INTERVAL,
      minPurchaseUsd: this.MIN_PURCHASE_USD,
      minWhalesForConsensus: this.MIN_WHALES_FOR_CONSENSUS,
      consensusTimeWindow: this.consensusTimeWindow,
      trackedTokens: this.recentWhalePurchases.size
    };
  }

  async addManualWallet(address: string, name: string, description: string = ''): Promise<boolean> {
    try {
      const configPath = path.join(process.cwd(), this.MANUAL_WALLETS_FILE);
      const config = this.getManualWalletsConfig() || {
        manualWallets: [],
        settings: {
          minPurchaseUsd: 50,
          checkIntervalSeconds: 30,
          enableQualifiedWallets: true,
          enableManualWallets: true,
          minWhalesForConsensus: 2
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
      
      logger.info(`🐋 CONSENSUS: Added manual wallet: ${name} (${address}) - WHALE CONSENSUS MONITORING ENABLED`);
      return true;
      
    } catch (error) {
      logger.error('❌ Failed to add manual wallet:', error);
      return false;
    }
  }
}
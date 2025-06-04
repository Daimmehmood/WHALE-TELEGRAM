// src/simpleMemeTracker.ts
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

interface TokenPurchase {
  walletAddress: string;
  tokenMint: string;
  tokenSymbol: string;
  tokenName: string;
  amountSol: number;
  amountUsd: number;
  signature: string;
  timestamp: Date;
  isMeme: boolean;
}

class SimpleMemeTracker {
  private readonly WALLET_TO_TRACK = '5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1'; // Change this wallet address
  private readonly SOL_PRICE_USD = 200;
  private readonly MIN_PURCHASE_USD = 10; // Low threshold for testing
  private readonly CHECK_INTERVAL = 60000; // 1 minute
  private lastCheckedTime: number = 0;
  private isRunning: boolean = false;

  // Known meme coin addresses (you can add more)
  private readonly MEME_COINS = new Set([
    'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', // BONK
    'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', // WIF
    'MEW1gQWJ3nEXg2qgERiKu7FAFj79PHvQVREQUzScPP5', // MEW
    'A8C3xuqscfmyLrte3VmTqrAq8kgMASius9AFNANwpump', // PUMP
    'So11111111111111111111111111111111111111112', // SOL (for testing)
  ]);

  constructor(walletAddress?: string) {
    if (walletAddress) {
      (this as any).WALLET_TO_TRACK = walletAddress;
    }
  }

  async start(): Promise<void> {
    console.log('\n' + '🎯'.repeat(60));
    console.log('🎯 SIMPLE MEME COIN PURCHASE TRACKER');
    console.log('🎯'.repeat(60));
    console.log(`🐋 Tracking Wallet: ${this.WALLET_TO_TRACK}`);
    console.log(`💰 Min Purchase: $${this.MIN_PURCHASE_USD}`);
    console.log(`⏱️ Check Interval: ${this.CHECK_INTERVAL / 1000} seconds`);
    console.log(`🪙 Focus: Meme coins & all token purchases`);
    console.log('🎯'.repeat(60));
    console.log('🔍 Starting to watch for purchases...\n');

    this.isRunning = true;
    
    // Initialize last checked time (24 hours ago)
    this.lastCheckedTime = Math.floor(Date.now() / 1000) - 86400;

    // Start monitoring
    this.checkForPurchases();
    
    // Set up interval
    setInterval(() => {
      if (this.isRunning) {
        this.checkForPurchases();
      }
    }, this.CHECK_INTERVAL);

    // Keep process alive
    process.stdin.resume();
  }

  async checkForPurchases(): Promise<void> {
    try {
      console.log(`🔍 Checking ${this.WALLET_TO_TRACK.substring(0, 8)}... for new purchases...`);

      // Get recent transaction signatures
      const signatures = await this.getRecentSignatures();
      
      if (!signatures || signatures.length === 0) {
        console.log('😴 No recent transactions found');
        return;
      }

      console.log(`📋 Found ${signatures.length} recent transactions, analyzing...`);

      const purchases: TokenPurchase[] = [];
      let latestTimestamp = this.lastCheckedTime;

      for (const sig of signatures) {
        // Skip old transactions
        if (sig.blockTime <= this.lastCheckedTime) {
          continue;
        }

        // Update latest timestamp
        if (sig.blockTime > latestTimestamp) {
          latestTimestamp = sig.blockTime;
        }

        // Skip failed transactions
        if (sig.err) {
          continue;
        }

        // Get transaction details and check for purchases
        const purchase = await this.analyzeTransaction(sig.signature);
        if (purchase && purchase.amountUsd >= this.MIN_PURCHASE_USD) {
          purchases.push(purchase);
        }

        // Small delay to avoid rate limiting
        await this.delay(200);
      }

      // Update last checked time
      this.lastCheckedTime = latestTimestamp;

      // Display any purchases found
      if (purchases.length > 0) {
        purchases.forEach(purchase => this.displayPurchaseAlert(purchase));
      } else {
        console.log('😴 No token purchases detected in recent transactions');
      }

    } catch (error) {
      console.error('❌ Error checking for purchases:', error);
    }
  }

  private async getRecentSignatures(): Promise<any[]> {
    const rpcEndpoints = [
      'https://api.mainnet-beta.solana.com',
      'https://rpc.ankr.com/solana',
      'https://mainnet.helius-rpc.com/?api-key=46dd6d27-c247-40fd-b360-1db6c7344442'
    ];

    for (const rpcUrl of rpcEndpoints) {
      try {
        const response = await axios.post(rpcUrl, {
          jsonrpc: '2.0',
          id: 1,
          method: 'getSignaturesForAddress',
          params: [
            this.WALLET_TO_TRACK,
            {
              limit: 15,
              commitment: 'confirmed'
            }
          ]
        }, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 15000
        });

        if (response.data?.result) {
          return response.data.result;
        }
      } catch (error) {
        console.log(`⚠️ RPC ${rpcUrl.replace('https://', '').substring(0, 20)}... failed, trying next...`);
        continue;
      }
    }

    return [];
  }

  private async analyzeTransaction(signature: string): Promise<TokenPurchase | null> {
    try {
      // Get full transaction details
      const response = await axios.post('https://api.mainnet-beta.solana.com', {
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
      }, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 15000
      });

      if (!response.data?.result) {
        return null;
      }

      const transaction = response.data.result;
      
      // Check if transaction failed
      if (transaction.meta?.err) {
        return null;
      }

      // Look for token balance increases
      const preTokenBalances = transaction.meta?.preTokenBalances || [];
      const postTokenBalances = transaction.meta?.postTokenBalances || [];

      

      return null;

    } catch (error) {
      return null;
    }
  }

  private calculateSolSpent(meta: any, walletAddress: string, accountKeys: string[]): number {
    try {
      const walletIndex = accountKeys.indexOf(walletAddress);
      if (walletIndex === -1) return 0;

      const preBalance = meta.preBalances[walletIndex] || 0;
      const postBalance = meta.postBalances[walletIndex] || 0;
      const balanceChange = preBalance - postBalance;

      // Convert from lamports to SOL
      return Math.max(0, balanceChange / 1000000000);
    } catch (error) {
      return 0;
    }
  }

  private async getTokenInfo(tokenMint: string): Promise<{ symbol: string; name: string }> {
    try {
      // Try Solscan API first
      const response = await axios.get(`https://api.solscan.io/token/meta?token=${tokenMint}`, {
        timeout: 5000,
        headers: { 'User-Agent': 'SimpleMemeTracker/1.0' }
      });

      return {
        symbol: response.data?.symbol || 'UNKNOWN',
        name: response.data?.name || 'Unknown Token'
      };
    } catch (error) {
      // Fallback to basic info
      return {
        symbol: tokenMint.substring(0, 6).toUpperCase(),
        name: 'Unknown Token'
      };
    }
  }

  private isMemeToken(mint: string, symbol: string, name: string): boolean {
    // Check if it's in our known meme coins list
    if (this.MEME_COINS.has(mint)) {
      return true;
    }

    // Check for meme-like characteristics
    const memeKeywords = ['meme', 'doge', 'pepe', 'shib', 'floki', 'elon', 'moon', 'inu', 'cat', 'frog'];
    const lowerSymbol = symbol.toLowerCase();
    const lowerName = name.toLowerCase();

    return memeKeywords.some(keyword => 
      lowerSymbol.includes(keyword) || lowerName.includes(keyword)
    );
  }

  private displayPurchaseAlert(purchase: TokenPurchase): void {
    const memeFlag = purchase.isMeme ? '🎭 MEME COIN' : '🪙 TOKEN';
    
    console.log('\n' + '🚨'.repeat(50));
    console.log('🚨🚨🚨 TOKEN PURCHASE DETECTED! 🚨🚨🚨');
    console.log('🚨'.repeat(50));
    console.log(`🐋 Wallet: ${purchase.walletAddress}`);
    console.log(`${memeFlag} Purchased: ${purchase.tokenSymbol} (${purchase.tokenName})`);
    console.log(`🔗 Token Address: ${purchase.tokenMint}`);
    console.log(`💰 Amount: ${purchase.amountSol.toFixed(4)} SOL (~$${purchase.amountUsd.toFixed(2)})`);
    console.log(`🕐 Time: ${purchase.timestamp.toLocaleString()}`);
    console.log('📊 Links:');
    console.log(`   🔗 Transaction: https://solscan.io/tx/${purchase.signature}`);
    console.log(`   🪙 Token: https://solscan.io/token/${purchase.tokenMint}`);
    console.log(`   📈 Chart: https://dexscreener.com/solana/${purchase.tokenMint}`);
    console.log(`   🚀 Pump.fun: https://pump.fun/${purchase.tokenMint}`);
    
    if (purchase.isMeme) {
      console.log('🎭 This appears to be a MEME COIN purchase! 🚀');
    }
    
    console.log('🚨'.repeat(50) + '\n');
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  stop(): void {
    this.isRunning = false;
    console.log('🛑 Meme tracker stopped');
  }
}

// CLI Interface
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('\n📖 SIMPLE MEME TRACKER USAGE:');
    console.log('='.repeat(50));
    console.log('ts-node src/simpleMemeTracker.ts <wallet_address>');
    console.log('');
    console.log('Example:');
    console.log('ts-node src/simpleMemeTracker.ts 5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1');
    console.log('='.repeat(50));
    return;
  }

  const walletAddress = args[0];
  
  // Validate wallet address format
  if (walletAddress.length < 32 || walletAddress.length > 44) {
    console.error('❌ Invalid wallet address format');
    return;
  }

  const tracker = new SimpleMemeTracker(walletAddress);
  
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Stopping tracker...');
    tracker.stop();
    process.exit(0);
  });

  await tracker.start();
}

if (require.main === module) {
  main();
}
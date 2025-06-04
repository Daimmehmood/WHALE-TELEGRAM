// Enhanced TelegramWhaleBot.ts - Better Token Info & Whale Display 🚀📱
import axios from 'axios';
import { logger } from '../utils/logger';
import * as fs from 'fs';
import * as path from 'path';

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
  transactionType: string;
}

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
  consensusStrength: number;
}

interface TelegramConfig {
  botToken: string;
  chatId: string;
  enabled: boolean;
  sendIndividualAlerts: boolean;
  sendConsensusAlerts: boolean;
  minConsensusWhales: number;
}

interface ManualWallet {
  address: string;
  name: string;
  description: string;
  enabled: boolean;
}

interface ManualWalletsConfig {
  manualWallets: ManualWallet[];
  settings: any;
}

export class EnhancedTelegramWhaleBot {
  private config: TelegramConfig;
  private manualWallets: ManualWallet[] = [];
  private tokenInfoCache: Map<string, { symbol: string; name: string; verified: boolean }> = new Map();

  constructor() {
    this.config = this.loadTelegramConfig();
    this.loadManualWallets();
    
    if (this.config.enabled) {
      logger.info('🤖 Enhanced Telegram Whale Bot initialized successfully');
      this.testConnection();
    } else {
      logger.info('🤖 Telegram Bot disabled - Configure telegram.json to enable');
    }
  }

  private loadTelegramConfig(): TelegramConfig {
    try {
      const configPath = path.join(process.cwd(), 'telegram.json');
      
      if (!fs.existsSync(configPath)) {
        this.createDefaultTelegramConfig();
        return {
          botToken: '',
          chatId: '',
          enabled: false,
          sendIndividualAlerts: true,
          sendConsensusAlerts: true,
          minConsensusWhales: 2
        };
      }
      
      const configData = fs.readFileSync(configPath, 'utf8');
      const config = JSON.parse(configData);
      
      logger.info(`🤖 Telegram config loaded - Enabled: ${config.enabled}`);
      return config;
      
    } catch (error) {
      logger.error('❌ Failed to load telegram config:', error);
      return {
        botToken: '',
        chatId: '',
        enabled: false,
        sendIndividualAlerts: true,
        sendConsensusAlerts: true,
        minConsensusWhales: 2
      };
    }
  }

  private loadManualWallets(): void {
    try {
      const configPath = path.join(process.cwd(), 'manualWallets.json');
      
      if (fs.existsSync(configPath)) {
        const configData = fs.readFileSync(configPath, 'utf8');
        const config: ManualWalletsConfig = JSON.parse(configData);
        this.manualWallets = config.manualWallets || [];
        logger.info(`🤖 Loaded ${this.manualWallets.length} manual wallets for name mapping`);
      }
    } catch (error) {
      logger.error('❌ Failed to load manual wallets:', error);
      this.manualWallets = [];
    }
  }

  private createDefaultTelegramConfig(): void {
    const defaultConfig = {
      botToken: "YOUR_BOT_TOKEN_HERE",
      chatId: "YOUR_CHAT_ID_HERE", 
      enabled: false,
      sendIndividualAlerts: true,
      sendConsensusAlerts: true,
      minConsensusWhales: 2,
      setup_instructions: {
        step1: "Create bot with @BotFather on Telegram",
        step2: "Get bot token from @BotFather", 
        step3: "Add bot to your group/channel",
        step4: "Get chat ID using @userinfobot or API",
        step5: "Replace YOUR_BOT_TOKEN_HERE and YOUR_CHAT_ID_HERE",
        step6: "Set enabled: true",
        note: "Chat ID format: -1001234567890 (for groups/channels)"
      }
    };
    
    fs.writeFileSync('telegram.json', JSON.stringify(defaultConfig, null, 2));
    logger.info('📱 Created telegram.json - Please configure your bot token and chat ID');
  }

  private async testConnection(): Promise<void> {
    if (!this.config.enabled || !this.config.botToken) {
      return;
    }

    try {
      logger.info('🤖 Testing Telegram Bot connection...');
      
      const timeouts = [5000, 10000, 15000];
      
      for (let i = 0; i < timeouts.length; i++) {
        try {
          const response = await axios.get(`https://api.telegram.org/bot${this.config.botToken}/getMe`, {
            timeout: timeouts[i],
            headers: {
              'Content-Type': 'application/json'
            }
          });
          
          if (response.data.ok) {
            logger.info(`🤖 Telegram Bot connected: @${response.data.result.username}`);
            await this.sendMessage('🤖 Enhanced Whale Bot connected!\n⚡ Ready to send enhanced whale alerts with proper token names!');
            return;
          }
        } catch (error) {
          logger.warn(`🤖 Connection attempt ${i + 1} failed (timeout: ${timeouts[i]}ms)`);
          if (i === timeouts.length - 1) {
            throw error;
          }
          await this.delay(2000);
        }
      }
      
    } catch (error) {
      logger.error('❌ Telegram connection failed');
      logger.info('💡 Set "enabled": false in telegram.json to disable Telegram alerts');
    }
  }

  // 🆕 ENHANCED: Get comprehensive token information from multiple sources
  private async getEnhancedTokenInfo(tokenMint: string): Promise<{ symbol: string; name: string; verified: boolean }> {
    // Check cache first
    if (this.tokenInfoCache.has(tokenMint)) {
      return this.tokenInfoCache.get(tokenMint)!;
    }

    let tokenInfo = {
      symbol: 'UNKNOWN',
      name: 'Unknown Token',
      verified: false
    };

    try {
      // Try multiple sources for better token info
      const sources = [
        // Jupiter API (usually has good token metadata)
        async () => {
          const response = await axios.get(`https://token.jup.ag/strict`, { timeout: 5000 });
          const token = response.data.find((t: any) => t.address === tokenMint);
          if (token) {
            return {
              symbol: token.symbol || 'UNKNOWN',
              name: token.name || 'Unknown Token',
              verified: true
            };
          }
          return null;
        },

        // Solana Token List
        async () => {
          const response = await axios.get(`https://raw.githubusercontent.com/solana-labs/token-list/main/src/tokens/solana.tokenlist.json`, { timeout: 5000 });
          const token = response.data.tokens.find((t: any) => t.address === tokenMint);
          if (token) {
            return {
              symbol: token.symbol || 'UNKNOWN',
              name: token.name || 'Unknown Token',
              verified: true
            };
          }
          return null;
        },

        // Solscan API
        async () => {
          const response = await axios.get(`https://api.solscan.io/token/meta?token=${tokenMint}`, { timeout: 5000 });
          if (response.data && response.data.symbol) {
            return {
              symbol: response.data.symbol,
              name: response.data.name || response.data.symbol,
              verified: false
            };
          }
          return null;
        },

        // Birdeye API
        async () => {
          const response = await axios.get(`https://public-api.birdeye.so/public/tokenlist?chain=solana`, { timeout: 5000 });
          const token = response.data.data?.tokens?.find((t: any) => t.address === tokenMint);
          if (token) {
            return {
              symbol: token.symbol || 'UNKNOWN',
              name: token.name || token.symbol || 'Unknown Token',
              verified: true
            };
          }
          return null;
        }
      ];

      // Try sources in order until we find good data
      for (const source of sources) {
        try {
          const result = await source();
          if (result && result.symbol !== 'UNKNOWN') {
            tokenInfo = result;
            break;
          }
        } catch (error) {
          // Continue to next source
          continue;
        }
      }

      // If still unknown, try to get basic info from on-chain data
      if (tokenInfo.symbol === 'UNKNOWN') {
        try {
          const response = await axios.post('https://api.mainnet-beta.solana.com', {
            jsonrpc: '2.0',
            id: 1,
            method: 'getAccountInfo',
            params: [
              tokenMint,
              { encoding: 'jsonParsed' }
            ]
          }, { timeout: 5000 });

          if (response.data?.result?.value?.data?.parsed?.info) {
            const info = response.data.result.value.data.parsed.info;
            tokenInfo.symbol = info.symbol || tokenMint.substring(0, 6);
            tokenInfo.name = info.name || `Token ${tokenMint.substring(0, 6)}`;
          }
        } catch (error) {
          // Use fallback
          tokenInfo.symbol = tokenMint.substring(0, 6);
          tokenInfo.name = `Token ${tokenMint.substring(0, 6)}`;
        }
      }

    } catch (error) {
      logger.warn(`Failed to get token info for ${tokenMint}:`, error);
    }

    // Cache the result
    this.tokenInfoCache.set(tokenMint, tokenInfo);
    return tokenInfo;
  }

  // 🆕 ENHANCED: Get whale wallet name or create a readable label
  private getWhaleWalletLabel(walletAddress: string, walletName?: string): { name: string; shortAddress: string; isNamed: boolean } {
    // Check if we have a manual wallet name
    const manualWallet = this.manualWallets.find(w => w.address === walletAddress);
    if (manualWallet) {
      return {
        name: manualWallet.name,
        shortAddress: walletAddress.substring(0, 8) + '...',
        isNamed: true
      };
    }

    // Use provided wallet name
    if (walletName) {
      return {
        name: walletName,
        shortAddress: walletAddress.substring(0, 8) + '...',
        isNamed: true
      };
    }

    // Create a readable label for unknown wallets
    const shortAddr = walletAddress.substring(0, 8);
    return {
      name: `Whale ${shortAddr}`,
      shortAddress: shortAddr + '...',
      isNamed: false
    };
  }

  private async sendMessage(text: string, parseMode: string = 'HTML'): Promise<boolean> {
    if (!this.config.enabled || !this.config.botToken || !this.config.chatId) {
      return false;
    }

    try {
      const timeouts = [3000, 5000, 8000];
      
      for (let i = 0; i < timeouts.length; i++) {
        try {
          const response = await axios.post(`https://api.telegram.org/bot${this.config.botToken}/sendMessage`, {
            chat_id: this.config.chatId,
            text: text,
            parse_mode: parseMode,
            disable_web_page_preview: true
          }, {
            timeout: timeouts[i],
            headers: {
              'Content-Type': 'application/json'
            }
          });

          if (response.data.ok) {
            logger.info('📱 Telegram message sent successfully');
            return true;
          }
        } catch (error) {
          if (i === timeouts.length - 1) {
            throw error;
          }
          await this.delay(1000);
        }
      }
      
      return false;
      
    } catch (error: any) {
      logger.warn('❌ Telegram message failed');
      return false;
    }
  }

  // 🆕 ENHANCED: Individual purchase alert with better token info
  async sendIndividualPurchaseAlert(purchase: TokenPurchase): Promise<void> {
    if (!this.config.enabled || !this.config.sendIndividualAlerts) {
      logger.info('📱 Individual alert skipped - disabled in config');
      return;
    }

    // Get enhanced token info
    const tokenInfo = await this.getEnhancedTokenInfo(purchase.tokenMint);
    const whaleInfo = this.getWhaleWalletLabel(purchase.walletAddress, purchase.walletName);
    
    const verifiedBadge = tokenInfo.verified ? '✅' : '⚠️';
    const namedWhaleBadge = whaleInfo.isNamed ? '👑' : '🐋';
    
    const message = `
🚨 <b>WHALE PURCHASE DETECTED!</b> ${namedWhaleBadge}

${namedWhaleBadge} <b>Whale:</b> ${whaleInfo.name}
📍 <b>Address:</b> <code>${whaleInfo.shortAddress}</code>

🪙 <b>Token:</b> ${verifiedBadge} <b>${tokenInfo.name}</b> (${tokenInfo.symbol})
💰 <b>Amount:</b> ${purchase.amountSol.toFixed(4)} SOL (~$${purchase.amountUsd.toFixed(2)})
🕐 <b>Time:</b> ${purchase.timestamp.toLocaleString()}

<b>🔗 Quick Links:</b>
📊 <a href="https://solscan.io/tx/${purchase.signature}">Transaction</a>
📈 <a href="https://dexscreener.com/solana/${purchase.tokenMint}">Chart</a>
🚀 <a href="https://pump.fun/${purchase.tokenMint}">Pump.fun</a>
👤 <a href="https://solscan.io/account/${purchase.walletAddress}">Whale Wallet</a>

⚡ Checking for whale consensus...
    `.trim();

    const success = await this.sendMessage(message);
    if (success) {
      logger.info('📱 Enhanced individual purchase alert sent to Telegram');
    } else {
      logger.warn('📱 Failed to send individual alert to Telegram');
    }
  }

  // 🆕 ENHANCED: Whale consensus alert with better info
  async sendWhaleConsensusAlert(consensus: WhaleConsensus): Promise<void> {
    if (!this.config.enabled || !this.config.sendConsensusAlerts) {
      logger.info('📱 Consensus alert skipped - disabled in config');
      return;
    }

    if (consensus.totalWhales < this.config.minConsensusWhales) {
      logger.info(`📱 Consensus alert skipped - need ${this.config.minConsensusWhales} whales, found ${consensus.totalWhales}`);
      return;
    }

    // Get enhanced token info
    const tokenInfo = await this.getEnhancedTokenInfo(consensus.tokenMint);
    const riskScore = this.calculateRiskScore(consensus);
    const signal = this.generateTradingSignal(consensus);

    const verifiedBadge = tokenInfo.verified ? '✅' : '⚠️';

    // Format whale list with proper names
    const whaleList = consensus.whales.map((whale, index) => {
      const whaleInfo = this.getWhaleWalletLabel(whale.walletAddress, whale.walletName);
      const whaleBadge = whaleInfo.isNamed ? '👑' : '🐋';
      return `${index + 1}. ${whaleBadge} <b>${whaleInfo.name}</b>
   💰 $${whale.amountUsd.toFixed(2)} • ${whale.timestamp.toLocaleTimeString()}
   📍 <code>${whaleInfo.shortAddress}</code>`;
    }).join('\n\n');

    const message = `
🚨🐋 <b>WHALE CONSENSUS ALERT!</b> 🚨🐋
🚨 <b>${consensus.totalWhales} WHALES BUYING SAME TOKEN!</b> 🚨

🪙 <b>TOKEN INFO:</b> ${verifiedBadge}
<b>Name:</b> ${tokenInfo.name}
<b>Symbol:</b> ${tokenInfo.symbol}
<b>Contract:</b> <code>${consensus.tokenMint.substring(0, 12)}...</code>

🐋 <b>CONSENSUS DATA (${consensus.totalWhales} WHALES):</b>
<b>Total Whales:</b> ${consensus.totalWhales} whales
<b>Total Amount:</b> ${consensus.totalAmountSol.toFixed(4)} SOL (~$${consensus.totalAmountUsd.toFixed(2)})
<b>Average per Whale:</b> $${(consensus.totalAmountUsd / consensus.totalWhales).toFixed(2)}
<b>Time Span:</b> ${this.formatTimeDifference(consensus.firstPurchaseTime, consensus.lastPurchaseTime)}

⚠️ <b>RISK ASSESSMENT:</b>
<b>Risk Level:</b> ${riskScore.level}
<b>Risk Score:</b> ${riskScore.score}/100

📈 <b>TRADING SIGNAL:</b>
<b>Signal:</b> ${signal.type}
<b>Confidence:</b> ${signal.confidence}%

🐋 <b>WHALE PURCHASES:</b>
${whaleList}

<b>🔗 ACTION LINKS:</b>
📈 <a href="https://dexscreener.com/solana/${consensus.tokenMint}">DexScreener</a>
🚀 <a href="https://pump.fun/${consensus.tokenMint}">Pump.fun</a>
📋 <a href="https://solscan.io/token/${consensus.tokenMint}">Token Info</a>
🔍 <a href="https://birdeye.so/token/${consensus.tokenMint}?chain=solana">Birdeye</a>

🚨 <b>WHALE CONSENSUS DETECTED - ACT FAST!</b> 🚨
    `.trim();

    // Check message length and split if needed
    if (message.length > 4000) {
      await this.sendLongConsensusAlert(consensus, tokenInfo);
    } else {
      await this.sendMessage(message);
    }

    logger.info('📱🐋 Enhanced whale consensus alert sent to Telegram');
  }

  // 🆕 ENHANCED: Split long messages with better formatting
  private async sendLongConsensusAlert(consensus: WhaleConsensus, tokenInfo: any): Promise<void> {
    const verifiedBadge = tokenInfo.verified ? '✅' : '⚠️';

    // Message 1: Main alert
    const mainMessage = `
🚨🐋 <b>WHALE CONSENSUS ALERT!</b> 🚨🐋
🚨 <b>${consensus.totalWhales} WHALES BUYING ${tokenInfo.symbol}!</b> 🚨

🪙 <b>TOKEN:</b> ${verifiedBadge} <b>${tokenInfo.name}</b>
<b>Symbol:</b> ${tokenInfo.symbol}
<b>Contract:</b> <code>${consensus.tokenMint.substring(0, 12)}...</code>

🐋 <b>CONSENSUS DATA:</b>
<b>Total Whales:</b> ${consensus.totalWhales} whales
<b>Total Amount:</b> ${consensus.totalAmountSol.toFixed(4)} SOL (~$${consensus.totalAmountUsd.toFixed(2)})
<b>Average per Whale:</b> $${(consensus.totalAmountUsd / consensus.totalWhales).toFixed(2)}

<b>🔗 QUICK ACTION:</b>
📈 <a href="https://dexscreener.com/solana/${consensus.tokenMint}">Chart</a> | 
🚀 <a href="https://pump.fun/${consensus.tokenMint}">Buy</a> | 
📋 <a href="https://solscan.io/token/${consensus.tokenMint}">Info</a>

🚨 <b>ACT FAST - WHALE CONSENSUS DETECTED!</b> 🚨
    `.trim();

    await this.sendMessage(mainMessage);

    // Message 2: Individual whale details with proper names
    const whaleDetails = consensus.whales.map((whale, index) => {
      const whaleInfo = this.getWhaleWalletLabel(whale.walletAddress, whale.walletName);
      const whaleBadge = whaleInfo.isNamed ? '👑' : '🐋';
      return `${index + 1}. ${whaleBadge} <b>${whaleInfo.name}</b>
   💰 ${whale.amountSol.toFixed(4)} SOL (~$${whale.amountUsd.toFixed(2)})
   🕐 ${whale.timestamp.toLocaleString()}
   📍 <code>${whaleInfo.shortAddress}</code>
   📊 <a href="https://solscan.io/tx/${whale.signature}">TX</a> | <a href="https://solscan.io/account/${whale.walletAddress}">Wallet</a>`;
    }).join('\n\n');

    const whaleMessage = `
🐋 <b>INDIVIDUAL WHALE PURCHASES:</b>

${whaleDetails}
    `.trim();

    await this.sendMessage(whaleMessage);
  }

  private calculateRiskScore(consensus: WhaleConsensus): { level: string; score: number } {
    let score = 0;
    
    if (consensus.totalWhales >= 5) score += 30;
    else if (consensus.totalWhales >= 3) score += 20;
    else score += 10;
    
    if (consensus.totalAmountUsd >= 10000) score += 30;
    else if (consensus.totalAmountUsd >= 5000) score += 20;
    else score += 10;
    
    const timeSpan = consensus.lastPurchaseTime.getTime() - consensus.firstPurchaseTime.getTime();
    if (timeSpan <= 5 * 60 * 1000) score += 30;
    else if (timeSpan <= 15 * 60 * 1000) score += 20;
    else score += 10;
    
    let level = 'LOW';
    if (score >= 80) level = 'VERY HIGH';
    else if (score >= 60) level = 'HIGH';
    else if (score >= 40) level = 'MEDIUM';
    
    return { level, score };
  }

  private generateTradingSignal(consensus: WhaleConsensus): { type: string; confidence: number } {
    let confidence = 50;
    confidence += consensus.totalWhales * 10;
    
    const avgAmount = consensus.totalAmountUsd / consensus.totalWhales;
    if (avgAmount >= 2000) confidence += 20;
    else if (avgAmount >= 1000) confidence += 10;
    
    confidence = Math.min(confidence, 95);
    
    let type = 'HOLD';
    if (confidence >= 80) type = 'STRONG BUY';
    else if (confidence >= 70) type = 'BUY';
    else if (confidence >= 60) type = 'WEAK BUY';
    
    return { type, confidence };
  }

  private formatTimeDifference(startTime: Date, endTime: Date): string {
    const diffMs = endTime.getTime() - startTime.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffSeconds = Math.floor((diffMs % (1000 * 60)) / 1000);
    
    if (diffMinutes === 0) return `${diffSeconds}s`;
    else if (diffMinutes < 60) return `${diffMinutes}m ${diffSeconds}s`;
    else {
      const hours = Math.floor(diffMinutes / 60);
      const mins = diffMinutes % 60;
      return `${hours}h ${mins}m`;
    }
  }

  async sendTestMessage(): Promise<void> {
    if (!this.config.enabled) {
      logger.warn('🤖 Telegram bot disabled');
      return;
    }

    const testMessage = `
🧪 <b>ENHANCED TELEGRAM BOT TEST</b> 🤖✨

✅ Enhanced bot is working correctly!
📱 Connected to group
🐋 Ready to send enhanced whale alerts
⚡ Enhanced token name resolution active
👑 Whale wallet name mapping active
🔍 Multi-source token verification enabled

<i>Test message from Enhanced Whale Consensus Bot</i>
    `.trim();

    const success = await this.sendMessage(testMessage);
    if (success) {
      logger.info('✅ Enhanced Telegram test message sent successfully');
    } else {
      logger.error('❌ Failed to send enhanced Telegram test message');
    }
  }

  getBotStatus(): { enabled: boolean; configured: boolean } {
    return {
      enabled: this.config.enabled,
      configured: !!(this.config.botToken && this.config.chatId)
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // 🆕 Add method to refresh token cache
  async refreshTokenCache(): Promise<void> {
    this.tokenInfoCache.clear();
    logger.info('🔄 Token info cache cleared - will fetch fresh data');
  }

  // 🆕 Add method to get cache stats
  getCacheStats(): { totalCached: number; verifiedTokens: number } {
    const cached = Array.from(this.tokenInfoCache.values());
    return {
      totalCached: cached.length,
      verifiedTokens: cached.filter(t => t.verified).length
    };
  }
}
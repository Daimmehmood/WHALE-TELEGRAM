// src/monitor-no-db.ts - ENHANCED WITH SOCIAL MEDIA (PART 1) 📱🐋🔍
import dotenv from 'dotenv';
import { logger } from './utils/logger';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

// 📱 NEW: Import social media modules
import { SocialMediaAnalyzer, SocialMediaData } from './socialMediaAnalyzer';
import { SocialMediaFormatter, FormattedSocialDisplay } from './socialMediaFormatter';

dotenv.config();

interface ManualWallet {
  address: string;
  name: string;
  description: string;
  winrate?: string;
  enabled: boolean;
}

interface ManualWalletsConfig {
  manualWallets: ManualWallet[];
  settings: {
    minPurchaseUsd: number;
    checkIntervalSeconds: number;
    enableQualifiedWallets: boolean;
    enableManualWallets: boolean;
    minWhalesForConsensus: number;
    // 📱 NEW: Social media settings
    enableSocialAnalysis?: boolean;
    socialAnalysisDelay?: number;
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

// Market Cap Data Interface (existing)
interface TokenMarketData {
  marketCap?: number;
  price?: number;
  volume24h?: number;
  priceChange24h?: number;
  fullyDilutedValuation?: number;
  holders?: number;
  liquidity?: number;
  source: string;
}

// 📱 NEW: Enhanced interfaces with social data
interface EnhancedTokenPurchase extends TokenPurchase {
  marketData?: TokenMarketData | null;
  socialData?: SocialMediaData | null;  // NEW: Social media data
  socialDisplay?: FormattedSocialDisplay | null;  // NEW: Formatted social display
}

interface EnhancedWhaleConsensus extends WhaleConsensus {
  marketData?: TokenMarketData | null;
  marketCapRisk?: string;
  liquidityRisk?: string;
  // 📱 NEW: Social consensus data
  socialData?: SocialMediaData | null;
  socialDisplay?: FormattedSocialDisplay | null;
  socialRiskLevel?: string;
  communityStrength?: number;
  overallRiskScore?: number;
}

// 🚀 REAL-TIME SOL PRICE SERVICE (unchanged)
class RealTimeSolPriceService {
  private currentPrice: number = 200;
  private lastPriceUpdate: number = 0;
  private priceUpdateInterval: number = 30000;
  private isUpdating: boolean = false;

  private readonly PRICE_ENDPOINTS = [
    'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd',
    'https://api.binance.com/api/v3/ticker/price?symbol=SOLUSDT',
    'https://api.coinbase.com/v2/exchange-rates?currency=SOL',
    'https://api.kraken.com/0/public/Ticker?pair=SOLUSD'
  ];

  private priceAxios = axios.create({
    timeout: 3000,
    headers: {
      'User-Agent': 'WhaleBot/2.0',
      'Accept': 'application/json'
    }
  });

  constructor() {
    this.startPriceUpdates();
    this.updateSolPrice();
  }

  private startPriceUpdates(): void {
    setInterval(() => {
      this.updateSolPrice();
    }, this.priceUpdateInterval);
    
    logger.info('💰 Real-time SOL price service started - updating every 30s');
  }

  private async updateSolPrice(): Promise<void> {
    if (this.isUpdating) return;
    
    this.isUpdating = true;
    const now = Date.now();

    try {
      // Try CoinGecko first
      try {
        const response = await this.priceAxios.get(this.PRICE_ENDPOINTS[0]);
        if (response.data?.solana?.usd) {
          this.currentPrice = parseFloat(response.data.solana.usd);
          this.lastPriceUpdate = now;
          logger.info(`💰 SOL Price updated: $${this.currentPrice.toFixed(2)} (CoinGecko)`);
          this.isUpdating = false;
          return;
        }
      } catch (error) {
        logger.warn('💰 CoinGecko price fetch failed, trying Binance...');
      }

      // Try Binance
      try {
        const response = await this.priceAxios.get(this.PRICE_ENDPOINTS[1]);
        if (response.data?.price) {
          this.currentPrice = parseFloat(response.data.price);
          this.lastPriceUpdate = now;
          logger.info(`💰 SOL Price updated: $${this.currentPrice.toFixed(2)} (Binance)`);
          this.isUpdating = false;
          return;
        }
      } catch (error) {
        logger.warn('💰 Binance price fetch failed, trying Coinbase...');
      }

      // Try Coinbase
      try {
        const response = await this.priceAxios.get(this.PRICE_ENDPOINTS[2]);
        if (response.data?.data?.rates?.USD) {
          this.currentPrice = 1 / parseFloat(response.data.data.rates.USD);
          this.lastPriceUpdate = now;
          logger.info(`💰 SOL Price updated: $${this.currentPrice.toFixed(2)} (Coinbase)`);
          this.isUpdating = false;
          return;
        }
      } catch (error) {
        logger.warn('💰 Coinbase price fetch failed, trying Kraken...');
      }

      // Try Kraken
      try {
        const response = await this.priceAxios.get(this.PRICE_ENDPOINTS[3]);
        if (response.data?.result?.SOLUSD?.c?.[0]) {
          this.currentPrice = parseFloat(response.data.result.SOLUSD.c[0]);
          this.lastPriceUpdate = now;
          logger.info(`💰 SOL Price updated: $${this.currentPrice.toFixed(2)} (Kraken)`);
          this.isUpdating = false;
          return;
        }
      } catch (error) {
        logger.warn('💰 All price APIs failed, using cached price');
      }

    } catch (error) {
      logger.error('💰 Critical error updating SOL price:', error);
    }

    this.isUpdating = false;
  }

  getCurrentPrice(): number {
    const age = Date.now() - this.lastPriceUpdate;
    
    if (age > 300000) {
      this.updateSolPrice();
    }
    
    return this.currentPrice;
  }

  getPriceAge(): string {
    const age = Date.now() - this.lastPriceUpdate;
    const minutes = Math.floor(age / 60000);
    const seconds = Math.floor((age % 60000) / 1000);
    
    if (minutes === 0) return `${seconds}s ago`;
    return `${minutes}m ${seconds}s ago`;
  }

  async forceUpdate(): Promise<number> {
    this.isUpdating = false;
    await this.updateSolPrice();
    return this.currentPrice;
  }
}

// src/monitor-no-db.ts - ENHANCED WITH SOCIAL MEDIA (PART 2) 📱🤖📊
// 🤖📊📱 ENHANCED TELEGRAM BOT WITH SOCIAL MEDIA
class EnhancedTelegramBot {
  private config: any;
  private messageQueue: Array<{ message: string; priority: number }> = [];
  private isProcessingQueue: boolean = false;
  
  // 📱 NEW: Social media components
  private socialAnalyzer: SocialMediaAnalyzer;
  private socialFormatter: SocialMediaFormatter;

  constructor() {
    this.config = this.loadTelegramConfig();
    
    // 📱 NEW: Initialize social media components
    this.socialAnalyzer = new SocialMediaAnalyzer();
    this.socialFormatter = new SocialMediaFormatter();
    
    if (this.config.enabled) {
      logger.info('🤖📊📱 Enhanced Telegram Bot with Market Cap + Social Media initialized');
      this.testConnection();
      this.startMessageQueue();
    } else {
      logger.info('🤖 Telegram Bot disabled - Configure telegram.json to enable');
    }
  }

  private generateSafetyWarning(consensus: EnhancedWhaleConsensus): string {
  const warnings = [];
  
  // Market Cap Warning
  if (consensus.marketData?.marketCap && consensus.marketData.marketCap < 1000000) {
    warnings.push('⚠️ Very low market cap - high volatility risk');
  }
  
  // Liquidity Warning
  if (consensus.marketData?.liquidity && consensus.marketData.liquidity < 100000) {
    warnings.push('⚠️ Low liquidity - price manipulation risk');
  }
  
  // Social Warning
  if (consensus.socialData?.riskLevel === 'VERY_HIGH') {
    warnings.push('⚠️ No verified social presence - possible scam');
  }
  
  // Price Change Warning
  if (consensus.marketData?.priceChange24h && consensus.marketData.priceChange24h < -50) {
    warnings.push('⚠️ Massive price dump in last 24h');
  }
  
  // Combined Score Warning
  if (consensus.overallRiskScore && consensus.overallRiskScore < 30) {
    warnings.push('🚨 VERY HIGH RISK - Multiple red flags detected');
  }
  
  // Win Rate Warning
  // Add logic to check average win rate if available
  
  if (warnings.length === 0) {
    return '✅ No major risk flags detected';
  }
  
  return warnings.join('\n');
}

  private loadTelegramConfig(): any {
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
      logger.info('🤖📊📱 Testing Enhanced Telegram connection...');
      
      const response = await axios.get(`https://api.telegram.org/bot${this.config.botToken}/getMe`, {
        timeout: 3000,
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (response.data.ok) {
        logger.info(`🤖 Enhanced Telegram connected: @${response.data.result.username}`);
        await this.sendMessage('⚡ Enhanced Whale Bot connected!\n 🐋 Ready for enhanced whale alerts');
      }
      
    } catch (error) {
      logger.error('❌ Telegram connection failed - continuing without alerts');
    }
  }

  private startMessageQueue(): void {
    setInterval(() => {
      this.processMessageQueue();
    }, 1000);
  }

  private async processMessageQueue(): Promise<void> {
    if (this.isProcessingQueue || this.messageQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    try {
      this.messageQueue.sort((a, b) => b.priority - a.priority);
      
      const message = this.messageQueue.shift();
      if (message) {
        await this.sendMessageImmediate(message.message);
      }
    } catch (error) {
      logger.warn('❌ Message queue processing failed:', error);
    }

    this.isProcessingQueue = false;
  }

  private async sendMessageImmediate(text: string, parseMode: string = 'HTML'): Promise<boolean> {
    if (!this.config.enabled || !this.config.botToken || !this.config.chatId) {
      return false;
    }

    try {
      const response = await axios.post(`https://api.telegram.org/bot${this.config.botToken}/sendMessage`, {
        chat_id: this.config.chatId,
        text: text,
        parse_mode: parseMode,
        disable_web_page_preview: true
      }, {
        timeout: 2000,
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.data.ok) {
        logger.info('📱⚡📊 Enhanced Telegram message sent');
        return true;
      }
      
      return false;
      
    } catch (error: any) {
      logger.warn('❌ Enhanced Telegram send failed');
      return false;
    }
  }

  private async sendMessage(text: string): Promise<boolean> {
    return this.sendMessageImmediate(text);
  }

  queueMessage(message: string, priority: number = 1): void {
    this.messageQueue.push({ message, priority });
    
    if (priority >= 10) {
      setTimeout(() => this.processMessageQueue(), 100);
    }
  }

  // 📊 Format large numbers for display (existing function)
  private formatNumber(num: number): string {
    if (num >= 1000000000) {
      return (num / 1000000000).toFixed(2) + 'B';
    }
    if (num >= 1000000) {
      return (num / 1000000).toFixed(2) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(2) + 'K';
    }
    return num.toFixed(2);
  }

  // 📊 Calculate market cap risk level (existing function)
  private calculateMarketCapRisk(marketCap: number): string {
    if (marketCap >= 1000000) return 'VERY LOW';
    if (marketCap >= 100000) return 'LOW';
    if (marketCap >= 10000) return 'MEDIUM';
    if (marketCap >= 1000) return 'HIGH';
    return 'VERY HIGH';
  }

  // 📊 Calculate liquidity risk level (existing function)
  private calculateLiquidityRisk(liquidity: number): string {
    if (liquidity >= 1000000) return 'VERY LOW';
    if (liquidity >= 500000) return 'LOW';
    if (liquidity >= 50000) return 'MEDIUM';
    if (liquidity >= 10000) return 'HIGH';
    return 'VERY HIGH';
  }

  // 🏆📱 ENHANCED: Individual purchase alert with simple win rate + social media
  async sendEnhancedIndividualAlertWithSocialAndWinRate(
  purchase: EnhancedTokenPurchase,
  solPrice: number,
  winRate: string
): Promise<void> {
  if (!this.config.enabled || !this.config.sendIndividualAlerts) {
    return;
  }

  const walletLabel = purchase.walletName || `#${purchase.walletAddress.substring(0, 3)}`;
  const md = purchase.marketData;
  
  // Build compact market info
  let marketInfo = '';
  if (md?.price) {
    marketInfo += `💰 $${md.price.toFixed(8)}`;
  }
  if (md?.marketCap) {
    const mcFormatted = this.formatNumber(md.marketCap);
    const mcRisk = this.calculateMarketCapRisk(md.marketCap);
    marketInfo += ` | 📊 MC: $${mcFormatted} (${mcRisk} Risk)`;
  }
  // if (md?.volume24h) {
  //   marketInfo += ` | 📈 Vol: $${this.formatNumber(md.volume24h)}`;
  // }
  // if (md?.priceChange24h !== undefined) {
  //   const changeEmoji = md.priceChange24h >= 0 ? '📈' : '📉';
  //   marketInfo += ` | ${changeEmoji} ${md.priceChange24h.toFixed(1)}%`;
  // }

  // Build compact social info
  let socialInfo = '';
  if (purchase.socialData) {
    const stars = '⭐'.repeat(Math.floor(purchase.socialData.socialRating));
    const riskColor = purchase.socialData.riskLevel === 'LOW' ? '🟢' : 
                     purchase.socialData.riskLevel === 'MEDIUM' ? '🟡' : 
                     purchase.socialData.riskLevel === 'HIGH' ? '🟠' : '🔴';
    
    socialInfo = `📱 Social: ${purchase.socialData.socialRating}/5 ${stars} (${riskColor} ${purchase.socialData.riskLevel} Risk)`;
    
    // Add platform icons
    if (purchase.socialData.activePlatforms.length > 0) {
      const platforms = purchase.socialData.activePlatforms.map(p => {
        if (p === 'Twitter') return purchase.socialData?.twitter?.verified ? '🐦✅' : '🐦';
        if (p === 'Telegram') return '📱';
        return '🌐';
      }).join(' ');
      socialInfo += ` | ${platforms}`;
    } else {
      socialInfo += ' | ❌ No Presence';
    }
  } else {
    socialInfo = '📱 Social: Analyzing...';
  }

  const message = `
🚨 <b>WHALE PURCHASE ALERT</b> 🚨

🐋 <b>Whale:</b> ${walletLabel} | <b>Win Rate:</b> ${winRate}
🪙 <b>Token:</b> ${purchase.tokenName || purchase.tokenSymbol || 'Unknown'}
💰 <b>Bought:</b> ${purchase.amountSol.toFixed(2)} SOL (~$${purchase.amountUsd.toFixed(0)})
🕐 <b>Time:</b> ${purchase.timestamp.toLocaleTimeString()}

📊 <b>MARKET:</b>
${marketInfo || 'Loading...'}

${socialInfo}

🔗 <a href="https://dexscreener.com/solana/${purchase.tokenMint}">Chart</a> | <a href="https://solscan.io/tx/${purchase.signature}">TX</a> | <a href="https://pump.fun/${purchase.tokenMint}">Pump</a>
  `.trim();

  this.queueMessage(message, 15);
}

  // 🚀📊📱 ENHANCED: Whale consensus alert with social media analysis
async sendEnhancedConsensusAlertWithSocialAndWinRates(
 consensus: EnhancedWhaleConsensus, 
  solPrice: number,
  manualWallets: ManualWallet[]
): Promise<void> {
  if (!this.config.enabled || !this.config.sendConsensusAlerts) {
    return;
  }

  if (consensus.totalWhales < this.config.minConsensusWhales) {
    return;
  }

  const md = consensus.marketData;

  // Build market info
  let marketInfo = '';
  if (md?.price) {
    marketInfo += `💰 $${md.price.toFixed(8)}`;
  }
  if (md?.marketCap) {
    const mcFormatted = this.formatNumber(md.marketCap);
    const mcRisk = this.calculateMarketCapRisk(md.marketCap);
    marketInfo += ` | 📊 MC: $${mcFormatted} (${mcRisk} Risk)`;
  }
  // if (md?.volume24h) {
  //   marketInfo += ` | 📈 Vol: $${this.formatNumber(md.volume24h)}`;
  // }
  // if (md?.liquidity) {
  //   const liqRisk = this.calculateLiquidityRisk(md);
  //   marketInfo += ` | 💧 Liq: $${this.formatNumber(md.liquidity)}`;
  // }

  // Build social info
  let socialInfo = '';
  if (consensus.socialData) {
    const stars = '⭐'.repeat(Math.floor(consensus.socialData.socialRating));
    const riskColors = {
      'LOW': '🟢', 'MEDIUM': '🟡', 'HIGH': '🟠', 'VERY_HIGH': '🔴'
    };
    const riskColor = riskColors[consensus.socialData.riskLevel];
    
    socialInfo = `📱 Rating: ${consensus.socialData.socialRating}/5 ${stars} | Community: ${consensus.socialData.overall.totalFollowers > 0 ? this.formatNumber(consensus.socialData.overall.totalFollowers) : '0'} | Social Risk: ${riskColor} ${consensus.socialData.riskLevel}`;
  } else {
    socialInfo = '📱 Social: Analyzing...';
  }

  // Build whale list with win rates
  let whaleList = '';
  consensus.whales.forEach((whale, index) => {
    const walletLabel = whale.walletName || `#${whale.walletAddress.substring(0, 3)}`;
    const manualWallet = manualWallets.find(w => w.address === whale.walletAddress);
    const winRate = manualWallet?.winrate || 'N/A';
    
    whaleList += `${index + 1}. 🐋 <b>${walletLabel}</b> - $${whale.amountUsd.toFixed(0)} | 🏆 ${winRate}\n`;
  });

  // Calculate average win rate
  let avgWinRateInfo = '';
  const validWinRates = consensus.whales
    .map(whale => {
      const manualWallet = manualWallets.find(w => w.address === whale.walletAddress);
      const winRate = manualWallet?.winrate;
      return winRate?.includes('%') ? parseFloat(winRate.replace('%', '')) : null;
    })
    .filter(rate => rate !== null) as number[];

  if (validWinRates.length > 0) {
    const avgWinRate = validWinRates.reduce((sum, rate) => sum + rate, 0) / validWinRates.length;
    const qualityEmoji = avgWinRate >= 75 ? '🏆' : avgWinRate >= 65 ? '🥇' : avgWinRate >= 50 ? '🥈' : '🥉';
    avgWinRateInfo = `🏆 <b>Quality:</b> ${qualityEmoji} ${avgWinRate.toFixed(1)}% avg (${validWinRates.length}/${consensus.totalWhales} whales)`;
  }

  // Risk assessment
  let riskAssessment = '';
  const risks = [];
  if (md?.marketCap && md.marketCap < 1000000) risks.push('Low MC');
  if (md?.liquidity && md.liquidity < 100000) risks.push('Low Liq');
  if (consensus.socialData?.riskLevel === 'VERY_HIGH') risks.push('No Social');
  if (md?.priceChange24h && md.priceChange24h < -50) risks.push('Price Dump');

  if (risks.length > 0) {
    riskAssessment = `⚠️ <b>Risks:</b> ${risks.join(', ')}`;
  } else {
    riskAssessment = '✅ <b>Risk Check:</b> No major flags';
  }

  const message = `
🐋 <b>WHALE CONSENSUS ALERT!</b> 🚨
<b>${consensus.totalWhales} WHALES BUYING SAME TOKEN</b>

🪙 <b>Token:</b> ${consensus.tokenName} (${consensus.tokenSymbol})
💰 <b>Total:</b> ${consensus.totalAmountSol.toFixed(2)} SOL (~$${consensus.totalAmountUsd.toFixed(0)}) | <b>Avg:</b> $${(consensus.totalAmountUsd / consensus.totalWhales).toFixed(0)}

📊 <b>MARKET:</b>
${marketInfo || 'Loading...'}

${socialInfo}

${avgWinRateInfo}

${riskAssessment}

🐋 <b>Whales:</b>
${whaleList}

🔗 <a href="https://dexscreener.com/solana/${consensus.tokenMint}">Chart</a> | <a href="https://pump.fun/${consensus.tokenMint}">Pump</a> | <a href="https://solscan.io/token/${consensus.tokenMint}">Token</a>
  `.trim();

  this.queueMessage(message, 25);
}

// 📱 ULTRA COMPACT ALERT (Even shorter option)
async sendUltraCompactAlert(
  purchase: EnhancedTokenPurchase,
  solPrice: number,
  winRate: string
): Promise<void> {
  if (!this.config.enabled || !this.config.sendIndividualAlerts) {
    return;
  }

  const walletLabel = purchase.walletName || `#${purchase.walletAddress.substring(0, 3)}`;
  const md = purchase.marketData;
  
  // Ultra compact format
  let marketData = '';
  if (md?.marketCap) {
    const risk = this.calculateMarketCapRisk(md.marketCap);
    const riskEmoji = risk === 'VERY_LOW' ? '🟢' : risk === 'LOW' ? '🟡' : risk === 'MEDIUM' ? '🟠' : '🔴';
    marketData = `${riskEmoji} MC: $${this.formatNumber(md.marketCap)}`;
  }

  let socialData = '';
  if (purchase.socialData) {
    const riskColor = purchase.socialData.riskLevel === 'LOW' ? '🟢' : 
                     purchase.socialData.riskLevel === 'MEDIUM' ? '🟡' : 
                     purchase.socialData.riskLevel === 'HIGH' ? '🟠' : '🔴';
    socialData = `${riskColor} Social: ${purchase.socialData.socialRating}/5`;
  }

  const message = `
🚨 <b>WHALE BUY</b> 🚨
🐋 ${walletLabel} | 🏆 ${winRate}
🪙 ${purchase.tokenSymbol || 'Token'}: $${purchase.amountUsd.toFixed(0)}
📊 ${marketData} | 📱 ${socialData}
🔗 <a href="https://dexscreener.com/solana/${purchase.tokenMint}">Chart</a>
  `.trim();

  this.queueMessage(message, 15);
}


  // 📊 Calculate overall risk (existing function)
  private calculateOverallRisk(marketData: TokenMarketData): string {
    const risks = [];
    
    if (marketData.marketCap) {
      risks.push(this.calculateMarketCapRisk(marketData.marketCap));
    }
    
    if (marketData.liquidity) {
      risks.push(this.calculateLiquidityRisk(marketData.liquidity));
    }
    
    const highRiskCount = risks.filter(r => r === 'HIGH' || r === 'VERY HIGH').length;
    
    if (highRiskCount >= 2) return 'VERY HIGH';
    if (highRiskCount >= 1) return 'HIGH';
    if (risks.includes('MEDIUM')) return 'MEDIUM';
    if (risks.includes('LOW')) return 'LOW';
    return 'VERY LOW';
  }

  // 📊 Calculate risk score (existing function)
  private calculateRiskScore(consensus: WhaleConsensus | EnhancedWhaleConsensus): { level: string; score: number } {
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
    
    // Enhanced scoring for market data
    if ('marketData' in consensus && consensus.marketData) {
      const md = consensus.marketData;
      if (md.marketCap && md.marketCap >= 10000000) score += 10;
      if (md.liquidity && md.liquidity >= 100000) score += 10;
      if (md.volume24h && md.volume24h >= 100000) score += 5;
    }
    
    let level = 'LOW';
    if (score >= 90) level = 'EXTREME';
    else if (score >= 80) level = 'VERY HIGH';
    else if (score >= 60) level = 'HIGH';
    else if (score >= 40) level = 'MEDIUM';
    
    return { level, score };
  }

  // 📈 Generate trading signal (existing function)
  private generateEnhancedTradingSignal(consensus: EnhancedWhaleConsensus): { type: string; confidence: number } {
  let confidence = 30; // Start lower for safety
  let riskPenalties = 0;
  
  // Whale count impact
  confidence += consensus.totalWhales * 8;
  
  // Amount impact
  const avgAmount = consensus.totalAmountUsd / consensus.totalWhales;
  if (avgAmount >= 2000) confidence += 20;
  else if (avgAmount >= 1000) confidence += 10;
  
  // Market data penalties
  if (consensus.marketData) {
    const md = consensus.marketData;
    
    if (md.marketCap && md.marketCap < 100000) {
      confidence -= 15;
      riskPenalties += 15;
    }
    
    if (md.liquidity && md.liquidity < 50000) {
      confidence -= 20;
      riskPenalties += 20;
    }
    
    if (md.priceChange24h && md.priceChange24h < -50) {
      confidence -= 25;
      riskPenalties += 25;
    }
  }
  
  // Social media penalties
  if (consensus.socialData?.riskLevel === 'VERY_HIGH') {
    confidence -= 15;
    riskPenalties += 15;
  }
  
  // Overall risk score override
  if (consensus.overallRiskScore && consensus.overallRiskScore < 30) {
    confidence -= 25;
    riskPenalties += 25;
  }
  
  // Safety caps
  confidence = Math.max(5, Math.min(95, confidence));
  
  // Critical risk override
  if (riskPenalties >= 40) {
    confidence = Math.min(confidence, 30);
  }
  
  // Determine signal type
  let signalType = 'AVOID';
  if (confidence >= 75) signalType = 'BUY';
  else if (confidence >= 65) signalType = 'WEAK BUY';
  else if (confidence >= 50) signalType = 'NEUTRAL';
  else if (confidence >= 35) signalType = 'CAUTION';
  else if (confidence >= 20) signalType = 'HIGH RISK';
  
  return { type: signalType, confidence: Math.round(confidence) };
}

  // ⏰ Format time difference (existing function)
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

  // 🧪 Test message (updated)
  async sendTestMessage(): Promise<void> {
    if (!this.config.enabled) {
      logger.warn('🤖 Telegram bot disabled');
      return;
    }

    const testMessage = `
🧪📊📱 <b>ENHANCED TELEGRAM BOT TEST</b> 🤖⚡📊📱

✅ Bot is working at maximum speed!
📱 Connected to group
💰 Real-time SOL price: ACTIVE
📊 Market Cap data: ENABLED
📱 Social Media Analysis: ENABLED
🐋 Ready for enhanced whale alerts with social verification
⚡ Ultra fast monitoring active

📱 <b>NEW SOCIAL FEATURES:</b>
🐦 Twitter account verification
📱 Telegram community analysis
⭐ Social rating system (1-5 stars)
🚨 Social risk assessment
👥 Community engagement tracking

<i>Test message from Enhanced Whale Bot with Social Media</i>
    `.trim();

    this.queueMessage(testMessage, 5);
  }

  getBotStatus(): { enabled: boolean; configured: boolean } {
    return {
      enabled: this.config.enabled,
      configured: !!(this.config.botToken && this.config.chatId)
    };
  }

  // 📱 NEW: Get social analyzer
  getSocialAnalyzer(): SocialMediaAnalyzer {
    return this.socialAnalyzer;
  }

  // 📱 NEW: Get social formatter
  getSocialFormatter(): SocialMediaFormatter {
    return this.socialFormatter;
  }
}

// src/monitor-no-db.ts - ENHANCED WITH SOCIAL MEDIA (PART 3A) 📱🐋🔍
// 🚀📊📱 ENHANCED ULTRA FAST NO-DB WHALE MONITOR WITH SOCIAL MEDIA
class EnhancedUltraFastWhaleMonitor {
  private isMonitoring: boolean = false;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private manualWallets: ManualWallet[] = [];
  private lastCheckedTimes: Map<string, number> = new Map();
  private CHECK_INTERVAL = 10000; // Ultra fast 10 seconds
  private MIN_PURCHASE_USD = 50;
  private MIN_WHALES_FOR_CONSENSUS = 2;
  private readonly MANUAL_WALLETS_FILE = 'manualWallets.json';
  
  private recentWhalePurchases: Map<string, EnhancedTokenPurchase[]> = new Map();
  private consensusTimeWindow = 30 * 60 * 1000; // 30 minutes
  private alertedConsensus: Set<string> = new Set();
  private tokenInfoCache: Map<string, { symbol: string; name: string; expires: number }> = new Map();

  // 📊 Market Cap Cache (existing)
  private marketCapCache: Map<string, { data: TokenMarketData; expires: number }> = new Map();

  // 📱 NEW: Social media components
  private socialAnalyzer: SocialMediaAnalyzer;
  private socialFormatter: SocialMediaFormatter;
  private enableSocialAnalysis: boolean = true;
  private socialAnalysisDelay: number = 2000; // 2 second delay
  private socialAnalysisCache: Map<string, { data: SocialMediaData; expires: number }> = new Map();

  private telegramBot: EnhancedTelegramBot;
  private solPriceService: RealTimeSolPriceService;

  // Ultra fast RPC endpoints optimized for speed (existing)
  private readonly ULTRA_FAST_RPC_ENDPOINTS = [
    'https://mainnet.helius-rpc.com/?api-key=46dd6d27-c247-40fd-b360-1db6c7344442',
    'https://solana-mainnet.rpc.quiknode.pro/',
    'https://rpc.ankr.com/solana',
    'https://api.mainnet-beta.solana.com'
  ];

  private ultraAxios = axios.create({
    timeout: 3000,
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'EnhancedUltraFastWhaleBot/4.0',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive'
    },
    maxRedirects: 0,
    validateStatus: (status) => status < 500
  });

  constructor() {
    this.setupEnhancedUltraFastMode();
    this.solPriceService = new RealTimeSolPriceService();
    this.telegramBot = new EnhancedTelegramBot();
    
    // 📱 NEW: Initialize social media components
    this.socialAnalyzer = this.telegramBot.getSocialAnalyzer();
    this.socialFormatter = this.telegramBot.getSocialFormatter();
    
    logger.info('🚀📱🔍 Enhanced Ultra Fast Whale Monitor with Social Media initialized');
  }

  private setupEnhancedUltraFastMode(): void {
    // Ultra optimized HTTP agent (existing)
    this.ultraAxios.defaults.httpsAgent = new (require('https').Agent)({
      keepAlive: true,
      maxSockets: 60,
      maxFreeSockets: 30,
      timeout: 3000,
      freeSocketTimeout: 1000
    });
    
    logger.info('🚀⚡💰📊📱 ENHANCED ULTRA FAST MODE + MARKET CAP + SOCIAL MEDIA ACTIVATED!');
  }

  async startMonitoring(): Promise<void> {
    if (this.isMonitoring) {
      logger.warn('⚠️ Enhanced ultra fast monitoring is already running');
      return;
    }

    logger.info('🚀⚡💰📊📱 Starting ENHANCED ULTRA FAST WHALE MONITOR WITH SOCIAL MEDIA...');
    
    try {
      await this.loadManualWallets();
      
      if (this.manualWallets.length === 0) {
        await this.createDefaultWalletConfig();
        logger.warn('❌ No manual wallets configured. Created default config.');
        console.log('\n🔧 PLEASE ADD WALLETS TO manualWallets.json AND RESTART!');
        return;
      }

      const telegramStatus = this.getTelegramStatus();
      const currentSolPrice = this.solPriceService.getCurrentPrice();

      this.isMonitoring = true;
      
      // Start monitoring from 3 minutes ago for ultra fast detection
      const threeMinutesAgo = Date.now() - (3 * 60 * 1000);
      this.manualWallets.forEach(wallet => {
        this.lastCheckedTimes.set(wallet.address, Math.floor(threeMinutesAgo / 1000));
      });

      logger.info(`🚀⚡💰📊📱 ENHANCED: Monitoring ${this.manualWallets.length} wallets with Market Cap + Social Media`);
      logger.info(`💰 Real-time SOL Price: $${currentSolPrice.toFixed(2)}`);
      logger.info(`📱 Social Media Analysis: ${this.enableSocialAnalysis ? 'ENABLED' : 'DISABLED'}`);
      this.displayEnhancedStatus();

      // Ultra fast monitoring interval
      this.monitoringInterval = setInterval(async () => {
        logger.info(`⚡💰📊📱 ENHANCED cycle with SOL: $${this.solPriceService.getCurrentPrice().toFixed(2)} + Market + Social`);
        await this.enhancedUltraFastDetectConsensus();
      }, this.CHECK_INTERVAL);

      // Start immediately
      setTimeout(() => {
        logger.info(`🚀⚡📊📱 Starting immediate enhanced detection with market + social...`);
        this.enhancedUltraFastDetectConsensus();
      }, 1000);

    } catch (error) {
      logger.error('❌ Failed to start enhanced ultra fast monitoring:', error);
      throw error;
    }
  }

  async stopMonitoring(): Promise<void> {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.isMonitoring = false;
    logger.info('🛑 Enhanced ultra fast monitoring stopped');
  }

  private async loadManualWallets(): Promise<void> {
    try {
      const configPath = path.join(process.cwd(), this.MANUAL_WALLETS_FILE);
      
      if (!fs.existsSync(configPath)) {
        await this.createDefaultWalletConfig();
        return;
      }
      
      const configData = fs.readFileSync(configPath, 'utf8');
      const config: ManualWalletsConfig = JSON.parse(configData);
      
      this.MIN_PURCHASE_USD = config.settings.minPurchaseUsd;
      this.CHECK_INTERVAL = Math.max(config.settings.checkIntervalSeconds * 1000, 10000);
      this.MIN_WHALES_FOR_CONSENSUS = config.settings.minWhalesForConsensus || 2;
      
      // 📱 NEW: Load social settings
      if (config.settings.enableSocialAnalysis !== undefined) {
        this.enableSocialAnalysis = config.settings.enableSocialAnalysis;
      }
      if (config.settings.socialAnalysisDelay !== undefined) {
        this.socialAnalysisDelay = config.settings.socialAnalysisDelay;
      }
      
      this.manualWallets = config.manualWallets.filter(w => w.enabled);
      
      logger.info(`🐋📊📱 ENHANCED: Loaded ${this.manualWallets.length} wallets with social analysis: ${this.enableSocialAnalysis}`);
      
    } catch (error) {
      logger.error('❌ Failed to load manual wallets:', error);
      this.manualWallets = [];
    }
  }

  private async createDefaultWalletConfig(): Promise<void> {
    const defaultConfig: ManualWalletsConfig = {
      manualWallets: [
        {
          address: "ZnyMYb3XdLnRnpgXoFiorQB1TVFaqVCLXLha1WNGCBS",
          name: "ENHANCED WHALE",
          description: "Enhanced test whale with market cap + social data",
          enabled: true
        }
      ],
      settings: {
        minPurchaseUsd: 50,
        checkIntervalSeconds: 10,
        enableQualifiedWallets: false,
        enableManualWallets: true,
        minWhalesForConsensus: 2,
        // 📱 NEW: Social media settings
        enableSocialAnalysis: true,
        socialAnalysisDelay: 2000
      }
    };
    
    const configPath = path.join(process.cwd(), this.MANUAL_WALLETS_FILE);
    fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
    logger.info(`📝📊📱 Created enhanced ${this.MANUAL_WALLETS_FILE} with social media settings`);
  }

  private displayEnhancedStatus(): void {
    const telegramStatus = this.getTelegramStatus();
    const currentSolPrice = this.solPriceService.getCurrentPrice();
    const priceAge = this.solPriceService.getPriceAge();
    
    console.log('\n' + '🚀⚡💰📊📱🐋'.repeat(18));
    console.log('🚀⚡📊📱 ENHANCED WHALE MONITOR + MARKET CAP + SOCIAL MEDIA 📱📊⚡🚀');
    console.log('🚀⚡💰📊📱🐋'.repeat(18));
    console.log(`💰 Real-time SOL Price: $${currentSolPrice.toFixed(2)} (${priceAge})`);
    console.log(`📊 Market Cap Data: ENABLED (15min cache)`);
    console.log(`📱 Social Media Analysis: ${this.enableSocialAnalysis ? 'ENABLED' : 'DISABLED'}`);
    console.log(`🐋 Manual Wallets: ${this.manualWallets.length}`);
    console.log(`💰 Min Purchase Alert: $${this.MIN_PURCHASE_USD}`);
    console.log(`🐋 Min Whales for Consensus: ${this.MIN_WHALES_FOR_CONSENSUS} whales`);
    console.log(`⚡ ENHANCED Interval: ${this.CHECK_INTERVAL / 1000}s`);
    console.log(`🕐 Consensus Window: ${this.consensusTimeWindow / 60000} minutes`);
    console.log(`🤖 Telegram Bot: ${telegramStatus.enabled ? '✅ ENABLED' : '❌ DISABLED'}`);
    console.log(`📱 Telegram Configured: ${telegramStatus.configured ? '✅ YES' : '❌ NO'}`);
    
    if (this.enableSocialAnalysis) {
      console.log(`📱 Social Analysis Delay: ${this.socialAnalysisDelay}ms`);
      console.log(`📱 Social Cache: 30 minutes`);
    }
    
    console.log(`🚨 STATUS: ENHANCED + MARKET + SOCIAL + REAL-TIME SOL!`);
    console.log('🚀⚡💰📊📱🐋'.repeat(18));
    
    console.log('📍 ENHANCED MONITORING WALLETS:');
    this.manualWallets.forEach(wallet => {
      console.log(`   🚀📊📱 ${wallet.name}: ${wallet.address.substring(0, 12)}...`);
    });
    console.log('🚀⚡💰📊📱🐋'.repeat(18));
    
    console.log('⚡💰📊📱 ENHANCED + MARKET + SOCIAL: Ultra fast whale detection with complete verification...');
    console.log('');
  }

  // 🚀📊📱 ENHANCED: Get comprehensive market data for token (existing function)
  private async getTokenMarketData(tokenMint: string): Promise<TokenMarketData | null> {
    // Check cache first (15 minute expiry for market data)
    const cached = this.marketCapCache.get(tokenMint);
    if (cached && cached.expires > Date.now()) {
      return cached.data;
    }

    logger.info(`📊 Fetching market data for ${tokenMint.substring(0, 8)}...`);

    // Try multiple APIs for comprehensive market data (existing)
    const marketApis = [
      {
        name: 'DexScreener',
        fetcher: async () => this.getMarketDataFromDexScreener(tokenMint)
      },
      {
        name: 'CoinGecko',
        fetcher: async () => this.getMarketDataFromCoinGecko(tokenMint)
      },
      {
        name: 'Birdeye',
        fetcher: async () => this.getMarketDataFromBirdeye(tokenMint)
      },
      {
        name: 'Jupiter',
        fetcher: async () => this.getMarketDataFromJupiter(tokenMint)
      }
    ];

    for (const api of marketApis) {
      try {
        logger.info(`   📊 Trying ${api.name} for market data...`);
        const marketData = await api.fetcher();
        
        if (marketData && (marketData.marketCap || marketData.price)) {
          logger.info(`✅📊 Market data from ${api.name}: MC: ${marketData.marketCap ? '$' + this.formatNumber(marketData.marketCap) : 'N/A'}`);
          
          // Cache the result for 15 minutes
          this.marketCapCache.set(tokenMint, {
            data: marketData,
            expires: Date.now() + (15 * 60 * 1000)
          });
          
          return marketData;
        }
      } catch (error) {
        logger.warn(`   ❌ ${api.name} market data failed:`, error);
        continue;
      }
    }

    logger.warn(`❌📊 No market data found for ${tokenMint.substring(0, 8)}...`);
    return null;
  }

  // 📱 NEW: Get social media data with caching
  private async getSocialMediaData(tokenMint: string, tokenSymbol?: string): Promise<SocialMediaData | null> {
    // Check cache first (30 minute expiry for social data)
    const cached = this.socialAnalysisCache.get(tokenMint);
    if (cached && cached.expires > Date.now()) {
      logger.info(`📱💾 Using cached social data for ${tokenSymbol || tokenMint.substring(0, 8)}`);
      return cached.data;
    }

    if (!this.enableSocialAnalysis) {
      logger.info(`📱❌ Social analysis disabled for ${tokenSymbol || tokenMint.substring(0, 8)}`);
      return null;
    }

    logger.info(`📱🔍 Analyzing social media for ${tokenSymbol || tokenMint.substring(0, 8)}...`);

    try {
      // Add delay to prevent rate limiting
      await new Promise(resolve => setTimeout(resolve, this.socialAnalysisDelay));
      
      const socialData = await this.socialAnalyzer.analyzeSocialMedia(tokenMint, tokenSymbol);
      
      if (socialData) {
        // Cache the result for 30 minutes
        this.socialAnalysisCache.set(tokenMint, {
          data: socialData,
          expires: Date.now() + (30 * 60 * 1000)
        });
        
        logger.info(`✅📱 Social analysis complete: ${socialData.socialRating}/5 stars, ${socialData.riskLevel} risk`);
        return socialData;
      }
      
      logger.warn(`❌📱 No social data found for ${tokenSymbol || tokenMint.substring(0, 8)}`);
      return null;
      
    } catch (error) {
      logger.warn(`❌📱 Social analysis failed for ${tokenSymbol || tokenMint.substring(0, 8)}:`, error);
      return null;
    }
  }

  // 📊 Get market data from DexScreener (existing function)
  private async getMarketDataFromDexScreener(tokenMint: string): Promise<TokenMarketData | null> {
    try {
      const response = await axios.get(`https://api.dexscreener.com/latest/dex/tokens/${tokenMint}`, {
        timeout: 5000,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'EnhancedUltraFastWhaleBot/4.0'
        }
      });

      if (response.data?.pairs && response.data.pairs.length > 0) {
        // Find the pair with highest liquidity
        const bestPair = response.data.pairs.sort((a: any, b: any) => {
          const aLiq = parseFloat(a.liquidity?.usd || '0');
          const bLiq = parseFloat(b.liquidity?.usd || '0');
          return bLiq - aLiq;
        })[0];

        if (bestPair) {
          return {
            marketCap: parseFloat(bestPair.marketCap || '0') || undefined,
            price: parseFloat(bestPair.priceUsd || '0') || undefined,
            volume24h: parseFloat(bestPair.volume?.h24 || '0') || undefined,
            priceChange24h: parseFloat(bestPair.priceChange?.h24 || '0') || undefined,
            fullyDilutedValuation: parseFloat(bestPair.fdv || '0') || undefined,
            liquidity: parseFloat(bestPair.liquidity?.usd || '0') || undefined,
            source: 'DexScreener'
          };
        }
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  // 📊 Get market data from CoinGecko (existing function)
  private async getMarketDataFromCoinGecko(tokenMint: string): Promise<TokenMarketData | null> {
    try {
      const response = await axios.get(`https://api.coingecko.com/api/v3/coins/solana/contract/${tokenMint}`, {
        timeout: 5000,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'EnhancedUltraFastWhaleBot/4.0'
        }
      });

      if (response.data && response.data.market_data) {
        const data = response.data.market_data;
        return {
          marketCap: data.market_cap?.usd || undefined,
          price: data.current_price?.usd || undefined,
          volume24h: data.total_volume?.usd || undefined,
          priceChange24h: data.price_change_percentage_24h || undefined,
          fullyDilutedValuation: data.fully_diluted_valuation?.usd || undefined,
          source: 'CoinGecko'
        };
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  // 📊 Get market data from Birdeye (existing function)
  private async getMarketDataFromBirdeye(tokenMint: string): Promise<TokenMarketData | null> {
    try {
      const response = await axios.get(`https://public-api.birdeye.so/defi/token_overview?address=${tokenMint}`, {
        timeout: 5000,
        headers: {
          'Accept': 'application/json',
          'X-API-KEY': 'public',
          'User-Agent': 'EnhancedUltraFastWhaleBot/4.0'
        }
      });

      if (response.data?.data) {
        const data = response.data.data;
        return {
          marketCap: data.mc || undefined,
          price: data.price || undefined,
          volume24h: data.v24hUSD || undefined,
          priceChange24h: data.price24hChangePercent || undefined,
          liquidity: data.liquidity || undefined,
          source: 'Birdeye'
        };
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  // 📊 Get market data from Jupiter (existing function)
  private async getMarketDataFromJupiter(tokenMint: string): Promise<TokenMarketData | null> {
    try {
      const response = await axios.get(`https://price.jup.ag/v4/price?ids=${tokenMint}`, {
        timeout: 5000,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'EnhancedUltraFastWhaleBot/4.0'
        }
      });

      if (response.data?.data && response.data.data[tokenMint]) {
        const data = response.data.data[tokenMint];
        return {
          price: data.price || undefined,
          source: 'Jupiter'
        };
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  // 📊 Calculate market cap risk (existing function)
  private calculateMarketCapRisk(marketData: TokenMarketData | null): string {
    if (!marketData || !marketData.marketCap) return 'UNKNOWN';
      
    const mc = marketData.marketCap;
    
    if (mc >= 1000000000) return 'VERY LOW';
    if (mc >= 100000000) return 'LOW';
    if (mc >= 10000000) return 'MEDIUM';
    if (mc >= 1000000) return 'HIGH';
    return 'VERY HIGH';
  }

  // 📊 Calculate liquidity risk (existing function)
  private calculateLiquidityRisk(marketData: TokenMarketData): string {
    if (!marketData.liquidity) return 'UNKNOWN';
    
    const liq = marketData.liquidity;
    
    if (liq >= 1000000) return 'VERY LOW';
    if (liq >= 500000) return 'LOW';
    if (liq >= 100000) return 'MEDIUM';
    if (liq >= 50000) return 'HIGH';
    return 'VERY HIGH';
  }

  // 📊 Format large numbers (existing function)
  private formatNumber(num: number): string {
    if (num >= 1000000000) {
      return (num / 1000000000).toFixed(2) + 'B';
    }
    if (num >= 1000000) {
      return (num / 1000000).toFixed(2) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(2) + 'K';
    }
    return num.toFixed(2);
  }

  // src/monitor-no-db.ts - ENHANCED WITH SOCIAL MEDIA (PART 3B) 📱🐋🔍
// Continuation of EnhancedUltraFastWhaleMonitor class...

  private async enhancedUltraFastDetectConsensus(): Promise<void> {
    const startTime = Date.now();
    let successfulChecks = 0;
    let totalPurchasesFound = 0;
    const currentSolPrice = this.solPriceService.getCurrentPrice();

    logger.info(`⚡💰📊📱 ENHANCED: Checking ${this.manualWallets.length} wallets with SOL: ${currentSolPrice.toFixed(2)} + Market + Social`);

    try {
      // Enhanced parallel processing
      const walletPromises = this.manualWallets.map(async (wallet, index) => {
        try {
          logger.info(`⚡📊📱 [${index + 1}/${this.manualWallets.length}] ENHANCED: ${wallet.name}`);
          
          const purchases = await this.enhancedUltraFastCheckWallet(wallet.address, wallet.name, currentSolPrice);
          
          if (purchases.length > 0) {
            this.addEnhancedPurchasesToConsensusTracking(purchases);
            
            // Immediate consensus check for ultra fast response
            setTimeout(() => this.instantEnhancedConsensusCheck(currentSolPrice), 50);
            
            logger.info(`🎯📊📱 ENHANCED: Found ${purchases.length} purchases from ${wallet.name}`);
            return { success: true, purchases: purchases.length };
          }
          
          return { success: true, purchases: 0 };
          
        } catch (error) {
          logger.warn(`⚠️📊📱 ENHANCED: Failed ${wallet.name}: ${error}`);
          return { success: false, purchases: 0 };
        }
      });

      const results = await Promise.all(walletPromises);
      
      results.forEach(result => {
        if (result.success) {
          successfulChecks++;
          totalPurchasesFound += result.purchases;
        }
      });

      await this.analyzeEnhancedWhaleConsensus(currentSolPrice);

      const endTime = Date.now();
      const totalTime = (endTime - startTime) / 1000;

      logger.info(`⚡💰📊📱 ENHANCED cycle complete in ${totalTime.toFixed(2)}s: ${successfulChecks} successful`);
      logger.info(`🚨📊📱 ENHANCED: ${totalPurchasesFound} purchases tracked with SOL: ${currentSolPrice.toFixed(2)} + Market + Social`);

    } catch (error) {
      logger.error('❌📊📱 Enhanced consensus detection failed:', error);
    }
  }

  private async enhancedUltraFastCheckWallet(walletAddress: string, walletName: string, currentSolPrice: number): Promise<EnhancedTokenPurchase[]> {
    try {
      const lastChecked = this.lastCheckedTimes.get(walletAddress) || Math.floor(Date.now() / 1000) - 180;
      
      const signatures = await this.ultraFastGetSignatures(walletAddress);
      
      if (!signatures || signatures.length === 0) {
        return [];
      }

      const purchases: EnhancedTokenPurchase[] = [];
      let latestTimestamp = lastChecked;

      // Ultra fast filtering - only recent transactions
      const recentSignatures = signatures.slice(0, 15).filter((sig: any) => sig.blockTime > lastChecked && !sig.err);

      if (recentSignatures.length === 0) {
        return [];
      }

      logger.info(`   ⚡💰📊📱 ENHANCED: Processing ${recentSignatures.length} transactions with market + social data...`);

      // Enhanced parallel transaction processing
      const transactionPromises = recentSignatures.map(async (sig: any) => {
        try {
          if (sig.blockTime > latestTimestamp) {
            latestTimestamp = sig.blockTime;
          }

          const transaction = await this.ultraFastGetTransaction(sig.signature);
          if (transaction) {
            const purchase = await this.parseEnhancedTokenPurchase(transaction, walletAddress, sig.signature, walletName, currentSolPrice);
            if (purchase && purchase.amountUsd >= this.MIN_PURCHASE_USD) {
              this.showEnhancedPurchaseAlertWithMarketCapAndSocial(purchase, currentSolPrice);
              return purchase;
            }
          }
          return null;
        } catch (error) {
          return null;
        }
      });

      const results = await Promise.all(transactionPromises);
      const validPurchases = results.filter(p => p !== null) as EnhancedTokenPurchase[];

      purchases.push(...validPurchases);
      this.lastCheckedTimes.set(walletAddress, latestTimestamp);

      return purchases;

    } catch (error) {
      logger.warn(`❌📊📱 ENHANCED error for ${walletAddress.substring(0, 8)}...:`, error);
      return [];
    }
  }

  // 🚀📊📱 ENHANCED: Updated token purchase parsing with market + social data
  private async parseEnhancedTokenPurchase(transaction: any, walletAddress: string, signature: string, walletName: string, currentSolPrice: number): Promise<EnhancedTokenPurchase | null> {
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
            (pre: any) => pre.accountIndex === postBalance.accountIndex
          );
          
          const preAmount = preBalance ? parseFloat(preBalance.uiTokenAmount.uiAmountString || '0') : 0;
          const postAmount = parseFloat(postBalance.uiTokenAmount.uiAmountString || '0');
          
          if (postAmount > preAmount) {
            const tokenMint = postBalance.mint;
            const solSpent = this.calculateSolSpent(meta, walletAddress, transaction.transaction.message.accountKeys);
            
            if (solSpent > 0) {
              const usdAmount = solSpent * currentSolPrice;
              
              console.log(`🔍📊📱 Getting token info + market data + social analysis for: ${tokenMint}`);
              
              // Get token info, market data, and social data in parallel
              const [tokenInfo, marketData, socialData] = await Promise.all([
                this.getTokenInfo(tokenMint),
                this.getTokenMarketData(tokenMint),
                this.getSocialMediaData(tokenMint, undefined) // Will get symbol from tokenInfo
              ]);
              
              // 📱 NEW: Format social display if social data exists
              let socialDisplay: FormattedSocialDisplay | null = null;
              if (socialData && tokenInfo) {
                socialDisplay = this.socialFormatter.formatSocialDisplay(socialData, tokenInfo.symbol);
              }
              
              const enhancedPurchase: EnhancedTokenPurchase = {
                walletAddress,
                walletName,
                tokenMint,
                tokenSymbol: tokenInfo?.symbol || 'UNKNOWN',
                tokenName: tokenInfo?.name || 'Unknown Token',
                amountSol: solSpent,
                amountUsd: usdAmount,
                signature,
                timestamp: new Date(transaction.blockTime * 1000),
                transactionType: 'TOKEN_PURCHASE',
                marketData,
                socialData,      // 📱 NEW: Social media data
                socialDisplay    // 📱 NEW: Formatted social display
              };

              console.log(`✅📊📱 Enhanced purchase created with market + social data: ${enhancedPurchase.tokenName}`);
              if (marketData?.marketCap) {
                console.log(`   📊 Market Cap: $${this.formatNumber(marketData.marketCap)}`);
              }
              if (socialData) {
                console.log(`   📱 Social Rating: ${socialData.socialRating}/5 stars, Risk: ${socialData.riskLevel}`);
              }
              
              return enhancedPurchase;
            }
          }
        }
      }
      return null;
    } catch (error) {
      console.log('❌📊📱 Error parsing enhanced token purchase:', error);
      return null;
    }
  }

  // 🚀📊📱 ENHANCED: Updated individual purchase alert with market cap + social media
  private async showEnhancedPurchaseAlertWithMarketCapAndSocial(
    purchase: EnhancedTokenPurchase,
    currentSolPrice: number
  ): Promise<void> {
    
    // Get manual wallet win rate from config
    const manualWallet = this.manualWallets.find(w => w.address === purchase.walletAddress);
    const walletWinRate = manualWallet?.winrate || 'N/A';
    
    console.log('\n' + '⚡🚀💰📊🏆📱'.repeat(23));
    console.log('⚡🚀💰📊🏆📱 ENHANCED WHALE WITH SOCIAL MEDIA! 📱🏆📊💰🚀⚡');
    console.log('🚀⚡💰📊🏆📱 SOL + MARKET + SOCIAL + WIN RATE! 📱🏆📊💰⚡🚀');
    console.log('⚡🚀💰📊🏆📱'.repeat(23));
    
    // Display basic purchase info
    console.log(`🐋 WHALE: ${purchase.walletName || purchase.walletAddress.substring(0, 8) + '...'}`);
    console.log(`🏆 WIN RATE: ${walletWinRate}`);
    console.log('─'.repeat(70));
    console.log(`🪙 TOKEN NAME: ${purchase.tokenName || 'Loading...'}`);
    console.log(`🏷️ TOKEN SYMBOL: ${purchase.tokenSymbol || 'Loading...'}`);
    console.log(`💰 AMOUNT: ${purchase.amountSol.toFixed(4)} SOL (~$${purchase.amountUsd.toFixed(2)})`);
    console.log(`📊 SOL PRICE: $${currentSolPrice.toFixed(2)} (REAL-TIME)`);
    console.log(`🕐 TIME: ${purchase.timestamp.toLocaleString()}`);
    console.log('─'.repeat(70));
    
    // Market data section (existing)
    if (purchase.marketData) {
      const md = purchase.marketData;
      console.log('📊 MARKET DATA:');
      
      if (md.marketCap) {
        const mcRisk = this.calculateMarketCapRisk(md);
        console.log(`   💎 Market Cap: $${this.formatNumber(md.marketCap)} (Risk: ${mcRisk})`);
      }
      
      if (md.price) {
        console.log(`   💵 Token Price: $${md.price.toFixed(8)}`);
      }
      
      // if (md.volume24h) {
      //   console.log(`   📈 24h Volume: $${this.formatNumber(md.volume24h)}`);
      // }
      
      // if (md.priceChange24h !== undefined) {
      //   const changeColor = md.priceChange24h >= 0 ? '📈' : '📉';
      //   console.log(`   ${changeColor} 24h Change: ${md.priceChange24h.toFixed(2)}%`);
      // }
      
      if (md.liquidity) {
        const liqRisk = this.calculateLiquidityRisk(md);
        console.log(`   💧 Liquidity: $${this.formatNumber(md.liquidity)} (Risk: ${liqRisk})`);
      }
      
      console.log(`   📊 Data Source: ${md.source}`);
    } else {
      console.log('📊 MARKET DATA: Not available');
    }
    
    console.log('─'.repeat(70));

    // 📱 NEW: Social media analysis section
    if (purchase.socialData && purchase.socialDisplay) {
      console.log(purchase.socialDisplay.consoleSummary);
    } else if (this.enableSocialAnalysis) {
      console.log('📱 SOCIAL MEDIA: Analysis in progress...');
    } else {
      console.log('📱 SOCIAL MEDIA: Analysis disabled');
    }
    
    console.log('─'.repeat(70));
    console.log('🚀 ENHANCED ACTION LINKS:');
    console.log(`   📊 TX: https://solscan.io/tx/${purchase.signature}`);
    console.log(`   🪙 Token: https://solscan.io/token/${purchase.tokenMint}`);
    console.log(`   📈 Chart: https://dexscreener.com/solana/${purchase.tokenMint}`);
    console.log(`   🚀 Pump: https://pump.fun/${purchase.tokenMint}`);
    console.log(`   🦎 CoinGecko: https://www.coingecko.com/en/coins/solana/contract/${purchase.tokenMint}`);
    console.log('─'.repeat(70));
    console.log(`⚡💰📊🏆📱 ENHANCED WITH FULL SOCIAL + MARKET VERIFICATION!`);
    console.log('📱 TELEGRAM SENT WITH COMPLETE ANALYSIS...');
    console.log('⚡🚀💰📊🏆📱'.repeat(23) + '\n');

    // 🤖📱📊🏆 SEND TO TELEGRAM WITH SOCIAL + WIN RATE
    await this.telegramBot.sendEnhancedIndividualAlertWithSocialAndWinRate(purchase, currentSolPrice, walletWinRate);
  }

  private async instantEnhancedConsensusCheck(currentSolPrice: number): Promise<void> {
    const currentTime = Date.now();
    
    for (const [tokenMint, purchases] of this.recentWhalePurchases.entries()) {
      const recentPurchases = purchases.filter(p => 
        (currentTime - p.timestamp.getTime()) <= this.consensusTimeWindow
      );

      const uniqueWhales = new Map<string, EnhancedTokenPurchase>();
      recentPurchases.forEach(purchase => {
        if (!uniqueWhales.has(purchase.walletAddress)) {
          uniqueWhales.set(purchase.walletAddress, purchase);
        }
      });

      const uniquePurchases = Array.from(uniqueWhales.values());

      if (uniquePurchases.length >= this.MIN_WHALES_FOR_CONSENSUS) {
        const consensusId = `${tokenMint}_${uniquePurchases.length}`;
        
        if (!this.alertedConsensus.has(consensusId)) {
          this.alertedConsensus.add(consensusId);
          
          // Get enhanced token info, market data, and social data
          const firstPurchase = uniquePurchases[0];
          const [tokenInfo, marketData, socialData] = await Promise.all([
            this.getTokenInfo(tokenMint),
            this.getTokenMarketData(tokenMint),
            this.getSocialMediaData(tokenMint, firstPurchase.tokenSymbol)
          ]);
          
          // 📱 NEW: Format social display and calculate enhanced metrics
          let socialDisplay: FormattedSocialDisplay | null = null;
          let socialRiskLevel: string | undefined = undefined;
          let communityStrength: number | undefined = undefined;
          let overallRiskScore: number | undefined = undefined;

          if (socialData && tokenInfo) {
            socialDisplay = this.socialFormatter.formatSocialDisplay(socialData, tokenInfo.symbol);
            socialRiskLevel = socialData.riskLevel;
            communityStrength = this.calculateCommunityStrength(socialData);
            overallRiskScore = this.calculateOverallRiskScore(marketData, socialData, uniquePurchases.length);
          }
          
          // Recalculate USD amounts with current SOL price
          const recalculatedPurchases = uniquePurchases.map(p => ({
            ...p,
            amountUsd: p.amountSol * currentSolPrice
          }));
          
          const totalAmountSol = recalculatedPurchases.reduce((sum, p) => sum + p.amountSol, 0);
          const totalAmountUsd = recalculatedPurchases.reduce((sum, p) => sum + p.amountUsd, 0);
          const timestamps = recalculatedPurchases.map(p => p.timestamp.getTime());
          const firstPurchaseTime = new Date(Math.min(...timestamps));
          const lastPurchaseTime = new Date(Math.max(...timestamps));
          const consensusStrength = recalculatedPurchases.length * 100 + totalAmountUsd;

          const enhancedConsensus: EnhancedWhaleConsensus = {
            tokenMint,
            tokenSymbol: tokenInfo?.symbol || 'UNKNOWN',
            tokenName: tokenInfo?.name || 'Unknown Token',
            whales: recalculatedPurchases,
            totalWhales: recalculatedPurchases.length,
            totalAmountSol,
            totalAmountUsd,
            firstPurchaseTime,
            lastPurchaseTime,
            consensusStrength,
            marketData,
            marketCapRisk: marketData ? this.calculateMarketCapRisk(marketData) : 'UNKNOWN',
            liquidityRisk: marketData ? this.calculateLiquidityRisk(marketData) : 'UNKNOWN',
            // 📱 NEW: Social consensus data
            socialData,
            socialDisplay,
            socialRiskLevel,
            communityStrength,
            overallRiskScore
          };

          this.triggerEnhancedConsensusWithSocialMedia(enhancedConsensus, currentSolPrice);
        }
      }
    }
  }

  // 🚀📊📱 ENHANCED: Updated consensus alert with social media
  private async triggerEnhancedConsensusWithSocialMedia(consensus: EnhancedWhaleConsensus, currentSolPrice: number): Promise<void> {
  console.log('\n' + '🚨⚡🐋💰📊🏆📱'.repeat(22));
  console.log('🚨⚡🐋💰📊🏆📱 ENHANCED WHALE CONSENSUS WITH SOCIAL + WIN RATES! 📱🏆📊💰🐋⚡🚨');
  console.log('⚡🚨💰📊🏆📱 SOL + MARKET + SOCIAL + INDIVIDUAL WIN RATES! 📱🏆📊💰🚨⚡');
  console.log('🚨⚡🐋💰📊🏆📱'.repeat(22));
  
  console.log('🪙 ENHANCED TOKEN INFORMATION:');
  console.log(`   Token Name: ${consensus.tokenName}`);
  console.log(`   Token Symbol: ${consensus.tokenSymbol}`);
  console.log(`   Token Address: ${consensus.tokenMint}`);
  console.log('');

    // 🏆 ENHANCED WIN RATE ANALYSIS WITH INDIVIDUAL RATES
  const whaleWinRates = consensus.whales.map(whale => {
    const manualWallet = this.manualWallets.find(w => w.address === whale.walletAddress);
    return {
      ...whale,
      winRate: manualWallet?.winrate || 'N/A'
    };
  });

  const validWinRates = whaleWinRates.filter(w => w.winRate !== 'N/A' && w.winRate.includes('%'));
  
    
    if (validWinRates.length > 0) {
    console.log('🏆 ENHANCED WHALE QUALITY ANALYSIS:');
    console.log(`   📊 Whales with Win Rates: ${validWinRates.length}/${consensus.totalWhales}`);
    
    let totalWinRate = 0;
    validWinRates.forEach(whale => {
      const rate = parseFloat(whale.winRate.replace('%', ''));
      totalWinRate += rate;
    });
    const avgWinRate = totalWinRate / validWinRates.length;
    
    console.log(`   📈 Average Win Rate: ${avgWinRate.toFixed(1)}%`);
    
    let qualityLevel = 'UNKNOWN';
    if (avgWinRate >= 85) qualityLevel = 'PREMIUM';
    else if (avgWinRate >= 75) qualityLevel = 'HIGH';
    else if (avgWinRate >= 65) qualityLevel = 'MEDIUM';
    else if (avgWinRate >= 50) qualityLevel = 'LOW';
    else qualityLevel = 'POOR';
    
    console.log(`   🎯 Consensus Quality: ${qualityLevel}`);
    console.log('');
  } else {
    console.log('🏆 WHALE QUALITY: No win rate data available');
    console.log('');
  }
    
   // 📊 ENHANCED MARKET DATA SECTION (existing)
  if (consensus.marketData) {
    const md = consensus.marketData;
    console.log('📊 COMPREHENSIVE MARKET DATA:');
    
    if (md.marketCap) {
      console.log(`   💎 Market Cap: $${this.formatNumber(md.marketCap)} (Risk: ${consensus.marketCapRisk})`);
    }
    
    if (md.price) {
      console.log(`   💵 Token Price: $${md.price.toFixed(8)}`);
    }
    
    // if (md.volume24h) {
    //   console.log(`   📈 24h Volume: $${this.formatNumber(md.volume24h)}`);
    // }
    
    // if (md.priceChange24h !== undefined) {
    //   const changeColor = md.priceChange24h >= 0 ? '📈' : '📉';
    //   console.log(`   ${changeColor} 24h Change: ${md.priceChange24h.toFixed(2)}%`);
    // }
    
    if (md.liquidity) {
      console.log(`   💧 Liquidity: $${this.formatNumber(md.liquidity)} (Risk: ${consensus.liquidityRisk})`);
    }
    
    // if (md.fullyDilutedValuation) {
    //   console.log(`   🔮 FDV: $${this.formatNumber(md.fullyDilutedValuation)}`);
    // }
    
    // console.log(`   📊 Data Source: ${md.source}`);
    console.log('');
  } else {
    console.log('📊 MARKET DATA: Not available for this token');
    console.log('');
  }

  // 📱 SOCIAL MEDIA ANALYSIS SECTION (existing)
  if (consensus.socialData && consensus.socialDisplay) {
    console.log(consensus.socialDisplay.consoleSummary);
    
    if (consensus.communityStrength !== undefined) {
      console.log(`   👥 Community Strength: ${consensus.communityStrength}/100`);
    }
    
    if (consensus.overallRiskScore !== undefined) {
      console.log(`   🎯 Combined Risk Score: ${consensus.overallRiskScore}/100`);
    }
    console.log('');
  } else if (this.enableSocialAnalysis) {
    console.log('📱 SOCIAL MEDIA: Analysis in progress...');
    console.log('');
  } else {
    console.log('📱 SOCIAL MEDIA: Analysis disabled');
    console.log('');
  }
  
  console.log(`🐋💰📊📱 ENHANCED CONSENSUS (${consensus.totalWhales} WHALES):`);
  console.log(`   Total Whales: ${consensus.totalWhales} whales`);
  console.log(`   Total Amount: ${consensus.totalAmountSol.toFixed(4)} SOL (~$${consensus.totalAmountUsd.toFixed(2)})`);
  console.log(`   Average per Whale: ${(consensus.totalAmountSol / consensus.totalWhales).toFixed(4)} SOL (~$${(consensus.totalAmountUsd / consensus.totalWhales).toFixed(2)})`);
  console.log(`   📊 SOL Price: $${currentSolPrice.toFixed(2)} (REAL-TIME)`);
  console.log(`   Consensus Strength: ${consensus.consensusStrength.toFixed(0)} points`);
  console.log(`   Time Span: ${this.formatTimeDifference(consensus.firstPurchaseTime, consensus.lastPurchaseTime)}`);
  
  // 🎯 ENHANCED RISK ASSESSMENT
  console.log('');
  console.log('🎯 COMPREHENSIVE RISK ASSESSMENT:');
  console.log(`   📊 Market Cap Risk: ${consensus.marketCapRisk}`);
  console.log(`   💧 Liquidity Risk: ${consensus.liquidityRisk}`);
  
  if (consensus.socialRiskLevel) {
    console.log(`   📱 Social Risk: ${consensus.socialRiskLevel}`);
  }
  
  if (consensus.overallRiskScore !== undefined) {
    console.log(`   🚨 Overall Risk Score: ${consensus.overallRiskScore}/100`);
  }
  
  console.log('');
  console.log('🐋 🏆 WHALE PURCHASES WITH INDIVIDUAL WIN RATES:');
  whaleWinRates.forEach((whale, index) => {
    const walletLabel = whale.walletName || `Whale ${whale.walletAddress.substring(0, 8)}...`;
    console.log(`   ${index + 1}. ⚡ ${walletLabel}`);
    console.log(`      💰 Amount: ${whale.amountSol.toFixed(4)} SOL (~$${whale.amountUsd.toFixed(2)})`);
    console.log(`      🏆 Win Rate: ${whale.winRate}`);
    console.log(`      🕐 Time: ${whale.timestamp.toLocaleString()}`);
    if (index < whaleWinRates.length - 1) {
      console.log('      ' + '-'.repeat(50));
    }
  });
  
  console.log('');
  console.log('🚀💰📊📱 ENHANCED ACTION LINKS:');
  console.log(`   ⚡ DexScreener: https://dexscreener.com/solana/${consensus.tokenMint}`);
  console.log(`   🚀 Pump.fun: https://pump.fun/${consensus.tokenMint}`);
  console.log(`   📋 Solscan: https://solscan.io/token/${consensus.tokenMint}`);
  console.log(`   🦎 CoinGecko: https://www.coingecko.com/en/coins/solana/contract/${consensus.tokenMint}`);
  console.log('');
  
  console.log('🚨⚡💰📊📱 ENHANCED CONSENSUS WITH COMPLETE SOCIAL + WIN RATE VERIFICATION! ⚡🚨');
  console.log('🚀💰📊📱 MARKET CAP + SOCIAL MEDIA + INDIVIDUAL WIN RATES INCLUDED!');
  console.log('📱💰📊 SENDING TELEGRAM WITH FULL ANALYSIS...');
  console.log('🚨⚡🐋💰📊📱'.repeat(22) + '\n');

  // 🤖📱📊 SEND ENHANCED CONSENSUS TO TELEGRAM WITH WIN RATES
  // 🏆 NEW: Pass manual wallets to get individual win rates
  await this.telegramBot.sendEnhancedConsensusAlertWithSocialAndWinRates(consensus, currentSolPrice, this.manualWallets);
  
  console.log('✅💰📊📱🏆 ENHANCED TELEGRAM CONSENSUS SENT WITH SOCIAL + WIN RATES! 📱🚨');
}



  // 📱 NEW: Calculate community strength based on social data
  private calculateCommunityStrength(socialData: SocialMediaData): number {
    let strength = 0;

    // Base score from social rating
    strength += socialData.socialRating * 15;

    // Platform presence
    strength += socialData.overall.platformCount * 10;

    // Follower count impact
    if (socialData.overall.totalFollowers >= 100000) strength += 25;
    else if (socialData.overall.totalFollowers >= 50000) strength += 20;
    else if (socialData.overall.totalFollowers >= 10000) strength += 15;
    else if (socialData.overall.totalFollowers >= 1000) strength += 10;
    else if (socialData.overall.totalFollowers >= 100) strength += 5;

    // Verification bonus
    strength += socialData.overall.verifiedAccounts * 15;

    // Engagement bonus
    if (socialData.overall.engagement === 'HIGH') strength += 15;
    else if (socialData.overall.engagement === 'MEDIUM') strength += 8;

    // Active accounts bonus
    strength += socialData.overall.activeAccounts * 5;

    return Math.min(100, strength);
  }

  // 📱 NEW: Calculate overall risk score combining market + social data
  private calculateOverallRiskScore(
    marketData: TokenMarketData | null, 
    socialData: SocialMediaData | null, 
    whaleCount: number
  ): number {
    let score = 50; // Base score

    // Market data impact
    if (marketData) {
      if (marketData.marketCap) {
        if (marketData.marketCap >= 10000000) score += 15; // $10M+
        else if (marketData.marketCap >= 1000000) score += 10; // $1M+
        else if (marketData.marketCap >= 100000) score += 5; // $100K+
        else score -= 10; // < $100K
      }
      
      if (marketData.liquidity) {
        if (marketData.liquidity >= 500000) score += 10; // $500K+
        else if (marketData.liquidity >= 100000) score += 5; // $100K+
        else score -= 5; // < $100K
      }
      
      if (marketData.volume24h) {
        if (marketData.volume24h >= 1000000) score += 10; // $1M+
        else if (marketData.volume24h >= 100000) score += 5; // $100K+
      }
    }

          // Social data impact
    if (socialData) {
      // Social rating impact
      score += (socialData.socialRating - 2.5) * 8;
      
      // Risk level impact
      switch (socialData.riskLevel) {
        case 'LOW': score += 10; break;
        case 'MEDIUM': score += 5; break;
        case 'HIGH': score -= 5; break;
        case 'VERY_HIGH': score -= 15; break;
      }
      
      // Platform diversity bonus
      score += socialData.overall.platformCount * 3;
      
      // Verification bonus
      score += socialData.overall.verifiedAccounts * 8;
      
      // Community size bonus
      if (socialData.overall.totalFollowers >= 50000) score += 8;
      else if (socialData.overall.totalFollowers >= 10000) score += 5;
      else if (socialData.overall.totalFollowers >= 1000) score += 3;
    }

    // Whale count impact
    score += whaleCount * 5;

    return Math.min(100, Math.max(0, score));
  }

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

  private async ultraFastGetSignatures(walletAddress: string): Promise<any[]> {
    // Use only the fastest 2 endpoints for maximum speed
    const fastestEndpoints = this.ULTRA_FAST_RPC_ENDPOINTS.slice(0, 2);
    
    const rpcPromises = fastestEndpoints.map(async (rpcUrl) => {
      try {
        const response = await this.ultraAxios.post(rpcUrl, {
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

  private async ultraFastGetTransaction(signature: string): Promise<any> {
    const fastestEndpoint = this.ULTRA_FAST_RPC_ENDPOINTS[0];
    
    try {
      const response = await this.ultraAxios.post(fastestEndpoint, {
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
      return null;
    } catch (error) {
      return null;
    }
  }

  // 🚀💰📊📱 ENHANCED: Token info with caching and ultra fast response
  private async getTokenInfo(tokenMint: string): Promise<{ symbol: string; name: string } | null> {
    // Check cache first with expiration
    const cached = this.tokenInfoCache.get(tokenMint);
    if (cached && cached.expires > Date.now()) {
      return { symbol: cached.symbol, name: cached.name };
    }

    console.log(`🔍💰📊📱 Enhanced token info for: ${tokenMint}`);

    try {
      // Enhanced token info fetching with DexScreener priority
      const response = await axios.get(`https://api.dexscreener.com/latest/dex/tokens/${tokenMint}`, { 
        timeout: 5000,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'EnhancedWhaleBot/4.0'
        }
      });
      
      if (response.data?.pairs && response.data.pairs.length > 0) {
        const pair = response.data.pairs[0];
        if (pair.baseToken && pair.baseToken.symbol) {
          const tokenInfo = {
            symbol: pair.baseToken.symbol,
            name: pair.baseToken.name || pair.baseToken.symbol,
            expires: Date.now() + (5 * 60 * 1000)
          };
          console.log(`✅💰📊📱 DexScreener success: ${tokenInfo.name} (${tokenInfo.symbol})`);
          this.tokenInfoCache.set(tokenMint, tokenInfo);
          return { symbol: tokenInfo.symbol, name: tokenInfo.name };
        }
      }

      // Enhanced fallback
      const fallback = {
        symbol: tokenMint.substring(0, 8),
        name: `Token ${tokenMint.substring(0, 8)}`,
        expires: Date.now() + (2 * 60 * 1000)
      };
      
      console.log(`❌💰📊📱 Using enhanced fallback for ${tokenMint}: ${fallback.name}`);
      this.tokenInfoCache.set(tokenMint, fallback);
      return { symbol: fallback.symbol, name: fallback.name };
      
    } catch (error) {
      console.log(`❌💰📊📱 Enhanced token info error for ${tokenMint}:`, error);
      const fallback = {
        symbol: tokenMint.substring(0, 8),
        name: `Token ${tokenMint.substring(0, 8)}`,
        expires: Date.now() + (2 * 60 * 1000)
      };
      this.tokenInfoCache.set(tokenMint, fallback);
      return { symbol: fallback.symbol, name: fallback.name };
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

  private addEnhancedPurchasesToConsensusTracking(purchases: EnhancedTokenPurchase[]): void {
    const currentTime = Date.now();
    
    purchases.forEach(purchase => {
      const tokenMint = purchase.tokenMint;
      
      if (!this.recentWhalePurchases.has(tokenMint)) {
        this.recentWhalePurchases.set(tokenMint, []);
      }
      
      const tokenPurchases = this.recentWhalePurchases.get(tokenMint)!;
      tokenPurchases.push(purchase);
      
      const filteredPurchases = tokenPurchases.filter(p => 
        (currentTime - p.timestamp.getTime()) <= this.consensusTimeWindow
      );
      
      this.recentWhalePurchases.set(tokenMint, filteredPurchases);
    });
  }

  private async analyzeEnhancedWhaleConsensus(currentSolPrice: number): Promise<void> {
    const currentTime = Date.now();
    const consensusTokens: EnhancedWhaleConsensus[] = [];

    logger.info('🐋💰📊📱 Analyzing enhanced whale consensus with real-time SOL price + market + social data...');

    for (const [tokenMint, purchases] of this.recentWhalePurchases.entries()) {
      const recentPurchases = purchases.filter(p => 
        (currentTime - p.timestamp.getTime()) <= this.consensusTimeWindow
      );

      const uniqueWhales = new Map<string, EnhancedTokenPurchase>();
      recentPurchases.forEach(purchase => {
        if (!uniqueWhales.has(purchase.walletAddress)) {
          // Recalculate USD with current SOL price
          const updatedPurchase = {
            ...purchase,
            amountUsd: purchase.amountSol * currentSolPrice
          };
          uniqueWhales.set(purchase.walletAddress, updatedPurchase);
        }
      });

      const uniquePurchases = Array.from(uniqueWhales.values());

      if (uniquePurchases.length >= this.MIN_WHALES_FOR_CONSENSUS) {
        const firstPurchase = uniquePurchases[0];
        const [tokenInfo, marketData, socialData] = await Promise.all([
          this.getTokenInfo(tokenMint),
          this.getTokenMarketData(tokenMint),
          this.getSocialMediaData(tokenMint, firstPurchase.tokenSymbol)
        ]);
        
        // 📱 NEW: Enhanced consensus with social data
        let socialDisplay: FormattedSocialDisplay | null = null;
        let socialRiskLevel: string | undefined = undefined;
        let communityStrength: number | undefined = undefined;
        let overallRiskScore: number | undefined = undefined;

        if (socialData && tokenInfo) {
          socialDisplay = this.socialFormatter.formatSocialDisplay(socialData, tokenInfo.symbol);
          socialRiskLevel = socialData.riskLevel;
          communityStrength = this.calculateCommunityStrength(socialData);
          overallRiskScore = this.calculateOverallRiskScore(marketData, socialData, uniquePurchases.length);
        }
        
        const totalAmountSol = uniquePurchases.reduce((sum, p) => sum + p.amountSol, 0);
        const totalAmountUsd = uniquePurchases.reduce((sum, p) => sum + p.amountUsd, 0);
        const timestamps = uniquePurchases.map(p => p.timestamp.getTime());
        const firstPurchaseTime = new Date(Math.min(...timestamps));
        const lastPurchaseTime = new Date(Math.max(...timestamps));
        
        const consensusStrength = uniquePurchases.length * 100 + totalAmountUsd;

        const enhancedConsensus: EnhancedWhaleConsensus = {
          tokenMint,
          tokenSymbol: tokenInfo?.symbol || 'UNKNOWN',
          tokenName: tokenInfo?.name || 'Unknown Token',
          whales: uniquePurchases,
          totalWhales: uniquePurchases.length,
          totalAmountSol,
          totalAmountUsd,
          firstPurchaseTime,
          lastPurchaseTime,
          consensusStrength,
          marketData,
          marketCapRisk: marketData ? this.calculateMarketCapRisk(marketData) : 'UNKNOWN',
          liquidityRisk: marketData ? this.calculateLiquidityRisk(marketData) : 'UNKNOWN',
          // 📱 NEW: Social consensus data
          socialData,
          socialDisplay,
          socialRiskLevel,
          communityStrength,
          overallRiskScore
        };

        consensusTokens.push(enhancedConsensus);
      }
    }

    consensusTokens.sort((a, b) => b.consensusStrength - a.consensusStrength);

    for (const consensus of consensusTokens) {
      const consensusId = `${consensus.tokenMint}_${consensus.totalWhales}`;
      
      if (!this.alertedConsensus.has(consensusId)) {
        this.alertedConsensus.add(consensusId);
        await this.triggerEnhancedConsensusWithSocialMedia(consensus, currentSolPrice);
      }
    }

    if (consensusTokens.length > 0) {
      logger.info(`🐋💰📊📱 Found ${consensusTokens.length} enhanced whale consensus signals with market + social data!`);
    } else {
      logger.info('🐋💰📊📱 No enhanced whale consensus detected in current cycle');
    }
  }

  async testWallet(walletAddress: string): Promise<void> {
    const currentSolPrice = this.solPriceService.getCurrentPrice();
    logger.info(`🚀⚡💰📊📱 ENHANCED: Testing wallet ${walletAddress} with real-time SOL: ${currentSolPrice.toFixed(2)} + Market + Social`);
    
    try {
      const purchases = await this.enhancedUltraFastCheckWallet(walletAddress, 'Enhanced Test Whale', currentSolPrice);
      
      if (purchases.length > 0) {
        console.log(`✅💰📊📱 ENHANCED: Found ${purchases.length} purchases with real-time SOL pricing + market + social data`);
        this.addEnhancedPurchasesToConsensusTracking(purchases);
        await this.instantEnhancedConsensusCheck(currentSolPrice);
      } else {
        console.log('❌ ENHANCED: No purchases found in last 3 minutes');
        console.log('💡 ENHANCED: Monitoring last 3 minutes for maximum speed');
        
        console.log('🤖💰📊📱 Sending Telegram test with enhanced features...');
        await this.telegramBot.sendTestMessage();
      }
    } catch (error) {
      logger.error('❌💰📊📱 Enhanced test failed:', error);
    }
  }

  getTelegramStatus(): { enabled: boolean; configured: boolean } {
    return this.telegramBot.getBotStatus();
  }

  getCurrentSolPrice(): number {
    return this.solPriceService.getCurrentPrice();
  }

  getSolPriceAge(): string {
    return this.solPriceService.getPriceAge();
  }

  async forceUpdateSolPrice(): Promise<number> {
    return await this.solPriceService.forceUpdate();
  }

  // 📱 NEW: Social analysis configuration methods
  configureSocialAnalysis(enabled: boolean, delay?: number): void {
    this.enableSocialAnalysis = enabled;
    if (delay !== undefined) {
      this.socialAnalysisDelay = delay;
    }
    
    logger.info(`📱⚙️ Social analysis: ${enabled ? 'ENABLED' : 'DISABLED'}`);
    if (delay !== undefined) {
      logger.info(`📱⏱️ Social analysis delay: ${delay}ms`);
    }
  }

  getSocialAnalysisStatus(): { enabled: boolean; delay: number } {
    return {
      enabled: this.enableSocialAnalysis,
      delay: this.socialAnalysisDelay
    };
  }

  getSocialAnalyzer(): SocialMediaAnalyzer {
    return this.socialAnalyzer;
  }

  getSocialFormatter(): SocialMediaFormatter {
    return this.socialFormatter;
  }

  // 📱 NEW: Clear social cache
  clearSocialCache(): void {
    this.socialAnalysisCache.clear();
    logger.info('📱🧹 Social analysis cache cleared');
  }

  // 📱 NEW: Get social cache stats
  getSocialCacheStats(): { size: number; entries: string[] } {
    return {
      size: this.socialAnalysisCache.size,
      entries: Array.from(this.socialAnalysisCache.keys())
    };
  }
}

// src/monitor-no-db.ts - ENHANCED WITH SOCIAL MEDIA (PART 4 - FINAL) 📱🐋🚀
// 🚀💰📊📱 MAIN EXECUTION WITH ENHANCED FEATURES + SOCIAL MEDIA

async function startEnhancedMonitoringWithMarketCapAndSocial(): Promise<void> {
  const monitor = new EnhancedUltraFastWhaleMonitor();
  
  try {
    logger.info('🚀⚡💰📊📱 Starting ENHANCED Whale Monitor with MARKET CAP + SOCIAL MEDIA DATA...');
    
    await monitor.startMonitoring();
    
    const telegramStatus = monitor.getTelegramStatus();
    const socialStatus = monitor.getSocialAnalysisStatus();
    const currentSolPrice = monitor.getCurrentSolPrice();
    const priceAge = monitor.getSolPriceAge();
    
    console.log(`✅💰 Real-time SOL Price: $${currentSolPrice.toFixed(2)} (${priceAge})`);
    console.log(`✅📊 Market Cap Data: ENABLED`);
    console.log(`✅📱 Social Media Analysis: ${socialStatus.enabled ? 'ENABLED' : 'DISABLED'}`);
    
    if (socialStatus.enabled) {
      console.log(`✅📱 Social Analysis Delay: ${socialStatus.delay}ms`);
    }
    
    if (telegramStatus.enabled && telegramStatus.configured) {
      console.log('✅📱 Telegram Bot: Ready with enhanced alerts including market cap + social media!');
    } else {
      console.log('💡📱 Telegram Bot: Configure telegram.json to enable enhanced alerts');
    }
    
    // Display enhanced updates every minute
    setInterval(() => {
      const price = monitor.getCurrentSolPrice();
      const age = monitor.getSolPriceAge();
      const social = monitor.getSocialAnalysisStatus();
      console.log(`💰📊📱 SOL: $${price.toFixed(2)} (${age}) | Market: ACTIVE | Social: ${social.enabled ? 'ACTIVE' : 'DISABLED'}`);
    }, 60000);
    
    // 📱 NEW: Display social cache stats every 10 minutes
    setInterval(() => {
      const socialStats = monitor.getSocialCacheStats();
      if (socialStats.size > 0) {
        console.log(`📱💾 Social Cache: ${socialStats.size} entries cached`);
      }
    }, 600000); // 10 minutes
    
    process.on('SIGINT', async () => {
      logger.info('🛑💰📊📱 Stopping enhanced monitor with social media...');
      await monitor.stopMonitoring();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      logger.info('🛑💰📊📱 Stopping enhanced monitor with social media...');
      await monitor.stopMonitoring();
      process.exit(0);
    });
    
    process.stdin.resume();
    
  } catch (error) {
    logger.error('❌💰📊📱 Enhanced monitor with social media failed:', error);
    process.exit(1);
  }
}

async function testEnhancedWalletWithMarketCapAndSocial(walletAddress: string): Promise<void> {
  const monitor = new EnhancedUltraFastWhaleMonitor();
  
  try {
    const currentSolPrice = monitor.getCurrentSolPrice();
    const socialStatus = monitor.getSocialAnalysisStatus();
    logger.info(`🚀⚡💰📊📱 Testing wallet: ${walletAddress} with SOL: $${currentSolPrice.toFixed(2)} + Market + Social: ${socialStatus.enabled ? 'ENABLED' : 'DISABLED'}`);
    await monitor.testWallet(walletAddress);
    process.exit(0);
  } catch (error) {
    logger.error('❌💰📊📱 Enhanced test with social media failed:', error);
    process.exit(1);
  }
}

// 📱 NEW: Test social media analysis only
async function testSocialMediaAnalysis(tokenMintOrSymbol: string): Promise<void> {
  try {
    logger.info(`📱🔍 Testing social media analysis for: ${tokenMintOrSymbol}`);
    
    const monitor = new EnhancedUltraFastWhaleMonitor();
    const socialAnalyzer = monitor.getSocialAnalyzer();
    const socialFormatter = monitor.getSocialFormatter();
    
    console.log('\n📱🔍 Analyzing social media presence...');
    
    const socialData = await socialAnalyzer.analyzeSocialMedia(tokenMintOrSymbol, tokenMintOrSymbol);
    
    if (socialData) {
      const socialDisplay = socialFormatter.formatSocialDisplay(socialData, tokenMintOrSymbol);
      
      console.log('\n' + '📱🔍📊'.repeat(20));
      console.log('📱🔍📊 SOCIAL MEDIA ANALYSIS TEST RESULTS 📊🔍📱');
      console.log('📱🔍📊'.repeat(20));
      
      console.log(socialDisplay.consoleSummary);
      
      console.log('\n📱 TELEGRAM MESSAGE PREVIEW:');
      console.log('─'.repeat(50));
      console.log(socialDisplay.telegramMessage.replace(/<\/?b>/g, '').replace(/<\/?i>/g, ''));
      console.log('─'.repeat(50));
      
      console.log('\n📱 SHORT SUMMARY:', socialDisplay.shortSummary);
      console.log('📱 RISK INDICATOR:', socialDisplay.riskIndicator);
      console.log('📱 PLATFORM ICONS:', socialDisplay.platformIcons);
      
      console.log('\n✅📱 Social media analysis test completed successfully!');
      console.log('📱🔍📊'.repeat(20));
    } else {
      console.log('❌📱 No social media data found for:', tokenMintOrSymbol);
    }
    
    process.exit(0);
  } catch (error) {
    logger.error('❌📱 Social media analysis test failed:', error);
    process.exit(1);
  }
}

// 📱 NEW: Configure social media settings
async function configureSocialSettings(): Promise<void> {
  try {
    console.log('\n📱⚙️ SOCIAL MEDIA CONFIGURATION');
    console.log('═'.repeat(50));
    
    const monitor = new EnhancedUltraFastWhaleMonitor();
    const currentStatus = monitor.getSocialAnalysisStatus();
    
    console.log(`Current Status: ${currentStatus.enabled ? '✅ ENABLED' : '❌ DISABLED'}`);
    console.log(`Current Delay: ${currentStatus.delay}ms`);
    
    // Load current config
    const configPath = path.join(process.cwd(), 'manualWallets.json');
    
    if (fs.existsSync(configPath)) {
      const configData = fs.readFileSync(configPath, 'utf8');
      const config = JSON.parse(configData);
      
      console.log('\n📱 Current Social Settings in manualWallets.json:');
      console.log(`   enableSocialAnalysis: ${config.settings.enableSocialAnalysis}`);
      console.log(`   socialAnalysisDelay: ${config.settings.socialAnalysisDelay}ms`);
      
      console.log('\n💡 To modify social settings:');
      console.log('   1. Edit manualWallets.json');
      console.log('   2. Set enableSocialAnalysis: true/false');
      console.log('   3. Set socialAnalysisDelay: milliseconds (recommended: 2000-5000)');
      console.log('   4. Restart the monitor');
      
      console.log('\n📱 Social Media Features:');
      console.log('   🐦 Twitter account verification');
      console.log('   📱 Telegram community analysis');
      console.log('   ⭐ Social rating system (1-5 stars)');
      console.log('   🚨 Social risk assessment');
      console.log('   👥 Community engagement tracking');
      console.log('   📊 Combined market + social risk scoring');
      
    } else {
      console.log('❌ manualWallets.json not found. Please run the monitor first to create it.');
    }
    
    process.exit(0);
  } catch (error) {
    logger.error('❌ Social configuration failed:', error);
    process.exit(1);
  }
}

// 📱 NEW: Clear social media cache
async function clearSocialCache(): Promise<void> {
  try {
    const monitor = new EnhancedUltraFastWhaleMonitor();
    const beforeStats = monitor.getSocialCacheStats();
    
    console.log(`📱💾 Current social cache: ${beforeStats.size} entries`);
    
    monitor.clearSocialCache();
    monitor.getSocialAnalyzer().clearCache();
    
    const afterStats = monitor.getSocialCacheStats();
    
    console.log(`✅📱 Social media cache cleared!`);
    console.log(`📱💾 Cache entries: ${beforeStats.size} → ${afterStats.size}`);
    
    process.exit(0);
  } catch (error) {
    logger.error('❌ Clear social cache failed:', error);
    process.exit(1);
  }
}

// 📱 NEW: Show social cache statistics
async function showSocialCacheStats(): Promise<void> {
  try {
    const monitor = new EnhancedUltraFastWhaleMonitor();
    const socialStats = monitor.getSocialCacheStats();
    const analyzerStats = monitor.getSocialAnalyzer().getCacheStats();
    
    console.log('\n📱💾 SOCIAL MEDIA CACHE STATISTICS');
    console.log('═'.repeat(50));
    console.log(`Monitor Cache: ${socialStats.size} entries`);
    console.log(`Analyzer Cache: ${analyzerStats.size} entries`);
    console.log(`Total Cached Tokens: ${socialStats.size + analyzerStats.size}`);
    
    if (socialStats.entries.length > 0) {
      console.log('\n📱 Cached Token Mints (Monitor):');
      socialStats.entries.forEach((entry, index) => {
        console.log(`   ${index + 1}. ${entry.substring(0, 12)}...`);
      });
    }
    
    if (analyzerStats.entries.length > 0) {
      console.log('\n📱 Cached Token Mints (Analyzer):');
      analyzerStats.entries.forEach((entry, index) => {
        console.log(`   ${index + 1}. ${entry.substring(0, 12)}...`);
      });
    }
    
    console.log('\n💡 Cache entries expire after 30 minutes');
    console.log('💡 Use "npm start clear-cache" to clear all social cache');
    
    process.exit(0);
  } catch (error) {
    logger.error('❌ Show social cache stats failed:', error);
    process.exit(1);
  }
}

// 🚀💰📊📱 ENHANCED CLI COMMANDS WITH SOCIAL MEDIA
const args = process.argv.slice(2);

if (args.length === 0) {
  // Default: Start enhanced monitoring with social media
  startEnhancedMonitoringWithMarketCapAndSocial();
} else {
  const command = args[0].toLowerCase();
  
  switch (command) {
    case 'test':
      if (args[1]) {
        testEnhancedWalletWithMarketCapAndSocial(args[1]);
      } else {
        console.log('❌ Please provide a wallet address to test');
        console.log('💡 Usage: npm start test <wallet_address>');
        process.exit(1);
      }
      break;

    // 📱 NEW: Social media test command
    case 'test-social':
      if (args[1]) {
        testSocialMediaAnalysis(args[1]);
      } else {
        console.log('❌ Please provide a token mint or symbol to test');
        console.log('💡 Usage: npm start test-social <token_mint_or_symbol>');
        console.log('💡 Example: npm start test-social SOL');
        console.log('💡 Example: npm start test-social So11111111111111111111111111111111111111112');
        process.exit(1);
      }
      break;

    // 📱 NEW: Configure social settings
    case 'config-social':
      configureSocialSettings();
      break;

    // 📱 NEW: Clear social cache
    case 'clear-cache':
      clearSocialCache();
      break;

    // 📱 NEW: Show cache statistics
    case 'cache-stats':
      showSocialCacheStats();
      break;
      
    case 'help':
    case '--help':
    case '-h':
      console.log('\n🚀⚡💰📊📱 ENHANCED WHALE MONITOR WITH MARKET CAP + SOCIAL MEDIA 📱📊💰⚡🚀');
      console.log('═'.repeat(80));
      console.log('✨ FEATURES:');
      console.log('   💰 Real-time SOL price updates (30s intervals)');
      console.log('   📊 Market cap, volume, and liquidity data from multiple sources');
      console.log('   📱 Social media analysis (Twitter, Telegram verification)');
      console.log('   ⭐ Social rating system (1-5 stars) with risk assessment');
      console.log('   🐋 Ultra fast whale consensus detection (10s intervals)');
      console.log('   📱 Enhanced Telegram alerts with social verification');
      console.log('   🏆 Whale win rate tracking from configuration');
      console.log('   🎯 Combined market + social risk scoring');
      console.log('   💾 Smart caching system (15min market, 30min social)');
      console.log('');
      console.log('📋 COMMANDS:');
      console.log('   npm start                     - Start enhanced monitoring');
      console.log('   npm start test <wallet>       - Test specific wallet');
      console.log('   npm start test-social <token> - Test social media analysis');
      console.log('   npm start config-social       - Configure social media settings');
      console.log('   npm start clear-cache         - Clear social media cache');
      console.log('   npm start cache-stats         - Show cache statistics');
      console.log('   npm start help                - Show this help');
      console.log('');
      console.log('📱 SOCIAL MEDIA FEATURES:');
      console.log('   🐦 Twitter account verification and follower analysis');
      console.log('   📱 Telegram community detection and member counting');
      console.log('   ⭐ 1-5 star social rating based on presence and engagement');
      console.log('   🚨 Social risk levels: LOW, MEDIUM, HIGH, VERY_HIGH');
      console.log('   👥 Community strength scoring (0-100)');
      console.log('   🎯 Combined market + social risk assessment');
      console.log('');
      console.log('⚙️ CONFIGURATION:');
      console.log('   📝 manualWallets.json - Wallet configuration + social settings');
      console.log('   📱 telegram.json - Telegram bot configuration');
      console.log('   📱 enableSocialAnalysis: true/false');
      console.log('   📱 socialAnalysisDelay: 2000-5000ms (recommended)');
      console.log('');
      console.log('📊 DATA SOURCES:');
      console.log('   💰 SOL Price: CoinGecko, Binance, Coinbase, Kraken');
      console.log('   📊 Market Data: DexScreener, CoinGecko, Birdeye, Jupiter');
      console.log('   📱 Social Data: Twitter, Telegram (no API keys required)');
      console.log('');
      console.log('🚀 PERFORMANCE:');
      console.log('   ⚡ 10-second whale detection cycles');
      console.log('   💾 Smart caching to prevent rate limiting');
      console.log('   🔄 Parallel processing of market + social data');
      console.log('   🚀 Ultra-fast RPC endpoints for maximum speed');
      console.log('');
      console.log('💡 EXAMPLES:');
      console.log('   npm start test 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU');
      console.log('   npm start test-social SOL');
      console.log('   npm start test-social BONK');
      console.log('═'.repeat(80));
      console.log('');
      process.exit(0);
      break;
      
    default:
      console.log(`❌ Unknown command: ${command}`);
      console.log('💡 Run "npm start help" to see available commands');
      console.log('');
      console.log('📱 NEW SOCIAL MEDIA COMMANDS:');
      console.log('   npm start test-social <token>  - Test social analysis');
      console.log('   npm start config-social        - Configure social settings');
      console.log('   npm start clear-cache          - Clear social cache');
      console.log('   npm start cache-stats          - Show cache statistics');
      process.exit(1);
  }
}

// 📱🎉 END OF ENHANCED WHALE MONITOR WITH SOCIAL MEDIA INTEGRATION
// ═══════════════════════════════════════════════════════════════════════════════
// 🚀 FEATURES ADDED:
// ✅ Social Media Analysis (Twitter, Telegram)
// ✅ Social Rating System (1-5 stars)
// ✅ Social Risk Assessment (LOW, MEDIUM, HIGH, VERY_HIGH)
// ✅ Community Strength Scoring (0-100)
// ✅ Combined Market + Social Risk Scoring
// ✅ Enhanced Telegram Alerts with Social Verification
// ✅ Smart Caching System for Social Data
// ✅ Configurable Social Analysis Settings
// ✅ Social Media Test Commands
// ✅ Cache Management Commands
// ✅ Complete CLI Interface
// ✅ All Original Functionality Preserved
// ═══════════════════════════════════════════════════════════════════════════════
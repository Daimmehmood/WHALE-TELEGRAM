// src/services/TelegramWhaleBot.ts - TELEGRAM WHALE CONSENSUS ALERTS 🚀📱
import axios from 'axios';
import { logger } from '../utils/logger';

interface WhaleConsensus {
  tokenMint: string;
  tokenSymbol: string;
  tokenName: string;
  whales: Array<{
    walletAddress: string;
    walletName?: string;
    amountSol: number;
    amountUsd: number;
    signature: string;
    timestamp: Date;
  }>;
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

export class TelegramWhaleBot {
  private config: TelegramConfig;
  private telegramAxios: any;

  constructor() {
    this.config = this.loadTelegramConfig();
    this.setupTelegramAxios();
    
    if (this.config.enabled) {
      logger.info('🤖 Telegram Whale Bot initialized successfully');
      this.testConnection();
    } else {
      logger.info('🤖 Telegram Bot disabled - Configure telegram.json to enable');
    }
  }

  private loadTelegramConfig(): TelegramConfig {
    try {
      const fs = require('fs');
      const path = require('path');
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
    const fs = require('fs');
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

  private setupTelegramAxios(): void {
    if (!this.config.botToken) {
      return;
    }

    this.telegramAxios = axios.create({
      baseURL: `https://api.telegram.org/bot${this.config.botToken}`,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  private async testConnection(): Promise<void> {
    if (!this.config.enabled || !this.config.botToken) {
      return;
    }

    try {
      const response = await this.telegramAxios.get('/getMe');
      if (response.data.ok) {
        logger.info(`🤖 Telegram Bot connected: @${response.data.result.username}`);
        // Send test message
        await this.sendMessage('🤖 Whale Consensus Bot connected successfully!\n⚡ Ready to send whale alerts to this group!');
      }
    } catch (error) {
      logger.error('❌ Telegram Bot connection failed:', error);
      logger.error('💡 Check your bot token and make sure bot is added to the group');
    }
  }

  private async sendMessage(text: string, parseMode: string = 'HTML'): Promise<boolean> {
    if (!this.config.enabled || !this.config.botToken || !this.config.chatId) {
      return false;
    }

    try {
      const response = await this.telegramAxios.post('/sendMessage', {
        chat_id: this.config.chatId,
        text: text,
        parse_mode: parseMode,
        disable_web_page_preview: true
      });

      if (response.data.ok) {
        logger.info('📱 Telegram message sent successfully');
        return true;
      } else {
        logger.error('❌ Telegram message failed:', response.data);
        return false;
      }
    } catch (error) {
      logger.error('❌ Telegram send error:', error);
      return false;
    }
  }

  // 🚨 MAIN METHOD: Send Individual Purchase Alert
  async sendIndividualPurchaseAlert(purchase: {
    walletAddress: string;
    walletName?: string;
    tokenMint: string;
    tokenSymbol?: string;
    tokenName?: string;
    amountSol: number;
    amountUsd: number;
    signature: string;
    timestamp: Date;
  }): Promise<void> {
    if (!this.config.enabled || !this.config.sendIndividualAlerts) {
      return;
    }

    const walletLabel = purchase.walletName || `${purchase.walletAddress.substring(0, 8)}...`;
    
    const message = `
🚨 <b>WHALE PURCHASE DETECTED!</b> 🐋

🐋 <b>Whale:</b> ${walletLabel}
🪙 <b>Token:</b> ${purchase.tokenSymbol || 'Unknown'}
💰 <b>Amount:</b> ${purchase.amountSol.toFixed(4)} SOL (~$${purchase.amountUsd.toFixed(2)})
🕐 <b>Time:</b> ${purchase.timestamp.toLocaleString()}

<b>🔗 Quick Links:</b>
📊 <a href="https://solscan.io/tx/${purchase.signature}">Transaction</a>
📈 <a href="https://dexscreener.com/solana/${purchase.tokenMint}">Chart</a>
🚀 <a href="https://pump.fun/${purchase.tokenMint}">Pump.fun</a>

⚡ Checking for whale consensus...
    `.trim();

    await this.sendMessage(message);
    logger.info('📱 Individual purchase alert sent to Telegram');
  }

  // 🚨🐋 MAIN METHOD: Send Whale Consensus Alert
  async sendWhaleConsensusAlert(consensus: WhaleConsensus): Promise<void> {
    if (!this.config.enabled || !this.config.sendConsensusAlerts) {
      return;
    }

    if (consensus.totalWhales < this.config.minConsensusWhales) {
      return;
    }

    // Calculate risk level
    const riskScore = this.calculateRiskScore(consensus);
    const signal = this.generateTradingSignal(consensus);

    const message = `
🚨🐋 <b>WHALE CONSENSUS ALERT!</b> 🚨🐋
🚨 <b>MULTIPLE WHALES BUYING SAME TOKEN!</b> 🚨

🪙 <b>TOKEN INFO:</b>
<b>Name:</b> ${consensus.tokenName}
<b>Symbol:</b> ${consensus.tokenSymbol}

🐋 <b>CONSENSUS DATA (${consensus.totalWhales} WHALES):</b>
<b>Total Whales:</b> ${consensus.totalWhales} whales
<b>Total Amount:</b> ${consensus.totalAmountSol.toFixed(4)} SOL (~$${consensus.totalAmountUsd.toFixed(2)})
<b>Average per Whale:</b> $${(consensus.totalAmountUsd / consensus.totalWhales).toFixed(2)}
<b>Time Span:</b> ${this.formatTimeDifference(consensus.firstPurchaseTime, consensus.lastPurchaseTime)}

⚠️ <b>RISK ASSESSMENT:</b>
<b>Risk Level:</b> ${riskScore.level}
<b>Risk Score:</b> ${riskScore.score}/100
<b>Assessment:</b> ${riskScore.assessment}

📈 <b>TRADING SIGNAL:</b>
<b>Signal:</b> ${signal.type}
<b>Confidence:</b> ${signal.confidence}%
<b>Recommendation:</b> ${signal.recommendation}

🐋 <b>WHALE PURCHASES:</b>
${consensus.whales.map((whale, index) => {
  const walletLabel = whale.walletName || `${whale.walletAddress.substring(0, 8)}...`;
  return `${index + 1}. 🐋 ${walletLabel}\n   💰 $${whale.amountUsd.toFixed(2)} • ${whale.timestamp.toLocaleTimeString()}`;
}).join('\n')}

<b>🔗 ACTION LINKS:</b>
📈 <a href="https://dexscreener.com/solana/${consensus.tokenMint}">DexScreener Chart</a>
🚀 <a href="https://pump.fun/${consensus.tokenMint}">Pump.fun</a>
📋 <a href="https://solscan.io/token/${consensus.tokenMint}">Token Info</a>

🚨 <b>WHALE CONSENSUS DETECTED - CONSIDER IMMEDIATE ACTION!</b> 🚨
    `.trim();

    // Split message if too long (Telegram limit is 4096 characters)
    if (message.length > 4000) {
      await this.sendLongConsensusAlert(consensus);
    } else {
      await this.sendMessage(message);
    }

    logger.info('📱🐋 Whale consensus alert sent to Telegram');
  }

  // 📱 Send long consensus alert in multiple messages
  private async sendLongConsensusAlert(consensus: WhaleConsensus): Promise<void> {
    // Message 1: Main alert
    const mainMessage = `
🚨🐋 <b>WHALE CONSENSUS ALERT!</b> 🚨🐋
🚨 <b>${consensus.totalWhales} WHALES BUYING ${consensus.tokenSymbol}!</b> 🚨

🪙 <b>TOKEN:</b> ${consensus.tokenName} (${consensus.tokenSymbol})

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

    // Message 2: Individual whale details
    const whaleDetails = `
🐋 <b>INDIVIDUAL WHALE PURCHASES:</b>

${consensus.whales.map((whale, index) => {
  const walletLabel = whale.walletName || `Whale ${whale.walletAddress.substring(0, 8)}...`;
  return `${index + 1}. 🐋 <b>${walletLabel}</b>\n   💰 ${whale.amountSol.toFixed(4)} SOL (~$${whale.amountUsd.toFixed(2)})\n   🕐 ${whale.timestamp.toLocaleString()}\n   📊 <a href="https://solscan.io/tx/${whale.signature}">TX</a>`;
}).join('\n\n')}
    `.trim();

    await this.sendMessage(whaleDetails);
  }

  // 🎯 Calculate risk score for Telegram display
  private calculateRiskScore(consensus: WhaleConsensus): { level: string; score: number; assessment: string } {
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
    
    const avgPurchase = consensus.totalAmountUsd / consensus.totalWhales;
    if (avgPurchase >= 2000) score += 10;
    else if (avgPurchase >= 1000) score += 5;
    
    let level = 'LOW';
    let assessment = 'Weak signal';
    
    if (score >= 80) {
      level = 'VERY HIGH';
      assessment = 'Extremely strong whale consensus';
    } else if (score >= 60) {
      level = 'HIGH';
      assessment = 'Strong whale consensus';
    } else if (score >= 40) {
      level = 'MEDIUM';
      assessment = 'Moderate whale interest';
    }
    
    return { level, score, assessment };
  }

  // 📈 Generate trading signal for Telegram display
  private generateTradingSignal(consensus: WhaleConsensus): { type: string; confidence: number; recommendation: string } {
    let confidence = 50;
    
    confidence += consensus.totalWhales * 10;
    
    const avgAmount = consensus.totalAmountUsd / consensus.totalWhales;
    if (avgAmount >= 2000) confidence += 20;
    else if (avgAmount >= 1000) confidence += 10;
    
    const timeSpan = consensus.lastPurchaseTime.getTime() - consensus.firstPurchaseTime.getTime();
    if (timeSpan <= 5 * 60 * 1000) confidence += 15;
    else if (timeSpan <= 15 * 60 * 1000) confidence += 10;
    
    confidence = Math.min(confidence, 95);
    
    let type = 'HOLD';
    let recommendation = 'Monitor position';
    
    if (confidence >= 80) {
      type = 'STRONG BUY';
      recommendation = 'Consider immediate purchase';
    } else if (confidence >= 70) {
      type = 'BUY';
      recommendation = 'Good buying opportunity';
    } else if (confidence >= 60) {
      type = 'WEAK BUY';
      recommendation = 'Monitor closely';
    }
    
    return { type, confidence, recommendation };
  }

  // ⏰ Format time difference for Telegram
  private formatTimeDifference(startTime: Date, endTime: Date): string {
    const diffMs = endTime.getTime() - startTime.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffSeconds = Math.floor((diffMs % (1000 * 60)) / 1000);
    
    if (diffMinutes === 0) {
      return `${diffSeconds}s`;
    } else if (diffMinutes < 60) {
      return `${diffMinutes}m ${diffSeconds}s`;
    } else {
      const hours = Math.floor(diffMinutes / 60);
      const mins = diffMinutes % 60;
      return `${hours}h ${mins}m`;
    }
  }

  // 🧪 Test Telegram bot
  async sendTestMessage(): Promise<void> {
    if (!this.config.enabled) {
      logger.warn('🤖 Telegram bot disabled - Cannot send test message');
      return;
    }

    const testMessage = `
🧪 <b>TELEGRAM BOT TEST</b> 🤖

✅ Bot is working correctly!
📱 Connected to: ${this.config.chatId}
🐋 Ready to send whale consensus alerts
⚡ Monitoring active

<i>This is a test message from your Whale Consensus Bot</i>
    `.trim();

    const success = await this.sendMessage(testMessage);
    if (success) {
      logger.info('✅ Telegram test message sent successfully');
    } else {
      logger.error('❌ Failed to send Telegram test message');
    }
  }

  // 📊 Get bot status
  getBotStatus(): { enabled: boolean; configured: boolean; chatId: string } {
    return {
      enabled: this.config.enabled,
      configured: !!(this.config.botToken && this.config.chatId),
      chatId: this.config.chatId
    };
  }

  // ⚙️ Update bot configuration
  updateConfig(newConfig: Partial<TelegramConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    if (this.config.botToken) {
      this.setupTelegramAxios();
    }
    
    logger.info('🤖 Telegram bot configuration updated');
  }
}
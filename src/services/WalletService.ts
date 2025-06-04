// src/services/WalletService.ts
import { Wallet } from '../models/Wallet';
import { WhaleWallet, ScrapedWalletData } from '../types/wallet';
import { logger } from '../utils/logger';

export class WalletService {
  async saveWallets(scrapedWallets: ScrapedWalletData[]): Promise<void> {
    logger.info(`💾 Saving ${scrapedWallets.length} wallets to database`);
    
    let newWallets = 0;
    let updatedWallets = 0;
    
    for (const scraped of scrapedWallets) {
      try {
        const existingWallet = await Wallet.findOne({ address: scraped.address });
        
        const walletDoc = await Wallet.findOneAndUpdate(
          { address: scraped.address },
          {
            address: scraped.address,
            winRate: scraped.winRate,
            pnl: scraped.pnl,
            totalTrades: scraped.totalTrades,
            tradingDays: scraped.tradingDays,
            lastActive: new Date(),
            solanaTokens: scraped.recentTokens,
            pumpFunTokens: [],
            avgTradeSize: scraped.avgTradeSize,
            minPurchaseSize: scraped.minPurchaseSize,
            maxPurchaseSize: scraped.maxPurchaseSize,
            last30DaysPnl: scraped.last30DaysPnl,
            last30DaysWinRate: scraped.last30DaysWinRate,
            activeTradingDays: scraped.activeTradingDays,
            updatedAt: new Date()
          },
          { 
            upsert: true, 
            new: true,
            setDefaultsOnInsert: true
          }
        );
        
        if (existingWallet) {
          updatedWallets++;
        } else {
          newWallets++;
        }
        
      } catch (error) {
        logger.error(`❌ Failed to save wallet ${scraped.address}:`, error);
      }
    }
    
    logger.info(`✅ Database updated - New: ${newWallets}, Updated: ${updatedWallets}`);
  }

  async getAllWallets(): Promise<WhaleWallet[]> {
    return await Wallet.find({}).sort({ winRate: -1, pnl: -1 }).lean();
  }

  async getQualifiedWallets(): Promise<WhaleWallet[]> {
    const minWinRate = parseFloat(process.env.MIN_WIN_RATE || '50');
    const minPnl = parseFloat(process.env.MIN_PNL || '0');
    const minTradingDays = parseInt(process.env.MIN_TRADING_DAYS || '30');
    const minPurchaseSize = parseFloat(process.env.MIN_PURCHASE_SIZE || '500');
    
    logger.info(`🔍 Searching for wallets with criteria: WinRate≥${minWinRate}%, PNL≥${minPnl}, TradingDays≥${minTradingDays}, MinPurchase≥${minPurchaseSize}`);
    
    // Simple query that matches the scraper logic exactly
    const qualifiedWallets = await Wallet.find({
      winRate: { $gte: minWinRate },
      pnl: { $gt: minPnl },
      tradingDays: { $gte: minTradingDays },
      avgTradeSize: { $gte: minPurchaseSize }
    }).sort({ winRate: -1, pnl: -1 }).lean();
    
    logger.info(`🎯 Found ${qualifiedWallets.length} qualified wallets in database`);
    
    // Log a few examples for debugging
    if (qualifiedWallets.length > 0) {
      logger.info(`📋 First qualified wallet: ${qualifiedWallets[0].address.substring(0, 8)}... - WinRate: ${qualifiedWallets[0].winRate}%`);
    }
    
    return qualifiedWallets;
  }

  async getWalletByAddress(address: string): Promise<WhaleWallet | null> {
    return await Wallet.findOne({ address }).lean();
  }

  async updateWalletTokens(address: string, tokens: string[]): Promise<void> {
    await Wallet.findOneAndUpdate(
      { address },
      { 
        solanaTokens: tokens,
        updatedAt: new Date()
      }
    );
  }

  async getTotalWalletCount(): Promise<number> {
    return await Wallet.countDocuments({});
  }

  async getQualificationStats(): Promise<{
    total: number;
    qualified: number;
    qualificationRate: number;
    criteria: {
      winRate: number;
      pnl: number;
      tradingDays: number;
      minPurchase: number;
    };
    breakdown: {
      passedWinRate: number;
      passedPnl: number;
      passedTradingDays: number;
      passedMinPurchase: number;
    };
  }> {
    const total = await this.getTotalWalletCount();
    const qualified = await this.getQualifiedWallets();
    
    // Get breakdown stats
    const allWallets = await this.getAllWallets();
    const minWinRate = parseFloat(process.env.MIN_WIN_RATE || '50');
    const minPnl = parseFloat(process.env.MIN_PNL || '0');
    const minTradingDays = parseInt(process.env.MIN_TRADING_DAYS || '30');
    const minPurchaseSize = parseFloat(process.env.MIN_PURCHASE_SIZE || '500');
    
    const breakdown = {
      passedWinRate: allWallets.filter(w => w.winRate >= minWinRate).length,
      passedPnl: allWallets.filter(w => w.pnl > minPnl).length,
      passedTradingDays: allWallets.filter(w => w.tradingDays >= minTradingDays).length,
      passedMinPurchase: allWallets.filter(w => w.avgTradeSize >= minPurchaseSize).length
    };
    
    logger.info(`📊 Breakdown - WinRate: ${breakdown.passedWinRate}, PNL: ${breakdown.passedPnl}, TradingDays: ${breakdown.passedTradingDays}, MinPurchase: ${breakdown.passedMinPurchase}`);
    
    return {
      total,
      qualified: qualified.length,
      qualificationRate: total > 0 ? (qualified.length / total) * 100 : 0,
      criteria: {
        winRate: minWinRate,
        pnl: minPnl,
        tradingDays: minTradingDays,
        minPurchase: minPurchaseSize
      },
      breakdown
    };
  }

  async getRecentlyUpdatedWallets(hours: number = 24): Promise<WhaleWallet[]> {
    const cutoffTime = new Date(Date.now() - (hours * 60 * 60 * 1000));
    
    return await Wallet.find({
      updatedAt: { $gte: cutoffTime }
    }).sort({ updatedAt: -1 }).lean();
  }

  // Debug method to check actual data
  async debugWalletData(): Promise<void> {
    const sampleWallets = await Wallet.find({}).limit(5).lean();
    
    logger.info(`🐛 DEBUG - Sample wallet data:`);
    sampleWallets.forEach((wallet, index) => {
      logger.info(`${index + 1}. ${wallet.address.substring(0, 8)}... - WinRate: ${wallet.winRate}%, PNL: $${wallet.pnl}, AvgTrade: $${wallet.avgTradeSize}`);
    });
  }
}
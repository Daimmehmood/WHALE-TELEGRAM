"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WalletService = void 0;
// src/services/WalletService.ts
const Wallet_1 = require("../models/Wallet");
const logger_1 = require("../utils/logger");
class WalletService {
    async saveWallets(scrapedWallets) {
        logger_1.logger.info(`💾 Saving ${scrapedWallets.length} wallets to database`);
        let newWallets = 0;
        let updatedWallets = 0;
        for (const scraped of scrapedWallets) {
            try {
                const existingWallet = await Wallet_1.Wallet.findOne({ address: scraped.address });
                const walletDoc = await Wallet_1.Wallet.findOneAndUpdate({ address: scraped.address }, {
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
                }, {
                    upsert: true,
                    new: true,
                    setDefaultsOnInsert: true
                });
                if (existingWallet) {
                    updatedWallets++;
                }
                else {
                    newWallets++;
                }
            }
            catch (error) {
                logger_1.logger.error(`❌ Failed to save wallet ${scraped.address}:`, error);
            }
        }
        logger_1.logger.info(`✅ Database updated - New: ${newWallets}, Updated: ${updatedWallets}`);
    }
    async getAllWallets() {
        return await Wallet_1.Wallet.find({}).sort({ winRate: -1, pnl: -1 }).lean();
    }
    async getQualifiedWallets() {
        const minWinRate = parseFloat(process.env.MIN_WIN_RATE || '50');
        const minPnl = parseFloat(process.env.MIN_PNL || '0');
        const minTradingDays = parseInt(process.env.MIN_TRADING_DAYS || '30');
        const minPurchaseSize = parseFloat(process.env.MIN_PURCHASE_SIZE || '500');
        logger_1.logger.info(`🔍 Searching for wallets with criteria: WinRate≥${minWinRate}%, PNL≥${minPnl}, TradingDays≥${minTradingDays}, MinPurchase≥${minPurchaseSize}`);
        // Simple query that matches the scraper logic exactly
        const qualifiedWallets = await Wallet_1.Wallet.find({
            winRate: { $gte: minWinRate },
            pnl: { $gt: minPnl },
            tradingDays: { $gte: minTradingDays },
            avgTradeSize: { $gte: minPurchaseSize }
        }).sort({ winRate: -1, pnl: -1 }).lean();
        logger_1.logger.info(`🎯 Found ${qualifiedWallets.length} qualified wallets in database`);
        // Log a few examples for debugging
        if (qualifiedWallets.length > 0) {
            logger_1.logger.info(`📋 First qualified wallet: ${qualifiedWallets[0].address.substring(0, 8)}... - WinRate: ${qualifiedWallets[0].winRate}%`);
        }
        return qualifiedWallets;
    }
    async getWalletByAddress(address) {
        return await Wallet_1.Wallet.findOne({ address }).lean();
    }
    async updateWalletTokens(address, tokens) {
        await Wallet_1.Wallet.findOneAndUpdate({ address }, {
            solanaTokens: tokens,
            updatedAt: new Date()
        });
    }
    async getTotalWalletCount() {
        return await Wallet_1.Wallet.countDocuments({});
    }
    async getQualificationStats() {
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
        logger_1.logger.info(`📊 Breakdown - WinRate: ${breakdown.passedWinRate}, PNL: ${breakdown.passedPnl}, TradingDays: ${breakdown.passedTradingDays}, MinPurchase: ${breakdown.passedMinPurchase}`);
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
    async getRecentlyUpdatedWallets(hours = 24) {
        const cutoffTime = new Date(Date.now() - (hours * 60 * 60 * 1000));
        return await Wallet_1.Wallet.find({
            updatedAt: { $gte: cutoffTime }
        }).sort({ updatedAt: -1 }).lean();
    }
    // Debug method to check actual data
    async debugWalletData() {
        const sampleWallets = await Wallet_1.Wallet.find({}).limit(5).lean();
        logger_1.logger.info(`🐛 DEBUG - Sample wallet data:`);
        sampleWallets.forEach((wallet, index) => {
            logger_1.logger.info(`${index + 1}. ${wallet.address.substring(0, 8)}... - WinRate: ${wallet.winRate}%, PNL: $${wallet.pnl}, AvgTrade: $${wallet.avgTradeSize}`);
        });
    }
}
exports.WalletService = WalletService;

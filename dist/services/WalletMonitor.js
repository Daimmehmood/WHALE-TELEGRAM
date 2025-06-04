"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WalletMonitor = void 0;
// src/services/WalletMonitor.ts
const axios_1 = __importDefault(require("axios"));
const logger_1 = require("../utils/logger");
const WalletService_1 = require("./WalletService");
class WalletMonitor {
    constructor() {
        this.isMonitoring = false;
        this.monitoringInterval = null;
        this.qualifiedWallets = [];
        this.lastCheckedTimes = new Map();
        this.SOLSCAN_API_KEY = process.env.SOLSCAN_API_KEY || '';
        this.SOL_PRICE_USD = 200; // Approximate SOL price in USD
        this.CHECK_INTERVAL = 30000; // 30 seconds
        this.MIN_PURCHASE_USD = 1500; // Minimum purchase amount in USD
        this.walletService = new WalletService_1.WalletService();
    }
    async startMonitoring() {
        if (this.isMonitoring) {
            logger_1.logger.warn('⚠️ Wallet monitoring is already running');
            return;
        }
        logger_1.logger.info('🚀 Starting real-time wallet monitoring...');
        // Load qualified wallets
        await this.loadQualifiedWallets();
        if (this.qualifiedWallets.length === 0) {
            logger_1.logger.warn('❌ No qualified wallets found. Please run scraper first.');
            return;
        }
        this.isMonitoring = true;
        // Initialize last checked times (30 minutes ago to avoid spam on startup)
        const thirtyMinutesAgo = Date.now() - (30 * 60 * 1000);
        this.qualifiedWallets.forEach(wallet => {
            this.lastCheckedTimes.set(wallet.address, Math.floor(thirtyMinutesAgo / 1000));
        });
        logger_1.logger.info(`👁️ Monitoring ${this.qualifiedWallets.length} qualified whale wallets`);
        this.displayMonitoringStatus();
        // Start monitoring loop
        this.monitoringInterval = setInterval(async () => {
            await this.checkAllWallets();
        }, this.CHECK_INTERVAL);
        // Initial check
        await this.checkAllWallets();
    }
    async stopMonitoring() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }
        this.isMonitoring = false;
        logger_1.logger.info('🛑 Wallet monitoring stopped');
    }
    async loadQualifiedWallets() {
        try {
            this.qualifiedWallets = await this.walletService.getQualifiedWallets();
            logger_1.logger.info(`📋 Loaded ${this.qualifiedWallets.length} qualified wallets for monitoring`);
        }
        catch (error) {
            logger_1.logger.error('❌ Failed to load qualified wallets:', error);
            throw error;
        }
    }
    displayMonitoringStatus() {
        console.log('\n' + '='.repeat(80));
        console.log('👁️ REAL-TIME WHALE WALLET MONITORING ACTIVE');
        console.log('='.repeat(80));
        console.log(`🐋 Monitoring Wallets: ${this.qualifiedWallets.length}`);
        console.log(`💰 Min Purchase Alert: $${this.MIN_PURCHASE_USD}`);
        console.log(`⏱️ Check Interval: ${this.CHECK_INTERVAL / 1000}s`);
        console.log(`📡 Using Solscan API: ${this.SOLSCAN_API_KEY ? 'Yes' : 'No (Rate Limited)'}`);
        console.log('='.repeat(80));
        console.log('🔍 Watching for token purchases...\n');
    }
    async checkAllWallets() {
        const purchases = [];
        for (const wallet of this.qualifiedWallets) {
            try {
                const walletPurchases = await this.checkWalletTransactions(wallet.address);
                purchases.push(...walletPurchases);
                // Small delay between API calls to avoid rate limiting
                await this.delay(200);
            }
            catch (error) {
                logger_1.logger.warn(`⚠️ Failed to check wallet ${wallet.address.substring(0, 8)}...:`, error);
            }
        }
        if (purchases.length > 0) {
            this.alertTokenPurchases(purchases);
        }
    }
    async checkWalletTransactions(walletAddress) {
        try {
            const lastChecked = this.lastCheckedTimes.get(walletAddress) || Math.floor(Date.now() / 1000) - 3600;
            // Get recent transactions from Solscan
            const transactions = await this.getSolscanTransactions(walletAddress);
            if (!transactions || transactions.length === 0) {
                return [];
            }
            const purchases = [];
            let latestTimestamp = lastChecked;
            for (const tx of transactions) {
                // Skip if transaction is older than last checked
                if (tx.blockTime <= lastChecked) {
                    continue;
                }
                // Update latest timestamp
                if (tx.blockTime > latestTimestamp) {
                    latestTimestamp = tx.blockTime;
                }
                // Skip failed transactions
                if (tx.status !== 'Success') {
                    continue;
                }
                // Parse token purchases from transaction
                const purchase = await this.parseTokenPurchase(tx, walletAddress);
                if (purchase && purchase.amountUsd >= this.MIN_PURCHASE_USD) {
                    purchases.push(purchase);
                }
            }
            // Update last checked time
            this.lastCheckedTimes.set(walletAddress, latestTimestamp);
            return purchases;
        }
        catch (error) {
            logger_1.logger.warn(`Error checking transactions for ${walletAddress}:`, error);
            return [];
        }
    }
    async getSolscanTransactions(walletAddress) {
        try {
            const headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            };
            // Add API key if available
            if (this.SOLSCAN_API_KEY) {
                headers['token'] = this.SOLSCAN_API_KEY;
            }
            const response = await axios_1.default.get(`https://pro-api.solscan.io/v1.0/account/transactions`, {
                params: {
                    account: walletAddress,
                    limit: 50
                },
                headers,
                timeout: 10000
            });
            return response.data.data || [];
        }
        catch (error) {
            if (error.response?.status === 429) {
                logger_1.logger.warn('⚠️ Solscan API rate limit reached, using fallback...');
                return await this.getFallbackTransactions(walletAddress);
            }
            throw error;
        }
    }
    async getFallbackTransactions(walletAddress) {
        try {
            // Fallback to public Solscan endpoint (more limited)
            const response = await axios_1.default.get(`https://public-api.solscan.io/account/transactions`, {
                params: {
                    account: walletAddress,
                    limit: 20
                },
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                timeout: 10000
            });
            return response.data || [];
        }
        catch (error) {
            logger_1.logger.warn('Fallback API also failed:', error);
            return [];
        }
    }
    async parseTokenPurchase(tx, walletAddress) {
        try {
            // Look for token transfer instructions
            for (const instruction of tx.parsedInstruction || []) {
                if (this.isTokenPurchaseInstruction(instruction, walletAddress)) {
                    const tokenMint = instruction.info?.mint;
                    const amount = instruction.info?.amount;
                    if (tokenMint && amount) {
                        const solAmount = this.calculateSolAmount(tx, walletAddress);
                        const usdAmount = solAmount * this.SOL_PRICE_USD;
                        // Get token info
                        const tokenInfo = await this.getTokenInfo(tokenMint);
                        return {
                            walletAddress,
                            tokenMint,
                            tokenSymbol: tokenInfo?.symbol || 'UNKNOWN',
                            amountSol: solAmount,
                            amountUsd: usdAmount,
                            signature: tx.signature,
                            timestamp: new Date(tx.blockTime * 1000),
                            tokenAddress: tokenMint
                        };
                    }
                }
            }
            return null;
        }
        catch (error) {
            logger_1.logger.warn('Error parsing token purchase:', error);
            return null;
        }
    }
    isTokenPurchaseInstruction(instruction, walletAddress) {
        // Check if this is a token transfer to the wallet (indicating a purchase)
        return (instruction.type === 'transfer' &&
            instruction.info?.destination === walletAddress &&
            instruction.info?.mint !== undefined);
    }
    calculateSolAmount(tx, walletAddress) {
        // Calculate SOL amount based on transaction fee and lamports
        // This is a simplified calculation - in reality you'd need more complex parsing
        const lamports = Math.abs(tx.lamport || 0);
        return lamports / 1000000000; // Convert lamports to SOL
    }
    async getTokenInfo(tokenMint) {
        try {
            // Try to get token info from a public API
            const response = await axios_1.default.get(`https://public-api.solscan.io/token/meta`, {
                params: { tokenAddress: tokenMint },
                timeout: 5000
            });
            return {
                symbol: response.data?.symbol || 'UNKNOWN',
                name: response.data?.name || 'Unknown Token'
            };
        }
        catch (error) {
            return { symbol: 'UNKNOWN', name: 'Unknown Token' };
        }
    }
    alertTokenPurchases(purchases) {
        purchases.forEach(purchase => {
            this.displayPurchaseAlert(purchase);
        });
    }
    displayPurchaseAlert(purchase) {
        console.log('\n' + '🚨'.repeat(20));
        console.log('🚨 WHALE TOKEN PURCHASE DETECTED! 🚨');
        console.log('🚨'.repeat(20));
        console.log(`🐋 Whale Wallet: ${purchase.walletAddress}`);
        console.log(`🪙 Token: ${purchase.tokenSymbol} (${purchase.tokenMint})`);
        console.log(`💰 Purchase Amount: ${purchase.amountSol.toFixed(4)} SOL (~$${purchase.amountUsd.toFixed(2)})`);
        console.log(`🕐 Time: ${purchase.timestamp.toLocaleString()}`);
        console.log(`🔗 Transaction: https://solscan.io/tx/${purchase.signature}`);
        console.log(`🌐 Token Info: https://solscan.io/token/${purchase.tokenMint}`);
        if (purchase.tokenSymbol !== 'UNKNOWN') {
            console.log(`📈 Pump.fun: https://pump.fun/${purchase.tokenMint}`);
        }
        console.log('🚨'.repeat(20) + '\n');
        // Log to file as well
        logger_1.logger.info('🚨 WHALE PURCHASE DETECTED', {
            wallet: purchase.walletAddress,
            token: purchase.tokenSymbol,
            tokenMint: purchase.tokenMint,
            amountSol: purchase.amountSol,
            amountUsd: purchase.amountUsd,
            signature: purchase.signature,
            timestamp: purchase.timestamp
        });
    }
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    // Method to manually check a specific wallet (for testing)
    async testWalletMonitoring(walletAddress) {
        logger_1.logger.info(`🧪 Testing monitoring for wallet: ${walletAddress}`);
        try {
            const purchases = await this.checkWalletTransactions(walletAddress);
            if (purchases.length > 0) {
                console.log(`✅ Found ${purchases.length} recent purchases:`);
                purchases.forEach(purchase => this.displayPurchaseAlert(purchase));
            }
            else {
                console.log('❌ No recent purchases found for this wallet');
            }
        }
        catch (error) {
            logger_1.logger.error('❌ Test failed:', error);
        }
    }
    getMonitoringStatus() {
        return {
            isActive: this.isMonitoring,
            walletsCount: this.qualifiedWallets.length,
            checkInterval: this.CHECK_INTERVAL,
            minPurchaseUsd: this.MIN_PURCHASE_USD
        };
    }
}
exports.WalletMonitor = WalletMonitor;

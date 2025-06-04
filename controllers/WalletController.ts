// src/controllers/WalletController.ts
import { Request, Response } from 'express';
import { WalletService } from '../services/WalletService';
import { logger } from '../utils/logger';

export class WalletController {
  private walletService: WalletService;

  constructor() {
    this.walletService = new WalletService();
  }

  // Add this method to WalletController class



// Add this method to src/controllers/WalletController.ts

async debugWallets(req: Request, res: Response): Promise<void> {
  try {
    // Get sample data for debugging
    const allWallets = await this.walletService.getAllWallets();
    const sampleWallets = allWallets.slice(0, 10);
    
    const minWinRate = parseFloat(process.env.MIN_WIN_RATE || '50');
    const minPurchaseSize = parseFloat(process.env.MIN_PURCHASE_SIZE || '500');
    
    const debugInfo = sampleWallets.map(wallet => ({
      address: wallet.address.substring(0, 8) + '...',
      winRate: wallet.winRate,
      pnl: wallet.pnl,
      avgTradeSize: wallet.avgTradeSize,
      qualifies: {
        winRate: wallet.winRate >= minWinRate,
        pnl: wallet.pnl > 0,
        avgTrade: wallet.avgTradeSize >= minPurchaseSize
      }
    }));
    
    res.json({
      success: true,
      criteria: {
        minWinRate,
        minPurchaseSize
      },
      sampleData: debugInfo,
      totalWallets: allWallets.length
    });
  } catch (error) {
    logger.error('Debug error:', error);
    res.status(500).json({ success: false, error: 'Debug failed' });
  }
}

  async getWallets(req: Request, res: Response): Promise<void> {
    try {
      const { 
        limit = 50, 
        offset = 0, 
        minWinRate, 
        minPnl,
        sortBy = 'winRate',
        sortOrder = 'desc'
      } = req.query;

      const wallets = await this.walletService.getAllWallets();
      
      // Apply additional filters if provided
      let filtered = wallets;
      if (minWinRate) {
        filtered = filtered.filter(w => w.winRate >= Number(minWinRate));
      }
      if (minPnl) {
        filtered = filtered.filter(w => w.pnl >= Number(minPnl));
      }

      // Apply sorting
      filtered.sort((a, b) => {
        const aVal = a[sortBy as keyof typeof a] as number;
        const bVal = b[sortBy as keyof typeof b] as number;
        return sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
      });

      // Apply pagination
      const paginated = filtered.slice(
        Number(offset), 
        Number(offset) + Number(limit)
      );

      res.json({
        success: true,
        data: paginated,
        total: filtered.length,
        limit: Number(limit),
        offset: Number(offset)
      });
    } catch (error) {
      logger.error('Error fetching wallets:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch wallets'
      });
    }
  }

  async getQualifiedWallets(req: Request, res: Response): Promise<void> {
    try {
      const { limit = 50, offset = 0 } = req.query;

      const qualifiedWallets = await this.walletService.getQualifiedWallets();
      
      // Apply pagination
      const paginated = qualifiedWallets.slice(
        Number(offset), 
        Number(offset) + Number(limit)
      );

      res.json({
        success: true,
        data: paginated,
        total: qualifiedWallets.length,
        limit: Number(limit),
        offset: Number(offset),
        message: `Found ${qualifiedWallets.length} qualified whale wallets`
      });
    } catch (error) {
      logger.error('Error fetching qualified wallets:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch qualified wallets'
      });
    }
  }

  async getWallet(req: Request, res: Response): Promise<void> {
    try {
      const { address } = req.params;
      const wallet = await this.walletService.getWalletByAddress(address);
      
      if (!wallet) {
        res.status(404).json({
          success: false,
          error: 'Wallet not found'
        });
        return;
      }

      res.json({
        success: true,
        data: wallet
      });
    } catch (error) {
      logger.error('Error fetching wallet:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch wallet'
      });
    }
  }

  async getStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = await this.walletService.getQualificationStats();
      
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      logger.error('Error fetching stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch stats'
      });
    }
  }
}
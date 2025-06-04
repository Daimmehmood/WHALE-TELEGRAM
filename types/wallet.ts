// src/types/wallet.ts
export interface WhaleWallet {
  address: string;
  winRate: number;
  pnl: number;
  totalTrades: number;
  tradingDays: number;
  lastActive: Date;
  solanaTokens: string[];
  pumpFunTokens: string[];
  avgTradeSize: number;
  minPurchaseSize?: number;
  maxPurchaseSize?: number;
  last30DaysPnl?: number;
  last30DaysWinRate?: number;
  activeTradingDays?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ScrapedWalletData {
  address: string;
  winRate: number;
  pnl: number;
  totalTrades: number;
  tradingDays: number;
  recentTokens: string[];
  avgTradeSize: number;
  minPurchaseSize?: number;
  maxPurchaseSize?: number;
  last30DaysPnl?: number;
  last30DaysWinRate?: number;
  activeTradingDays?: number;
}
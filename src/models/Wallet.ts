// src/models/Wallet.ts
import mongoose, { Schema, Document } from 'mongoose';
import { WhaleWallet } from '../types/wallet';

interface WalletDocument extends WhaleWallet, Document {}

const WalletSchema = new Schema<WalletDocument>({
  address: { type: String, required: true, unique: true, index: true },
  winRate: { type: Number, required: true, min: 0, max: 100 },
  pnl: { type: Number, required: true },
  totalTrades: { type: Number, required: true, min: 0 },
  tradingDays: { type: Number, required: true, min: 0 },
  lastActive: { type: Date, required: true },
  solanaTokens: [{ type: String }],
  pumpFunTokens: [{ type: String }],
  avgTradeSize: { type: Number, required: true, min: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Add indexes for efficient querying
WalletSchema.index({ winRate: -1 });
WalletSchema.index({ pnl: -1 });
WalletSchema.index({ lastActive: -1 });
WalletSchema.index({ 
  winRate: -1, 
  pnl: -1, 
  tradingDays: -1 
});

WalletSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

export const Wallet = mongoose.model<WalletDocument>('Wallet', WalletSchema);
// src/routes/wallets.ts
import { Router } from 'express';
import { WalletController } from '../controllers/WalletController';

const router = Router();
const walletController = new WalletController();

// Get all wallets
router.get('/', walletController.getWallets.bind(walletController));

// Get only qualified wallets
router.get('/qualified', walletController.getQualifiedWallets.bind(walletController));

// Get wallet statistics
router.get('/stats', walletController.getStats.bind(walletController));

// DEBUG route - MUST be before /:address route
router.get('/debug', walletController.debugWallets.bind(walletController));

// Get specific wallet by address - MUST be last
router.get('/:address', walletController.getWallet.bind(walletController));

export default router;
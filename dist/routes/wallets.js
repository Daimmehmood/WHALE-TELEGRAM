"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// src/routes/wallets.ts
const express_1 = require("express");
const WalletController_1 = require("../controllers/WalletController");
const router = (0, express_1.Router)();
const walletController = new WalletController_1.WalletController();
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
exports.default = router;

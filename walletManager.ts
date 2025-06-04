// src/walletManager.ts
import * as fs from 'fs';
import * as path from 'path';
import { logger } from './utils/logger';

interface ManualWallet {
  address: string;
  name: string;
  description: string;
  enabled: boolean;
  addedDate: string;
  lastChecked?: string;
}

interface ManualWalletsConfig {
  manualWallets: ManualWallet[];
  settings: {
    minPurchaseUsd: number;
    checkIntervalSeconds: number;
    enableQualifiedWallets: boolean;
    enableManualWallets: boolean;
    solPriceUsd: number;
  };
  metadata: {
    version: string;
    lastUpdated: string;
    totalWallets: number;
  };
}

class WalletManager {
  private readonly CONFIG_FILE = 'manualWallets.json';
  private configPath: string;

  constructor() {
    this.configPath = path.join(process.cwd(), this.CONFIG_FILE);
  }

  private loadConfig(): ManualWalletsConfig {
    try {
      if (!fs.existsSync(this.configPath)) {
        return this.createDefaultConfig();
      }
      
      const configData = fs.readFileSync(this.configPath, 'utf8');
      const config = JSON.parse(configData);
      
      // Update metadata
      config.metadata = config.metadata || {};
      config.metadata.totalWallets = config.manualWallets?.length || 0;
      
      return config;
    } catch (error) {
      console.error('❌ Failed to load config:', error);
      return this.createDefaultConfig();
    }
  }

  private createDefaultConfig(): ManualWalletsConfig {
    const defaultConfig: ManualWalletsConfig = {
      manualWallets: [],
      settings: {
        minPurchaseUsd: 50,
        checkIntervalSeconds: 30,
        enableQualifiedWallets: true,
        enableManualWallets: true,
        solPriceUsd: 200
      },
      metadata: {
        version: '1.0.0',
        lastUpdated: new Date().toISOString(),
        totalWallets: 0
      }
    };
    
    this.saveConfig(defaultConfig);
    console.log(`📝 Created default configuration file: ${this.CONFIG_FILE}`);
    return defaultConfig;
  }

  private saveConfig(config: ManualWalletsConfig): void {
    try {
      // Update metadata before saving
      config.metadata.lastUpdated = new Date().toISOString();
      config.metadata.totalWallets = config.manualWallets.length;
      
      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
      console.log(`💾 Configuration saved successfully`);
    } catch (error) {
      console.error('❌ Failed to save config:', error);
    }
  }

  addWallet(address: string, name: string, description: string = ''): void {
    const config = this.loadConfig();
    
    // Validate Solana address format
    if (!this.isValidSolanaAddress(address)) {
      console.error('❌ Invalid Solana address format');
      console.error('   Solana addresses should be 32-44 characters long and contain only valid base58 characters');
      return;
    }
    
    // Check if wallet already exists
    const existingWallet = config.manualWallets.find(w => w.address === address);
    if (existingWallet) {
      console.error(`❌ Wallet already exists:`);
      console.error(`   Name: ${existingWallet.name}`);
      console.error(`   Address: ${existingWallet.address}`);
      console.error(`   Status: ${existingWallet.enabled ? 'Enabled' : 'Disabled'}`);
      return;
    }
    
    // Add new wallet
    const newWallet: ManualWallet = {
      address,
      name,
      description,
      enabled: true,
      addedDate: new Date().toISOString()
    };
    
    config.manualWallets.push(newWallet);
    this.saveConfig(config);
    
    console.log(`✅ Successfully added wallet:`);
    console.log(`   Name: ${name}`);
    console.log(`   Address: ${address}`);
    console.log(`   Description: ${description || 'No description'}`);
    console.log(`   Status: Enabled`);
    console.log(`   Added: ${new Date().toLocaleString()}`);
  }

  removeWallet(addressOrName: string): void {
    const config = this.loadConfig();
    const initialLength = config.manualWallets.length;
    
    // Find wallet by address or name
    const walletIndex = config.manualWallets.findIndex(w => 
      w.address === addressOrName || 
      w.name.toLowerCase() === addressOrName.toLowerCase()
    );
    
    if (walletIndex === -1) {
      console.error(`❌ Wallet not found: ${addressOrName}`);
      console.error(`   Try using the exact address or name`);
      this.listWallets();
      return;
    }
    
    const removedWallet = config.manualWallets[walletIndex];
    config.manualWallets.splice(walletIndex, 1);
    
    this.saveConfig(config);
    console.log(`✅ Successfully removed wallet:`);
    console.log(`   Name: ${removedWallet.name}`);
    console.log(`   Address: ${removedWallet.address}`);
  }

  listWallets(): void {
    const config = this.loadConfig();
    
    console.log('\n' + '='.repeat(80));
    console.log('📋 MANUAL WALLETS CONFIGURATION');
    console.log('='.repeat(80));
    
    if (config.manualWallets.length === 0) {
      console.log('📭 No manual wallets configured');
      console.log('\n💡 To add a wallet, use:');
      console.log('   npm run wallet-manager add <address> <name> [description]');
      console.log('='.repeat(80));
      return;
    }
    
    // Show summary
    const enabledCount = config.manualWallets.filter(w => w.enabled).length;
    console.log(`📊 Total Wallets: ${config.manualWallets.length}`);
    console.log(`✅ Enabled: ${enabledCount}`);
    console.log(`❌ Disabled: ${config.manualWallets.length - enabledCount}`);
    console.log(`⚙️ Min Purchase: $${config.settings.minPurchaseUsd}`);
    console.log(`⏱️ Check Interval: ${config.settings.checkIntervalSeconds}s`);
    console.log('='.repeat(80));
    
    config.manualWallets.forEach((wallet, index) => {
      const status = wallet.enabled ? '✅ ENABLED' : '❌ DISABLED';
      const addedDate = new Date(wallet.addedDate).toLocaleDateString();
      
      console.log(`\n${index + 1}. ${status}`);
      console.log(`   📛 Name: ${wallet.name}`);
      console.log(`   🔗 Address: ${wallet.address}`);
      console.log(`   📝 Description: ${wallet.description || 'No description'}`);
      console.log(`   📅 Added: ${addedDate}`);
      if (wallet.lastChecked) {
        console.log(`   🕐 Last Checked: ${new Date(wallet.lastChecked).toLocaleString()}`);
      }
      console.log(`   🌐 Verify: https://solscan.io/account/${wallet.address}`);
      
      if (index < config.manualWallets.length - 1) {
        console.log('   ' + '-'.repeat(70));
      }
    });
    
    console.log('\n' + '='.repeat(80));
    console.log('💡 COMMANDS:');
    console.log('   • Add wallet: npm run wallet-manager add <address> <name> [description]');
    console.log('   • Remove wallet: npm run wallet-manager remove <address|name>');
    console.log('   • Enable wallet: npm run wallet-manager enable <address|name>');
    console.log('   • Disable wallet: npm run wallet-manager disable <address|name>');
    console.log('   • Update settings: npm run wallet-manager settings <minUsd> [intervalSec]');
    console.log('='.repeat(80));
  }

  enableWallet(addressOrName: string): void {
    const config = this.loadConfig();
    const wallet = config.manualWallets.find(w => 
      w.address === addressOrName || 
      w.name.toLowerCase() === addressOrName.toLowerCase()
    );
    
    if (!wallet) {
      console.error(`❌ Wallet not found: ${addressOrName}`);
      return;
    }
    
    if (wallet.enabled) {
      console.log(`ℹ️ Wallet "${wallet.name}" is already enabled`);
      return;
    }
    
    wallet.enabled = true;
    this.saveConfig(config);
    console.log(`✅ Enabled wallet: ${wallet.name} (${wallet.address})`);
  }

  disableWallet(addressOrName: string): void {
    const config = this.loadConfig();
    const wallet = config.manualWallets.find(w => 
      w.address === addressOrName || 
      w.name.toLowerCase() === addressOrName.toLowerCase()
    );
    
    if (!wallet) {
      console.error(`❌ Wallet not found: ${addressOrName}`);
      return;
    }
    
    if (!wallet.enabled) {
      console.log(`ℹ️ Wallet "${wallet.name}" is already disabled`);
      return;
    }
    
    wallet.enabled = false;
    this.saveConfig(config);
    console.log(`❌ Disabled wallet: ${wallet.name} (${wallet.address})`);
  }

  updateSettings(minPurchaseUsd?: number, checkIntervalSeconds?: number, solPriceUsd?: number): void {
    const config = this.loadConfig();
    let updated = false;
    
    console.log('\n⚙️ UPDATING SETTINGS:');
    console.log('='.repeat(40));
    
    if (minPurchaseUsd !== undefined && minPurchaseUsd > 0) {
      const oldValue = config.settings.minPurchaseUsd;
      config.settings.minPurchaseUsd = minPurchaseUsd;
      console.log(`💰 Min Purchase: $${oldValue} → $${minPurchaseUsd}`);
      updated = true;
    }
    
    if (checkIntervalSeconds !== undefined && checkIntervalSeconds > 0) {
      const oldValue = config.settings.checkIntervalSeconds;
      config.settings.checkIntervalSeconds = checkIntervalSeconds;
      console.log(`⏱️ Check Interval: ${oldValue}s → ${checkIntervalSeconds}s`);
      updated = true;
    }
    
    if (solPriceUsd !== undefined && solPriceUsd > 0) {
      const oldValue = config.settings.solPriceUsd;
      config.settings.solPriceUsd = solPriceUsd;
      console.log(`🔗 SOL Price: $${oldValue} → $${solPriceUsd}`);
      updated = true;
    }
    
    if (updated) {
      this.saveConfig(config);
      console.log('✅ Settings updated successfully');
    } else {
      console.log('❌ No valid settings provided');
    }
    
    console.log('='.repeat(40));
  }

  showSettings(): void {
    const config = this.loadConfig();
    
    console.log('\n⚙️ CURRENT SETTINGS:');
    console.log('='.repeat(50));
    console.log(`💰 Minimum Purchase Alert: $${config.settings.minPurchaseUsd}`);
    console.log(`⏱️ Check Interval: ${config.settings.checkIntervalSeconds} seconds`);
    console.log(`🔗 SOL Price (for calculation): $${config.settings.solPriceUsd}`);
    console.log(`📊 Monitor Qualified Wallets: ${config.settings.enableQualifiedWallets ? 'Yes' : 'No'}`);
    console.log(`📍 Monitor Manual Wallets: ${config.settings.enableManualWallets ? 'Yes' : 'No'}`);
    console.log('='.repeat(50));
    console.log(`📁 Config File: ${this.configPath}`);
    console.log(`📅 Last Updated: ${new Date(config.metadata.lastUpdated).toLocaleString()}`);
    console.log(`📊 Total Manual Wallets: ${config.metadata.totalWallets}`);
    console.log('='.repeat(50));
  }

  validateConfig(): void {
    const config = this.loadConfig();
    let issues = 0;
    
    console.log('\n🔍 CONFIGURATION VALIDATION:');
    console.log('='.repeat(50));
    
    // Check for duplicate addresses
    const addresses = config.manualWallets.map(w => w.address);
    const duplicates = addresses.filter((addr, index) => addresses.indexOf(addr) !== index);
    
    if (duplicates.length > 0) {
      console.log(`❌ Duplicate addresses found: ${duplicates.length}`);
      duplicates.forEach(addr => console.log(`   • ${addr}`));
      issues++;
    }
    
    // Check for invalid addresses
    const invalidWallets = config.manualWallets.filter(w => !this.isValidSolanaAddress(w.address));
    if (invalidWallets.length > 0) {
      console.log(`❌ Invalid addresses found: ${invalidWallets.length}`);
      invalidWallets.forEach(w => console.log(`   • ${w.name}: ${w.address}`));
      issues++;
    }
    
    // Check settings
    if (config.settings.minPurchaseUsd <= 0) {
      console.log(`❌ Invalid minimum purchase amount: $${config.settings.minPurchaseUsd}`);
      issues++;
    }
    
    if (config.settings.checkIntervalSeconds < 10) {
      console.log(`⚠️ Very short check interval: ${config.settings.checkIntervalSeconds}s (may cause rate limiting)`);
    }
    
    if (issues === 0) {
      console.log('✅ Configuration is valid');
      console.log(`📊 ${config.manualWallets.length} wallets configured`);
      console.log(`✅ ${config.manualWallets.filter(w => w.enabled).length} wallets enabled`);
    } else {
      console.log(`❌ Found ${issues} configuration issues`);
    }
    
    console.log('='.repeat(50));
  }

  exportWallets(outputFile?: string): void {
    const config = this.loadConfig();
    const exportData = {
      exportDate: new Date().toISOString(),
      wallets: config.manualWallets.map(w => ({
        address: w.address,
        name: w.name,
        description: w.description,
        enabled: w.enabled,
        addedDate: w.addedDate
      })),
      settings: config.settings
    };
    
    const fileName = outputFile || `wallet-export-${new Date().toISOString().split('T')[0]}.json`;
    
    try {
      fs.writeFileSync(fileName, JSON.stringify(exportData, null, 2));
      console.log(`✅ Wallets exported to: ${fileName}`);
      console.log(`📊 Exported ${exportData.wallets.length} wallets`);
    } catch (error) {
      console.error('❌ Failed to export wallets:', error);
    }
  }

  importWallets(inputFile: string): void {
    try {
      if (!fs.existsSync(inputFile)) {
        console.error(`❌ Import file not found: ${inputFile}`);
        return;
      }
      
      const importData = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
      const config = this.loadConfig();
      
      let addedCount = 0;
      let skippedCount = 0;
      
      console.log(`📥 Importing wallets from: ${inputFile}`);
      
      importData.wallets?.forEach((importWallet: any) => {
        // Check if wallet already exists
        if (config.manualWallets.some(w => w.address === importWallet.address)) {
          console.log(`⏭️ Skipped (exists): ${importWallet.name} (${importWallet.address})`);
          skippedCount++;
          return;
        }
        
        // Validate address
        if (!this.isValidSolanaAddress(importWallet.address)) {
          console.log(`❌ Skipped (invalid): ${importWallet.name} (${importWallet.address})`);
          skippedCount++;
          return;
        }
        
        // Add wallet
        config.manualWallets.push({
          address: importWallet.address,
          name: importWallet.name || 'Imported Wallet',
          description: importWallet.description || 'Imported from file',
          enabled: importWallet.enabled !== false,
          addedDate: new Date().toISOString()
        });
        
        console.log(`✅ Added: ${importWallet.name} (${importWallet.address})`);
        addedCount++;
      });
      
      if (addedCount > 0) {
        this.saveConfig(config);
      }
      
      console.log(`\n📊 Import Summary:`);
      console.log(`   ✅ Added: ${addedCount} wallets`);
      console.log(`   ⏭️ Skipped: ${skippedCount} wallets`);
      
    } catch (error) {
      console.error('❌ Failed to import wallets:', error);
    }
  }

  private isValidSolanaAddress(address: string): boolean {
    if (!address || typeof address !== 'string') return false;
    if (address.length < 32 || address.length > 44) return false;
    if (!/^[1-9A-HJ-NP-Za-km-z]+$/.test(address)) return false;
    if (new Set(address).size === 1) return false; // All same character
    return true;
  }

  showHelp(): void {
    console.log('\n📖 WALLET MANAGER - HELP');
    console.log('='.repeat(60));
    console.log('BASIC COMMANDS:');
    console.log('  add <address> <name> [description]  Add a new wallet');
    console.log('  remove <address|name>               Remove a wallet');
    console.log('  list                                List all wallets');
    console.log('  enable <address|name>               Enable a wallet');
    console.log('  disable <address|name>              Disable a wallet');
    console.log('');
    console.log('SETTINGS:');
    console.log('  settings <minUsd> [intervalSec] [solPrice]  Update settings');
    console.log('  show-settings                       Show current settings');
    console.log('');
    console.log('ADVANCED:');
    console.log('  validate                            Validate configuration');
    console.log('  export [filename]                   Export wallets to file');
    console.log('  import <filename>                   Import wallets from file');
    console.log('  help                                Show this help');
    console.log('='.repeat(60));
    console.log('EXAMPLES:');
    console.log('  npm run wallet-manager add 4BdKaxN8G6ka4GYtQQWk4G4dZRUTX2vQH9GcXdBREFUk "Whale #1" "High performance trader"');
    console.log('  npm run wallet-manager remove "Whale #1"');
    console.log('  npm run wallet-manager settings 100 60 250');
    console.log('  npm run wallet-manager export my-wallets.json');
    console.log('  npm run wallet-manager import backup-wallets.json');
    console.log('='.repeat(60));
  }
}

// CLI Interface
function main(): void {
  const manager = new WalletManager();
  const args = process.argv.slice(2);

  if (args.length === 0) {
    manager.showHelp();
    return;
  }

  const command = args[0].toLowerCase();

  try {
    switch (command) {
      case 'add':
        if (args.length < 3) {
          console.error('❌ Usage: add <address> <name> [description]');
          console.error('   Example: npm run wallet-manager add 4BdKaxN8... "Whale #1" "Description"');
          return;
        }
        manager.addWallet(args[1], args[2], args[3] || '');
        break;

      case 'remove':
        if (args.length < 2) {
          console.error('❌ Usage: remove <address|name>');
          console.error('   Example: npm run wallet-manager remove "Whale #1"');
          return;
        }
        manager.removeWallet(args[1]);
        break;

      case 'list':
        manager.listWallets();
        break;

      case 'enable':
        if (args.length < 2) {
          console.error('❌ Usage: enable <address|name>');
          return;
        }
        manager.enableWallet(args[1]);
        break;

      case 'disable':
        if (args.length < 2) {
          console.error('❌ Usage: disable <address|name>');
          return;
        }
        manager.disableWallet(args[1]);
        break;

      case 'settings':
        if (args.length < 2) {
          console.error('❌ Usage: settings <minUsd> [intervalSec] [solPrice]');
          console.error('   Example: npm run wallet-manager settings 100 60 250');
          return;
        }
        const minUsd = parseFloat(args[1]);
        const intervalSec = args[2] ? parseInt(args[2]) : undefined;
        const solPrice = args[3] ? parseFloat(args[3]) : undefined;
        manager.updateSettings(minUsd, intervalSec, solPrice);
        break;

      case 'show-settings':
        manager.showSettings();
        break;

      case 'validate':
        manager.validateConfig();
        break;

      case 'export':
        manager.exportWallets(args[1]);
        break;

      case 'import':
        if (args.length < 2) {
          console.error('❌ Usage: import <filename>');
          return;
        }
        manager.importWallets(args[1]);
        break;

      case 'help':
      case '--help':
      case '-h':
        manager.showHelp();
        break;

      default:
        console.error(`❌ Unknown command: ${command}`);
        manager.showHelp();
        break;
    }
  } catch (error) {
    console.error('❌ Command failed:', error);
  }
}

// Export for use in other modules
export { WalletManager };

// Run CLI if called directly
if (require.main === module) {
  main();
}
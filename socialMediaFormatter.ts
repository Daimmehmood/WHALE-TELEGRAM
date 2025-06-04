
// src/socialMediaFormatter.ts - SOCIAL MEDIA DISPLAY FORMATTER 📱💫🎨
import { SocialMediaData, TwitterData, TelegramData } from './socialMediaAnalyzer';
import { logger } from './utils/logger';

export interface FormattedSocialDisplay {
  consoleSummary: string;
  telegramMessage: string;
  shortSummary: string;
  riskIndicator: string;
  platformIcons: string;
}

export class SocialMediaFormatter {
  private readonly PLATFORM_ICONS = {
    twitter: '🐦',
    telegram: '📱',
    verified: '✅',
    warning: '⚠️',
    risk: '🚨',
    star: '⭐',
    members: '👥',
    followers: '👥',
    active: '🟢',
    inactive: '🔴',
    unknown: '❓'
  };

  private readonly RISK_COLORS = {
    'LOW': '🟢',
    'MEDIUM': '🟡', 
    'HIGH': '🟠',
    'VERY_HIGH': '🔴'
  };

  private readonly ENGAGEMENT_ICONS = {
    'HIGH': '🔥',
    'MEDIUM': '📈',
    'LOW': '📉'
  };

  constructor() {
    logger.info('📱🎨 Social Media Formatter initialized');
  }

  // 🎯 MAIN: Format social media data for display
  formatSocialDisplay(socialData: SocialMediaData, tokenSymbol: string): FormattedSocialDisplay {
    const consoleSummary = this.formatConsoleDisplay(socialData, tokenSymbol);
    const telegramMessage = this.formatTelegramDisplay(socialData, tokenSymbol);
    const shortSummary = this.formatShortSummary(socialData);
    const riskIndicator = this.formatRiskIndicator(socialData);
    const platformIcons = this.formatPlatformIcons(socialData);

    return {
      consoleSummary,
      telegramMessage, 
      shortSummary,
      riskIndicator,
      platformIcons
    };
  }

  // 🖥️ FORMAT CONSOLE DISPLAY
  private formatConsoleDisplay(socialData: SocialMediaData, tokenSymbol: string): string {
    const stars = this.PLATFORM_ICONS.star.repeat(Math.floor(socialData.socialRating));
    const riskColor = this.RISK_COLORS[socialData.riskLevel];
    
    let display = `\n📱 SOCIAL MEDIA ANALYSIS FOR ${tokenSymbol}:\n`;
    display += `   ${stars} Social Rating: ${socialData.socialRating}/5\n`;
    display += `   ${riskColor} Risk Level: ${socialData.riskLevel}\n`;
    display += `   📊 Summary: ${socialData.summary}\n`;
    
    if (socialData.activePlatforms.length > 0) {
      display += `   🌐 Active Platforms: ${socialData.activePlatforms.join(', ')}\n`;
    }

    // Twitter details
    if (socialData.twitter?.profileExists) {
      display += this.formatTwitterConsole(socialData.twitter);
    }

    // Telegram details  
    if (socialData.telegram?.profileExists) {
      display += this.formatTelegramConsole(socialData.telegram);
    }

    // Overall stats
    display += `   📊 Total Followers/Members: ${this.formatNumber(socialData.overall.totalFollowers)}\n`;
    display += `   ${this.ENGAGEMENT_ICONS[socialData.overall.engagement]} Overall Engagement: ${socialData.overall.engagement}\n`;
    
    if (socialData.overall.verifiedAccounts > 0) {
      display += `   ✅ Verified Accounts: ${socialData.overall.verifiedAccounts}\n`;
    }

    return display;
  }

  // 🐦 FORMAT TWITTER CONSOLE
  private formatTwitterConsole(twitter: TwitterData): string {
    let display = `   🐦 TWITTER:\n`;
    
    if (twitter.handle) {
      display += `      Handle: @${twitter.handle}`;
      if (twitter.verified) display += ` ✅`;
      display += `\n`;
    }
    
    if (twitter.followers !== undefined) {
      display += `      👥 Followers: ${this.formatNumber(twitter.followers)}\n`;
    }
    
    if (twitter.engagement) {
      const engagementIcon = this.ENGAGEMENT_ICONS[twitter.engagement];
      display += `      ${engagementIcon} Engagement: ${twitter.engagement}\n`;
    }
    
    const activityIcon = twitter.active ? this.PLATFORM_ICONS.active : this.PLATFORM_ICONS.inactive;
    display += `      ${activityIcon} Status: ${twitter.active ? 'Active' : 'Inactive'}\n`;
    
    return display;
  }

  // 📱 FORMAT TELEGRAM CONSOLE
  private formatTelegramConsole(telegram: TelegramData): string {
    let display = `   📱 TELEGRAM:\n`;
    
    if (telegram.handle) {
      display += `      Handle: @${telegram.handle}\n`;
    }
    
    if (telegram.type) {
      display += `      Type: ${telegram.type}\n`;
    }
    
    if (telegram.members !== undefined) {
      display += `      👥 Members: ${this.formatNumber(telegram.members)}\n`;
    }
    
    const activityIcon = telegram.active ? this.PLATFORM_ICONS.active : this.PLATFORM_ICONS.inactive;
    display += `      ${activityIcon} Status: ${telegram.active ? 'Active' : 'Inactive'}\n`;
    
    return display;
  }

  // 📱 FORMAT TELEGRAM MESSAGE
  private formatTelegramDisplay(socialData: SocialMediaData, tokenSymbol: string): string {
    const stars = this.PLATFORM_ICONS.star.repeat(Math.floor(socialData.socialRating));
    const riskIcon = this.RISK_COLORS[socialData.riskLevel];
    
    let message = `\n📱 <b>SOCIAL MEDIA ANALYSIS:</b>\n`;
    message += `${stars} <b>Social Rating:</b> ${socialData.socialRating}/5\n`;
    message += `${riskIcon} <b>Social Risk:</b> ${socialData.riskLevel}\n`;
    
    if (socialData.activePlatforms.length > 0) {
      const platformsList = this.formatPlatformsList(socialData);
      message += `🌐 <b>Active on:</b> ${platformsList}\n`;
    } else {
      message += `❌ <b>No social presence found</b>\n`;
    }

    // Add detailed platform info
    if (socialData.twitter?.profileExists || socialData.telegram?.profileExists) {
      message += `\n📊 <b>Platform Details:</b>\n`;
      
      if (socialData.twitter?.profileExists) {
        message += this.formatTwitterTelegram(socialData.twitter);
      }
      
      if (socialData.telegram?.profileExists) {
        message += this.formatTelegramTelegram(socialData.telegram);
      }
    }

    // Overall engagement
    const engagementIcon = this.ENGAGEMENT_ICONS[socialData.overall.engagement];
    message += `\n${engagementIcon} <b>Overall Engagement:</b> ${socialData.overall.engagement}`;
    
    if (socialData.overall.totalFollowers > 0) {
      message += `\n👥 <b>Total Following:</b> ${this.formatNumber(socialData.overall.totalFollowers)}`;
    }

    return message;
  }

  // 🐦 FORMAT TWITTER FOR TELEGRAM
  private formatTwitterTelegram(twitter: TwitterData): string {
    let info = `🐦 <b>Twitter:</b> `;
    
    if (twitter.handle) {
      info += `@${twitter.handle}`;
      if (twitter.verified) info += ` ✅`;
    }
    
    if (twitter.followers !== undefined) {
      info += ` • ${this.formatNumber(twitter.followers)} followers`;
    }
    
    info += `\n`;
    return info;
  }

  // 📱 FORMAT TELEGRAM FOR TELEGRAM
  private formatTelegramTelegram(telegram: TelegramData): string {
    let info = `📱 <b>Telegram:</b> `;
    
    if (telegram.handle) {
      info += `@${telegram.handle}`;
    }
    
    if (telegram.members !== undefined) {
      info += ` • ${this.formatNumber(telegram.members)} members`;
    }
    
    if (telegram.type) {
      info += ` • ${telegram.type}`;
    }
    
    info += `\n`;
    return info;
  }

  // 📝 FORMAT SHORT SUMMARY
  private formatShortSummary(socialData: SocialMediaData): string {
    const stars = this.PLATFORM_ICONS.star.repeat(Math.floor(socialData.socialRating));
    const riskIcon = this.RISK_COLORS[socialData.riskLevel];
    
    if (socialData.activePlatforms.length === 0) {
      return `${riskIcon} No social presence • ${stars}`;
    }

    const platforms = socialData.activePlatforms.map(platform => {
      switch(platform.toLowerCase()) {
        case 'twitter': return this.PLATFORM_ICONS.twitter;
        case 'telegram': return this.PLATFORM_ICONS.telegram;
        default: return '🌐';
      }
    }).join('');

    const verified = socialData.overall.verifiedAccounts > 0 ? ' ✅' : '';
    
    return `${platforms} ${socialData.socialRating}/5 ${stars} • ${riskIcon} ${socialData.riskLevel}${verified}`;
  }

  // 🚨 FORMAT RISK INDICATOR
  private formatRiskIndicator(socialData: SocialMediaData): string {
    const riskIcon = this.RISK_COLORS[socialData.riskLevel];
    
    switch(socialData.riskLevel) {
      case 'LOW':
        return `${riskIcon} VERIFIED SOCIAL PRESENCE`;
      case 'MEDIUM':
        return `${riskIcon} MODERATE SOCIAL ACTIVITY`;
      case 'HIGH':
        return `${riskIcon} LIMITED SOCIAL PRESENCE`;
      case 'VERY_HIGH':
        return `${riskIcon} NO VERIFIED SOCIAL ACCOUNTS`;
      default:
        return `❓ UNKNOWN SOCIAL STATUS`;
    }
  }

  // 🌐 FORMAT PLATFORM ICONS
  private formatPlatformIcons(socialData: SocialMediaData): string {
    if (socialData.activePlatforms.length === 0) {
      return '❌';
    }

    const icons = socialData.activePlatforms.map(platform => {
      switch(platform.toLowerCase()) {
        case 'twitter': 
          return socialData.twitter?.verified ? '🐦✅' : '🐦';
        case 'telegram': 
          return this.PLATFORM_ICONS.telegram;
        default: 
          return '🌐';
      }
    });

    return icons.join(' ');
  }

  // 🌐 FORMAT PLATFORMS LIST
  private formatPlatformsList(socialData: SocialMediaData): string {
    return socialData.activePlatforms.map(platform => {
      switch(platform.toLowerCase()) {
        case 'twitter':
          const twitterIcon = socialData.twitter?.verified ? '🐦✅' : '🐦';
          return `${twitterIcon} Twitter`;
        case 'telegram':
          return `📱 Telegram`;
        default:
          return `🌐 ${platform}`;
      }
    }).join(', ');
  }

  // 📊 FORMAT NUMBER
  private formatNumber(num: number): string {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  }

  // 📱 FORMAT COMPACT SOCIAL INFO (for individual alerts)
  formatCompactSocial(socialData: SocialMediaData): string {
    const stars = this.PLATFORM_ICONS.star.repeat(Math.floor(socialData.socialRating));
    const riskIcon = this.RISK_COLORS[socialData.riskLevel];
    
    if (socialData.activePlatforms.length === 0) {
      return `📱 <b>Social:</b> ${riskIcon} No presence • ${stars}`;
    }

    let compact = `📱 <b>Social:</b> ${socialData.socialRating}/5 ${stars} • ${riskIcon} ${socialData.riskLevel}`;
    
    // Add platform info
    const platformInfo = [];
    
    if (socialData.twitter?.profileExists) {
      let twitterInfo = `🐦`;
      if (socialData.twitter.verified) twitterInfo += `✅`;
      if (socialData.twitter.followers) {
        twitterInfo += ` ${this.formatNumber(socialData.twitter.followers)}`;
      }
      platformInfo.push(twitterInfo);
    }
    
    if (socialData.telegram?.profileExists) {
      let telegramInfo = `📱`;
      if (socialData.telegram.members) {
        telegramInfo += ` ${this.formatNumber(socialData.telegram.members)}`;
      }
      platformInfo.push(telegramInfo);
    }

    if (platformInfo.length > 0) {
      compact += `\n📊 <b>Found:</b> ${platformInfo.join(' • ')}`;
    }

    return compact;
  }

  // 🔥 FORMAT CONSENSUS SOCIAL INFO (for consensus alerts)
  formatConsensusSocial(socialData: SocialMediaData, tokenSymbol: string): string {
    const stars = this.PLATFORM_ICONS.star.repeat(Math.floor(socialData.socialRating));
    const riskIcon = this.RISK_COLORS[socialData.riskLevel];
    
    let consensus = `\n📱 <b>SOCIAL MEDIA VERIFICATION:</b>\n`;
    consensus += `${stars} <b>Social Score:</b> ${socialData.socialRating}/5 stars\n`;
    consensus += `${riskIcon} <b>Social Risk:</b> ${socialData.riskLevel}\n`;
    
    if (socialData.activePlatforms.length === 0) {
      consensus += `❌ <b>Warning:</b> No verified social presence found\n`;
      consensus += `🚨 <b>Recommendation:</b> VERY HIGH RISK - No official channels`;
      return consensus;
    }

    // Platform breakdown
    consensus += `🌐 <b>Verified Platforms:</b>\n`;
    
    if (socialData.twitter?.profileExists) {
      consensus += `   🐦 <b>Twitter:</b> @${socialData.twitter.handle || 'found'}`;
      if (socialData.twitter.verified) consensus += ` ✅ <b>VERIFIED</b>`;
      if (socialData.twitter.followers) {
        consensus += ` • ${this.formatNumber(socialData.twitter.followers)} followers`;
      }
      consensus += `\n`;
    }
    
    if (socialData.telegram?.profileExists) {
      consensus += `   📱 <b>Telegram:</b> @${socialData.telegram.handle || 'found'}`;
      if (socialData.telegram.members) {
        consensus += ` • ${this.formatNumber(socialData.telegram.members)} members`;
      }
      if (socialData.telegram.type) {
        consensus += ` • ${socialData.telegram.type}`;
      }
      consensus += `\n`;
    }

    // Engagement summary
    const engagementIcon = this.ENGAGEMENT_ICONS[socialData.overall.engagement];
    consensus += `${engagementIcon} <b>Community Engagement:</b> ${socialData.overall.engagement}`;
    
    if (socialData.overall.totalFollowers > 0) {
      consensus += `\n👥 <b>Total Community:</b> ${this.formatNumber(socialData.overall.totalFollowers)} followers/members`;
    }

    // Risk assessment
    consensus += `\n\n🎯 <b>Social Risk Assessment:</b>`;
    switch(socialData.riskLevel) {
      case 'LOW':
        consensus += ` ✅ <b>SAFE</b> - Strong verified presence`;
        break;
      case 'MEDIUM':
        consensus += ` ⚠️ <b>MODERATE</b> - Some social activity`;
        break;
      case 'HIGH':
        consensus += ` 🟠 <b>CAUTION</b> - Limited social proof`;
        break;
      case 'VERY_HIGH':
        consensus += ` 🔴 <b>WARNING</b> - No verified accounts`;
        break;
    }

    return consensus;
  }

  // 🎨 FORMAT ENHANCED DISPLAY (for special alerts)
  formatEnhancedDisplay(socialData: SocialMediaData, tokenSymbol: string): string {
    const header = `📱🔍 COMPREHENSIVE SOCIAL ANALYSIS FOR ${tokenSymbol} 🔍📱`;
    const separator = '═'.repeat(50);
    
    let enhanced = `\n${separator}\n${header}\n${separator}\n`;
    
    // Overall score
    const stars = this.PLATFORM_ICONS.star.repeat(Math.floor(socialData.socialRating));
    const riskIcon = this.RISK_COLORS[socialData.riskLevel];
    
    enhanced += `⭐ SOCIAL SCORE: ${socialData.socialRating}/5 ${stars}\n`;
    enhanced += `🚨 RISK LEVEL: ${riskIcon} ${socialData.riskLevel}\n`;
    enhanced += `📊 SUMMARY: ${socialData.summary}\n`;
    enhanced += `${separator}\n`;

    // Platform details
    if (socialData.activePlatforms.length > 0) {
      enhanced += `🌐 PLATFORM ANALYSIS:\n`;
      
      if (socialData.twitter?.profileExists) {
        enhanced += this.formatDetailedTwitter(socialData.twitter);
      }
      
      if (socialData.telegram?.profileExists) {
        enhanced += this.formatDetailedTelegram(socialData.telegram);
      }
      
      enhanced += `${separator}\n`;
    }

    // Community metrics
    enhanced += `👥 COMMUNITY METRICS:\n`;
    enhanced += `   Total Following: ${this.formatNumber(socialData.overall.totalFollowers)}\n`;
    enhanced += `   Active Platforms: ${socialData.overall.platformCount}\n`;
    enhanced += `   Verified Accounts: ${socialData.overall.verifiedAccounts}\n`;
    enhanced += `   Active Accounts: ${socialData.overall.activeAccounts}\n`;
    
    const engagementIcon = this.ENGAGEMENT_ICONS[socialData.overall.engagement];
    enhanced += `   ${engagementIcon} Engagement Level: ${socialData.overall.engagement}\n`;
    enhanced += `${separator}\n`;

    return enhanced;
  }

  // 🐦 FORMAT DETAILED TWITTER
  private formatDetailedTwitter(twitter: TwitterData): string {
    let detail = `🐦 TWITTER ANALYSIS:\n`;
    detail += `   Handle: @${twitter.handle || 'unknown'}\n`;
    detail += `   Verified: ${twitter.verified ? '✅ YES' : '❌ NO'}\n`;
    detail += `   Followers: ${twitter.followers ? this.formatNumber(twitter.followers) : 'Unknown'}\n`;
    detail += `   Engagement: ${this.ENGAGEMENT_ICONS[twitter.engagement || 'LOW']} ${twitter.engagement || 'LOW'}\n`;
    detail += `   Status: ${twitter.active ? '🟢 ACTIVE' : '🔴 INACTIVE'}\n`;
    detail += `   Last Activity: ${twitter.lastActivity || 'Unknown'}\n\n`;
    return detail;
  }

  // 📱 FORMAT DETAILED TELEGRAM  
  private formatDetailedTelegram(telegram: TelegramData): string {
    let detail = `📱 TELEGRAM ANALYSIS:\n`;
    detail += `   Handle: @${telegram.handle || 'unknown'}\n`;
    detail += `   Type: ${telegram.type || 'UNKNOWN'}\n`;
    detail += `   Members: ${telegram.members ? this.formatNumber(telegram.members) : 'Unknown'}\n`;
    detail += `   Status: ${telegram.active ? '🟢 ACTIVE' : '🔴 INACTIVE'}\n`;
    detail += `   Last Activity: ${telegram.lastActivity || 'Unknown'}\n\n`;
    return detail;
  }
}
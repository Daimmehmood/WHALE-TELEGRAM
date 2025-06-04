// src/socialMediaAnalyzer.ts - REAL SOCIAL MEDIA FETCHER 📱🔍📊
import axios from 'axios';
import { logger } from './utils/logger';

export interface SocialMediaData {
  twitter?: TwitterData;
  telegram?: TelegramData;
  overall: OverallSocialData;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';
  socialRating: number; // 1-5 stars
  summary: string;
  activePlatforms: string[];
}

export interface TwitterData {
  handle?: string;
  followers?: number;
  verified?: boolean;
  active?: boolean;
  engagement?: 'LOW' | 'MEDIUM' | 'HIGH';
  lastActivity?: string;
  profileExists: boolean;
}

export interface TelegramData {
  handle?: string;
  members?: number;
  active?: boolean;
  type?: 'GROUP' | 'CHANNEL' | 'BOT';
  lastActivity?: string;
  profileExists: boolean;
}

export interface OverallSocialData {
  totalFollowers: number;
  platformCount: number;
  verifiedAccounts: number;
  activeAccounts: number;
  engagement: 'LOW' | 'MEDIUM' | 'HIGH';
}

export class SocialMediaAnalyzer {
  private cache: Map<string, { data: SocialMediaData; expires: number }> = new Map();
  private readonly CACHE_DURATION = 30 * 60 * 1000; // 30 minutes
  
  private socialAxios = axios.create({
    timeout: 10000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json, text/html, */*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Upgrade-Insecure-Requests': '1'
    }
  });

  constructor() {
    logger.info('📱🔍 Real Social Media Analyzer initialized');
  }

  // 🎯 MAIN: Analyze social media for a token by fetching real data
  async analyzeSocialMedia(tokenMint: string, tokenSymbol?: string): Promise<SocialMediaData | null> {
    // Check cache first
    const cached = this.cache.get(tokenMint);
    if (cached && cached.expires > Date.now()) {
      logger.info(`📱💾 Using cached social data for ${tokenSymbol || tokenMint.substring(0, 8)}`);
      return cached.data;
    }

    logger.info(`📱🔍 Fetching REAL social media data for ${tokenSymbol || tokenMint.substring(0, 8)}...`);

    try {
      // 🔍 STEP 1: Get social links from multiple sources
      const socialLinks = await this.fetchSocialLinksFromSources(tokenMint, tokenSymbol);
      
      if (!socialLinks || (!socialLinks.twitter && !socialLinks.telegram)) {
        logger.warn(`📱❌ No social links found for ${tokenSymbol || tokenMint.substring(0, 8)}`);
        return this.createEmptySocialData();
      }

      // 🔍 STEP 2: Verify and analyze each social platform
      const [twitterData, telegramData] = await Promise.allSettled([
        socialLinks.twitter ? this.verifyTwitterAccount(socialLinks.twitter) : Promise.resolve(null),
        socialLinks.telegram ? this.verifyTelegramAccount(socialLinks.telegram) : Promise.resolve(null)
      ]);

      const twitter = twitterData.status === 'fulfilled' ? twitterData.value : null;
      const telegram = telegramData.status === 'fulfilled' ? telegramData.value : null;

      const socialData = this.compileSocialData(twitter, telegram, tokenSymbol || tokenMint);

      // Cache the result
      this.cache.set(tokenMint, {
        data: socialData,
        expires: Date.now() + this.CACHE_DURATION
      });

      logger.info(`✅📱 Real social analysis complete for ${tokenSymbol}: ${socialData.socialRating}/5 stars`);
      return socialData;

    } catch (error) {
      logger.warn(`❌📱 Real social media analysis failed for ${tokenSymbol}:`, error);
      return this.createEmptySocialData();
    }
  }

  // 🔍 FETCH SOCIAL LINKS FROM MULTIPLE SOURCES
  private async fetchSocialLinksFromSources(tokenMint: string, tokenSymbol?: string): Promise<{twitter?: string, telegram?: string, website?: string} | null> {
    const sources = [
      () => this.getSocialFromDexScreener(tokenMint),
      () => this.getSocialFromCoinGecko(tokenMint),
      () => this.getSocialFromBirdeye(tokenMint),
      () => this.getSocialFromMoralis(tokenMint)
    ];

    for (const source of sources) {
      try {
        const links = await source();
        if (links && (links.twitter || links.telegram)) {
          logger.info(`📱✅ Found social links: Twitter: ${!!links.twitter}, Telegram: ${!!links.telegram}`);
          return links;
        }
      } catch (error) {
        continue; // Try next source
      }
    }

    return null;
  }

  // 🔍 GET SOCIAL LINKS FROM DEXSCREENER
  private async getSocialFromDexScreener(tokenMint: string): Promise<{twitter?: string, telegram?: string, website?: string} | null> {
    try {
      logger.info(`📊 Fetching social links from DexScreener for ${tokenMint.substring(0, 8)}...`);
      
      const response = await this.socialAxios.get(`https://api.dexscreener.com/latest/dex/tokens/${tokenMint}`);
      
      if (response.data?.pairs && response.data.pairs.length > 0) {
        const pair = response.data.pairs[0];
        const info = pair.info || {};
        
        let twitter: string | undefined = undefined;
        let telegram: string | undefined = undefined;
        let website: string | undefined = undefined;

        // Extract social links from info object
        if (info.socials) {
          const socials = Array.isArray(info.socials) ? info.socials : [info.socials];
          
          for (const social of socials) {
            if (social.type === 'twitter' || social.platform === 'twitter') {
              const extractedTwitter = this.extractTwitterHandle(social.url);
              if (extractedTwitter) twitter = extractedTwitter;
            } else if (social.type === 'telegram' || social.platform === 'telegram') {
              const extractedTelegram = this.extractTelegramHandle(social.url);
              if (extractedTelegram) telegram = extractedTelegram;
            }
          }
        }

        // Also check direct properties
        if (info.twitter) {
          const extractedTwitter = this.extractTwitterHandle(info.twitter);
          if (extractedTwitter) twitter = extractedTwitter;
        }
        if (info.telegram) {
          const extractedTelegram = this.extractTelegramHandle(info.telegram);
          if (extractedTelegram) telegram = extractedTelegram;
        }
        if (info.website) website = info.website;

        // Check baseToken info as well
        if (pair.baseToken?.info) {
          const baseInfo = pair.baseToken.info;
          if (baseInfo.twitter && !twitter) {
            const extractedTwitter = this.extractTwitterHandle(baseInfo.twitter);
            if (extractedTwitter) twitter = extractedTwitter;
          }
          if (baseInfo.telegram && !telegram) {
            const extractedTelegram = this.extractTelegramHandle(baseInfo.telegram);
            if (extractedTelegram) telegram = extractedTelegram;
          }
        }

        if (twitter || telegram) {
          logger.info(`✅📊 DexScreener found - Twitter: ${twitter || 'none'}, Telegram: ${telegram || 'none'}`);
          return { twitter, telegram, website };
        }
      }
      
      return null;
    } catch (error) {
      logger.warn('❌📊 DexScreener social fetch failed');
      return null;
    }
  }

  // 🔍 GET SOCIAL LINKS FROM COINGECKO
  private async getSocialFromCoinGecko(tokenMint: string): Promise<{twitter?: string, telegram?: string, website?: string} | null> {
    try {
      logger.info(`🦎 Fetching social links from CoinGecko for ${tokenMint.substring(0, 8)}...`);
      
      const response = await this.socialAxios.get(`https://api.coingecko.com/api/v3/coins/solana/contract/${tokenMint}`);
      
      if (response.data && response.data.links) {
        const links = response.data.links;
        let twitter: string | undefined = undefined;
        let telegram: string | undefined = undefined;
        
        if (links.twitter_screen_name) {
          twitter = links.twitter_screen_name;
        }
        
        if (links.telegram_channel_identifier) {
          telegram = links.telegram_channel_identifier;
        }
        
        // Also check homepage for social links
        if (links.homepage && links.homepage.length > 0) {
          const website = links.homepage[0];
          
          // Sometimes social links are in homepage
          if (website.includes('twitter.com') && !twitter) {
            const extractedTwitter = this.extractTwitterHandle(website);
            if (extractedTwitter) twitter = extractedTwitter;
          }
          if (website.includes('t.me') && !telegram) {
            const extractedTelegram = this.extractTelegramHandle(website);
            if (extractedTelegram) telegram = extractedTelegram;
          }
        }

        if (twitter || telegram) {
          logger.info(`✅🦎 CoinGecko found - Twitter: ${twitter || 'none'}, Telegram: ${telegram || 'none'}`);
          return { twitter, telegram, website: links.homepage?.[0] };
        }
      }
      
      return null;
    } catch (error) {
      logger.warn('❌🦎 CoinGecko social fetch failed');
      return null;
    }
  }

  // 🔍 GET SOCIAL LINKS FROM BIRDEYE
  private async getSocialFromBirdeye(tokenMint: string): Promise<{twitter?: string, telegram?: string, website?: string} | null> {
    try {
      logger.info(`🐦 Fetching social links from Birdeye for ${tokenMint.substring(0, 8)}...`);
      
      const response = await this.socialAxios.get(`https://public-api.birdeye.so/defi/token_overview?address=${tokenMint}`, {
        headers: {
          'X-API-KEY': 'public'
        }
      });
      
      if (response.data?.data) {
        const data = response.data.data;
        let twitter: string | undefined = undefined;
        let telegram: string | undefined = undefined;
        
        // Check extensions for social links
        if (data.extensions) {
          if (data.extensions.twitter) {
            const extractedTwitter = this.extractTwitterHandle(data.extensions.twitter);
            if (extractedTwitter) twitter = extractedTwitter;
          }
          if (data.extensions.telegram) {
            const extractedTelegram = this.extractTelegramHandle(data.extensions.telegram);
            if (extractedTelegram) telegram = extractedTelegram;
          }
        }

        if (twitter || telegram) {
          logger.info(`✅🐦 Birdeye found - Twitter: ${twitter || 'none'}, Telegram: ${telegram || 'none'}`);
          return { twitter, telegram, website: data.extensions?.website };
        }
      }
      
      return null;
    } catch (error) {
      logger.warn('❌🐦 Birdeye social fetch failed');
      return null;
    }
  }

  // 🔍 GET SOCIAL LINKS FROM MORALIS/OTHER APIs
  private async getSocialFromMoralis(tokenMint: string): Promise<{twitter?: string, telegram?: string, website?: string} | null> {
    try {
      // Try Solscan API for token info
      const response = await this.socialAxios.get(`https://public-api.solscan.io/token/meta?tokenAddress=${tokenMint}`);
      
      if (response.data) {
        const data = response.data;
        let twitter: string | undefined = undefined;
        let telegram: string | undefined = undefined;
        
        // Check for social links in metadata
        if (data.twitter) {
          const extractedTwitter = this.extractTwitterHandle(data.twitter);
          if (extractedTwitter) twitter = extractedTwitter;
        }
        if (data.telegram) {
          const extractedTelegram = this.extractTelegramHandle(data.telegram);
          if (extractedTelegram) telegram = extractedTelegram;
        }
        
        if (twitter || telegram) {
          logger.info(`✅📡 Solscan found - Twitter: ${twitter || 'none'}, Telegram: ${telegram || 'none'}`);
          return { twitter, telegram, website: data.website };
        }
      }
      
      return null;
    } catch (error) {
      logger.warn('❌📡 Solscan social fetch failed');
      return null;
    }
  }

  // 🐦 VERIFY TWITTER ACCOUNT
  private async verifyTwitterAccount(twitterHandle: string): Promise<TwitterData | null> {
    try {
      logger.info(`🐦 Verifying Twitter account: @${twitterHandle}`);
      
      // Clean the handle
      const cleanHandle = twitterHandle.replace('@', '').trim();
      
      // Method 1: Try to fetch Twitter profile using web scraping approach
      const profileData = await this.scrapeTwitterProfile(cleanHandle);
      
      if (profileData) {
        logger.info(`✅🐦 Twitter verification successful: @${cleanHandle}`);
        return {
          handle: cleanHandle,
          followers: profileData.followers,
          verified: profileData.verified,
          active: profileData.active,
          engagement: this.calculateEngagementLevel(profileData.followers),
          lastActivity: profileData.lastActivity,
          profileExists: true
        };
      }
      
      // Method 2: Fallback - check if profile exists
      const exists = await this.checkTwitterProfileExists(cleanHandle);
      
      if (exists) {
        return {
          handle: cleanHandle,
          profileExists: true,
          active: true,
          engagement: 'MEDIUM'
        };
      }
      
      return null;
      
    } catch (error) {
      logger.warn(`❌🐦 Twitter verification failed for @${twitterHandle}:`, error);
      return null;
    }
  }

  // 📱 VERIFY TELEGRAM ACCOUNT
  private async verifyTelegramAccount(telegramHandle: string): Promise<TelegramData | null> {
    try {
      logger.info(`📱 Verifying Telegram: @${telegramHandle}`);
      
      // Clean the handle
      const cleanHandle = telegramHandle.replace('@', '').trim();
      
      // Try to get Telegram channel/group info
      const telegramData = await this.scrapeTelegramProfile(cleanHandle);
      
      if (telegramData) {
        logger.info(`✅📱 Telegram verification successful: @${cleanHandle}`);
        return {
          handle: cleanHandle,
          members: telegramData.members,
          active: telegramData.active,
          type: telegramData.type,
          lastActivity: telegramData.lastActivity,
          profileExists: true
        };
      }
      
      // Fallback - check if profile exists
      const exists = await this.checkTelegramProfileExists(cleanHandle);
      
      if (exists) {
        return {
          handle: cleanHandle,
          profileExists: true,
          active: true,
          type: 'GROUP'
        };
      }
      
      return null;
      
    } catch (error) {
      logger.warn(`❌📱 Telegram verification failed for @${telegramHandle}:`, error);
      return null;
    }
  }

  // 🔍 SCRAPE TWITTER PROFILE DATA
  private async scrapeTwitterProfile(handle: string): Promise<{followers?: number, verified?: boolean, active?: boolean, lastActivity?: string} | null> {
    try {
      // Method 1: Try Twitter API alternatives (nitter, etc.)
      const nitterUrls = [
        `https://nitter.net/${handle}`,
        `https://nitter.it/${handle}`,
        `https://nitter.privacy.com.de/${handle}`
      ];
      
      for (const url of nitterUrls) {
        try {
          const response = await this.socialAxios.get(url, { timeout: 5000 });
          
          if (response.status === 200 && response.data) {
            const html = response.data;
            
            // Extract follower count
            let followers = 0;
            const followerMatch = html.match(/(\d+(?:,\d+)*)\s*(?:Followers|followers)/i);
            if (followerMatch) {
              followers = parseInt(followerMatch[1].replace(/,/g, ''));
            }
            
            // Check verification
            const verified = html.includes('verified') || html.includes('✓') || html.includes('checkmark');
            
            // Check activity
            const active = html.includes('hours ago') || html.includes('minutes ago') || html.includes('days ago');
            
            return {
              followers,
              verified,
              active,
              lastActivity: active ? 'Recently' : 'Unknown'
            };
          }
        } catch (error) {
          continue; // Try next nitter instance
        }
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }

  // 🔍 SCRAPE TELEGRAM PROFILE DATA
  private async scrapeTelegramProfile(handle: string): Promise<{members?: number, active?: boolean, type?: 'GROUP' | 'CHANNEL' | 'BOT', lastActivity?: string} | null> {
    try {
      // Try to access Telegram preview
      const url = `https://t.me/${handle}`;
      
      const response = await this.socialAxios.get(url, { 
        timeout: 5000,
        headers: {
          'User-Agent': 'TelegramBot (like TwitterBot)'
        }
      });
      
      if (response.status === 200 && response.data) {
        const html = response.data;
        
        // Extract member count
        let members = 0;
        const memberMatch = html.match(/(\d+(?:,\d+)*)\s*(?:members|subscribers)/i);
        if (memberMatch) {
          members = parseInt(memberMatch[1].replace(/,/g, ''));
        }
        
        // Determine type
        let type: 'GROUP' | 'CHANNEL' | 'BOT' = 'GROUP';
        if (html.includes('channel') || html.includes('Channel')) {
          type = 'CHANNEL';
        } else if (html.includes('bot') || html.includes('Bot')) {
          type = 'BOT';
        }
        
        // Check activity
        const active = html.includes('online') || html.includes('recently') || html.includes('last seen');
        
        return {
          members,
          active,
          type,
          lastActivity: active ? 'Recently' : 'Unknown'
        };
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }

  // 🔍 CHECK IF TWITTER PROFILE EXISTS
  private async checkTwitterProfileExists(handle: string): Promise<boolean> {
    try {
      const url = `https://twitter.com/${handle}`;
      const response = await this.socialAxios.head(url, { timeout: 3000 });
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  // 🔍 CHECK IF TELEGRAM PROFILE EXISTS
  private async checkTelegramProfileExists(handle: string): Promise<boolean> {
    try {
      const url = `https://t.me/${handle}`;
      const response = await this.socialAxios.head(url, { timeout: 3000 });
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  // 🛠️ UTILITY FUNCTIONS
  private extractTwitterHandle(url: string): string | null {
    if (!url) return null;
    
    const patterns = [
      /twitter\.com\/([a-zA-Z0-9_]+)/,
      /x\.com\/([a-zA-Z0-9_]+)/,
      /@([a-zA-Z0-9_]+)/
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    
    // If it's just a handle without URL
    if (url.match(/^[a-zA-Z0-9_]+$/)) {
      return url;
    }
    
    return null;
  }

  private extractTelegramHandle(url: string): string | null {
    if (!url) return null;
    
    const patterns = [
      /t\.me\/([a-zA-Z0-9_]+)/,
      /telegram\.me\/([a-zA-Z0-9_]+)/,
      /@([a-zA-Z0-9_]+)/
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    
    // If it's just a handle without URL
    if (url.match(/^[a-zA-Z0-9_]+$/)) {
      return url;
    }
    
    return null;
  }

  private calculateEngagementLevel(followers?: number): 'LOW' | 'MEDIUM' | 'HIGH' {
    if (!followers) return 'LOW';
    if (followers >= 50000) return 'HIGH';
    if (followers >= 5000) return 'MEDIUM';
    return 'LOW';
  }

  // 📊 COMPILE SOCIAL DATA
  private compileSocialData(
    twitter: TwitterData | null, 
    telegram: TelegramData | null, 
    tokenIdentifier: string
  ): SocialMediaData {
    
    const activePlatforms: string[] = [];
    let totalFollowers = 0;
    let verifiedAccounts = 0;
    let activeAccounts = 0;

    // Process Twitter data
    if (twitter?.profileExists) {
      activePlatforms.push('Twitter');
      totalFollowers += twitter.followers || 0;
      if (twitter.verified) verifiedAccounts++;
      if (twitter.active) activeAccounts++;
    }

    // Process Telegram data
    if (telegram?.profileExists) {
      activePlatforms.push('Telegram');
      totalFollowers += telegram.members || 0;
      if (telegram.active) activeAccounts++;
    }

    // Calculate overall engagement
    const overallEngagement = this.calculateOverallEngagement(twitter, telegram, totalFollowers);
    
    // Calculate social rating (1-5 stars)
    const socialRating = this.calculateSocialRating(
      activePlatforms.length,
      totalFollowers,
      verifiedAccounts,
      activeAccounts,
      overallEngagement
    );

    // Determine risk level
    const riskLevel = this.calculateRiskLevel(socialRating, activePlatforms.length, verifiedAccounts);

    // Generate summary
    const summary = this.generateSummary(socialRating, activePlatforms, verifiedAccounts, totalFollowers);

    return {
      twitter: twitter?.profileExists ? twitter : undefined,
      telegram: telegram?.profileExists ? telegram : undefined,
      overall: {
        totalFollowers,
        platformCount: activePlatforms.length,
        verifiedAccounts,
        activeAccounts,
        engagement: overallEngagement
      },
      riskLevel,
      socialRating,
      summary,
      activePlatforms
    };
  }

  // 📊 CALCULATE OVERALL ENGAGEMENT
  private calculateOverallEngagement(
    twitter: TwitterData | null, 
    telegram: TelegramData | null, 
    totalFollowers: number
  ): 'LOW' | 'MEDIUM' | 'HIGH' {
    
    let engagementScore = 0;
    let platforms = 0;

    if (twitter?.profileExists) {
      platforms++;
      if (twitter.engagement === 'HIGH') engagementScore += 3;
      else if (twitter.engagement === 'MEDIUM') engagementScore += 2;
      else engagementScore += 1;
    }

    if (telegram?.profileExists) {
      platforms++;
      if (telegram.members && telegram.members >= 10000) engagementScore += 3;
      else if (telegram.members && telegram.members >= 1000) engagementScore += 2;
      else engagementScore += 1;
    }

    if (platforms === 0) return 'LOW';

    const averageEngagement = engagementScore / platforms;
    
    if (averageEngagement >= 2.5) return 'HIGH';
    if (averageEngagement >= 1.5) return 'MEDIUM';
    return 'LOW';
  }

  // ⭐ CALCULATE SOCIAL RATING
  private calculateSocialRating(
    platformCount: number,
    totalFollowers: number,
    verifiedAccounts: number,
    activeAccounts: number,
    engagement: 'LOW' | 'MEDIUM' | 'HIGH'
  ): number {
    
    let rating = 1; // Base rating

    // Platform diversity bonus
    rating += platformCount * 0.8;

    // Follower count bonus
    if (totalFollowers >= 100000) rating += 1.5;
    else if (totalFollowers >= 50000) rating += 1.2;
    else if (totalFollowers >= 10000) rating += 1;
    else if (totalFollowers >= 1000) rating += 0.6;
    else if (totalFollowers >= 100) rating += 0.3;

    // Verified account bonus
    rating += verifiedAccounts * 0.8;

    // Active account bonus
    rating += (activeAccounts / Math.max(platformCount, 1)) * 0.6;

    // Engagement bonus
    if (engagement === 'HIGH') rating += 1.2;
    else if (engagement === 'MEDIUM') rating += 0.6;

    // Cap at 5 stars
    return Math.min(5, Math.round(rating * 10) / 10);
  }

  // 🚨 CALCULATE RISK LEVEL
  private calculateRiskLevel(
    socialRating: number,
    platformCount: number,
    verifiedAccounts: number
  ): 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH' {
    
    if (socialRating >= 4 && verifiedAccounts > 0) return 'LOW';
    if (socialRating >= 3.5 && platformCount >= 2) return 'LOW';
    if (socialRating >= 3) return 'MEDIUM';
    if (socialRating >= 2) return 'MEDIUM';
    if (socialRating >= 1.5) return 'HIGH';
    return 'VERY_HIGH';
  }

  // 📝 GENERATE SUMMARY
  private generateSummary(
    socialRating: number,
    activePlatforms: string[],
    verifiedAccounts: number,
    totalFollowers: number
  ): string {
    
    const stars = '⭐'.repeat(Math.floor(socialRating));
    const platforms = activePlatforms.join(', ');
    
    if (socialRating >= 4) {
      return `Strong social presence with ${stars} rating. Active on: ${platforms} ${verifiedAccounts > 0 ? '✓' : ''}`;
    } else if (socialRating >= 3) {
      return `Good social engagement ${stars}. Found on: ${platforms} ${verifiedAccounts > 0 ? '✓' : ''}`;
    } else if (socialRating >= 2) {
      return `Limited social presence ${stars}. Platforms: ${platforms || 'None'}`;
    } else {
      return `Minimal social engagement ${stars}. Very limited online presence`;
    }
  }

  // 📊 CREATE EMPTY SOCIAL DATA FOR TOKENS WITH NO SOCIAL PRESENCE
  private createEmptySocialData(): SocialMediaData {
    return {
      overall: {
        totalFollowers: 0,
        platformCount: 0,
        verifiedAccounts: 0,
        activeAccounts: 0,
        engagement: 'LOW'
      },
      riskLevel: 'VERY_HIGH',
      socialRating: 1,
      summary: 'No social media presence found',
      activePlatforms: []
    };
  }

  // 🧹 CLEAR CACHE
  clearCache(): void {
    this.cache.clear();
    logger.info('📱🧹 Social media cache cleared');
  }

  // 📊 GET CACHE STATS
  getCacheStats(): { size: number; entries: string[] } {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys())
    };
  }
}
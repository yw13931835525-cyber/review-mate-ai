/**
 * License management and tier limits
 */

const TIER = {
  FREE: 'free',
  PRO: 'pro',
  TEAM: 'team',
};

// Simple license key format: rm_[tier]_[hash]
// In production, this would call a license server

const LICENSE_SERVER = 'https://api.reviewmate.ai';
const LICENSE_FILE = '.reviewmate-license';
const USAGE_FILE = '.reviewmate-usage';

/**
 * Verify a license key
 * @param {string} key - License key
 * @returns {Promise<{tier: string, valid: boolean, message: string}>}
 */
async function verifyLicense(key) {
  if (!key) {
    return { tier: TIER.FREE, valid: false, message: 'No license key - using free tier' };
  }

  // Basic format check
  if (!key.startsWith('rm_')) {
    return { tier: TIER.FREE, valid: false, message: 'Invalid license key format' };
  }

  // Parse key components
  const parts = key.split('_');
  if (parts.length < 3) {
    return { tier: TIER.FREE, valid: false, message: 'Invalid license key' };
  }

  const tier = parts[1] || TIER.FREE;
  const hash = parts.slice(2).join('_');

  // In production, verify against license server
  // For now, accept keys with valid tier prefix
  const validTiers = [TIER.FREE, TIER.PRO, TIER.TEAM];
  if (!validTiers.includes(tier)) {
    return { tier: TIER.FREE, valid: false, message: 'Unknown license tier' };
  }

  // Check hash length (basic validation)
  if (hash.length < 8) {
    return { tier: TIER.FREE, valid: false, message: 'Invalid license key hash' };
  }

  return {
    tier,
    valid: true,
    message: `${tier.toUpperCase()} license active`,
  };
}

/**
 * Get limits for a tier
 */
function getTierLimits(tier) {
  const limits = {
    [TIER.FREE]: {
      maxFilesPerPR: 5,
      maxPRsPerMonth: 30,
      reviewsPerMonth: 30,
      securityScan: false,
      deepAnalysis: false,
      multiLanguage: false,
      teamFeatures: false,
    },
    [TIER.PRO]: {
      maxFilesPerPR: 50,
      maxPRsPerMonth: Infinity,
      reviewsPerMonth: Infinity,
      securityScan: true,
      deepAnalysis: true,
      multiLanguage: true,
      teamFeatures: false,
    },
    [TIER.TEAM]: {
      maxFilesPerPR: Infinity,
      maxPRsPerMonth: Infinity,
      reviewsPerMonth: Infinity,
      securityScan: true,
      deepAnalysis: true,
      multiLanguage: true,
      teamFeatures: true,
    },
  };

  return limits[tier] || limits[TIER.FREE];
}

module.exports = {
  TIER,
  verifyLicense,
  getTierLimits,
};

// Sentinel — Rules Library
// Sensitivity levels
export const LEVELS = {
  PUBLIC: 0,
  INTERNAL: 1,
  CONFIDENTIAL: 2,
  RESTRICTED: 3,
};

export const LEVEL_NAMES = ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED'];

export const RULES = {
  // Regex patterns → { regex, label, level }
  patterns: {
    apiKey: {
      regex: /(?:api[_\-\s]?key|api[_\-\s]?secret|access[_\-\s]?key)\s*[:=]\s*['"]?([A-Za-z0-9\-_]{16,})/gi,
      label: 'API Key',
      level: LEVELS.RESTRICTED,
    },
    email: {
      regex: /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g,
      label: 'Email Address',
      level: LEVELS.CONFIDENTIAL,
    },
    phone: {
      regex: /(?:\+?1[\s\-.]?)?\(?\d{3}\)?[\s\-.]?\d{3}[\s\-.]?\d{4}/g,
      label: 'Phone Number',
      level: LEVELS.CONFIDENTIAL,
    },
    creditCard: {
      regex: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})\b/g,
      label: 'Credit Card Number',
      level: LEVELS.RESTRICTED,
    },
    privateKey: {
      regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
      label: 'Private Key',
      level: LEVELS.RESTRICTED,
    },
    password: {
      regex: /(?:password|passwd|pwd|secret|token|auth_token|bearer)\s*[:=]\s*['"]?([^\s'"]{8,})/gi,
      label: 'Password / Token',
      level: LEVELS.RESTRICTED,
    },
    revenue: {
      regex: /\$\s*\d+(?:\.\d+)?\s*(?:[KkMmBb]|million|billion|thousand)/g,
      label: 'Revenue Figure',
      level: LEVELS.CONFIDENTIAL,
    },
    ssn: {
      regex: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g,
      label: 'SSN',
      level: LEVELS.RESTRICTED,
    },
    ipAddress: {
      regex: /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g,
      label: 'IP Address',
      level: LEVELS.INTERNAL,
    },
  },

  // Entity keyword lists → { keywords, label, level }
  entities: {
    financial: {
      keywords: ['runway', 'burn rate', 'cap table', 'valuation', 'equity', 'dilution', 'series a', 'series b', 'ipo', 'pre-money', 'post-money', 'arr', 'mrr', 'ebitda', 'net revenue', 'gross margin', 'cash flow', 'bridge round', 'convertible note', 'safe note'],
      label: 'Financial Term',
      level: LEVELS.CONFIDENTIAL,
    },
    legal: {
      keywords: ['nda', 'non-disclosure', 'term sheet', 'letter of intent', 'loi', 'due diligence', 'indemnification', 'liability', 'arbitration', 'settlement', 'litigation', 'breach', 'injunction', 'attorney-client'],
      label: 'Legal Term',
      level: LEVELS.CONFIDENTIAL,
    },
    ma: {
      keywords: ['acquisition', 'acquire', 'merger', 'acquihire', 'takeover', 'buyout', 'target company', 'deal close', 'closing', 'lbo', 'asset purchase', 'share purchase', 'strategic partner', 'exclusivity period'],
      label: 'M&A Term',
      level: LEVELS.RESTRICTED,
    },
    hr: {
      keywords: ['salary', 'compensation', 'bonus', 'equity grant', 'stock options', 'vesting', 'severance', 'performance review', 'termination', 'layoff', 'headcount', 'hiring freeze', 'offer letter'],
      label: 'HR Term',
      level: LEVELS.CONFIDENTIAL,
    },
  },

  // Custom rules → { name, pattern (regex string), label, level, enabled }
  customRules: [
    { name: 'Project Nighthawk', pattern: '\\bNighthawk\\b', label: 'Project Codename', level: LEVELS.RESTRICTED, enabled: true },
    { name: 'Project X', pattern: '\\bProject\\s+X\\b', label: 'Project Codename', level: LEVELS.RESTRICTED, enabled: true },
    { name: 'Operation Titan', pattern: '\\bOperation\\s+Titan\\b', label: 'Project Codename', level: LEVELS.RESTRICTED, enabled: true },
    { name: 'Internal Domain', pattern: '\\b[a-z0-9-]+\\.internal\\b', label: 'Internal Domain', level: LEVELS.INTERNAL, enabled: true },
  ],
};

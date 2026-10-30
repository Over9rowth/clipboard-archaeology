// Copyright (C) 2026 Over9rowth
// SPDX-License-Identifier: GPL-3.0-only
/**
 * 剪贴板考古台 - 核心领域算法与敏感信息哨兵
 * 100% 真实数学公式与规则实现，严禁伪实现
 */

const crypto = require("node:crypto");

/**
 * Luhn 模 10 校验算法
 * 仅包含 13~19 位数字且非全同数字，从右向左偶数位乘 2（若 > 9 则减 9），全部位求和 mod 10 === 0
 */
function verifyLuhn(digitsOnly) {
  if (typeof digitsOnly !== "string") return false;
  const cleaned = digitsOnly.replace(/[\s-]/g, "");
  if (!/^\d{13,19}$/.test(cleaned)) return false;

  // 排除全同数字（如 0000000000000000 或 1111111111111111）
  const firstChar = cleaned[0];
  if (cleaned.split("").every(c => c === firstChar)) return false;

  let sum = 0;
  let shouldDouble = false;
  for (let i = cleaned.length - 1; i >= 0; i--) {
    let digit = parseInt(cleaned[i], 10);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }
  return sum % 10 === 0;
}

/**
 * 18 位身份证 ISO 7064:1983.MOD 11-2 校验码
 * 前 17 位乘权重求和 mod 11，映射表与第 18 位严格一致
 */
function verifyCnIdCheckDigit(id18) {
  if (typeof id18 !== "string") return false;
  const upper = id18.toUpperCase().trim();
  if (!/^\d{17}[\dX]$/.test(upper)) return false;

  const weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
  const checkCodes = ["1", "0", "X", "9", "8", "7", "6", "5", "4", "3", "2"];

  let sum = 0;
  for (let i = 0; i < 17; i++) {
    sum += parseInt(upper[i], 10) * weights[i];
  }
  const mod = sum % 11;
  return checkCodes[mod] === upper[17];
}

/**
 * 香农信息熵计算：H = -sum(p_i * log2(p_i))
 */
function calcShannonEntropy(str) {
  if (typeof str !== "string" || str.length === 0) return 0;
  const freq = {};
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    freq[ch] = (freq[ch] || 0) + 1;
  }
  const len = str.length;
  let entropy = 0;
  for (const count of Object.values(freq)) {
    const p = count / len;
    entropy -= p * Math.log2(p);
  }
  return Math.round(entropy * 1000) / 1000;
}

/**
 * 脱敏单项区间：保留前 3 字符与后 2 字符，中间替换为 "••••••"
 */
function maskSingleToken(raw) {
  if (raw.length <= 5) return "••••••";
  return raw.slice(0, 3) + "••••••" + raw.slice(-2);
}

/**
 * 敏感信息审查巡检器
 */
function inspectSensitiveContent(text) {
  if (typeof text !== "string" || text.trim().length === 0) {
    return { hasSensitive: false, riskLevel: "SAFE", findings: [] };
  }

  const findings = [];

  // 1. 银行卡检测：匹配 13~19 位数字（允许空格或中划线分隔），必须通过 Luhn 校验
  const bankCardRegex = /\b(?:\d[ -]?){13,19}\b/g;
  let match;
  while ((match = bankCardRegex.exec(text)) !== null) {
    const raw = match[0];
    const digits = raw.replace(/[\s-]/g, "");
    if (verifyLuhn(digits)) {
      findings.push({
        type: "BANK_CARD",
        rawMatch: raw,
        maskedPreview: maskSingleToken(raw),
        startOffset: match.index,
        endOffset: match.index + raw.length,
        reason: `通过 Luhn 模 10 校验的标准卡号（${digits.length}位）`
      });
    }
  }

  // 2. 18 位中国居民身份证检测：必须通过 ISO 7064 校验码
  const cnIdRegex = /\b[1-9]\d{5}(?:18|19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{3}[\dX]\b/gi;
  while ((match = cnIdRegex.exec(text)) !== null) {
    const raw = match[0];
    if (verifyCnIdCheckDigit(raw)) {
      findings.push({
        type: "CN_ID_CARD",
        rawMatch: raw,
        maskedPreview: maskSingleToken(raw),
        startOffset: match.index,
        endOffset: match.index + raw.length,
        reason: "符合二代身份证生日规范且通过 ISO 7064 模 11 校验位"
      });
    }
  }

  // 3. API 密钥、JWT 令牌或特定服务 Token
  // - OpenAI: sk-[a-zA-Z0-9_-]{20,}
  // - AWS Access Key: (?:AKIA|ABIA|ACCA|ASIA)[0-9A-Z]{16}
  // - GitHub Token: ghp_[a-zA-Z0-9]{36} or gho_[a-zA-Z0-9]{36}
  // - JWT Header: eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+
  const apiKeyRegexes = [
    { pattern: /\bsk-(?:live-|proj-)?[a-zA-Z0-9_-]{20,}\b/g, desc: "OpenAI/大模型 API Key" },
    { pattern: /\b(?:AKIA|ABIA|ACCA|ASIA)[0-9A-Z]{16}\b/g, desc: "AWS Access Key ID" },
    { pattern: /\b(?:ghp|gho|ghu|ghs|ghr)_[a-zA-Z0-9]{36}\b/g, desc: "GitHub Access Token" },
    { pattern: /\beyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}(?:\.[a-zA-Z0-9_-]+)?\b/g, desc: "JWT 认证令牌" }
  ];

  for (const { pattern, desc } of apiKeyRegexes) {
    while ((match = pattern.exec(text)) !== null) {
      const raw = match[0];
      findings.push({
        type: "API_KEY_OR_TOKEN",
        rawMatch: raw,
        maskedPreview: maskSingleToken(raw),
        startOffset: match.index,
        endOffset: match.index + raw.length,
        reason: desc
      });
    }
  }

  // 4. 高香农熵疑似随机密码/Secret（长度 12~64、同时包含大写、小写、数字、且非 URL/路径，H >= 3.85）
  const tokenRegex = /\b[A-Za-z0-9!@#$%^&*()_+=\-`~[\]{}|:;<>?,./]{12,64}\b/g;
  while ((match = tokenRegex.exec(text)) !== null) {
    const raw = match[0];
    // 排除已匹配的 API Key 或银行卡
    const alreadyMatched = findings.some(f => match.index >= f.startOffset && match.index < f.endOffset);
    if (!alreadyMatched) {
      const hasUpper = /[A-Z]/.test(raw);
      const hasLower = /[a-z]/.test(raw);
      const hasDigit = /[0-9]/.test(raw);
      const isPathOrUrl = /^https?:\/\//i.test(raw) || /^[A-Za-z]:\\/.test(raw) || raw.includes("/");
      if (hasUpper && hasLower && hasDigit && !isPathOrUrl) {
        const entropy = calcShannonEntropy(raw);
        if (entropy >= 3.85) {
          findings.push({
            type: "HIGH_ENTROPY_SECRET",
            rawMatch: raw,
            maskedPreview: maskSingleToken(raw),
            startOffset: match.index,
            endOffset: match.index + raw.length,
            reason: `高香农信息熵密码/私钥（H=${entropy} bits/char）`
          });
        }
      }
    }
  }

  // 5. 常见高敏联系人 PII（手机号等）
  const phoneRegex = /\b(?:(?:\+?86)?1[3-9]\d{9})\b/g;
  while ((match = phoneRegex.exec(text)) !== null) {
    const raw = match[0];
    const alreadyMatched = findings.some(f => match.index >= f.startOffset && match.index < f.endOffset);
    if (!alreadyMatched) {
      findings.push({
        type: "CONTACT_PII",
        rawMatch: raw,
        maskedPreview: maskSingleToken(raw),
        startOffset: match.index,
        endOffset: match.index + raw.length,
        reason: "中国大陆手机号码（11位数字规范）"
      });
    }
  }

  // 去除重叠的区间
  findings.sort((a, b) => a.startOffset - b.startOffset);
  const dedupedFindings = [];
  let lastEnd = -1;
  for (const f of findings) {
    if (f.startOffset >= lastEnd) {
      dedupedFindings.push(f);
      lastEnd = f.endOffset;
    }
  }

  let riskLevel = "SAFE";
  if (dedupedFindings.length > 0) {
    const hasHigh = dedupedFindings.some(f =>
      f.type === "BANK_CARD" || f.type === "CN_ID_CARD" || f.type === "API_KEY_OR_TOKEN" || f.type === "HIGH_ENTROPY_SECRET"
    );
    riskLevel = hasHigh ? "HIGH" : "MEDIUM";
  }

  return {
    hasSensitive: dedupedFindings.length > 0,
    riskLevel,
    findings: dedupedFindings
  };
}

/**
 * 对文本中检出的敏感内容执行一键脱敏替换
 */
function maskSensitiveText(text) {
  if (typeof text !== "string" || text.length === 0) {
    return { maskedText: "", redactionCount: 0 };
  }
  const inspection = inspectSensitiveContent(text);
  if (inspection.findings.length === 0) {
    return { maskedText: text, redactionCount: 0 };
  }

  let result = "";
  let lastIndex = 0;
  for (const f of inspection.findings) {
    result += text.slice(lastIndex, f.startOffset);
    result += f.maskedPreview;
    lastIndex = f.endOffset;
  }
  result += text.slice(lastIndex);

  return {
    maskedText: result,
    redactionCount: inspection.findings.length
  };
}

/**
 * 历史记录 SHA-256 去重与检索过滤
 */
function dedupeAndFilterHistory(entries, query, filterCategory) {
  if (!Array.isArray(entries)) return [];

  // SHA-256 去重，保留最新的一条
  const seenHashes = new Set();
  const deduped = [];
  // 逆序遍历优先保留最新
  const sorted = [...entries].sort((a, b) => b.createdAtMs - a.createdAtMs);
  for (const item of sorted) {
    const text = item.text || "";
    const hash = crypto.createHash("sha256").update(text, "utf8").digest("hex");
    if (!seenHashes.has(hash)) {
      seenHashes.add(hash);
      const inspection = inspectSensitiveContent(text);
      deduped.push({
        id: item.id,
        text,
        createdAtMs: item.createdAtMs,
        pinned: !!item.pinned,
        hash,
        charCount: text.length,
        inspection
      });
    }
  }

  // 过滤
  let filtered = deduped;
  if (query && query.trim().length > 0) {
    const q = query.trim().toLowerCase();
    filtered = filtered.filter(item => item.text.toLowerCase().includes(q));
  }

  if (filterCategory && filterCategory !== "ALL") {
    if (filterCategory === "SENSITIVE") {
      filtered = filtered.filter(item => item.inspection.hasSensitive);
    } else if (filterCategory === "SAFE") {
      filtered = filtered.filter(item => !item.inspection.hasSensitive);
    } else {
      filtered = filtered.filter(item =>
        item.inspection.findings.some(f => f.type === filterCategory)
      );
    }
  }

  // 置顶优先，其次按时间倒序
  filtered.sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return b.createdAtMs - a.createdAtMs;
  });

  return filtered;
}

module.exports = {
  verifyLuhn,
  verifyCnIdCheckDigit,
  calcShannonEntropy,
  inspectSensitiveContent,
  maskSensitiveText,
  dedupeAndFilterHistory
};

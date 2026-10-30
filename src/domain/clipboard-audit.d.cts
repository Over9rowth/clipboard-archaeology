export interface SensitiveFinding {
  type: "BANK_CARD" | "CN_ID_CARD" | "API_KEY_OR_TOKEN" | "HIGH_ENTROPY_SECRET" | "CONTACT_PII";
  rawMatch: string;
  maskedPreview: string;
  startOffset: number;
  endOffset: number;
  reason: string;
}

export interface SensitiveInspectionResult {
  hasSensitive: boolean;
  riskLevel: "HIGH" | "MEDIUM" | "SAFE";
  findings: SensitiveFinding[];
}

export interface MaskResult {
  maskedText: string;
  redactionCount: number;
}

export interface ClipboardHistoryItem {
  id: string;
  text: string;
  createdAtMs: number;
  pinned?: boolean;
  hash: string;
  charCount: number;
  inspection: SensitiveInspectionResult;
}

export declare function verifyLuhn(digitsOnly: string): boolean;
export declare function verifyCnIdCheckDigit(id18: string): boolean;
export declare function calcShannonEntropy(str: string): number;
export declare function inspectSensitiveContent(text: string): SensitiveInspectionResult;
export declare function maskSensitiveText(text: string): MaskResult;
export declare function dedupeAndFilterHistory(
  entries: Array<{ id: string; text: string; createdAtMs: number; pinned?: boolean }>,
  query?: string,
  filterCategory?: string
): Array<ClipboardHistoryItem>;

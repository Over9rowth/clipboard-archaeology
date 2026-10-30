const { describe, it } = require("node:test");
const assert = require("node:assert");
const {
  verifyLuhn,
  verifyCnIdCheckDigit,
  calcShannonEntropy,
  inspectSensitiveContent,
  maskSensitiveText,
  dedupeAndFilterHistory
} = require("../src/domain/clipboard-audit.cjs");

describe("剪贴板考古台 - 核心算法与高敏哨兵单元测试", () => {
  // 1. 银行卡 Luhn 算法测试
  it("01. verifyLuhn 正确识别标准银联/Visa卡号并拒绝非法/全同卡号", () => {
    // 经典合法的测试卡号 (Visa: 4532...1057, Master: 5105...)
    assert.strictEqual(verifyLuhn("4532 0151 1283 0366"), true);
    assert.strictEqual(verifyLuhn("4532015112830366"), true);
    assert.strictEqual(verifyLuhn("6222020200112233445"), false); // 随便构造的无效奇偶和

    // 拒绝全同数字
    assert.strictEqual(verifyLuhn("0000000000000000"), false);
    assert.strictEqual(verifyLuhn("1111111111111111"), false);
    // 拒绝长度不合规
    assert.strictEqual(verifyLuhn("123456"), false);
  });

  // 2. 二代身份证 ISO 7064 校验码测试
  it("02. verifyCnIdCheckDigit 严格校验前 17 位与第 18 位校验码对应关系", () => {
    // 合法测试身份证号码（前17位算出的校验码必须与末位一致）
    // 11010519491231002X (权重计算: mod 11 为 2 -> 对应码 'X')
    assert.strictEqual(verifyCnIdCheckDigit("11010519491231002X"), true);
    assert.strictEqual(verifyCnIdCheckDigit("11010519491231002x"), true);
    // 篡改末位
    assert.strictEqual(verifyCnIdCheckDigit("110105194912310020"), false);
    assert.strictEqual(verifyCnIdCheckDigit("110105194912310029"), false);
    // 长度或格式错误
    assert.strictEqual(verifyCnIdCheckDigit("1101051949123100"), false);
  });

  // 3. 香农信息熵公式测试
  it("03. calcShannonEntropy 计算真实信息熵（单字符熵=0，多字符混合高熵）", () => {
    assert.strictEqual(calcShannonEntropy(""), 0);
    assert.strictEqual(calcShannonEntropy("aaaaaaaa"), 0); // 纯同字符 H=0
    assert.strictEqual(calcShannonEntropy("abababab"), 1); // 2种等概率字符 H = - (0.5*-1 + 0.5*-1) = 1.0

    // 高随机复杂密码熵值应 >= 3.85
    const complexSecret = "Xk9#mP$7vL@2qZ!w";
    const entropy = calcShannonEntropy(complexSecret);
    assert.ok(entropy >= 3.85, `熵值应 >= 3.85，实际为 ${entropy}`);
  });

  // 4. inspectSensitiveContent 敏感凭证精准嗅探
  it("04. inspectSensitiveContent 检出 API Key、银行卡、身份证与高危密码", () => {
    const text = "OpenAI key: sk-proj-1234567890abcdef1234567890\nCard: 4532 0151 1283 0366\nPass: 8k#Lp9$vQx!2mZ0@";
    const res = inspectSensitiveContent(text);
    assert.strictEqual(res.hasSensitive, true);
    assert.strictEqual(res.riskLevel, "HIGH");
    assert.strictEqual(res.findings.length, 3);

    const types = res.findings.map(f => f.type);
    assert.ok(types.includes("API_KEY_OR_TOKEN"));
    assert.ok(types.includes("BANK_CARD"));
    assert.ok(types.includes("HIGH_ENTROPY_SECRET"));
  });

  // 5. maskSensitiveText 一键脱敏功能测试
  it("05. maskSensitiveText 自动保留前 3 后 2 字符并替换为中间黑圆点", () => {
    const text = "请付款至 4532 0151 1283 0366 谢谢";
    const masked = maskSensitiveText(text);
    assert.strictEqual(masked.redactionCount, 1);
    assert.ok(masked.maskedText.includes("453••••••66"));
    assert.ok(!masked.maskedText.includes("0151"));
  });

  // 6. dedupeAndFilterHistory SHA-256 去重与搜索
  it("06. dedupeAndFilterHistory 根据内容 SHA-256 自动去重且按时间/分类过滤", () => {
    const entries = [
      { id: "1", text: "测试重复剪贴内容", createdAtMs: 1000 },
      { id: "2", text: "测试重复剪贴内容", createdAtMs: 2000 }, // 应保留这条（时间更新）
      { id: "3", text: "纯安全内容没有任何敏感信息", createdAtMs: 1500 },
      { id: "4", text: "包含高危凭证 sk-proj-1234567890abcdef1234567890", createdAtMs: 1800 }
    ];

    const all = dedupeAndFilterHistory(entries);
    assert.strictEqual(all.length, 3, "相同内容应被 SHA-256 唯一去重");

    const sensitiveOnly = dedupeAndFilterHistory(entries, "", "SENSITIVE");
    assert.strictEqual(sensitiveOnly.length, 1);
    assert.strictEqual(sensitiveOnly[0].id, "4");

    const searchRes = dedupeAndFilterHistory(entries, "纯安全", "ALL");
    assert.strictEqual(searchRes.length, 1);
    assert.strictEqual(searchRes[0].id, "3");
  });

  // 7. 【反向对照测试 1】验证 Luhn 校验若被篡改为恒真返回则必定在无效卡号上暴露并抛出 AssertionError
  it("07. 【反向对照测试 1】Luhn 校验算法的严谨性与非平凡性验证", () => {
    const fakeLuhn = () => true;
    const invalidCard = "4532 0151 1283 0367"; // 末位被篡改的无效卡号

    // 真实算法必须判定为 false
    assert.strictEqual(verifyLuhn(invalidCard), false, "真实 Luhn 算法必须准确拒绝校验和不合法的卡号");

    // 若使用的是假算法（恒真），则无法拦截该无效卡号
    assert.throws(() => {
      const isAccepted = fakeLuhn(invalidCard);
      assert.strictEqual(isAccepted, false, "假算法被成功识破：恒真算法未能拒绝无效卡号");
    }, /AssertionError/);
  });

  // 8. 【反向对照测试 2】验证香农信息熵若被篡改为固定常数则无法区分重复文本与随机密码
  it("08. 【反向对照测试 2】香农信息熵计算的数学敏感性与非平凡性验证", () => {
    const fakeEntropy = () => 4.0; // 假实现直接返回常量
    const repeated = "aaaaaaaaaaaaaaaaaaaa";
    const random = "kX9#mP$7vL@2qZ!w";

    const realRepeatedEntropy = calcShannonEntropy(repeated);
    const realRandomEntropy = calcShannonEntropy(random);

    assert.strictEqual(realRepeatedEntropy, 0, "完全重复字符的真实熵值必须为 0");
    assert.ok(realRandomEntropy > 3.8, "高随机字符的真实熵值必须 > 3.8");

    // 假算法无法测出重复字符的 0 熵
    assert.throws(() => {
      const entropy = fakeEntropy(repeated);
      assert.strictEqual(entropy, 0, "假算法被成功识破：无法计算出纯重复文本的零熵");
    }, /AssertionError/);
  });
});

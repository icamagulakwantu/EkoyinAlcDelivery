// The bank account customers pay EFT orders into (founder, 22 Nov 2026).
// The details live in Render env vars, not in the code, so they can change (for example to a company
// business account) without a deploy: EFT_BANK_NAME, EFT_ACCOUNT_NAME, EFT_ACCOUNT_NUMBER,
// EFT_ACCOUNT_TYPE, EFT_BRANCH_CODE. Until they are all set, customers are told dispatch will send
// the banking details (the old behaviour).
// They are shown only to the customer who placed an EFT order that is still waiting for payment.
function getEftDetails(env = process.env) {
  const bankName = String(env.EFT_BANK_NAME || "").trim();
  const accountName = String(env.EFT_ACCOUNT_NAME || "").trim();
  const accountNumber = String(env.EFT_ACCOUNT_NUMBER || "").replace(/\s+/g, "");
  const accountType = String(env.EFT_ACCOUNT_TYPE || "").trim() || "Current";
  const branchCode = String(env.EFT_BRANCH_CODE || "").replace(/\s+/g, "");
  if (!bankName || !accountName || !/^\d{6,16}$/.test(accountNumber) || !/^\d{6}$/.test(branchCode)) return null;
  return { bankName, accountName, accountNumber, accountType, branchCode };
}

// A long account number reads better in groups of four.
const spaced = (n) => String(n).replace(/(\d{4})(?=\d)/g, "$1 ");

module.exports = { getEftDetails, spaced };

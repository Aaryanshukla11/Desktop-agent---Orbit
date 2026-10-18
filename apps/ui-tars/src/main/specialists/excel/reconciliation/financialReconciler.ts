/**
 * ORBIT Excel Specialist — Financial Reconciliation & Three-Way Match Engine (Level 2)
 * Reconciles Invoices, Bank Ledgers, Purchase Orders, and Receipts with audit trails.
 */

export interface PurchaseOrderRecord {
  poNumber: string;
  itemId: string;
  quantityOrdered: number;
  unitPrice: number;
  totalAmount: number;
}

export interface GoodsReceiptRecord {
  receiptId: string;
  poNumber: string;
  itemId: string;
  quantityReceived: number;
  receiptDate: string;
}

export interface VendorInvoiceRecord {
  invoiceId: string;
  poNumber: string;
  itemId: string;
  quantityBilled: number;
  billedUnitPrice: number;
  totalBilled: number;
}

export interface ThreeWayMatchResult {
  perfectMatches: Array<{
    poNumber: string;
    itemId: string;
    quantity: number;
    amount: number;
  }>;
  discrepancies: Array<{
    poNumber: string;
    itemId: string;
    issueType: 'PRICE_VARIANCE' | 'QUANTITY_VARIANCE' | 'UNMATCHED_INVOICE' | 'UNBILLED_RECEIPT';
    expected: number | string;
    actual: number | string;
    varianceAmount: number;
  }>;
  totalVarianceAmount: number;
  auditPassed: boolean;
}

export interface BankLedgerTransaction {
  txId: string;
  date: string;
  type: 'CREDIT' | 'DEBIT';
  amount: number;
  description: string;
}

export interface BankReconciliationResult {
  openingBalance: number;
  totalCredits: number;
  totalDebits: number;
  calculatedClosingBalance: number;
  reportedClosingBalance: number;
  balanceDiscrepancy: number;
  isBalanced: boolean;
  unmatchedInvoices: string[];
}

export class FinancialReconciler {
  /**
   * Executes a Three-Way Match: PO <-> Goods Receipt <-> Vendor Invoice.
   */
  public executeThreeWayMatch(params: {
    orders: PurchaseOrderRecord[];
    receipts: GoodsReceiptRecord[];
    invoices: VendorInvoiceRecord[];
    priceTolerance?: number;
  }): ThreeWayMatchResult {
    const { orders, receipts, invoices, priceTolerance = 0.01 } = params;

    const receiptMap = new Map<string, GoodsReceiptRecord>();
    receipts.forEach((r) => receiptMap.set(`${r.poNumber}§${r.itemId}`, r));

    const invoiceMap = new Map<string, VendorInvoiceRecord>();
    invoices.forEach((inv) => invoiceMap.set(`${inv.poNumber}§${inv.itemId}`, inv));

    const perfectMatches: ThreeWayMatchResult['perfectMatches'] = [];
    const discrepancies: ThreeWayMatchResult['discrepancies'] = [];
    let totalVarianceAmount = 0;

    for (const po of orders) {
      const key = `${po.poNumber}§${po.itemId}`;
      const receipt = receiptMap.get(key);
      const invoice = invoiceMap.get(key);

      if (!receipt) {
        discrepancies.push({
          poNumber: po.poNumber,
          itemId: po.itemId,
          issueType: 'UNBILLED_RECEIPT',
          expected: `Received: ${po.quantityOrdered}`,
          actual: 'No Goods Receipt Found',
          varianceAmount: po.totalAmount,
        });
        totalVarianceAmount += po.totalAmount;
        continue;
      }

      if (!invoice) {
        discrepancies.push({
          poNumber: po.poNumber,
          itemId: po.itemId,
          issueType: 'UNMATCHED_INVOICE',
          expected: `Invoice for PO ${po.poNumber}`,
          actual: 'No Vendor Invoice Found',
          varianceAmount: po.totalAmount,
        });
        totalVarianceAmount += po.totalAmount;
        continue;
      }

      // Check Quantity Variance (Ordered vs Received vs Billed)
      if (receipt.quantityReceived !== invoice.quantityBilled) {
        const qtyDiff = invoice.quantityBilled - receipt.quantityReceived;
        const varAmt = parseFloat((qtyDiff * invoice.billedUnitPrice).toFixed(2));
        discrepancies.push({
          poNumber: po.poNumber,
          itemId: po.itemId,
          issueType: 'QUANTITY_VARIANCE',
          expected: receipt.quantityReceived,
          actual: invoice.quantityBilled,
          varianceAmount: varAmt,
        });
        totalVarianceAmount += Math.abs(varAmt);
        continue;
      }

      // Check Price Variance (PO Unit Price vs Billed Unit Price)
      const priceDiff = Math.abs(po.unitPrice - invoice.billedUnitPrice);
      if (priceDiff > priceTolerance) {
        const varAmt = parseFloat((priceDiff * invoice.quantityBilled).toFixed(2));
        discrepancies.push({
          poNumber: po.poNumber,
          itemId: po.itemId,
          issueType: 'PRICE_VARIANCE',
          expected: po.unitPrice,
          actual: invoice.billedUnitPrice,
          varianceAmount: varAmt,
        });
        totalVarianceAmount += varAmt;
        continue;
      }

      // All 3 match perfectly
      perfectMatches.push({
        poNumber: po.poNumber,
        itemId: po.itemId,
        quantity: po.quantityOrdered,
        amount: po.totalAmount,
      });
    }

    return {
      perfectMatches,
      discrepancies,
      totalVarianceAmount: parseFloat(totalVarianceAmount.toFixed(2)),
      auditPassed: discrepancies.length === 0,
    };
  }

  /**
   * Executes Bank Ledger Balance Verification:
   * Opening + Credits - Debits == Closing Balance
   */
  public reconcileBankLedger(params: {
    openingBalance: number;
    reportedClosingBalance: number;
    transactions: BankLedgerTransaction[];
    registeredInvoiceIds?: string[];
  }): BankReconciliationResult {
    const { openingBalance, reportedClosingBalance, transactions, registeredInvoiceIds = [] } = params;

    let totalCredits = 0;
    let totalDebits = 0;
    const seenTxIds = new Set<string>();

    for (const tx of transactions) {
      if (tx.type === 'CREDIT') {
        totalCredits += tx.amount;
      } else {
        totalDebits += tx.amount;
      }
      seenTxIds.add(tx.txId);
    }

    const calculatedClosingBalance = parseFloat(
      (openingBalance + totalCredits - totalDebits).toFixed(2),
    );
    const balanceDiscrepancy = parseFloat(
      Math.abs(calculatedClosingBalance - reportedClosingBalance).toFixed(2),
    );

    const unmatchedInvoices = registeredInvoiceIds.filter((invId) => !seenTxIds.has(invId));

    return {
      openingBalance,
      totalCredits: parseFloat(totalCredits.toFixed(2)),
      totalDebits: parseFloat(totalDebits.toFixed(2)),
      calculatedClosingBalance,
      reportedClosingBalance,
      balanceDiscrepancy,
      isBalanced: balanceDiscrepancy <= 0.01,
      unmatchedInvoices,
    };
  }
}

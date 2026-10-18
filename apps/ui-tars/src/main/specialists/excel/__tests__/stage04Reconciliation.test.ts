import { describe, it, expect } from 'vitest';
import { SheetJoiner } from '../reconciliation/sheetJoiner';
import { FinancialReconciler } from '../reconciliation/financialReconciler';

describe('ORBIT Excel Specialist — Stage 04 (Level 2 Multi-Sheet Joins & Reconciliation)', () => {
  const joiner = new SheetJoiner();
  const reconciler = new FinancialReconciler();

  it('1. SheetJoiner correctly executes Left and Inner joins with composite keys', () => {
    const ordersHeaders = ['OrderID', 'CustomerID', 'Item', 'Amount'];
    const ordersRows = [
      ['ORD-101', 'CUST-1', 'Laptop', 1200],
      ['ORD-102', 'CUST-2', 'Monitor', 300],
      ['ORD-103', 'CUST-3', 'Keyboard', 75], // Unmatched in payments
    ];

    const paymentsHeaders = ['OrderID', 'CustomerID', 'PaymentMethod', 'Status'];
    const paymentsRows = [
      ['ORD-101', 'CUST-1', 'CreditCard', 'SETTLED'],
      ['ORD-102', 'CUST-2', 'BankWire', 'SETTLED'],
      ['ORD-999', 'CUST-9', 'Crypto', 'PENDING'], // Unmatched in orders
    ];

    // Execute Left Join on Composite Key [OrderID, CustomerID]
    const leftJoinResult = joiner.join(ordersRows, paymentsRows, {
      leftSheetName: 'Orders',
      rightSheetName: 'Payments',
      leftHeaders: ordersHeaders,
      rightHeaders: paymentsHeaders,
      leftKeyColumns: ['OrderID', 'CustomerID'],
      rightKeyColumns: ['OrderID', 'CustomerID'],
      joinType: 'LEFT',
      expectedCardinality: 'ONE_TO_ONE',
    });

    expect(leftJoinResult.matchedRows.length).toBe(3);
    expect(leftJoinResult.unmatchedLeftRows.length).toBe(1);
    expect(leftJoinResult.unmatchedLeftRows[0][0]).toBe('ORD-103');
    expect(leftJoinResult.unmatchedRightRows.length).toBe(1);
    expect(leftJoinResult.unmatchedRightRows[0][0]).toBe('ORD-999');
    expect(leftJoinResult.cardinalityViolations.length).toBe(0);

    // Inner Join
    const innerJoinResult = joiner.join(ordersRows, paymentsRows, {
      leftSheetName: 'Orders',
      rightSheetName: 'Payments',
      leftHeaders: ordersHeaders,
      rightHeaders: paymentsHeaders,
      leftKeyColumns: ['OrderID', 'CustomerID'],
      rightKeyColumns: ['OrderID', 'CustomerID'],
      joinType: 'INNER',
    });

    expect(innerJoinResult.matchedRows.length).toBe(2);
  });

  it('2. SheetJoiner detects cardinality violations (Expected ONE_TO_ONE, but found duplicates)', () => {
    const parentHeaders = ['ID', 'Name'];
    const parentRows = [['1', 'Parent A']];

    const childHeaders = ['ID', 'ChildName'];
    const childRows = [
      ['1', 'Child 1'],
      ['1', 'Child 2'], // duplicate match!
    ];

    const res = joiner.join(parentRows, childRows, {
      leftSheetName: 'Parents',
      rightSheetName: 'Children',
      leftHeaders: parentHeaders,
      rightHeaders: childHeaders,
      leftKeyColumns: ['ID'],
      rightKeyColumns: ['ID'],
      joinType: 'INNER',
      expectedCardinality: 'ONE_TO_ONE',
    });

    expect(res.cardinalityViolations.length).toBeGreaterThanOrEqual(1);
    expect(res.cardinalityViolations[0]).toContain('Cardinality Violation');
  });

  it('3. Three-Way Match Engine identifies price and quantity discrepancies', () => {
    const orders = [
      { poNumber: 'PO-100', itemId: 'ITEM-A', quantityOrdered: 10, unitPrice: 50.0, totalAmount: 500 },
      { poNumber: 'PO-200', itemId: 'ITEM-B', quantityOrdered: 5, unitPrice: 100.0, totalAmount: 500 },
      { poNumber: 'PO-300', itemId: 'ITEM-C', quantityOrdered: 20, unitPrice: 20.0, totalAmount: 400 },
    ];

    const receipts = [
      { receiptId: 'REC-1', poNumber: 'PO-100', itemId: 'ITEM-A', quantityReceived: 10, receiptDate: '2024-01-10' },
      { receiptId: 'REC-2', poNumber: 'PO-200', itemId: 'ITEM-B', quantityReceived: 5, receiptDate: '2024-01-12' },
      { receiptId: 'REC-3', poNumber: 'PO-300', itemId: 'ITEM-C', quantityReceived: 15, receiptDate: '2024-01-15' }, // Short receipt!
    ];

    const invoices = [
      { invoiceId: 'INV-1', poNumber: 'PO-100', itemId: 'ITEM-A', quantityBilled: 10, billedUnitPrice: 50.0, totalBilled: 500 }, // Match!
      { invoiceId: 'INV-2', poNumber: 'PO-200', itemId: 'ITEM-B', quantityBilled: 5, billedUnitPrice: 110.0, totalBilled: 550 }, // Price Variance!
      { invoiceId: 'INV-3', poNumber: 'PO-300', itemId: 'ITEM-C', quantityBilled: 20, billedUnitPrice: 20.0, totalBilled: 400 }, // Qty Variance with receipt (billed 20, received 15)
    ];

    const matchResult = reconciler.executeThreeWayMatch({ orders, receipts, invoices });

    expect(matchResult.auditPassed).toBe(false);
    expect(matchResult.perfectMatches.length).toBe(1);
    expect(matchResult.perfectMatches[0].poNumber).toBe('PO-100');

    expect(matchResult.discrepancies.length).toBe(2);
    expect(matchResult.discrepancies[0].issueType).toBe('PRICE_VARIANCE');
    expect(matchResult.discrepancies[0].varianceAmount).toBe(50.0);

    expect(matchResult.discrepancies[1].issueType).toBe('QUANTITY_VARIANCE');
    expect(matchResult.discrepancies[1].varianceAmount).toBe(100.0);
  });

  it('4. FinancialReconciler verifies bank ledger balance invariant: Opening + Credits - Debits == Closing', () => {
    const openingBalance = 10000.0;
    const transactions = [
      { txId: 'TX-1', date: '2024-02-01', type: 'CREDIT' as const, amount: 5000.0, description: 'Customer Payment' },
      { txId: 'TX-2', date: '2024-02-03', type: 'DEBIT' as const, amount: 2500.0, description: 'Vendor Payout' },
      { txId: 'TX-3', date: '2024-02-10', type: 'DEBIT' as const, amount: 150.0, description: 'Software Subscription' },
    ];

    // Case A: Perfectly balanced ledger (10000 + 5000 - 2500 - 150 = 12350)
    const balancedRes = reconciler.reconcileBankLedger({
      openingBalance,
      reportedClosingBalance: 12350.0,
      transactions,
    });

    expect(balancedRes.isBalanced).toBe(true);
    expect(balancedRes.balanceDiscrepancy).toBe(0.0);
    expect(balancedRes.calculatedClosingBalance).toBe(12350.0);

    // Case B: Imbalanced ledger with discrepancy (reported 12000 vs calculated 12350)
    const imbalancedRes = reconciler.reconcileBankLedger({
      openingBalance,
      reportedClosingBalance: 12000.0,
      transactions,
      registeredInvoiceIds: ['TX-1', 'TX-MISSING'],
    });

    expect(imbalancedRes.isBalanced).toBe(false);
    expect(imbalancedRes.balanceDiscrepancy).toBe(350.0);
    expect(imbalancedRes.unmatchedInvoices).toEqual(['TX-MISSING']);
  });
});

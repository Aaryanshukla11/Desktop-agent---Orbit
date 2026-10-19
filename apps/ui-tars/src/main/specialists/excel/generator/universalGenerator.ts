/**
 * Universal Dynamic Excel Dataset Planner & Generator
 * Generates realistic schemas, data, formulas, and charts dynamically for ANY user instruction.
 */

export interface UniversalExcelPlan {
  fileName: string;
  mainSheetName: string;
  headers: string[];
  rows: (string | number)[][];
  summarySheetName: string;
  summaryHeaders: string[];
  summaryRows: (string | number)[][];
  categories: string[];
  categoryColumnLetter: string; // e.g. 'C'
  numericColumnLetter: string;  // e.g. 'F'
  chartTitle: string;
  chartType: string;
  domainName: string; // e.g. "Electronics Sales", "University Students", "Manufacturing Employees"
  tokensConsumed?: number;
}

function createPrng(seed: number) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2d79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST_NAMES = [
  'Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Sai', 'Reyansh', 'Ayaan',
  'Krishna', 'Ishaan', 'Shaurya', 'Atharv', 'Advik', 'Pranav', 'Advaith', 'Aaryan',
  'James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda',
  'David', 'Elizabeth', 'William', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica',
  'Thomas', 'Sarah', 'Charles', 'Karen', 'Christopher', 'Nancy', 'Daniel', 'Lisa'
];

const LAST_NAMES = [
  'Sharma', 'Verma', 'Patel', 'Singh', 'Kumar', 'Rao', 'Reddy', 'Gupta',
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
  'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas'
];

export class UniversalDatasetPlanner {
  public plan(instructions: string): UniversalExcelPlan {
    const lower = instructions.toLowerCase();
    const rand = createPrng(Date.now() % 100000 + 42);

    // 1. Extract row count if specified (e.g. "200 entrepreneur", "data of 200", "50 rows")
    const countMatch =
      instructions.match(/(?:data\s+of|make|create|generate|add|with)\s+(\d+)\b/i) ||
      instructions.match(/(\d+)\s*(?:rows?|employees?|records?|items?|entries?|products?|students?|transactions?|coins?|entrepreneurs?|startups?|companies|users?|people|leads?|clients?)/i) ||
      instructions.match(/\b(\d+)\s+[a-zA-Z]+/i);
    let rowCount = countMatch ? parseInt(countMatch[1], 10) : 0;
    if (!rowCount || rowCount <= 0) {
      if (lower.includes('large') || lower.includes('big')) rowCount = 500;
      else if (lower.includes('small') || lower.includes('few')) rowCount = 20;
      else rowCount = 60; // Clean default
    }
    rowCount = Math.min(Math.max(rowCount, 10), 2000); // Safe bounds

    // 2. Extract filename if specified
    let customFileName: string | null = null;
    const nameMatch = instructions.match(/save(?:\s+it)?\s+as\s+([a-zA-Z0-9_\-\s]+?)(?:\.xlsx)?$/i);
    if (nameMatch && nameMatch[1]) {
      customFileName = `${nameMatch[1].trim()}.xlsx`;
    }

    // 3. Detect Domain / Intent
    if (
      lower.includes('entrepreneur') ||
      lower.includes('startup') ||
      lower.includes('founder') ||
      (lower.includes('business') && !lower.includes('budget'))
    ) {
      return this.planEntrepreneurs(rowCount, customFileName, rand);
    }

    if (
      lower.includes('sale') ||
      lower.includes('revenue') ||
      lower.includes('store') ||
      lower.includes('order') ||
      lower.includes('ecommerce') ||
      lower.includes('retail')
    ) {
      return this.planSales(rowCount, customFileName, rand);
    }

    if (
      lower.includes('student') ||
      lower.includes('school') ||
      lower.includes('college') ||
      lower.includes('university') ||
      lower.includes('marks') ||
      lower.includes('grade') ||
      lower.includes('exam') ||
      lower.includes('class')
    ) {
      return this.planStudents(rowCount, customFileName, rand, lower);
    }

    if (
      lower.includes('crypto') ||
      lower.includes('bitcoin') ||
      lower.includes('token') ||
      lower.includes('blockchain') ||
      lower.includes('coin')
    ) {
      return this.planCrypto(rowCount, customFileName, rand);
    }

    if (
      lower.includes('budget') ||
      lower.includes('expense') ||
      lower.includes('spending') ||
      lower.includes('finance') ||
      lower.includes('cost')
    ) {
      return this.planBudget(rowCount, customFileName, rand);
    }

    if (
      lower.includes('inventory') ||
      lower.includes('warehouse') ||
      lower.includes('stock') ||
      lower.includes('supplier')
    ) {
      return this.planInventory(rowCount, customFileName, rand);
    }

    if (
      lower.includes('real estate') ||
      lower.includes('property') ||
      lower.includes('house') ||
      lower.includes('apartment') ||
      lower.includes('rent')
    ) {
      return this.planRealEstate(rowCount, customFileName, rand);
    }

    if (
      lower.includes('hospital') ||
      lower.includes('patient') ||
      lower.includes('clinic') ||
      lower.includes('medical') ||
      lower.includes('doctor')
    ) {
      return this.planHealthcare(rowCount, customFileName, rand);
    }

    if (
      lower.includes('employee') ||
      lower.includes('worker') ||
      lower.includes('staff') ||
      lower.includes('hr') ||
      lower.includes('salary') ||
      lower.includes('payroll') ||
      lower.includes('manufacturing')
    ) {
      return this.planEmployees(rowCount, customFileName, rand, lower);
    }

    // Generic Fallback tailored to whatever the user said
    return this.planGeneric(rowCount, customFileName, rand, instructions);
  }

  // --- Domain Implementations ---

  private planSales(rowCount: number, fileName: string | null, rand: () => number): UniversalExcelPlan {
    const categories = ['Electronics', 'Home & Kitchen', 'Apparel', 'Books & Media', 'Sports & Fitness', 'Beauty & Personal Care'];
    const regions = ['North', 'South', 'East', 'West', 'Central'];
    const headers = ['Order ID', 'Customer Name', 'Category', 'Region', 'Quantity', 'Unit Price ($)', 'Total Revenue ($)'];
    const rows: (string | number)[][] = [];

    for (let i = 1; i <= rowCount; i++) {
      const orderId = `ORD-${10000 + i}`;
      const name = `${FIRST_NAMES[i % FIRST_NAMES.length]} ${LAST_NAMES[(i * 3) % LAST_NAMES.length]}`;
      const category = categories[Math.floor(rand() * categories.length)];
      const region = regions[Math.floor(rand() * regions.length)];
      const qty = 1 + Math.floor(rand() * 15);
      const unitPrice = parseFloat((15 + rand() * 180).toFixed(2));
      const totalRev = parseFloat((qty * unitPrice).toFixed(2));
      rows.push([orderId, name, category, region, qty, unitPrice, totalRev]);
    }

    const summaryHeaders = ['Category', 'Order Count', 'Total Revenue ($)', 'Average Order ($)'];
    const summaryRows: (string | number)[][] = [];
    for (const cat of categories) {
      summaryRows.push([
        cat,
        `=COUNTIF(SalesData!C2:C${rowCount + 1}, "${cat}")`,
        `=SUMIF(SalesData!C2:C${rowCount + 1}, "${cat}", SalesData!G2:G${rowCount + 1})`,
        `=AVERAGEIF(SalesData!C2:C${rowCount + 1}, "${cat}", SalesData!G2:G${rowCount + 1})`
      ]);
    }

    return {
      fileName: fileName || 'sales_report.xlsx',
      mainSheetName: 'SalesData',
      headers,
      rows,
      summarySheetName: 'SalesSummary',
      summaryHeaders,
      summaryRows,
      categories,
      categoryColumnLetter: 'C',
      numericColumnLetter: 'G',
      chartTitle: 'Total Revenue by Category ($)',
      chartType: 'ColumnClustered',
      domainName: 'Retail & E-commerce Sales'
    };
  }

  private planStudents(rowCount: number, fileName: string | null, rand: () => number, lowerPrompt: string = ''): UniversalExcelPlan {
    const isExamMarks = lowerPrompt.includes('mark') || lowerPrompt.includes('exam') || lowerPrompt.includes('subject');

    if (isExamMarks) {
      const subjects = ['Mathematics', 'Physics', 'Chemistry', 'English', 'Computer Science', 'Biology'];
      const maxMark = lowerPrompt.includes('out of 80') || lowerPrompt.includes('80') ? 80 : 100;
      const headers = ['Roll Number', 'Student Name', ...subjects, `Total Marks (/${subjects.length * maxMark})`, 'Percentage (%)', 'Grade'];
      const rows: (string | number)[][] = [];

      for (let i = 1; i <= rowCount; i++) {
        // 7-digit roll number e.g. 2401001
        const rollNumber = 2400000 + i;
        const name = `${FIRST_NAMES[i % FIRST_NAMES.length]} ${LAST_NAMES[(i * 5) % LAST_NAMES.length]}`;
        const marks = subjects.map(() => Math.floor((maxMark * 0.45) + rand() * (maxMark * 0.53)));
        const total = marks.reduce((a, b) => a + b, 0);
        const pct = parseFloat(((total / (subjects.length * maxMark)) * 100).toFixed(1));
        const grade = pct >= 90 ? 'A+' : pct >= 80 ? 'A' : pct >= 70 ? 'B+' : pct >= 60 ? 'B' : pct >= 50 ? 'C' : 'D';
        rows.push([rollNumber, name, ...marks, total, pct, grade]);
      }

      const summaryHeaders = ['Subject', 'Class Average (/80)', 'Highest Mark', 'Lowest Mark'];
      const summaryRows: (string | number)[][] = [];
      const colLetters = ['C', 'D', 'E', 'F', 'G', 'H'];
      subjects.forEach((subj, idx) => {
        const col = colLetters[idx];
        summaryRows.push([
          subj,
          `=ROUND(AVERAGE(ExaminationMarks!${col}2:${col}${rowCount + 1}), 1)`,
          `=MAX(ExaminationMarks!${col}2:${col}${rowCount + 1})`,
          `=MIN(ExaminationMarks!${col}2:${col}${rowCount + 1})`
        ]);
      });

      return {
        fileName: fileName || 'student_examination_marks.xlsx',
        mainSheetName: 'ExaminationMarks',
        headers,
        rows,
        summarySheetName: 'SubjectPerformance',
        summaryHeaders,
        summaryRows,
        categories: subjects,
        categoryColumnLetter: 'A',
        numericColumnLetter: 'B',
        chartTitle: 'Class Average Marks by Subject (/80)',
        chartType: 'ColumnClustered',
        domainName: 'Student Examination Marks'
      };
    }

    const departments = ['Computer Science', 'Mechanical Engineering', 'Electrical Engineering', 'Business Administration', 'Data Science', 'Biotechnology'];
    const headers = ['Student ID', 'Student Name', 'Department', 'Attendance (%)', 'Assignments Score', 'Midterm Score', 'Final Grade (%)'];
    const rows: (string | number)[][] = [];

    for (let i = 1; i <= rowCount; i++) {
      const id = `STU-${1000 + i}`;
      const name = `${FIRST_NAMES[i % FIRST_NAMES.length]} ${LAST_NAMES[(i * 5) % LAST_NAMES.length]}`;
      const dept = departments[Math.floor(rand() * departments.length)];
      const attendance = Math.floor(70 + rand() * 30);
      const assign = Math.floor(65 + rand() * 35);
      const mid = Math.floor(60 + rand() * 40);
      const finalScore = parseFloat(((assign * 0.3) + (mid * 0.7)).toFixed(1));
      rows.push([id, name, dept, attendance, assign, mid, finalScore]);
    }

    const summaryHeaders = ['Department', 'Student Count', 'Avg Final Grade (%)', 'Avg Attendance (%)'];
    const summaryRows: (string | number)[][] = [];
    for (const d of departments) {
      summaryRows.push([
        d,
        `=COUNTIF(StudentRoster!C2:C${rowCount + 1}, "${d}")`,
        `=AVERAGEIF(StudentRoster!C2:C${rowCount + 1}, "${d}", StudentRoster!G2:G${rowCount + 1})`,
        `=AVERAGEIF(StudentRoster!C2:C${rowCount + 1}, "${d}", StudentRoster!D2:D${rowCount + 1})`
      ]);
    }

    return {
      fileName: fileName || 'student_academic_records.xlsx',
      mainSheetName: 'StudentRoster',
      headers,
      rows,
      summarySheetName: 'DepartmentAnalytics',
      summaryHeaders,
      summaryRows,
      categories: departments,
      categoryColumnLetter: 'C',
      numericColumnLetter: 'G',
      chartTitle: 'Average Final Grade by Department (%)',
      chartType: 'ColumnClustered',
      domainName: 'Student Academic Records'
    };
  }

  private planCrypto(rowCount: number, fileName: string | null, rand: () => number): UniversalExcelPlan {
    const categories = ['Layer 1', 'Layer 2', 'DeFi Protocols', 'AI & Big Data', 'Meme Coins', 'Infrastructure'];
    const coinNames = [
      ['Bitcoin', 'BTC', 'Layer 1', 65000],
      ['Ethereum', 'ETH', 'Layer 1', 3500],
      ['Solana', 'SOL', 'Layer 1', 180],
      ['Polygon', 'MATIC', 'Layer 2', 0.85],
      ['Arbitrum', 'ARB', 'Layer 2', 1.2],
      ['Uniswap', 'UNI', 'DeFi Protocols', 11.5],
      ['Aave', 'AAVE', 'DeFi Protocols', 145],
      ['Render', 'RNDR', 'AI & Big Data', 9.2],
      ['Fetch.ai', 'FET', 'AI & Big Data', 2.1],
      ['Chainlink', 'LINK', 'Infrastructure', 18],
      ['Filecoin', 'FIL', 'Infrastructure', 6.4],
      ['Dogecoin', 'DOGE', 'Meme Coins', 0.15],
      ['Shiba Inu', 'SHIB', 'Meme Coins', 0.000025]
    ];

    const headers = ['Rank', 'Asset Name', 'Ticker', 'Sector', 'Portfolio Holdings', 'Price ($)', 'Holding Value ($)'];
    const rows: (string | number)[][] = [];

    for (let i = 1; i <= rowCount; i++) {
      const template = coinNames[(i - 1) % coinNames.length];
      const rank = i;
      const name = i <= coinNames.length ? String(template[0]) : `${template[0]} #${Math.floor(i / coinNames.length) + 1}`;
      const ticker = String(template[1]);
      const sector = String(template[2]);
      const basePrice = Number(template[3]);
      const price = parseFloat((basePrice * (0.9 + rand() * 0.2)).toFixed(4));
      const holdings = parseFloat((10 + rand() * 500).toFixed(2));
      const value = parseFloat((holdings * price).toFixed(2));
      rows.push([rank, name, ticker, sector, holdings, price, value]);
    }

    const summaryHeaders = ['Sector', 'Assets Tracked', 'Total Sector Value ($)', 'Avg Asset Value ($)'];
    const summaryRows: (string | number)[][] = [];
    for (const sec of categories) {
      summaryRows.push([
        sec,
        `=COUNTIF(CryptoHoldings!D2:D${rowCount + 1}, "${sec}")`,
        `=SUMIF(CryptoHoldings!D2:D${rowCount + 1}, "${sec}", CryptoHoldings!G2:G${rowCount + 1})`,
        `=AVERAGEIF(CryptoHoldings!D2:D${rowCount + 1}, "${sec}", CryptoHoldings!G2:G${rowCount + 1})`
      ]);
    }

    return {
      fileName: fileName || 'crypto_portfolio_tracker.xlsx',
      mainSheetName: 'CryptoHoldings',
      headers,
      rows,
      summarySheetName: 'SectorAllocation',
      summaryHeaders,
      summaryRows,
      categories,
      categoryColumnLetter: 'D',
      numericColumnLetter: 'G',
      chartTitle: 'Total Sector Value ($)',
      chartType: 'ColumnClustered',
      domainName: 'Crypto & Digital Assets Portfolio'
    };
  }

  private planBudget(rowCount: number, fileName: string | null, rand: () => number): UniversalExcelPlan {
    const categories = ['Housing & Rent', 'Groceries & Dining', 'Transportation', 'Utilities & Internet', 'Healthcare', 'Entertainment', 'Savings & Investments'];
    const headers = ['Transaction ID', 'Description', 'Category', 'Budgeted Amount ($)', 'Actual Spent ($)', 'Variance ($)'];
    const rows: (string | number)[][] = [];

    for (let i = 1; i <= rowCount; i++) {
      const id = `EXP-${2000 + i}`;
      const cat = categories[Math.floor(rand() * categories.length)];
      const budget = parseFloat((50 + rand() * 450).toFixed(2));
      const actual = parseFloat((budget * (0.8 + rand() * 0.4)).toFixed(2));
      const variance = parseFloat((budget - actual).toFixed(2));
      rows.push([id, `Expense #${i} (${cat})`, cat, budget, actual, variance]);
    }

    const summaryHeaders = ['Category', 'Item Count', 'Total Budget ($)', 'Total Actual ($)'];
    const summaryRows: (string | number)[][] = [];
    for (const c of categories) {
      summaryRows.push([
        c,
        `=COUNTIF(ExpenseTracker!C2:C${rowCount + 1}, "${c}")`,
        `=SUMIF(ExpenseTracker!C2:C${rowCount + 1}, "${c}", ExpenseTracker!D2:D${rowCount + 1})`,
        `=SUMIF(ExpenseTracker!C2:C${rowCount + 1}, "${c}", ExpenseTracker!E2:E${rowCount + 1})`
      ]);
    }

    return {
      fileName: fileName || 'personal_budget_tracker.xlsx',
      mainSheetName: 'ExpenseTracker',
      headers,
      rows,
      summarySheetName: 'BudgetOverview',
      summaryHeaders,
      summaryRows,
      categories,
      categoryColumnLetter: 'C',
      numericColumnLetter: 'E',
      chartTitle: 'Total Actual Expenditure by Category ($)',
      chartType: 'ColumnClustered',
      domainName: 'Monthly Budget & Expenses'
    };
  }

  private planInventory(rowCount: number, fileName: string | null, rand: () => number): UniversalExcelPlan {
    const categories = ['Hardware', 'Power Tools', 'Safety Equipment', 'Electrical Supplies', 'Plumbing', 'Fasteners & Adhesives'];
    const headers = ['SKU', 'Item Name', 'Category', 'Units in Stock', 'Reorder Threshold', 'Unit Cost ($)', 'Inventory Value ($)'];
    const rows: (string | number)[][] = [];

    for (let i = 1; i <= rowCount; i++) {
      const sku = `SKU-${5000 + i}`;
      const cat = categories[Math.floor(rand() * categories.length)];
      const stock = Math.floor(10 + rand() * 250);
      const reorder = Math.floor(15 + rand() * 30);
      const cost = parseFloat((5 + rand() * 95).toFixed(2));
      const val = parseFloat((stock * cost).toFixed(2));
      rows.push([sku, `${cat} Item #${i}`, cat, stock, reorder, cost, val]);
    }

    const summaryHeaders = ['Category', 'SKU Count', 'Total Units in Stock', 'Total Stock Value ($)'];
    const summaryRows: (string | number)[][] = [];
    for (const c of categories) {
      summaryRows.push([
        c,
        `=COUNTIF(InventoryStock!C2:C${rowCount + 1}, "${c}")`,
        `=SUMIF(InventoryStock!C2:C${rowCount + 1}, "${c}", InventoryStock!D2:D${rowCount + 1})`,
        `=SUMIF(InventoryStock!C2:C${rowCount + 1}, "${c}", InventoryStock!G2:G${rowCount + 1})`
      ]);
    }

    return {
      fileName: fileName || 'warehouse_inventory.xlsx',
      mainSheetName: 'InventoryStock',
      headers,
      rows,
      summarySheetName: 'InventorySummary',
      summaryHeaders,
      summaryRows,
      categories,
      categoryColumnLetter: 'C',
      numericColumnLetter: 'G',
      chartTitle: 'Total Stock Value by Category ($)',
      chartType: 'ColumnClustered',
      domainName: 'Warehouse & Stock Inventory'
    };
  }

  private planRealEstate(rowCount: number, fileName: string | null, rand: () => number): UniversalExcelPlan {
    const categories = ['Luxury Condo', 'Single Family Home', 'Townhouse', 'Duplex', 'Studio Apartment', 'Commercial Office'];
    const headers = ['Property ID', 'Title', 'Property Type', 'Bedrooms', 'Area (SqFt)', 'Price ($)', 'Price per SqFt ($)'];
    const rows: (string | number)[][] = [];

    for (let i = 1; i <= rowCount; i++) {
      const id = `PROP-${3000 + i}`;
      const type = categories[Math.floor(rand() * categories.length)];
      const beds = 1 + Math.floor(rand() * 5);
      const sqft = Math.floor(650 + rand() * 2800);
      const price = Math.floor(180000 + rand() * 950000);
      const pricePerSqft = parseFloat((price / sqft).toFixed(2));
      rows.push([id, `${type} #${i}`, type, beds, sqft, price, pricePerSqft]);
    }

    const summaryHeaders = ['Property Type', 'Listings Count', 'Avg Price ($)', 'Avg Area (SqFt)'];
    const summaryRows: (string | number)[][] = [];
    for (const c of categories) {
      summaryRows.push([
        c,
        `=COUNTIF(PropertyMaster!C2:C${rowCount + 1}, "${c}")`,
        `=AVERAGEIF(PropertyMaster!C2:C${rowCount + 1}, "${c}", PropertyMaster!F2:F${rowCount + 1})`,
        `=AVERAGEIF(PropertyMaster!C2:C${rowCount + 1}, "${c}", PropertyMaster!E2:E${rowCount + 1})`
      ]);
    }

    return {
      fileName: fileName || 'real_estate_listings.xlsx',
      mainSheetName: 'PropertyMaster',
      headers,
      rows,
      summarySheetName: 'MarketAnalytics',
      summaryHeaders,
      summaryRows,
      categories,
      categoryColumnLetter: 'C',
      numericColumnLetter: 'F',
      chartTitle: 'Average Property Price by Type ($)',
      chartType: 'ColumnClustered',
      domainName: 'Real Estate & Properties'
    };
  }

  private planHealthcare(rowCount: number, fileName: string | null, rand: () => number): UniversalExcelPlan {
    const departments = ['Cardiology', 'Orthopedics', 'Pediatrics', 'Neurology', 'General Surgery', 'Dermatology'];
    const headers = ['Patient ID', 'Patient Name', 'Department', 'Age', 'Doctor Assigned', 'Treatment Cost ($)', 'Days Admitted'];
    const rows: (string | number)[][] = [];

    for (let i = 1; i <= rowCount; i++) {
      const id = `PAT-${8000 + i}`;
      const name = `${FIRST_NAMES[i % FIRST_NAMES.length]} ${LAST_NAMES[(i * 2) % LAST_NAMES.length]}`;
      const dept = departments[Math.floor(rand() * departments.length)];
      const age = Math.floor(18 + rand() * 70);
      const doctor = `Dr. ${LAST_NAMES[(i * 4) % LAST_NAMES.length]}`;
      const cost = Math.floor(500 + rand() * 8500);
      const days = 1 + Math.floor(rand() * 12);
      rows.push([id, name, dept, age, doctor, cost, days]);
    }

    const summaryHeaders = ['Department', 'Patient Count', 'Total Treatment Cost ($)', 'Avg Length of Stay (Days)'];
    const summaryRows: (string | number)[][] = [];
    for (const d of departments) {
      summaryRows.push([
        d,
        `=COUNTIF(PatientRecords!C2:C${rowCount + 1}, "${d}")`,
        `=SUMIF(PatientRecords!C2:C${rowCount + 1}, "${d}", PatientRecords!F2:F${rowCount + 1})`,
        `=AVERAGEIF(PatientRecords!C2:C${rowCount + 1}, "${d}", PatientRecords!G2:G${rowCount + 1})`
      ]);
    }

    return {
      fileName: fileName || 'hospital_patient_records.xlsx',
      mainSheetName: 'PatientRecords',
      headers,
      rows,
      summarySheetName: 'DepartmentStatistics',
      summaryHeaders,
      summaryRows,
      categories: departments,
      categoryColumnLetter: 'C',
      numericColumnLetter: 'F',
      chartTitle: 'Total Treatment Cost by Department ($)',
      chartType: 'ColumnClustered',
      domainName: 'Hospital & Healthcare Records'
    };
  }

  private planEmployees(rowCount: number, fileName: string | null, rand: () => number, lowerPrompt: string): UniversalExcelPlan {
    // If user specified manufacturing, technology, finance, etc.
    let departments = ['Assembly', 'Quality Control', 'Welding & Joining', 'Machining & Fabrication', 'Maintenance & Utilities', 'Logistics & Warehousing', 'Safety & Compliance', 'Packaging & Dispatch'];
    let domainName = 'Manufacturing Plant Employees';
    let defaultFileName = 'employee_records.xlsx';

    if (lowerPrompt.includes('tech') || lowerPrompt.includes('software') || lowerPrompt.includes('it')) {
      departments = ['Frontend Engineering', 'Backend Engineering', 'DevOps & Cloud', 'Product Management', 'UI/UX Design', 'QA Automation', 'Data Engineering'];
      domainName = 'Tech Software Employees';
      defaultFileName = 'tech_team_payroll.xlsx';
    } else if (lowerPrompt.includes('hospital') || lowerPrompt.includes('nurse')) {
      departments = ['Intensive Care', 'Emergency Room', 'Outpatient Care', 'Laboratory', 'Radiology', 'Pharmacy'];
      domainName = 'Healthcare Staff';
      defaultFileName = 'hospital_staff_roster.xlsx';
    } else if (lowerPrompt.includes('hotel') || lowerPrompt.includes('restaurant')) {
      departments = ['Front Desk', 'Housekeeping', 'Culinary Kitchen', 'Food & Beverage', 'Guest Relations', 'Concierge'];
      domainName = 'Hospitality Staff';
      defaultFileName = 'hotel_staff_records.xlsx';
    }

    const shifts = ['Day Shift', 'Evening Shift', 'Night Shift'];
    const headers = ['Employee ID', 'Full Name', 'Department', 'Shift', 'Experience (Years)', 'Hourly Rate ($)', 'Monthly Salary ($)'];
    const rows: (string | number)[][] = [];

    for (let i = 1; i <= rowCount; i++) {
      const id = `EMP-${String(i).padStart(4, '0')}`;
      const name = `${FIRST_NAMES[i % FIRST_NAMES.length]} ${LAST_NAMES[(i * 7) % LAST_NAMES.length]}`;
      const dept = departments[Math.floor(rand() * departments.length)];
      const shift = shifts[Math.floor(rand() * shifts.length)];
      const exp = Math.floor(1 + rand() * 22);
      const rate = parseFloat((22 + rand() * 38).toFixed(2));
      const salary = parseFloat((rate * 176).toFixed(2));
      rows.push([id, name, dept, shift, exp, rate, salary]);
    }

    const summaryHeaders = ['Department', 'Headcount', 'Avg Hourly Rate ($)', 'Total Monthly Payroll ($)'];
    const summaryRows: (string | number)[][] = [];
    for (const d of departments) {
      summaryRows.push([
        d,
        `=COUNTIF(EmployeeData!C2:C${rowCount + 1}, "${d}")`,
        `=AVERAGEIF(EmployeeData!C2:C${rowCount + 1}, "${d}", EmployeeData!F2:F${rowCount + 1})`,
        `=SUMIF(EmployeeData!C2:C${rowCount + 1}, "${d}", EmployeeData!G2:G${rowCount + 1})`
      ]);
    }

    return {
      fileName: fileName || defaultFileName,
      mainSheetName: 'EmployeeData',
      headers,
      rows,
      summarySheetName: 'DepartmentSummary',
      summaryHeaders,
      summaryRows,
      categories: departments,
      categoryColumnLetter: 'C',
      numericColumnLetter: 'G',
      chartTitle: 'Headcount by Department',
      chartType: 'ColumnClustered',
      domainName
    };
  }

  private planEntrepreneurs(rowCount: number, fileName: string | null, rand: () => number): UniversalExcelPlan {
    const domains = [
      'Artificial Intelligence', 'FinTech & Payments', 'CleanTech & Energy', 'E-Commerce & Retail',
      'HealthTech & Biotech', 'EdTech & Learning', 'CyberSecurity', 'SaaS & Cloud Software',
      'Logistics & Supply Chain', 'Robotics & Automation'
    ];
    const cities = [
      'San Francisco, CA', 'New York, NY', 'Austin, TX', 'Seattle, WA', 'London, UK',
      'Bengaluru, India', 'Singapore', 'Berlin, Germany', 'Toronto, Canada', 'Boston, MA'
    ];
    const companyPrefixes = ['Apex', 'Nova', 'Cyber', 'Quantum', 'Cloud', 'Zenith', 'Omni', 'Hyper', 'Pulse', 'Vector', 'Alpha', 'Synapse'];
    const companySuffixes = ['Technologies', 'Labs', 'Solutions', 'Ventures', 'Systems', 'AI', 'Networks', 'Dynamics', 'Scale', 'Hub'];

    const headers = ['Entrepreneur ID', 'Founder Name', 'Business Name', 'Industry Domain', 'Contact Number', 'Email Address', 'Location', 'Annual Revenue ($)'];
    const rows: (string | number)[][] = [];

    for (let i = 1; i <= rowCount; i++) {
      const id = `ENT-${String(i).padStart(4, '0')}`;
      const fName = FIRST_NAMES[i % FIRST_NAMES.length];
      const lName = LAST_NAMES[(i * 3) % LAST_NAMES.length];
      const fullName = `${fName} ${lName}`;
      const domain = domains[Math.floor(rand() * domains.length)];
      const prefix = companyPrefixes[Math.floor(rand() * companyPrefixes.length)];
      const suffix = companySuffixes[Math.floor(rand() * companySuffixes.length)];
      const businessName = `${prefix} ${suffix}`;
      const contactNum = `+1-555-${String(1000 + ((i * 37) % 9000)).padStart(4, '0')}`;
      const email = `${fName.toLowerCase()}.${lName.toLowerCase()}@${prefix.toLowerCase()}${suffix.toLowerCase()}.com`;
      const location = cities[Math.floor(rand() * cities.length)];
      const revenue = parseFloat((250000 + rand() * 4750000).toFixed(2));

      rows.push([id, fullName, businessName, domain, contactNum, email, location, revenue]);
    }

    const summaryHeaders = ['Industry Domain', 'Founder Count', 'Total Revenue ($)', 'Average Revenue ($)'];
    const summaryRows: (string | number)[][] = [];
    for (const d of domains) {
      summaryRows.push([
        d,
        `=COUNTIF(EntrepreneurDirectory!D2:D${rowCount + 1}, "${d}")`,
        `=SUMIF(EntrepreneurDirectory!D2:D${rowCount + 1}, "${d}", EntrepreneurDirectory!H2:H${rowCount + 1})`,
        `=AVERAGEIF(EntrepreneurDirectory!D2:D${rowCount + 1}, "${d}", EntrepreneurDirectory!H2:H${rowCount + 1})`
      ]);
    }

    return {
      fileName: fileName || 'entrepreneur_directory.xlsx',
      mainSheetName: 'EntrepreneurDirectory',
      headers,
      rows,
      summarySheetName: 'DomainSummary',
      summaryHeaders,
      summaryRows,
      categories: domains,
      categoryColumnLetter: 'D',
      numericColumnLetter: 'H',
      chartTitle: 'Entrepreneurs by Industry Domain',
      chartType: 'ColumnClustered',
      domainName: 'Entrepreneur & Business Directory'
    };
  }

  private planGeneric(rowCount: number, fileName: string | null, rand: () => number, instructions: string): UniversalExcelPlan {
    const categories = ['Category Alpha', 'Category Beta', 'Category Gamma', 'Category Delta', 'Category Epsilon'];
    const headers = ['Record ID', 'Item Name', 'Category', 'Quantity', 'Score / Rating', 'Unit Value ($)', 'Total Value ($)'];
    const rows: (string | number)[][] = [];

    for (let i = 1; i <= rowCount; i++) {
      const id = `REC-${String(i).padStart(4, '0')}`;
      const cat = categories[Math.floor(rand() * categories.length)];
      const qty = 1 + Math.floor(rand() * 25);
      const score = parseFloat((3 + rand() * 2).toFixed(1));
      const unitVal = parseFloat((10 + rand() * 150).toFixed(2));
      const totalVal = parseFloat((qty * unitVal).toFixed(2));
      rows.push([id, `Entry #${i}`, cat, qty, score, unitVal, totalVal]);
    }

    const summaryHeaders = ['Category', 'Record Count', 'Total Value ($)', 'Avg Unit Value ($)'];
    const summaryRows: (string | number)[][] = [];
    for (const c of categories) {
      summaryRows.push([
        c,
        `=COUNTIF(DataSheet!C2:C${rowCount + 1}, "${c}")`,
        `=SUMIF(DataSheet!C2:C${rowCount + 1}, "${c}", DataSheet!G2:G${rowCount + 1})`,
        `=AVERAGEIF(DataSheet!C2:C${rowCount + 1}, "${c}", DataSheet!F2:F${rowCount + 1})`
      ]);
    }

    return {
      fileName: fileName || 'custom_dataset.xlsx',
      mainSheetName: 'DataSheet',
      headers,
      rows,
      summarySheetName: 'SummaryMetrics',
      summaryHeaders,
      summaryRows,
      categories,
      categoryColumnLetter: 'C',
      numericColumnLetter: 'G',
      chartTitle: 'Total Value by Category ($)',
      chartType: 'ColumnClustered',
      domainName: instructions.trim().slice(0, 40) || 'Custom Structured Dataset'
    };
  }
}

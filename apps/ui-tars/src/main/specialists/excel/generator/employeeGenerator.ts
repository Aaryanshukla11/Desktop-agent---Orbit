/**
 * Generator for realistic employee datasets (e.g. manufacturing plant employees)
 */

export interface EmployeeRecord {
  employeeId: string;
  name: string;
  domain: string;
  shift: string;
  experienceYears: number;
  hourlyRate: number;
  monthlySalary: number;
}

export interface EmployeeDataset {
  headers: string[];
  rows: (string | number)[][];
  domains: string[];
  totalEmployees: number;
}

const FIRST_NAMES = [
  'Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Sai', 'Reyansh', 'Ayaan',
  'Krishna', 'Ishaan', 'Shaurya', 'Atharv', 'Advik', 'Pranav', 'Advaith', 'Aaryan',
  'Dhruv', 'Kabir', 'Rudra', 'Ananya', 'Diya', 'Isha', 'Aadhya', 'Saanvi',
  'Aanya', 'Pari', 'Anika', 'Navya', 'Myra', 'Riya', 'Avani', 'Sneha',
  'Vikram', 'Rajesh', 'Suresh', 'Amit', 'Sunil', 'Pooja', 'Priya', 'Kavita',
];

const LAST_NAMES = [
  'Sharma', 'Verma', 'Patel', 'Singh', 'Kumar', 'Rao', 'Reddy', 'Gupta',
  'Mishra', 'Joshi', 'Mehta', 'Nair', 'Deshmukh', 'Yadav', 'Choudhury', 'Pandey',
  'Bose', 'Chatterjee', 'Mukherjee', 'Thakur', 'Gowda', 'Pillai', 'Iyer', 'Menon',
];

export const MANUFACTURING_DOMAINS = [
  'Assembly',
  'Quality Control',
  'Welding & Joining',
  'Machining & Fabrication',
  'Maintenance & Utilities',
  'Logistics & Warehousing',
  'Safety & Compliance',
  'Packaging & Dispatch',
];

const SHIFTS = ['Day Shift', 'Evening Shift', 'Night Shift'];

export class EmployeeDatasetGenerator {
  private prngState: number;

  constructor(seed = 42) {
    this.prngState = seed >>> 0;
  }

  private nextRandom(): number {
    this.prngState = (this.prngState + 0x6d2b79f5) | 0;
    let t = Math.imul(this.prngState ^ (this.prngState >>> 15), 1 | this.prngState);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  private pickRandom<T>(arr: T[]): T {
    const idx = Math.floor(this.nextRandom() * arr.length);
    return arr[idx];
  }

  private randomInt(min: number, max: number): number {
    return Math.floor(this.nextRandom() * (max - min + 1)) + min;
  }

  public generate(count = 800, seed = 42): EmployeeDataset {
    this.prngState = seed >>> 0;
    const headers = [
      'Employee ID',
      'Full Name',
      'Domain',
      'Shift',
      'Experience (Years)',
      'Hourly Rate ($)',
      'Monthly Salary ($)',
    ];

    const rows: (string | number)[][] = [];

    for (let i = 0; i < count; i++) {
      const empId = `EMP-${1000 + i + 1}`;
      const name = `${this.pickRandom(FIRST_NAMES)} ${this.pickRandom(LAST_NAMES)}`;
      const domain = this.pickRandom(MANUFACTURING_DOMAINS);
      const shift = this.pickRandom(SHIFTS);
      const expYears = this.randomInt(1, 24);
      const hourlyRate = this.randomInt(18, 55);
      const monthlySalary = Math.round(hourlyRate * 160 + expYears * 120);

      rows.push([
        empId,
        name,
        domain,
        shift,
        expYears,
        hourlyRate,
        monthlySalary,
      ]);
    }

    return {
      headers,
      rows,
      domains: [...MANUFACTURING_DOMAINS],
      totalEmployees: count,
    };
  }
}

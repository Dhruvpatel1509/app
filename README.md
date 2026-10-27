# 💸 Cashual — Intelligent Expense Sharing & AI Receipt Scanning

**Cashual** is a modern, responsive web application for splitting expenses with friends, managing shared group balances, scanning receipts with AI, and tracking personal monthly spending.

Built with Next.js 16, TypeScript, Tailwind CSS, Supabase (PostgreSQL with Row Level Security), and Recharts.

---

## ✨ Features & Highlights

### 1. 🤖 AI Receipt Scanner & Itemized Splitting
- **Photo Upload & Camera Capture**: Drag and drop receipts or snap photos from mobile and desktop.
- **AI OCR Processing**: Automatically extracts merchant name, date, itemized line items, subtotal, tax, and tip.
- **Item-Level Assignment**: Assign specific dishes, groceries, or items directly to the people who shared them.
- **Proportional Tax & Tip**: Taxes and tips are distributed proportionally to each person's consumed items (or split equally).
- **Penny-Exact Reconciliation**: Live validator confirms that sum of all member shares matches the receipt total to the exact cent.

### 2. ⚖️ 5 Flexible Split Methods
- **Equal Split (=)**: Divides total evenly across participants with integer largest-remainder penny distribution.
- **Exact Amounts ($)**: Assign custom exact amounts with live remaining balance calculation.
- **Percentages (%)**: Specify custom percentage shares with validation ensuring 100% total.
- **Shares (Ratios)**: Weighted distribution by shares (e.g. 2 shares : 1 share).
- **Adjustments (+/-)**: Base equal split with custom plus/minus adjustments.

### 3. 🌐 Groups & Friends Management
- **Group Spaces**: Create custom groups (Apartment, Road Trip, Dinner Club) with individual currency configurations.
- **Friendships**: Search and add friends by `@username`, manage incoming/outgoing requests.
- **Group Detail Feed**: Chronological list of shared expenses, member balances, settle up shortcuts, and invite links.

### 4. 🔀 Debt Simplification & Settle Up
- **Debt Graph Optimization**: Uses a bipartite greedy reduction algorithm to minimize the total number of transactions needed to settle all debts in a group.
- **1-Click Settlement**: Record payments made in cash, Venmo, Zelle, or PayPal, automatically updating net balances without altering historical expense records.

### 5. 📊 Personal Budgets & Analytics
- **True Personal Spending**: Only your allocated share of group expenses counts toward your personal spending budget.
- **Category Progress Bars**: Real-time spending progress by category (Dining, Groceries, Transport, Entertainment, etc.) with automatic color indicators (Green / Amber / Red).
- **Interactive Visualizations**: Monthly spending area charts and category breakdown pie charts built with Recharts.

---

## 🛠️ Tech Stack

- **Framework**: Next.js 16 (App Router, Turbopack)
- **Language**: TypeScript (Strict Mode)
- **Styling**: Tailwind CSS, Lucide Icons, Glassmorphic Emerald Dark/Light theme
- **Database & Auth**: Supabase PostgreSQL with Row Level Security (RLS)
- **OCR Engine**: Veryfi API integration with simulated testing fallback
- **Charts**: Recharts
- **Forms & Validation**: React Hook Form, Zod
- **Testing**: Vitest with 100% passing financial test suite

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js 18+ installed
- A free [Supabase](https://supabase.com) account

### 2. Installation
```bash
cd app
npm install
```

### 3. Environment Variables
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```
Fill in your Supabase project credentials:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Veryfi OCR (required for real receipt scans; demo mode works without this)
VERYFI_CLIENT_ID=your-client-id
VERYFI_USERNAME=your-username
VERYFI_API_KEY=your-api-key
VERYFI_CLIENT_SECRET=your-client-secret
```

### 4. Database Setup
Execute the migration scripts in your Supabase SQL Editor in order:
1. `supabase/migrations/001_initial_schema.sql` (Tables, constraints, minor-unit money rules)
2. `supabase/migrations/002_rls_policies.sql` (Row Level Security policies)
3. `supabase/migrations/003_functions_and_triggers.sql` (Auto-profile creation on signup, timestamps)
4. `supabase/migrations/004_receipts_storage.sql` (Receipts storage bucket + EUR currency)

### 5. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Running Tests & Build

```bash
# Run Vitest financial unit tests
npm test

# Run Next.js production build
npm run build
```

---

## 🛡️ Financial Integrity Principles
- **Minor Units Storage**: All money values (`total_minor`, `tax_minor`, `owed_amount_minor`, etc.) are stored as integers (cents) in PostgreSQL to prevent floating-point rounding errors.
- **Largest-Remainder Algorithm**: When division leaves remainder pennies, they are allocated in order of highest fractional remainder. Sum of splits always equals total expense.
- **Settlement Immutability**: Settlements create separate payment records and never mutate or overwrite original expense splits.

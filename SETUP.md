# Sales Tracker Setup Guide

## Overview
Multi-store sales tracking system with real-time financial reporting, built entirely on Supabase.

## Features
- Role-based access control (Employee, Moderator, Admin)
- Real-time order tracking per store
- Automatic profit calculations
- Daily sales sheet generation with 6 PM - 6 PM daily cycle
- Export sales sheets as PNG or PDF
- Multi-store analytics dashboard

## Architecture
- **Frontend**: Next.js 13 with TypeScript
- **Backend**: Supabase PostgreSQL + Auth + Row Level Security
- **Database**: 7 tables with indexes and RLS policies
- **Styling**: TailwindCSS + shadcn/ui components

## Database Tables
1. **stores** - 3 store locations
2. **profiles** - User roles linked to auth.users
3. **products** - Product catalog with editable buying prices
4. **orders** - Individual sales transactions
5. **sales_sheets** - Daily summaries per store
6. **sales_sheet_items** - Per-product breakdown
7. **expenses** - Daily operational costs

## User Roles & Permissions

### Employee
- Add customer orders
- View order list for their store
- See daily sales metrics
- Cannot modify prices or access admin features

### Moderator
- View all orders for their store
- Generate daily sales sheets (6 PM - 6 PM)
- Input dollar costs for the day
- View sales sheet history
- Export sheets as PNG/PDF
- Cannot modify products or manage users

### Admin
- Full system access
- Manage products and prices
- View analytics across all stores
- User management via Supabase Auth
- Expenses tracking
- All moderator and employee features

## Setting Up Demo Data

### 1. Create Test Users
Use Supabase Auth to create test users:
- **Employee**: employee@test.com (password: Test123!)
- **Moderator**: moderator@test.com (password: Test123!)
- **Admin**: admin@test.com (password: Test123!)

### 2. Assign Roles
In Supabase, insert profiles for each user:

```sql
-- For employee@test.com (get the actual UUID)
INSERT INTO profiles (id, name, role, store_id)
VALUES ('USER_UUID', 'Test Employee', 'employee', 'STORE_A_UUID');

-- For moderator@test.com
INSERT INTO profiles (id, name, role, store_id)
VALUES ('USER_UUID', 'Test Moderator', 'moderator', 'STORE_A_UUID');

-- For admin@test.com
INSERT INTO profiles (id, name, role, store_id)
VALUES ('USER_UUID', 'Admin User', 'admin', NULL);
```

### 3. Add Sample Products
Access `/admin/products` and add products with buying prices:
- Product A - 500 BDT
- Product B - 800 BDT
- Product C - 1200 BDT

### 4. Add Sample Orders
As an employee, use `/employee/add-order` to add sample orders

### 5. Generate Sales Sheets
As a moderator, go to `/moderator/generate-sales-sheet` to create daily summaries

## Database Queries Optimized for Vercel Free Plan

All queries are optimized to minimize request overhead:

1. **Compound Indexes**
   - orders(store_id, order_date) - Fast daily filtering
   - sales_sheets(store_id, date) - Unique daily sheets
   - expenses(store_id, date) - Quick expense lookups

2. **Query Patterns**
   - Single select queries with specific columns
   - Batch calculations on client-side
   - Pagination (10-100 items per request)
   - Caching through React state

3. **Request Optimization**
   - Column selection (not SELECT *)
   - maybeSingle() instead of single() for optional rows
   - No N+1 queries - products fetched once, reused
   - Aggregations done client-side

## Currency
All monetary values in **BDT (Bangladeshi Taka)**

## Daily Sales Cycle
The system operates on a **6 PM - 6 PM daily cycle**:
- Select a date on the sales sheet generation page
- All orders from yesterday 6 PM to selected day 6 PM are included
- Dollar cost input reduces gross profit to calculate net profit

## Row Level Security
All tables have RLS enabled:
- Employees can only access their store's orders
- Moderators can only access their store's data
- Admins have full access
- No direct table access without proper policies

## Deployment
The application is optimized for:
- **Vercel** - Free tier with Next.js
- **Supabase** - Free tier sufficient for ~30 orders/day
- **DNS & CDN** - Global Vercel edge network

## Environment Variables
Required in `.env`:
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

## Performance Notes
- All authentication handled client-side via Supabase Auth
- RLS enforced at database level
- Minimal API calls using smart query batching
- Precomputed values where possible
- Export uses html2canvas + jsPDF client-side rendering

## Troubleshooting

### Unauthorized errors
- Check user profile exists in profiles table
- Verify role is set correctly
- Ensure store_id is assigned for non-admin roles

### No data showing
- Check RLS policies are enabled
- Verify user has permission for their store
- Check order_date format (YYYY-MM-DD)

### Export not working
- Ensure exports are done on client-side
- Check browser allows canvas rendering
- Verify sales sheet has items before exporting

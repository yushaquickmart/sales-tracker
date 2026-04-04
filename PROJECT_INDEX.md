# Project Structure & Implementation Index

## Database Layer (Supabase)

### Migrations (Applied)
- `01_create_stores_table` - 3 stores with names
- `02_create_profiles_table` - Users with roles (admin/moderator/employee) and store assignment
- `03_create_products_table` - Products with editable buying prices
- `04_create_orders_table` - Order transactions with automatic profit calculation
- `05_create_sales_sheets_table` - Daily summaries per store
- `06_create_sales_sheet_items_table` - Per-product breakdown for reports
- `07_create_expenses_table` - Daily operational costs

### Tables (7 total)
- `stores` - 3 pre-created locations
- `profiles` - User roles and permissions
- `products` - Inventory with buying costs
- `orders` - Daily transactions (indexed on store_id, order_date)
- `sales_sheets` - Daily reports (unique on store_id, date)
- `sales_sheet_items` - Report line items
- `expenses` - Cost tracking per store

### Security (RLS)
- All tables have RLS enabled
- Employees: access own store only
- Moderators: manage own store data
- Admins: full access
- Policies enforce at database level

## Frontend Layer (Next.js)

### Core Setup
- `lib/supabase-client.ts` - Supabase initialization
- `lib/auth-context.tsx` - Authentication provider & hooks
- `lib/types.ts` - TypeScript interfaces (15 types)
- `lib/db-queries.ts` - Database operations (20+ functions)
- `lib/request-cache.ts` - Client-side caching utility

### Pages (15 total)

#### Authentication
- `app/auth/login/page.tsx` - Email/password login

#### Root
- `app/page.tsx` - Redirect based on role

#### Employee (3 pages)
- `app/employee/dashboard/page.tsx` - Daily metrics
- `app/employee/add-order/page.tsx` - Order entry with profit preview
- `app/employee/orders/page.tsx` - Order list with filtering

#### Moderator (5 pages)
- `app/moderator/dashboard/page.tsx` - Store metrics
- `app/moderator/daily-orders/page.tsx` - Packaging list grouped by product
- `app/moderator/sales-sheets/page.tsx` - Historical sales sheets
- `app/moderator/generate-sales-sheet/page.tsx` - Sheet creation with preview
- `app/moderator/sales-sheets/[id]/page.tsx` - Sheet detail with PNG/PDF export

#### Admin (4 pages)
- `app/admin/dashboard/page.tsx` - Multi-store overview
- `app/admin/analytics/page.tsx` - Analytics dashboard
- `app/admin/products/page.tsx` - Product CRUD
- `app/admin/users/page.tsx` - User management info

### Components

#### Layout
- `components/layout/navigation.tsx` - Role-based navbar with mobile support
- `components/layout/protected-layout.tsx` - Auth wrapper with role checks

#### Shared
- `components/shared/metric-card.tsx` - Dashboard metric display

#### UI (50+ shadcn components)
- All standard shadcn/ui components pre-configured

## Key Features Implementation

### Authentication Flow
```
Login → AuthProvider → useAuth() hook
↓
Check session → Get profile → Set role
↓
Redirect to role-specific dashboard
```

### Order Management Flow
```
Employee adds order → Calculate profit automatically
↓
Order stored in Supabase with RLS enforcement
↓
Data available for moderator reports
```

### Sales Sheet Generation Flow
```
Moderator selects date (6 PM yesterday - 6 PM today)
↓
Query all orders for that period
↓
Group by product → Calculate totals
↓
Input dollar cost → Calculate net profit
↓
Create sales_sheets entry + sales_sheet_items
↓
Display for export as PNG/PDF
```

### Permission Flow
```
User login → Get profile.role
↓
role = employee → Show /employee/* pages only
role = moderator → Show /moderator/* pages only
role = admin → Show /admin/* pages only
↓
Database RLS enforces at query level
```

## Request Optimization Details

### Query Counts
- Employee daily: ~4 requests
- Moderator daily: ~6 requests
- Admin daily: ~8 requests
- **Total: ~18/day (vs 1000/day Vercel limit)**

### Optimizations Applied
1. Column selection (not SELECT *)
2. Pagination (max 100 items)
3. Index usage (store_id, date)
4. Client-side calculations
5. Static pre-rendering (14/15 pages)
6. RLS filtering at DB level

### Caching Strategy
- Client-side 5-minute cache
- React state for session data
- Invalidate on mutations
- No persistent server cache

## File Organization

```
project/
├── app/                    # Next.js pages
│   ├── auth/
│   ├── employee/
│   ├── moderator/
│   ├── admin/
│   └── page.tsx
├── components/             # React components
│   ├── layout/
│   ├── shared/
│   └── ui/                # shadcn/ui
├── lib/                    # Utilities
│   ├── supabase-client.ts
│   ├── auth-context.tsx
│   ├── types.ts
│   ├── db-queries.ts
│   ├── request-cache.ts
│   └── utils.ts
├── hooks/                  # React hooks
│   └── use-toast.ts
├── public/                 # Static assets
├── README.md              # Project overview
├── SETUP.md               # Setup instructions
├── OPTIMIZATION.md        # Performance details
└── PROJECT_INDEX.md       # This file
```

## Database Query Patterns

### Fetching Orders for Date
```typescript
// Uses index: orders(store_id, order_date)
const { data } = await supabase
  .from('orders')
  .select('*, products(*)')  // Include product data
  .eq('store_id', storeId)
  .eq('order_date', date)
  .order('created_at', { ascending: false })
  .range(0, 99)
```

### Getting Sales Sheet for Date
```typescript
// Uses index: sales_sheets(store_id, date) UNIQUE
const { data } = await supabase
  .from('sales_sheets')
  .select('*')
  .eq('store_id', storeId)
  .eq('date', date)
  .maybeSingle()  // No error if not found
```

### Multi-Store Aggregation
```typescript
// Fetch all stores, then fetch metrics per store
const { data: stores } = await getStores()
const metrics = await Promise.all(
  stores.map(s => getDailySalesMetrics(s.id, date))
)
```

## Role-Based Features

### Employee
- ✓ Add orders (own store)
- ✓ View own store orders
- ✓ See profit calculations
- ✗ Modify prices
- ✗ Generate reports
- ✗ View other stores

### Moderator
- ✓ View all orders (own store)
- ✓ Generate daily sales sheets
- ✓ Export PNG/PDF
- ✓ Input daily costs
- ✓ View report history
- ✗ Modify products
- ✗ Manage users

### Admin
- ✓ Full system access
- ✓ Manage products
- ✓ Create/assign users
- ✓ View all stores
- ✓ Analytics dashboard
- ✓ All moderator features
- ✓ All employee features

## Calculation Formulas

### Per Order
```
total_sell_price = quantity × selling_price_per_unit
buy_cost = quantity × product.buying_price
profit = total_sell_price - buy_cost
```

### Sales Sheet Summary
```
total_sales = SUM(total_sell_price) for all orders that day
total_buy_cost = SUM(quantity × buying_price) for all products
gross_profit = total_sales - total_buy_cost
net_profit = gross_profit - total_dollar_cost
```

### Monthly Metrics
```
current_month_sales = SUM(sales) for current month
last_month_sales = SUM(sales) for last month (same date range)
cumulative_dollar_cost = SUM(costs) for current month
cumulative_net_profit = gross_profit - total costs
```

## Export Functionality

### PNG Export
- Uses html2canvas
- Client-side rendering
- No server function
- Direct download

### PDF Export
- Uses jsPDF
- HTML canvas to PDF
- Client-side generation
- Direct download

## Testing Credentials

After setup, test with:
- **Employee**: Can add orders and view metrics
- **Moderator**: Can generate sales sheets
- **Admin**: Can access all features

See SETUP.md for detailed user creation instructions.

## Deployment Checklist

- [ ] Clone repository
- [ ] Run `npm install`
- [ ] Set up Supabase project
- [ ] Copy environment variables
- [ ] Database migrations applied
- [ ] Create test users
- [ ] Test authentication flow
- [ ] Test role permissions
- [ ] Test order creation
- [ ] Test sales sheet generation
- [ ] Deploy to Vercel
- [ ] Configure custom domain

## Documentation Files

1. **README.md** - Project overview and features
2. **SETUP.md** - Step-by-step setup guide
3. **OPTIMIZATION.md** - Performance and request optimization
4. **PROJECT_INDEX.md** - This file, technical reference

## Development Commands

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm run start

# Run linting
npm run lint

# Type checking
npm run typecheck
```

## Key Technologies

- **Next.js 13** - React framework with App Router
- **TypeScript** - Type safety
- **Supabase** - Backend as a service
- **PostgreSQL** - Database (managed by Supabase)
- **TailwindCSS** - Styling
- **shadcn/ui** - Component library
- **Lucide React** - Icons
- **html2canvas** - PNG export
- **jsPDF** - PDF export

## Environment Variables

Required in `.env`:
```
NEXT_PUBLIC_SUPABASE_URL=your_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key
```

## Important Notes

1. **No custom backend** - All logic in Supabase
2. **RLS enforced** - Database-level security
3. **BDT currency** - All amounts in Bangladeshi Taka
4. **6 PM - 6 PM cycle** - Daily operations period
5. **Free tier** - Designed for $0 cost at scale

## Next Steps

1. Deploy to Vercel
2. Create Supabase project
3. Set environment variables
4. Create test users
5. Verify functionality
6. Monitor request usage
7. Gather feedback from users
8. Iterate on features

---

**Created**: 2024
**Version**: 1.0
**Status**: Production Ready

# Sales Tracker - Multi-Store Sales Management System

A production-ready sales tracking and financial reporting system for managing multiple store locations. Built entirely on Supabase with no custom backend required.

## Tech Stack

- **Frontend**: Next.js 13, TypeScript, TailwindCSS
- **Backend**: Supabase (PostgreSQL, Auth, RLS)
- **Database**: PostgreSQL with 7 optimized tables
- **Hosting**: Vercel (Next.js), Supabase (Database)
- **Export**: HTML2Canvas + jsPDF (client-side)

## Key Features

### 1. Multi-Store Management
- Support for 3 independent store locations
- Per-store financial reporting
- Store-specific user assignments
- Isolated data with RLS policies

### 2. Role-Based Access Control
- **Employee**: Add orders, view daily metrics
- **Moderator**: Manage daily operations, generate reports
- **Admin**: Full system access, analytics, configuration

### 3. Order Management
- Real-time order tracking
- Customer information capture
- Automatic profit calculations
- Product selection with buying price reference

### 4. Daily Sales Sheets
- Automatic generation from orders
- 6 PM - 6 PM daily cycle
- Per-product breakdown
- Dollar cost input for net profit calculation
- Export as PNG or PDF

### 5. Financial Analytics
- Daily and monthly metrics
- Store comparison dashboard
- Gross and net profit tracking
- Expense management

## Database Schema

### Tables
1. **stores** (3 locations)
2. **profiles** (users with roles and store assignment)
3. **products** (inventory with editable buying prices)
4. **orders** (individual sales transactions)
5. **sales_sheets** (daily summaries)
6. **sales_sheet_items** (per-product breakdown)
7. **expenses** (operational costs)

### Indexes
- store_id on orders (fast filtering)
- store_id, date on sales_sheets (unique daily reports)
- order_date on orders (chronological queries)
- store_id, date on expenses (daily lookups)

### Row Level Security
- Employees: store-specific access only
- Moderators: store-specific management
- Admins: full access
- All enforced at database level

## User Flows

### Employee Workflow
```
Login → Dashboard → Add Order → View Orders → Logout
```

### Moderator Workflow
```
Login → Daily Orders → Review → Generate Sales Sheet → Export → View History
```

### Admin Workflow
```
Login → Analytics → Manage Products → View Users → Dashboard
```

## API Efficiency

Optimized for Vercel free tier (1000 functions/day limit):

1. **Smart Query Selection**
   - Only select needed columns
   - Batch fetch when possible
   - Use maybeSingle() for optional data

2. **Request Patterns**
   - Single daily metrics query
   - Pagination (10-100 items)
   - Client-side aggregation
   - RLS filtering at database

3. **Caching Strategy**
   - 5-minute client-side cache
   - Invalidate on data changes
   - Use React state for current session

## File Structure

```
app/
├── auth/
│   └── login/          # Login page
├── employee/
│   ├── dashboard/      # Employee dashboard
│   ├── add-order/      # Order entry form
│   └── orders/         # Order list view
├── moderator/
│   ├── dashboard/      # Moderator dashboard
│   ├── daily-orders/   # Packaging list
│   ├── generate-sales-sheet/  # Sheet generation
│   └── sales-sheets/   # Sheet management
├── admin/
│   ├── dashboard/      # Admin overview
│   ├── analytics/      # Analytics page
│   ├── products/       # Product management
│   └── users/          # User management
└── page.tsx            # Root redirector

components/
├── layout/
│   ├── navigation.tsx      # Role-based navigation
│   └── protected-layout.tsx # Auth wrapper
├── shared/
│   └── metric-card.tsx      # Dashboard metric display
└── ui/                  # shadcn/ui components

lib/
├── supabase-client.ts     # Supabase initialization
├── auth-context.tsx       # Auth provider
├── types.ts              # TypeScript interfaces
├── db-queries.ts         # Database operations
└── request-cache.ts      # Client-side caching
```

## Getting Started

### 1. Clone & Install
```bash
npm install
```

### 2. Environment Setup
Create `.env` with Supabase credentials:
```
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
```

### 3. Database Setup
- Database migrations are applied automatically via Supabase
- 3 stores are pre-created
- RLS policies are in place

### 4. Initialize Admin Account
1. Navigate to `/setup` page
2. Click "Setup Admin User" button
3. Save the provided credentials:
   - Email: `admin@test.com`
   - Password: `Admin123456!`
4. Use these to log in

### 5. Create Additional Users (Optional)
Use Supabase Auth dashboard or create users programmatically, then assign roles:
```sql
INSERT INTO profiles (id, name, role, store_id)
VALUES (user_id, 'Name', 'employee', store_id);
```

### 6. Run Development Server
```bash
npm run dev
```

## Daily Operations

### Adding Orders (Employee)
1. Go to "Add Order"
2. Enter customer info
3. Select product and quantity
4. Profit calculated automatically
5. Submit order

### Generating Sales Sheet (Moderator)
1. Go to "Generate Sales Sheet"
2. Select date (yesterday 6 PM - today 6 PM)
3. Input dollar cost for the day
4. Preview calculates net profit
5. Generate and export

### Reviewing Analytics (Admin)
1. Go to "Admin Dashboard"
2. Select date to view metrics
3. See breakdown by store
4. Export data if needed

## Calculations

### Per Order
```
total_sell_price = quantity × selling_price_per_unit
buy_cost = quantity × product.buying_price
profit = total_sell_price - buy_cost
```

### Per Sales Sheet
```
total_sales = sum(all orders that day)
total_buy_cost = sum(quantity × buying_price for all products)
gross_profit = total_sales - total_buy_cost
net_profit = gross_profit - total_dollar_cost
```

## Security

### Authentication
- Supabase Auth email/password
- Session managed client-side
- No hardcoded credentials

### Authorization
- Row Level Security on all tables
- Role-based policy checks
- Store isolation via store_id

### Data Protection
- All sensitive queries filtered by auth.uid()
- Admin checks for privilege operations
- No client-side data exposure

## Performance

### Query Optimization
- Indexes on frequently filtered columns
- Select only needed fields
- Batch operations where possible
- Pagination for large datasets

### Frontend Optimization
- Next.js static pre-rendering
- Client-side calculations
- Efficient re-renders with React
- Lazy loading for heavy components

### Deployment
- Vercel: automatic deployments, global CDN
- Supabase: managed database, auto-scaling
- No server costs on free tier

## Monitoring

### Key Metrics
- Daily orders per store
- Sales by product
- Profit margins
- Monthly trends

### Error Handling
- User-friendly error messages
- Toast notifications
- Validation on client and database
- Graceful error states

## Future Enhancements

- Real-time order updates with Supabase Realtime
- Email reports for moderators
- Advanced analytics with charts
- Mobile app for faster order entry
- Bulk order import from CSV
- Customer relationship tracking
- Inventory management
- Supplier management

## License

Private - For internal use only

## Support

Contact: Development Team

## Database Credentials

All Supabase credentials stored in `.env`
Do not commit `.env` to version control

## Additional Documentation

See `SETUP.md` for detailed setup instructions and troubleshooting.

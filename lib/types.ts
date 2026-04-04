export type UserRole = 'admin' | 'moderator' | 'employee'

export interface Profile {
  id: string
  name: string
  role: UserRole
  store_id: string | null
  store_ids?: string[]  // PostgreSQL uuid[] - multiple store assignments
  created_at: string
}

export interface Store {
  id: string
  store_name: string
  created_at: string
}

export interface Product {
  id: string
  product_name: string
  buying_price: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ProductIncentive {
  product_id: string
  threshold_price: number
  above_incentive: number
  below_incentive: number
  created_at?: string
  updated_at?: string
  product?: Product
}

export interface EmployeeIncentive {
  employee_id: string
  employee_name: string
  total_incentive: number
  total_sales: number
}

export interface Order {
  id: string
  store_id: string
  employee_id: string
  customer_name: string
  customer_phone: string | null
  product_id: string
  quantity: number
  selling_price_per_unit: number
  total_sell_price: number
  order_date: string
  created_at: string
   // profile who created the order (employee or moderator/admin)
  created_by?: string | null
  created_by_name?: string | null
  deleted_at?: string | null
  deleted_by?: string | null
  deleted_by_name?: string | null
  product?: Product
  
  // Also properties that come from admin view
  is_deleted?: boolean
  returned_at?: string | null
  returned_by_name?: string | null
  returned_by?: string | null
}

export interface ReturnedOrder extends Order {}

export interface SalesSheet {
  id: string
  store_id: string
  date: string
  total_sales: number
  total_buy_cost: number
  total_returned_amount: number
  net_profit: number
  total_dollar_cost: number
  generated_by: string
  created_at: string
}

export interface SalesSheetItem {
  id: string
  sales_sheet_id: string
  product_id: string
  quantity_sold: number
  total_sell_value: number
  total_buy_cost: number
  profit: number
  dollar_cost_tk: number
  per_product_dollar: number
  product?: Product
}

export interface SalesSheetSnapshot {
  id: string
  sales_sheet_id: string
  store_id: string
  date: string
  snapshot: any
  created_at: string
}

export interface Expense {
  id: string
  date: string
  operational_expense: number
  management_cost: number
  financial_cost: number
  content_cost: number
  store_id: string | null
  created_at: string
}

export interface DashboardMetrics {
  total_sales: number
  total_buy_cost: number
  gross_profit: number
  net_profit: number
}

export interface MonthlyMetrics {
  current_month_sales: number
  previous_month_sales: number
  cumulative_dollar_cost: number
  cumulative_net_profit: number
}

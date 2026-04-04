import { createClient } from './supabase-client'
import {
  Order,
  SalesSheet,
  SalesSheetItem,
  Expense,
  Product,
  ProductIncentive,
  EmployeeIncentive,
  Store,
  SalesSheetSnapshot,
} from './types'
import { getDhakaBusinessDayRangeUtc } from './date-utils'
import { cached } from './memory-cache'

// Cast to avoid strict PostgREST generics inferring `never` in some build envs (e.g. Vercel)
const supabase = createClient() as any

// ORDERS
export async function getOrdersByStoreAndDate(
  storeId: string,
  date: string,
  limit = 100,
  offset = 0
) {
  const { startUtc, endUtc } = getDhakaBusinessDayRangeUtc(date)

  const { data, error, count } = await supabase
    .from('orders')
    .select(
      `id, store_id, employee_id, customer_name, customer_phone,
       product_id, quantity, selling_price_per_unit, total_sell_price,
       order_date, created_at, created_by,
       products(id, product_name, buying_price), stores(store_name)`,
      { count: 'exact' }
    )
    .eq('store_id', storeId)
    .gte('created_at', startUtc)
    .lt('created_at', endUtc)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  // Normalize: Supabase returns "products", ensure "product" exists for consistency
  const normalized = (data ?? []).map((o: any) => ({
    ...o,
    product: o.product ?? o.products,
    store: o.store ?? o.stores,
  }))
  return { data: normalized as any[], error, count }
}

// Orders for a specific employee (created_by) on a given store+date.
export async function getOrdersByStoreAndDateForEmployee(
  storeId: string,
  date: string,
  employeeProfileId: string,
  limit = 100,
  offset = 0
) {
  const { startUtc, endUtc } = getDhakaBusinessDayRangeUtc(date)

  const { data, error, count } = await supabase
    .from('orders')
    .select(
      `id, store_id, employee_id, customer_name, customer_phone,
       product_id, quantity, selling_price_per_unit, total_sell_price,
       order_date, created_at, created_by,
       products(id, product_name, buying_price), stores(store_name)`,
      { count: 'exact' }
    )
    .eq('store_id', storeId)
    .eq('created_by', employeeProfileId)
    .gte('created_at', startUtc)
    .lt('created_at', endUtc)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  const normalized = (data ?? []).map((o: any) => ({
    ...o,
    product: o.product ?? o.products,
    store: o.store ?? o.stores,
  }))
  return { data: normalized as any[], error, count }
}

// Orders created by a specific employee across all stores (optionally filtered by date)
export async function getOrdersByEmployee(
  employeeProfileId: string,
  date?: string,
  limit = 200,
  offset = 0
) {
  const q = supabase
    .from('orders')
    .select(
      `id, store_id, employee_id, customer_name, customer_phone,
       product_id, quantity, selling_price_per_unit, total_sell_price,
       order_date, created_at, created_by,
       products(id, product_name, buying_price), stores(store_name)`,
      { count: 'exact' }
    )
    .eq('employee_id', employeeProfileId)

  if (date) {
    const { startUtc, endUtc } = getDhakaBusinessDayRangeUtc(date)
    q.gte('created_at', startUtc).lt('created_at', endUtc)
  }

  const { data, error, count } = await q
    .order('order_date', { ascending: false })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  const normalized = (data ?? []).map((o: any) => ({
    ...o,
    product: o.product ?? o.products,
    store: o.store ?? o.stores,
  }))
  return { data: normalized as any[], error, count }
}

// Orders across all stores for a date (moderator/admin overview)
export async function getOrdersForAllStoresByDate(date: string, limit = 200, offset = 0) {
  const { startUtc, endUtc } = getDhakaBusinessDayRangeUtc(date)

  const { data, error, count } = await supabase
    .from('orders')
    .select(
      `id, store_id, employee_id, customer_name, customer_phone,
       product_id, quantity, selling_price_per_unit, total_sell_price,
       order_date, created_at, created_by,
       products(id, product_name, buying_price), stores(store_name)`,
      { count: 'exact' }
    )
    .gte('created_at', startUtc)
    .lt('created_at', endUtc)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  const normalized = (data ?? []).map((o: any) => ({
    ...o,
    product: o.product ?? o.products,
    store: o.store ?? o.stores,
  }))
  return { data: normalized as any[], error, count }
}

export async function getOrdersForDateRange(
  storeId: string,
  startDate: string,
  endDate: string
) {
  const { data, error } = await supabase
    .from('orders')
    .select(
      `id, store_id, employee_id, customer_name, customer_phone,
       product_id, quantity, selling_price_per_unit, total_sell_price,
       order_date, created_at, created_by, products(id, product_name, buying_price)`
    )
    .eq('store_id', storeId)
    .gte('order_date', startDate)
    .lte('order_date', endDate)
    .or('status.eq.active,status.is.null')
    .order('order_date', { ascending: false })

  return { data: data as any[], error }
}

export async function getOrdersForStore(storeId: string) {
  const { data, error } = await supabase
    .from('orders')
    .select(
      `id, store_id, employee_id, customer_name, customer_phone,
       product_id, quantity, selling_price_per_unit, total_sell_price,
       order_date, created_at, created_by, products(id, product_name, buying_price)`
    )
    .eq('store_id', storeId)
    .order('order_date', { ascending: false })
    .order('created_at', { ascending: false })

  return { data: data as any[], error }
}

export async function insertOrder(order: Omit<Order, 'id' | 'created_at'>) {
  // Cast to avoid strict PostgREST generics inferring `never` in some build envs
  const { data, error } = await (supabase as any)
    .from('orders')
    .insert([order])
    .select()

  return { data: data?.[0], error }
}

// Soft delete an order (moderator/admin)
export async function softDeleteOrder(orderId: string, _deletedBy: string) {
  // Move from orders -> deleted_orders (72h retention)
  const { data, error } = await (supabase as any).rpc('delete_order_to_deleted', { order_id: orderId })
  const row = Array.isArray(data) ? data[0] : data
  return { data: row as any, error }
}

export async function returnOrder(orderId: string) {
  const { data, error } = await (supabase as any).rpc('return_order_to_returned', { order_id: orderId })
  const row = Array.isArray(data) ? data[0] : data
  return { data: row as any, error }
}

export async function getReturnedOrdersByDate(date: string) {
  const { data, error } = await (supabase as any).rpc('moderator_returned_orders_by_date', { day: date })
  return { data: (data ?? []) as any[], error }
}

export async function adminOrdersByDate(day: string, includeDeleted = true) {
  const { data, error } = await (supabase as any).rpc('admin_orders_by_date', {
    day,
    include_deleted: includeDeleted,
  })
  return { data: (data ?? []) as any[], error }
}

export async function adminOrderById(orderId: string) {
  const { data, error } = await (supabase as any).rpc('admin_order_by_id', { order_id: orderId })
  const row = Array.isArray(data) ? data[0] : data
  return { data: row as any, error }
}

// Restore a soft-deleted order (admin)
export async function restoreOrder(orderId: string) {
  const { data, error } = await supabase
    .from('orders')
    .update({ deleted_at: null, deleted_by: null })
    .eq('id', orderId)
    .select()
    .maybeSingle()

  return { data: data as any, error }
}

export async function getOrderById(orderId: string) {
  let { data, error } = await supabase
    .from('orders')
    .select(
      `id, store_id, employee_id, customer_name, customer_phone,
       product_id, quantity, selling_price_per_unit, total_sell_price,
       order_date, created_at, created_by, 
       products(id, product_name, buying_price), stores(store_name)`
    )
    .eq('id', orderId)
    .maybeSingle()

  if (!data) {
    const returnedRes = await supabase
      .from('returned_orders')
      .select(
        `id, store_id, employee_id, customer_name, customer_phone,
         product_id, quantity, selling_price_per_unit, total_sell_price,
         order_date, created_at, created_by, returned_at, returned_by,
         products(id, product_name, buying_price), stores(store_name)`
      )
      .eq('id', orderId)
      .maybeSingle()
    
    if (returnedRes.data) {
      data = { ...returnedRes.data, is_returned: true };
      error = returnedRes.error;
    }
  }

  const normalized = data
    ? ({
        ...data,
        is_returned: data.is_returned || false,
        product: (data as any).product ?? (data as any).products,
        store: (data as any).store ?? (data as any).stores,
      } as any)
    : null

  return { data: normalized as any, error }
}

export async function getProductIncentives() {
  const { data, error } = await supabase
    .from('product_incentives')
    .select(`*, products(id, product_name)`)
  return { data: data as any[], error }
}

export async function saveProductIncentive(incentive: Partial<ProductIncentive>) {
  const { data, error } = await supabase
    .from('product_incentives')
    .upsert({ ...incentive, updated_at: new Date().toISOString() })
    .select()
    .single()
  return { data, error }
}

export async function getEmployeeMonthlyIncentives(targetMonth: string) {
  const { data, error } = await supabase.rpc('get_employee_incentives', { target_month: targetMonth })
  return { data: (data ?? []) as EmployeeIncentive[], error }
}

// PRODUCTS
export async function getProducts() {
  return await cached('products:active', 30_000, async () => {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('is_active', true)
      .order('product_name')
    return { data: data as Product[], error }
  })
}

export async function getAllProducts() {
  return await cached('products:all', 30_000, async () => {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('product_name')
    return { data: data as Product[], error }
  })
}

export async function insertProduct(product: Omit<Product, 'id' | 'created_at' | 'updated_at'>) {
  const { data, error } = await supabase
    .from('products')
    .insert([product])
    .select()

  return { data: data?.[0], error }
}

export async function updateProduct(id: string, updates: Partial<Product>) {
  const { data, error } = await supabase
    .from('products')
    .update(updates)
    .eq('id', id)
    .select()

  return { data: data?.[0], error }
}

// SALES SHEETS
export async function getSalesSheetsByStore(
  storeId: string,
  limit = 50,
  offset = 0
) {
  const { data, error, count } = await supabase
    .from('sales_sheets')
    .select('*', { count: 'exact' })
    .eq('store_id', storeId)
    .order('date', { ascending: false })
    .range(offset, offset + limit - 1)

  return { data: data as SalesSheet[], error, count }
}

// Sales sheets across multiple stores (moderator/admin)
export async function getSalesSheetsByStores(storeIds: string[], limit = 100, offset = 0) {
  const { data, error, count } = await supabase
    .from('sales_sheets')
    .select(
      'id, store_id, date, total_sales, total_buy_cost, total_dollar_cost, net_profit, generated_by, created_at, stores(store_name)',
      { count: 'exact' }
    )
    .in('store_id', storeIds)
    .order('date', { ascending: false })
    .range(offset, offset + limit - 1)

  return { data: (data ?? []) as any[], error, count }
}

// Sales sheets across all stores (admin)
export async function getAllSalesSheets(limit = 200, offset = 0) {
  const { data, error, count } = await supabase
    .from('sales_sheets')
    .select(
      'id, store_id, date, total_sales, total_buy_cost, total_dollar_cost, net_profit, generated_by, created_at, stores(store_name)',
      { count: 'exact' }
    )
    .order('date', { ascending: false })
    .range(offset, offset + limit - 1)

  return { data: (data ?? []) as any[], error, count }
}

// All sales sheets for a store within a date range (inclusive).
export async function getSalesSheetsForStoreInRange(
  storeId: string,
  startDate: string,
  endDate: string
) {
  const { data, error } = await supabase
    .from('sales_sheets')
    .select('*')
    .eq('store_id', storeId)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: true })

  return { data: (data ?? []) as SalesSheet[], error }
}

export async function getSalesSheetByStoreAndDate(
  storeId: string,
  date: string
) {
  const { data, error } = await supabase
    .from('sales_sheets')
    .select('*')
    .eq('store_id', storeId)
    .eq('date', date)
    .maybeSingle()

  return { data: data as SalesSheet | null, error }
}

export async function getSalesSheetById(id: string) {
  const { data, error } = await supabase
    .from('sales_sheets')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  return { data: data as SalesSheet | null, error }
}

// SALES SHEET SNAPSHOTS (denormalized preview replicas)
export async function insertSalesSheetSnapshot(input: {
  sales_sheet_id: string
  store_id: string
  date: string
  snapshot: unknown
}) {
  const { data, error } = await supabase
    .from('sales_sheet_snapshots')
    .insert([
      {
        sales_sheet_id: input.sales_sheet_id,
        store_id: input.store_id,
        date: input.date,
        snapshot: input.snapshot,
      },
    ])
    .select()
    .maybeSingle()

  return { data: data as SalesSheetSnapshot | null, error }
}

export async function getSalesSheetSnapshotBySheetId(
  salesSheetId: string
) {
  const { data, error } = await supabase
    .from('sales_sheet_snapshots')
    .select('*')
    .eq('sales_sheet_id', salesSheetId)
    .order('created_at', { ascending: false })
    .maybeSingle()

  return { data: data as SalesSheetSnapshot | null, error }
}

// Snapshots for a whole day across multiple stores (for day-combined "saved sheet" view)
export async function getSalesSheetSnapshotsByDateForStores(date: string, storeIds: string[]) {
  const { data, error } = await supabase
    .from('sales_sheet_snapshots')
    .select('id, sales_sheet_id, store_id, date, snapshot, created_at, stores(store_name)')
    .eq('date', date)
    .in('store_id', storeIds)
    .order('created_at', { ascending: false })

  return { data: (data ?? []) as any[], error }
}

export async function deleteSalesSheetById(id: string) {
  const { error } = await supabase
    .from('sales_sheets')
    .delete()
    .eq('id', id)

  return { error }
}

export async function insertSalesSheet(sheet: Omit<SalesSheet, 'id' | 'created_at'>) {
  const { data, error } = await supabase
    .from('sales_sheets')
    .insert([sheet])
    .select()

  return { data: ((data?.[0] as SalesSheet | undefined) ?? null), error }
}

export async function updateSalesSheet(id: string, updates: Partial<SalesSheet>) {
  const { data, error } = await supabase
    .from('sales_sheets')
    .update(updates)
    .eq('id', id)
    .select()

  return { data: ((data?.[0] as SalesSheet | undefined) ?? null), error }
}

// SALES SHEET ITEMS
export async function getSalesSheetItems(salesSheetId: string) {
  const { data, error } = await supabase
    .from('sales_sheet_items')
    .select(
      `id, sales_sheet_id, product_id, quantity_sold, total_sell_value,
       total_buy_cost, profit, dollar_cost_tk, per_product_dollar,
       products(id, product_name, buying_price)`
    )
    .eq('sales_sheet_id', salesSheetId)

  return { data: data as any[], error }
}

export async function insertSalesSheetItems(items: Omit<SalesSheetItem, 'id'>[]) {
  const { data, error } = await supabase
    .from('sales_sheet_items')
    .insert(items)
    .select()

  return { data: data as SalesSheetItem[], error }
}

// EXPENSES
export async function getExpensesByStoreAndDate(storeId: string, date: string) {
  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .eq('store_id', storeId)
    .eq('date', date)
    .maybeSingle()

  return { data: data as Expense | null, error }
}

export async function insertOrUpdateExpense(
  storeId: string,
  date: string,
  expense: Omit<Expense, 'id' | 'created_at' | 'store_id' | 'date'>
) {
  const existing = await getExpensesByStoreAndDate(storeId, date)

  if (existing.data) {
    const { data, error } = await supabase
      .from('expenses')
      .update(expense)
      .eq('id', existing.data.id)
      .select()
    return { data: data?.[0], error }
  } else {
    const { data, error } = await supabase
      .from('expenses')
      .insert([{ ...expense, store_id: storeId, date }])
      .select()
    return { data: data?.[0], error }
  }
}

// STORES
export async function getStores() {
  return await cached('stores:all', 60_000, async () => {
    const { data, error } = await supabase
      .from('stores')
      .select('*')
      .order('store_name')
    return { data: error ? [] : data, error }
  })
}

export async function insertStore(storeName: string) {
  const { data, error } = await supabase
    .from('stores')
    .insert([{ store_name: storeName }])
    .select('*')
    .maybeSingle()

  return { data, error }
}

export async function updateStore(id: string, storeName: string) {
  const { data, error } = await supabase
    .from('stores')
    .update({ store_name: storeName })
    .eq('id', id)
    .select('*')
    .maybeSingle()

  return { data, error }
}

export async function deleteStore(id: string) {
  const { error } = await supabase
    .from('stores')
    .delete()
    .eq('id', id)

  return { error }
}

// Assigned stores for a given profile (employee/moderator) - from profiles.store_ids
export async function getAssignedStoresForProfile(profileId: string) {
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, store_ids')
    .eq('id', profileId)
    .maybeSingle()

  if (profileError) {
    return { data: [] as Store[], error: profileError }
  }

  // Admin and moderators might need access to all stores or specific ones. 
  // Let's allow admin to fetch all active stores.
  if (profile?.role === 'admin') {
    const { data: allStores, error } = await supabase
      .from('stores')
      .select('*')
      .order('store_name')
    return { data: (allStores ?? []) as Store[], error }
  }

  if (!profile?.store_ids?.length) {
    return { data: [] as Store[], error: null }
  }

  const { data: stores, error } = await supabase
    .from('stores')
    .select('*')
    .in('id', profile.store_ids)

  if (error) return { data: [] as Store[], error }
  return { data: (stores ?? []) as Store[], error: null as any }
}

// ANALYTICS QUERIES
export async function getDailySalesMetrics(storeId: string, date: string) {
  const { data: orders } = await getOrdersByStoreAndDate(storeId, date, 1000)
  const { data: expenses } = await getExpensesByStoreAndDate(storeId, date)

  const totalSales = orders.reduce((sum, o) => sum + o.total_sell_price, 0)
  const totalBuyCost = orders.reduce((sum, o) => sum + o.quantity * o.products?.buying_price || 0, 0)
  const grossProfit = totalSales - totalBuyCost

  let netProfit = grossProfit
  if (expenses) {
    netProfit -= (
      expenses.operational_expense +
      expenses.management_cost +
      expenses.financial_cost +
      expenses.content_cost
    )
  }

  return {
    totalSales,
    totalBuyCost,
    grossProfit,
    netProfit,
    expenses: expenses || null,
  }
}

export async function getMonthlyMetrics(storeId: string, currentDate: Date) {
  const currentMonth = currentDate.getMonth()
  const currentYear = currentDate.getFullYear()

  const startOfCurrentMonth = new Date(currentYear, currentMonth, 1)
  const endOfCurrentMonth = new Date(currentYear, currentMonth + 1, 0)

  const startOfLastMonth = new Date(currentYear, currentMonth - 1, 1)
  const endOfLastMonth = new Date(currentYear, currentMonth, 0)

  const formatDate = (d: Date) => d.toISOString().split('T')[0]

  const { data: currentOrders } = await getOrdersForDateRange(
    storeId,
    formatDate(startOfCurrentMonth),
    formatDate(endOfCurrentMonth)
  )

  const { data: lastOrders } = await getOrdersForDateRange(
    storeId,
    formatDate(startOfLastMonth),
    formatDate(endOfLastMonth)
  )

  const currentMonthSales = currentOrders.reduce((sum, o) => sum + o.total_sell_price, 0)
  const lastMonthSales = lastOrders.reduce((sum, o) => sum + o.total_sell_price, 0)

  const { data: currentExpenses } = await supabase
    .from('expenses')
    .select('*')
    .eq('store_id', storeId)
    .gte('date', formatDate(startOfCurrentMonth))
    .lte('date', formatDate(endOfCurrentMonth))

  const cumulativeDollarCost = (currentExpenses || []).reduce(
    (sum: number, e: any) => sum + (e.total_dollar_cost || 0),
    0
  )

  return {
    currentMonthSales,
    lastMonthSales,
    cumulativeDollarCost,
    cumulativeNetProfit: 0,
  }
}

// Month-to-date metrics for a store, with previous-month same-date comparison.
export async function getStoreMonthToDateMetrics(storeId: string, selectedDate: string) {
  const date = new Date(selectedDate)
  if (Number.isNaN(date.getTime())) {
    throw new Error('Invalid selectedDate')
  }

  const year = date.getFullYear()
  const month = date.getMonth()
  const day = date.getDate()

  const startOfCurrentMonth = new Date(year, month, 1)

  // Previous month year/month
  const prevMonthDate = new Date(year, month - 1, 1)
  const prevYear = prevMonthDate.getFullYear()
  const prevMonth = prevMonthDate.getMonth()
  const startOfPrevMonth = new Date(prevYear, prevMonth, 1)
  const endOfPrevMonth = new Date(prevYear, prevMonth + 1, 0)
  const sameDayPrevMonth = new Date(prevYear, prevMonth, Math.min(day, endOfPrevMonth.getDate()))

  const formatDate = (d: Date) => d.toISOString().split('T')[0]

  const [{ data: currentOrders }, { data: lastOrders }] = await Promise.all([
    getOrdersForDateRange(storeId, formatDate(startOfCurrentMonth), formatDate(date)),
    getOrdersForDateRange(storeId, formatDate(startOfPrevMonth), formatDate(sameDayPrevMonth)),
  ])

  const currentMonthSalesToDate = (currentOrders || []).reduce(
    (sum, o: any) => sum + o.total_sell_price,
    0
  )
  const lastMonthSalesToSameDate = (lastOrders || []).reduce(
    (sum, o: any) => sum + o.total_sell_price,
    0
  )

  const { data: currentSheets } = await supabase
    .from('sales_sheets')
    .select('total_dollar_cost, net_profit')
    .eq('store_id', storeId)
    .gte('date', formatDate(startOfCurrentMonth))
    .lte('date', formatDate(date))

  const currentMonthDollarCostToDate = (currentSheets || []).reduce(
    (sum: number, s: any) => sum + (s.total_dollar_cost || 0),
    0
  )

  const cumulativeNetProfit = (currentSheets || []).reduce(
    (sum: number, s: any) => sum + (s.net_profit || 0),
    0
  )

  return {
    currentMonthSalesToDate,
    lastMonthSalesToSameDate,
    currentMonthDollarCostToDate,
    cumulativeNetProfit,
  }
}

export async function getAllStoresSalesMetrics(date: string) {
  const { data: stores } = await getStores()
  if (!stores) return { data: [], error: new Error('No stores found') }

  const metrics: any[] = []
  for (const store of stores) {
    const daily = await getDailySalesMetrics(store.id, date)
    metrics.push({
      store_id: store.id,
      store_name: store.store_name,
      ...daily,
    })
  }

  return { data: metrics, error: null }
}

// GLOBAL VARIABLES (admin-only configuration for daily sheets)
export type Variables = {
  operational_expense: number
  management_cost: number
  financial_cost: number
  content_cost: number
  others: number
  dollar_rate: number
}

export async function getVariables() {
  return await cached('variables:single', 15_000, async () => {
    const { data, error } = await supabase
      .from('variables')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    return { data: data as (Variables & { id: string }) | null, error }
  })
}

export async function updateVariables(updates: Variables) {
  // Update the oldest row (there should only be one)
  const { data: row, error: fetchError } = await supabase
    .from('variables')
    .select('id')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (fetchError) {
    return { data: null, error: fetchError }
  }

  if (!row) {
    const { data, error } = await supabase
      .from('variables')
      .insert({ ...updates })
      .select()
      .maybeSingle()
    return { data, error }
  }

  const { data, error } = await supabase
    .from('variables')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', row.id)
    .select()
    .maybeSingle()

  return { data, error }
}

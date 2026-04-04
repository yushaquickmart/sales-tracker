'use client'

import { useState, useEffect } from 'react'
import { ProtectedLayout } from '@/components/layout/protected-layout'
import { useAuth } from '@/lib/auth-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { getProducts, insertOrder, getOrdersByEmployee, getAssignedStoresForProfile } from '@/lib/db-queries'
import { Product, Order, Store } from '@/lib/types'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Search, Trash2 } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getDhakaTodayDateString } from '@/lib/date-utils'

export default function AddOrderPage() {
  const { profile } = useAuth()
  const { toast } = useToast()
  const [products, setProducts] = useState<Product[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(false)
  const [fetchingOrders, setFetchingOrders] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedDate, setSelectedDate] = useState(getDhakaTodayDateString())
  const [formData, setFormData] = useState({
    customer_name: '',
    customer_phone: '',
    product_id: '',
    quantity: '',
    selling_price_per_unit: '',
  })
  const [profit, setProfit] = useState(0)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [assignedStores, setAssignedStores] = useState<Store[]>([])
  const [currentStoreId, setCurrentStoreId] = useState<string | null>(null)

  useEffect(() => {
    getProducts().then((result) => {
      if (result.data) setProducts(result.data.filter(p => p.is_active))
    })
  }, [])

  useEffect(() => {
    if (!profile?.id) return

    ;(async () => {
      const { data, error } = await getAssignedStoresForProfile(profile.id)
      if (error) {
        toast({
          title: 'Failed to load assigned stores',
          description: error.message,
          variant: 'destructive',
        })
        setAssignedStores([])
        setCurrentStoreId(null)
        return
      }
      setAssignedStores(data)
      if (data.length > 0) {
        setCurrentStoreId((prev) => prev && data.some((s) => s.id === prev) ? prev : data[0].id)
      } else {
        setCurrentStoreId(null)
      }
    })()
  }, [profile?.id, toast])

  useEffect(() => {
    if (!profile?.id) {
      setOrders([])
      return
    }
    setFetchingOrders(true)
    // Show this employee's orders across all stores; filter by selected date
    getOrdersByEmployee(profile.id, selectedDate, 500)
      .then((result) => {
        if (result.data) {
          setOrders(result.data as any)
        }
        setFetchingOrders(false)
      })
      .catch(() => setFetchingOrders(false))
  }, [profile?.id, selectedDate])

  const selectedProduct = products.find((p) => p.id === formData.product_id)

  useEffect(() => {
    if (selectedProduct && formData.quantity && formData.selling_price_per_unit) {
      const quantity = parseInt(formData.quantity) || 0
      const sellingPrice = parseFloat(formData.selling_price_per_unit) || 0
      const totalSell = quantity * sellingPrice
      const buyCost = quantity * selectedProduct.buying_price
      setProfit(totalSell - buyCost)
    } else {
      setProfit(0)
    }
  }, [selectedProduct, formData.quantity, formData.selling_price_per_unit])

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.customer_name.trim()) {
      newErrors.customer_name = 'Customer name is required'
    }
    if (!formData.product_id) {
      newErrors.product_id = 'Please select a product'
    }
    if (!formData.quantity || parseInt(formData.quantity) <= 0) {
      newErrors.quantity = 'Quantity must be greater than 0'
    }
    if (!formData.selling_price_per_unit || parseFloat(formData.selling_price_per_unit) < 0) {
      newErrors.selling_price_per_unit = 'Selling price must be valid'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile) return
    if (!currentStoreId) {
      toast({
        title: 'No store selected',
        description: 'You do not have a store selected. Please contact an admin if this is unexpected.',
        variant: 'destructive',
      })
      return
    }

    if (!validateForm()) {
      toast({
        title: 'Validation Error',
        description: 'Please fix the errors below',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)
    try {
      const quantity = parseInt(formData.quantity)
      const sellingPrice = parseFloat(formData.selling_price_per_unit)

      const { error } = await insertOrder({
        store_id: currentStoreId,
        employee_id: profile.id,
        created_by: profile.id,
        customer_name: formData.customer_name,
        customer_phone: formData.customer_phone || null,
        product_id: formData.product_id,
        quantity,
        selling_price_per_unit: sellingPrice,
        total_sell_price: quantity * sellingPrice,
        order_date: selectedDate,
      })

      if (error) throw error

      toast({
        title: 'Success',
        description: 'Order added successfully',
      })

      setFormData({
        customer_name: '',
        customer_phone: '',
        product_id: '',
        quantity: '',
        selling_price_per_unit: '',
      })
      setErrors({})

      const result = await getOrdersByEmployee(profile.id, selectedDate, 500)
      if (result.data) setOrders(result.data as any)
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to add order',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const filteredOrders = orders.filter(
    order =>
      order.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.product?.product_name?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const todayOrders = orders
  const todayTotal = todayOrders.reduce((sum, o) => sum + o.total_sell_price, 0)
  const todayProfit = todayOrders.reduce((sum, o) => {
    const product = products.find(p => p.id === o.product_id)
    if (!product) return sum
    return sum + (o.total_sell_price - o.quantity * product.buying_price)
  }, 0)

  return (
    <ProtectedLayout allowedRoles={['admin']}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Add Orders</h1>
          <div className="flex items-center gap-4">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
        </div>

        <Tabs defaultValue="form" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="form">Add Order</TabsTrigger>
            <TabsTrigger value="history">Order History ({filteredOrders.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="form">
            <Card className="p-8">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="customer_name">Customer Name *</Label>
                    <Input
                      id="customer_name"
                      value={formData.customer_name}
                      onChange={(e) => {
                        setFormData({ ...formData, customer_name: e.target.value })
                        if (errors.customer_name) {
                          setErrors({ ...errors, customer_name: '' })
                        }
                      }}
                      placeholder="Full name"
                      className={`mt-2 ${errors.customer_name ? 'border-red-500' : ''}`}
                    />
                    {errors.customer_name && (
                      <p className="text-sm text-red-600 mt-1">{errors.customer_name}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="customer_phone">Phone Number</Label>
                    <Input
                      id="customer_phone"
                      value={formData.customer_phone}
                      onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
                      placeholder="+880..."
                      className="mt-2"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="store">Store *</Label>
                  <Select
                    value={currentStoreId ?? ''}
                    onValueChange={(value) => setCurrentStoreId(value)}
                    disabled={assignedStores.length <= 1}
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue
                        placeholder={
                          assignedStores.length === 0
                            ? 'No stores assigned'
                            : 'Select store'
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {assignedStores.map((store) => (
                        <SelectItem key={store.id} value={store.id}>
                          {store.store_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {assignedStores.length === 0 && (
                    <p className="text-sm text-red-600 mt-1">
                      No stores are assigned to your account. Please contact an admin.
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="product">Product *</Label>
                  <Select value={formData.product_id} onValueChange={(value) => {
                    setFormData({ ...formData, product_id: value })
                    if (errors.product_id) {
                      setErrors({ ...errors, product_id: '' })
                    }
                  }}>
                    <SelectTrigger className={`mt-2 ${errors.product_id ? 'border-red-500' : ''}`}>
                      <SelectValue placeholder="Select a product" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.product_name} (Buy: {p.buying_price.toFixed(2)} BDT)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.product_id && (
                    <p className="text-sm text-red-600 mt-1">{errors.product_id}</p>
                  )}
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="quantity">Quantity *</Label>
                    <Input
                      id="quantity"
                      type="number"
                      value={formData.quantity}
                      onChange={(e) => {
                        setFormData({ ...formData, quantity: e.target.value })
                        if (errors.quantity) {
                          setErrors({ ...errors, quantity: '' })
                        }
                      }}
                      placeholder="0"
                      min="1"
                      className={`mt-2 ${errors.quantity ? 'border-red-500' : ''}`}
                    />
                    {errors.quantity && (
                      <p className="text-sm text-red-600 mt-1">{errors.quantity}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="selling_price">Selling Price per Unit (BDT) *</Label>
                    <Input
                      id="selling_price"
                      type="number"
                      value={formData.selling_price_per_unit}
                      onChange={(e) => {
                        setFormData({ ...formData, selling_price_per_unit: e.target.value })
                        if (errors.selling_price_per_unit) {
                          setErrors({ ...errors, selling_price_per_unit: '' })
                        }
                      }}
                      placeholder="0"
                      min="0"
                      step="0.01"
                      className={`mt-2 ${errors.selling_price_per_unit ? 'border-red-500' : ''}`}
                    />
                    {errors.selling_price_per_unit && (
                      <p className="text-sm text-red-600 mt-1">{errors.selling_price_per_unit}</p>
                    )}
                  </div>
                </div>

                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Total Sell</p>
                      <p className="text-lg font-bold text-gray-900">
                        {(
                          (parseInt(formData.quantity) || 0) *
                          (parseFloat(formData.selling_price_per_unit) || 0)
                        ).toFixed(0)}{' '}
                        BDT
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Buy Cost</p>
                      <p className="text-lg font-bold text-gray-900">
                        {selectedProduct
                          ? ((parseInt(formData.quantity) || 0) * selectedProduct.buying_price).toFixed(0)
                          : 0}{' '}
                        BDT
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Profit</p>
                      <p className={`text-lg font-bold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {profit.toFixed(0)} BDT
                      </p>
                    </div>
                  </div>
                </div>

                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? 'Adding...' : 'Add Order'}
                </Button>
              </form>
            </Card>
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center gap-4">
                  <Search className="w-5 h-5 text-gray-400" />
                  <Input
                    placeholder="Search by customer name or product..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1 border-none focus:outline-none focus:ring-0"
                  />
                </div>
              </div>

              {todayOrders.length > 0 && (
                <div className="p-6 bg-green-50 border-b border-green-200">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Today's Total</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {todayTotal.toFixed(0)} BDT
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Orders Count</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {todayOrders.length}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Today's Profit</p>
                      <p className={`text-2xl font-bold ${todayProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {todayProfit.toFixed(0)} BDT
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {fetchingOrders ? (
                <div className="p-8 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto" />
                </div>
              ) : filteredOrders.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  No orders found for {selectedDate}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead className="text-sm font-semibold">Customer</TableHead>
                        <TableHead className="text-sm font-semibold">Product</TableHead>
                        <TableHead className="text-right text-sm font-semibold">Quantity</TableHead>
                        <TableHead className="text-right text-sm font-semibold">Unit Price</TableHead>
                        <TableHead className="text-right text-sm font-semibold">Total</TableHead>
                        <TableHead className="text-right text-sm font-semibold">Profit</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredOrders.map((order) => {
                        const product = products.find(p => p.id === order.product_id)
                        const orderProfit = order.total_sell_price - (order.quantity * (product?.buying_price || 0))
                        return (
                          <TableRow key={order.id} className="hover:bg-gray-50">
                            <TableCell className="text-sm font-medium text-gray-900">
                              {order.customer_name}
                            </TableCell>
                            <TableCell className="text-sm text-gray-600">
                              {product?.product_name || 'Unknown'}
                            </TableCell>
                            <TableCell className="text-right text-sm text-gray-900">
                              {order.quantity}
                            </TableCell>
                            <TableCell className="text-right text-sm text-gray-900">
                              {order.selling_price_per_unit.toFixed(2)} BDT
                            </TableCell>
                            <TableCell className="text-right text-sm font-medium text-gray-900">
                              {order.total_sell_price.toFixed(0)} BDT
                            </TableCell>
                            <TableCell className={`text-right text-sm font-medium ${orderProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {orderProfit.toFixed(0)} BDT
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </ProtectedLayout>
  )
}

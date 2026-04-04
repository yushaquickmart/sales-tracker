'use client'

import { useState, useEffect } from 'react'
import { ProtectedLayout } from '@/components/layout/protected-layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { getAllProducts, insertProduct, updateProduct } from '@/lib/db-queries'
import { Product } from '@/lib/types'

export default function ProductsPage() {
  const { toast } = useToast()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    product_name: '',
    buying_price: '',
  })

  useEffect(() => {
    loadProducts()
  }, [])

  const loadProducts = async () => {
    const result = await getAllProducts()
    if (result.data) setProducts(result.data)
    setLoading(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.product_name || !formData.buying_price) {
      toast({
        title: 'Error',
        description: 'Product name and buying price are required',
        variant: 'destructive',
      })
      return
    }

    try {
      const buyingPrice = parseFloat(formData.buying_price)

      if (editingId) {
        const { error } = await updateProduct(editingId, {
          product_name: formData.product_name,
          buying_price: buyingPrice,
        })
        if (error) throw error
      } else {
        const { error } = await insertProduct({
          product_name: formData.product_name,
          buying_price: buyingPrice,
          is_active: true,
        })
        if (error) throw error
      }

      toast({
        title: 'Success',
        description: editingId ? 'Product updated' : 'Product created',
      })

      setFormData({ product_name: '', buying_price: '' })
      setEditingId(null)
      setShowForm(false)
      await loadProducts()
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message,
        variant: 'destructive',
      })
    }
  }

  const handleEdit = (product: Product) => {
    setEditingId(product.id)
    setFormData({
      product_name: product.product_name,
      buying_price: product.buying_price.toString(),
    })
    setShowForm(true)
  }

  const handleCancel = () => {
    setEditingId(null)
    setFormData({ product_name: '', buying_price: '' })
    setShowForm(false)
  }

  return (
    <ProtectedLayout allowedRoles={['admin']}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Products</h1>
          {!showForm && (
            <Button onClick={() => setShowForm(true)}>Add Product</Button>
          )}
        </div>

        {showForm && (
          <Card className="p-8 mb-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <Label htmlFor="name">Product Name *</Label>
                <Input
                  id="name"
                  value={formData.product_name}
                  onChange={(e) => setFormData({ ...formData, product_name: e.target.value })}
                  placeholder="Enter product name"
                  required
                  className="mt-2"
                />
              </div>

              <div>
                <Label htmlFor="price">Buying Price (BDT) *</Label>
                <Input
                  id="price"
                  type="number"
                  value={formData.buying_price}
                  onChange={(e) => setFormData({ ...formData, buying_price: e.target.value })}
                  placeholder="0"
                  min="0"
                  step="0.01"
                  required
                  className="mt-2"
                />
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={loading}>
                  {editingId ? 'Update Product' : 'Add Product'}
                </Button>
                <Button type="button" variant="outline" onClick={handleCancel}>
                  Cancel
                </Button>
              </div>
            </form>
          </Card>
        )}

        <div className="bg-white rounded-lg shadow overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading...</div>
          ) : products.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No products yet</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Product Name
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Buying Price
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {products.map((product) => (
                    <tr key={product.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        {product.product_name}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {product.buying_price} BDT
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          product.is_active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {product.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEdit(product)}
                        >
                          Edit
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </ProtectedLayout>
  )
}

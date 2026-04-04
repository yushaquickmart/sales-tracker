'use client'

import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { Button } from '@/components/ui/button'
import { LogOut, Menu, X, ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export function Navigation() {
  const { profile, signOut } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const handleSignOut = async () => {
    await signOut()
    router.push('/')
  }

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link href="/" className="font-bold text-lg text-gray-900">
            Sales Tracker
          </Link>

          <button
            className="md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>

          <div className="hidden md:flex items-center gap-6">
            {profile?.role === 'employee' && (
              <>
                <Link href="/employee/dashboard" className="text-gray-600 hover:text-gray-900">
                  Dashboard
                </Link>
                <Link href="/employee/add-order" className="text-gray-600 hover:text-gray-900">
                  Add Order
                </Link>
                <Link href="/employee/orders" className="text-gray-600 hover:text-gray-900">
                  My Orders
                </Link>
              </>
            )}
            {profile?.role === 'moderator' && (
              <>
                <Link href="/moderator/dashboard" className="text-gray-600 hover:text-gray-900">
                  Dashboard
                </Link>
                <Link href="/moderator/daily-orders" className="text-gray-600 hover:text-gray-900">
                  Daily Orders
                </Link>
                <Link href="/moderator/returned-orders" className="text-gray-600 hover:text-gray-900">
                  Returned Orders
                </Link>
                <Link href="/moderator/sales-sheets" className="text-gray-600 hover:text-gray-900">
                  Sales Sheets
                </Link>
              </>
            )}
            {profile?.role === 'admin' && (
              <>
                <Link href="/admin/dashboard" className="text-gray-600 hover:text-gray-900">
                  Dashboard
                </Link>
                <Link href="/admin/add-order" className="text-gray-600 hover:text-gray-900">
                  Add Order
                </Link>
                <Link href="/admin/orders" className="text-gray-600 hover:text-gray-900">
                  Orders (Daily)
                </Link>
                <Link href="/moderator/returned-orders" className="text-gray-600 hover:text-gray-900">
                  Returned Orders
                </Link>
                <Link href="/admin/sales-sheets" className="text-gray-600 hover:text-gray-900">
                  Sales Sheets
                </Link>
                <DropdownMenu>
                  <DropdownMenuTrigger className="flex items-center gap-1 text-gray-600 hover:text-gray-900 outline-none">
                    Management <ChevronDown className="h-4 w-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem asChild>
                      <Link href="/admin/users" className="w-full cursor-pointer">Users</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/admin/stores" className="w-full cursor-pointer">Stores</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/admin/products" className="w-full cursor-pointer">Products</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/admin/variables" className="w-full cursor-pointer">Variables</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/admin/analytics" className="w-full cursor-pointer">Analytics</Link>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                
                <Link
                  href="/admin/incentives"
                  className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                    pathname === '/admin/incentives'
                      ? 'border-indigo-500 text-gray-900'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                  }`}
                >
                  Incentives
                </Link>
              </>
            )}

            <div className="flex items-center gap-3 border-l pl-6">
              <span className="text-sm text-gray-600">{profile?.name}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSignOut}
                className="text-gray-600 hover:text-gray-900"
              >
                <LogOut size={18} />
              </Button>
            </div>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200 py-4 space-y-3">
            {profile?.role === 'employee' && (
              <>
                <Link
                  href="/employee/dashboard"
                  className="block text-gray-600 hover:text-gray-900 py-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Dashboard
                </Link>
                <Link
                  href="/employee/add-order"
                  className="block text-gray-600 hover:text-gray-900 py-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Add Order
                </Link>
                <Link
                  href="/employee/orders"
                  className="block text-gray-600 hover:text-gray-900 py-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  My Orders
                </Link>
              </>
            )}
            {profile?.role === 'moderator' && (
              <>
                <Link
                  href="/moderator/dashboard"
                  className="block text-gray-600 hover:text-gray-900 py-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Dashboard
                </Link>
                <Link
                  href="/moderator/daily-orders"
                  className="block text-gray-600 hover:text-gray-900 py-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Daily Orders
                </Link>
                <Link
                  href="/moderator/returned-orders"
                  className="block text-gray-600 hover:text-gray-900 py-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Returned Orders
                </Link>
                <Link
                  href="/moderator/sales-sheets"
                  className="block text-gray-600 hover:text-gray-900 py-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Sales Sheets
                </Link>
              </>
            )}
            {profile?.role === 'admin' && (
              <>
                <Link
                  href="/admin/dashboard"
                  className="block text-gray-600 hover:text-gray-900 py-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Dashboard
                </Link>
                <Link
                  href="/admin/add-order"
                  className="block text-gray-600 hover:text-gray-900 py-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Add Order
                </Link>
                <Link
                  href="/admin/orders"
                  className="block text-gray-600 hover:text-gray-900 py-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Orders (Daily)
                </Link>
                <Link
                  href="/moderator/returned-orders"
                  className="block text-gray-600 hover:text-gray-900 py-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Returned Orders
                </Link>
                <Link
                  href="/admin/sales-sheets"
                  className="block text-gray-600 hover:text-gray-900 py-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Sales Sheets
                </Link>
                <div className="py-2 space-y-2 border-t mt-2 pt-2">
                  <span className="block text-gray-900 font-semibold">Management</span>
                  <div className="pl-4 space-y-2">
                    <Link
                      href="/admin/users"
                      className="block text-gray-600 hover:text-gray-900"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Users
                    </Link>
                    <Link
                      href="/admin/stores"
                      className="block text-gray-600 hover:text-gray-900"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Stores
                    </Link>
                    <Link
                      href="/admin/products"
                      className="block text-gray-600 hover:text-gray-900"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Products
                    </Link>
                    <Link
                      href="/admin/variables"
                      className="block text-gray-600 hover:text-gray-900"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Variables
                    </Link>
                    <Link
                      href="/admin/analytics"
                      className="block text-gray-600 hover:text-gray-900"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Analytics
                    </Link>
                  </div>
                </div>

                <Link
                  href="/admin/incentives"
                  className={`block pl-3 pr-4 py-2 border-l-4 text-base font-medium ${
                    pathname === '/admin/incentives'
                      ? 'bg-indigo-50 border-indigo-500 text-indigo-700'
                      : 'border-transparent text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800'
                  }`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Incentives
                </Link>
              </>
            )}
            <button
              onClick={handleSignOut}
              className="block w-full text-left text-gray-600 hover:text-gray-900 py-2 border-t mt-2 pt-2"
            >
              Sign Out
            </button>
          </div>
        )}
      </div>
    </nav>
  )
}


/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  auth, db, handleFirestoreError, OperationType 
} from './firebase';
import { 
  onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, User 
} from 'firebase/auth';
import { 
  collection, onSnapshot, query, addDoc, updateDoc, doc, deleteDoc, 
  where, Timestamp, orderBy, limit, getDocs, setDoc
} from 'firebase/firestore';
import { 
  LayoutDashboard, Scissors, Package, Users, Calendar, 
  BarChart3, LogOut, Plus, Search, ShoppingCart, 
  Trash2, CheckCircle2, XCircle, ChevronRight, 
  TrendingUp, DollarSign, Users2, Clock, 
  Sun, Moon, AlertTriangle, Save, Filter
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, startOfDay, endOfDay, isSameDay, parseISO, subDays } from 'date-fns';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell 
} from 'recharts';

// --- Types ---

interface Service {
  id: string;
  name: string;
  price: number;
  cost: number;
}

interface Product {
  id: string;
  name: string;
  price: number;
  cost: number;
  quantity: number;
}

interface Employee {
  id: string;
  name: string;
  role: string;
}

interface Appointment {
  id: string;
  customerName: string;
  serviceId: string;
  employeeId: string;
  dateTime: string;
  status: 'scheduled' | 'completed' | 'cancelled';
}

interface SaleItem {
  id: string;
  name: string;
  type: 'service' | 'product';
  price: number;
  cost: number;
  quantity: number;
}

interface Sale {
  id: string;
  customerName: string;
  items: SaleItem[];
  totalAmount: number;
  totalCost: number;
  employeeId: string;
  timestamp: string;
  dayId: string;
}

interface BusinessDay {
  id: string;
  date: string;
  isClosed: boolean;
  openingBalance: number;
  closingBalance?: number;
}

interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
}

// --- Components ---

const Button = ({ children, onClick, variant = 'primary', className = '', disabled = false, type = 'button' }: any) => {
  const variants: any = {
    primary: 'bg-indigo-600 text-white hover:bg-indigo-700',
    secondary: 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50',
    danger: 'bg-red-600 text-white hover:bg-red-700',
    ghost: 'bg-transparent text-gray-500 hover:bg-gray-100',
  };

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
};

const Input = ({ label, ...props }: any) => (
  <div className="flex flex-col gap-1.5 w-full">
    {label && <label className="text-sm font-medium text-gray-700">{label}</label>}
    <input
      {...props}
      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
    />
  </div>
);

const Select = ({ label, options, ...props }: any) => (
  <div className="flex flex-col gap-1.5 w-full">
    {label && <label className="text-sm font-medium text-gray-700">{label}</label>}
    <select
      {...props}
      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all bg-white"
    >
      <option value="">Select an option</option>
      {options.map((opt: any) => (
        <option key={opt.id || opt.value} value={opt.id || opt.value}>
          {opt.name || opt.label}
        </option>
      ))}
    </select>
  </div>
);

const Card = ({ children, className = "" }: any) => (
  <div className={`bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden ${className}`}>
    {children}
  </div>
);

const Modal = ({ isOpen, onClose, title, children }: any) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
          <h3 className="text-lg font-bold text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XCircle size={20} />
          </button>
        </div>
        <div className="p-6">
          {children}
        </div>
      </motion.div>
    </div>
  );
};

const Toast = ({ message, type = 'success', onClose }: any) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const colors: any = {
    success: 'bg-green-600',
    error: 'bg-red-600',
    info: 'bg-blue-600'
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 50 }}
      className={`fixed bottom-4 right-4 ${colors[type]} text-white px-6 py-3 rounded-lg shadow-lg z-[100] flex items-center gap-3`}
    >
      {type === 'success' && <CheckCircle2 size={20} />}
      {type === 'error' && <XCircle size={20} />}
      <span className="font-medium">{message}</span>
    </motion.div>
  );
};

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [toast, setToast] = useState<{ message: string, type: string } | null>(null);
  
  const showToast = (message: string, type = 'success') => {
    setToast({ message, type });
  };
  
  // Data State
  const [services, setServices] = useState<Service[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [currentDay, setCurrentDay] = useState<BusinessDay | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsAdminUser(u?.email === 'charbelhzayed@gmail.com');
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) return;

    const unsubServices = onSnapshot(collection(db, 'services'), 
      (snap) => setServices(snap.docs.map(d => ({ id: d.id, ...d.data() } as Service))),
      (err) => handleFirestoreError(err, OperationType.LIST, 'services')
    );

    const unsubProducts = onSnapshot(collection(db, 'products'), 
      (snap) => setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Product))),
      (err) => handleFirestoreError(err, OperationType.LIST, 'products')
    );

    const unsubEmployees = onSnapshot(collection(db, 'employees'), 
      (snap) => setEmployees(snap.docs.map(d => ({ id: d.id, ...d.data() } as Employee))),
      (err) => handleFirestoreError(err, OperationType.LIST, 'employees')
    );

    const unsubAppointments = onSnapshot(collection(db, 'appointments'), 
      (snap) => setAppointments(snap.docs.map(d => ({ id: d.id, ...d.data() } as Appointment))),
      (err) => handleFirestoreError(err, OperationType.LIST, 'appointments')
    );

    const unsubSales = onSnapshot(collection(db, 'sales'), 
      (snap) => setSales(snap.docs.map(d => ({ id: d.id, ...d.data() } as Sale))),
      (err) => handleFirestoreError(err, OperationType.LIST, 'sales')
    );

    const unsubCustomers = onSnapshot(collection(db, 'customers'), 
      (snap) => setCustomers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Customer))),
      (err) => handleFirestoreError(err, OperationType.LIST, 'customers')
    );

    const unsubDays = onSnapshot(query(collection(db, 'days'), orderBy('date', 'desc'), limit(1)), 
      (snap) => {
        if (!snap.empty) {
          const day = { id: snap.docs[0].id, ...snap.docs[0].data() } as BusinessDay;
          setCurrentDay(day.isClosed ? null : day);
        } else {
          setCurrentDay(null);
        }
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'days')
    );

    return () => {
      unsubServices();
      unsubProducts();
      unsubEmployees();
      unsubAppointments();
      unsubSales();
      unsubCustomers();
      unsubDays();
    };
  }, [user]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (error) {
      console.error('Login failed', error);
    }
  };

  const handleLogout = () => signOut(auth);

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-gray-50 p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full text-center space-y-8"
        >
          <div className="flex justify-center">
            <div className="p-4 bg-indigo-600 rounded-2xl shadow-xl shadow-indigo-200">
              <Scissors className="text-white" size={48} />
            </div>
          </div>
          <div>
            <h1 className="text-4xl font-bold text-gray-900 tracking-tight">Glow & Groom</h1>
            <p className="mt-2 text-gray-600">Salon Management System</p>
          </div>
          <Button onClick={handleLogin} className="w-full py-4 text-lg">
            Sign in with Google
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 flex items-center gap-3 border-b border-gray-100">
          <div className="p-2 bg-indigo-600 rounded-lg">
            <Scissors className="text-white" size={20} />
          </div>
          <span className="font-bold text-xl text-gray-900">Glow & Groom</span>
        </div>
        
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <NavItem active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<LayoutDashboard size={20} />} label="Dashboard" />
          <NavItem active={activeTab === 'pos'} onClick={() => setActiveTab('pos')} icon={<ShoppingCart size={20} />} label="Point of Sale" />
          <NavItem active={activeTab === 'appointments'} onClick={() => setActiveTab('appointments')} icon={<Calendar size={20} />} label="Appointments" />
          <NavItem active={activeTab === 'inventory'} onClick={() => setActiveTab('inventory')} icon={<Package size={20} />} label="Inventory" />
          <NavItem active={activeTab === 'employees'} onClick={() => setActiveTab('employees')} icon={<Users size={20} />} label="Employees" />
          <NavItem active={activeTab === 'reports'} onClick={() => setActiveTab('reports')} icon={<BarChart3 size={20} />} label="Reports" />
          <NavItem active={activeTab === 'sales-history'} onClick={() => setActiveTab('sales-history')} icon={<TrendingUp size={20} />} label="Sales History" />
        </nav>

        <div className="p-4 border-t border-gray-100 space-y-4">
          <div className="flex items-center gap-3 px-2">
            <img src={user.photoURL || ''} alt="" className="w-8 h-8 rounded-full border border-gray-200" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{user.displayName}</p>
              <p className="text-xs text-gray-500 truncate">{user.email}</p>
            </div>
          </div>
          <Button onClick={handleLogout} variant="ghost" className="w-full justify-start px-2">
            <LogOut size={20} />
            Logout
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8">
          <h2 className="text-xl font-semibold text-gray-900 capitalize">{activeTab.replace('-', ' ')}</h2>
          <div className="flex items-center gap-4">
            {currentDay ? (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-700 rounded-full text-sm font-medium border border-green-100">
                <Sun size={16} />
                Day Open: {format(parseISO(currentDay.date), 'MMM dd, yyyy')}
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 text-amber-700 rounded-full text-sm font-medium border border-amber-100">
                <Moon size={16} />
                Day Closed
              </div>
            )}
            <DayManager currentDay={currentDay} />
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'dashboard' && <Dashboard sales={sales} appointments={appointments} services={services} products={products} currentDay={currentDay} isAdmin={isAdminUser} showToast={showToast} />}
              {activeTab === 'pos' && <POS currentDay={currentDay} services={services} products={products} employees={employees} isAdmin={isAdminUser} showToast={showToast} />}
              {activeTab === 'appointments' && <Appointments appointments={appointments} services={services} employees={employees} customers={customers} showToast={showToast} />}
              {activeTab === 'inventory' && <Inventory services={services} products={products} showToast={showToast} />}
              {activeTab === 'employees' && <EmployeeManagement employees={employees} showToast={showToast} />}
              {activeTab === 'reports' && <Reports sales={sales} employees={employees} services={services} products={products} />}
              {activeTab === 'sales-history' && <SalesHistory sales={sales} employees={employees} services={services} products={products} currentDay={currentDay} isAdmin={isAdminUser} showToast={showToast} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

function NavItem({ active, onClick, icon, label }: any) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
        active 
          ? 'bg-indigo-50 text-indigo-700 shadow-sm' 
          : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

// --- Sub-Components ---

function Dashboard({ sales, appointments, services, products, currentDay, isAdmin, showToast }: any) {
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean, type: 'today' | 'all' | null }>({ isOpen: false, type: null });
  const [isDeleting, setIsDeleting] = useState(false);

  const todaySales = useMemo(() => {
    if (!currentDay) return [];
    return sales.filter((s: any) => s.dayId === currentDay.id);
  }, [sales, currentDay]);

  const grossSales = useMemo(() => {
    return todaySales.reduce((acc: number, s: any) => {
      return acc + s.items.reduce((itemAcc: number, item: any) => {
        return itemAcc + ((item.originalPrice || item.price) * item.quantity);
      }, 0);
    }, 0);
  }, [todaySales]);

  const netSales = todaySales.reduce((acc: number, s: any) => acc + s.totalAmount, 0);
  const totalDiscount = grossSales - netSales;
  const totalProfit = todaySales.reduce((acc: number, s: any) => acc + (s.totalAmount - s.totalCost), 0);
  const pendingAppointments = appointments.filter((a: any) => a.status === 'scheduled' && isSameDay(parseISO(a.dateTime), new Date()));

  const handleDeleteConfirm = async () => {
    setIsDeleting(true);
    try {
      if (confirmModal.type === 'today') {
        if (!currentDay) throw new Error('No active business day.');
        const q = query(collection(db, 'sales'), where('dayId', '==', currentDay.id));
        const snapshot = await getDocs(q);
        const deletePromises = snapshot.docs.map(d => deleteDoc(doc(db, 'sales', d.id)));
        await Promise.all(deletePromises);
        showToast("Today's sales deleted successfully.");
      } else if (confirmModal.type === 'all') {
        const snapshot = await getDocs(collection(db, 'sales'));
        const deletePromises = snapshot.docs.map(d => deleteDoc(doc(db, 'sales', d.id)));
        await Promise.all(deletePromises);
        showToast("All sales history deleted successfully.");
      }
      setConfirmModal({ isOpen: false, type: null });
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'sales');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Today's Revenue" 
          value={
            <div className="space-y-1 mt-2">
              <div className="flex justify-between items-center text-[10px] uppercase tracking-wider text-gray-400 font-bold">
                <span>Gross</span>
                <span className="text-gray-600">${grossSales.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-[10px] uppercase tracking-wider text-gray-400 font-bold">
                <span>Discount</span>
                <span className="text-red-500">-${totalDiscount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center pt-1 border-t border-gray-100">
                <span className="text-[10px] uppercase tracking-wider text-gray-900 font-black">Net</span>
                <span className="text-xl font-black text-gray-900">${netSales.toFixed(2)}</span>
              </div>
            </div>
          } 
          icon={<DollarSign className="text-green-600" />} 
          trend="+12%" 
          color="green" 
        />
        <StatCard title="Today's Profit" value={`$${totalProfit.toFixed(2)}`} icon={<TrendingUp className="text-blue-600" />} trend="+8%" color="blue" />
        <StatCard title="Pending Appts" value={pendingAppointments.length} icon={<Clock className="text-amber-600" />} color="amber" />
        <StatCard title="Total Sales" value={todaySales.length} icon={<ShoppingCart className="text-purple-600" />} color="purple" />
      </div>

      {isAdmin && (
        <Card className="p-6 border-red-100 bg-red-50/30">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-red-900 flex items-center gap-2">
                <AlertTriangle size={20} />
                Danger Zone
              </h3>
              <p className="text-sm text-red-600">Sensitive administrative actions. Use with extreme caution.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => setConfirmModal({ isOpen: true, type: 'today' })} variant="danger" className="bg-red-500 hover:bg-red-600 text-xs py-2">
                Delete Today's Sales
              </Button>
              <Button onClick={() => setConfirmModal({ isOpen: true, type: 'all' })} variant="danger" className="bg-red-700 hover:bg-red-800 text-xs py-2">
                Delete All Sales History
              </Button>
            </div>
          </div>
        </Card>
      )}

      <Modal
        isOpen={confirmModal.isOpen}
        onClose={() => !isDeleting && setConfirmModal({ isOpen: false, type: null })}
        title="Confirm Deletion"
      >
        <div className="space-y-4">
          <div className="p-4 bg-red-50 rounded-lg border border-red-100">
            <p className="text-sm text-red-800 font-medium">
              {confirmModal.type === 'today' 
                ? 'Are you sure you want to delete ALL sales for TODAY? This action cannot be undone.'
                : 'CRITICAL WARNING: Are you sure you want to delete ALL sales from the BEGINNING? This will wipe your entire sales history and cannot be undone.'}
            </p>
          </div>
          <div className="flex gap-3">
            <Button 
              variant="ghost" 
              className="flex-1" 
              onClick={() => setConfirmModal({ isOpen: false, type: null })}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button 
              variant="danger" 
              className="flex-1 bg-red-600 hover:bg-red-700" 
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Confirm Delete'}
            </Button>
          </div>
        </div>
      </Modal>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card>
          <div className="p-6 border-b border-gray-100 flex justify-between items-center">
            <h3 className="font-semibold text-gray-900">Recent Sales</h3>
            <Button variant="ghost" className="text-xs">View All</Button>
          </div>
          <div className="divide-y divide-gray-100">
            {todaySales.slice(0, 5).map((sale: any) => (
              <div key={sale.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                <div>
                  <p className="font-medium text-gray-900">{sale.customerName || 'Walk-in Customer'}</p>
                  <p className="text-xs text-gray-500">{format(parseISO(sale.timestamp), 'hh:mm a')}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-gray-900">${sale.totalAmount.toFixed(2)}</p>
                  <p className="text-xs text-green-600">+${(sale.totalAmount - sale.totalCost).toFixed(2)} profit</p>
                </div>
              </div>
            ))}
            {todaySales.length === 0 && (
              <div className="p-8 text-center text-gray-500">No sales recorded yet today.</div>
            )}
          </div>
        </Card>

        <Card>
          <div className="p-6 border-b border-gray-100 flex justify-between items-center">
            <h3 className="font-semibold text-gray-900">Today's Appointments</h3>
            <Button variant="ghost" className="text-xs">View Calendar</Button>
          </div>
          <div className="divide-y divide-gray-100">
            {pendingAppointments.slice(0, 5).map((appt: any) => (
              <div key={appt.id} className="p-4 flex items-center gap-4 hover:bg-gray-50 transition-colors">
                <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold">
                  {appt.customerName.charAt(0)}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{appt.customerName}</p>
                  <p className="text-xs text-gray-500">
                    {services.find((s: any) => s.id === appt.serviceId)?.name} • {format(parseISO(appt.dateTime), 'hh:mm a')}
                  </p>
                </div>
                <div className="px-2 py-1 rounded-full bg-amber-50 text-amber-600 text-[10px] font-bold uppercase tracking-wider">
                  Scheduled
                </div>
              </div>
            ))}
            {pendingAppointments.length === 0 && (
              <div className="p-8 text-center text-gray-500">No appointments for today.</div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, trend, color }: any) {
  const borderColors: any = {
    green: 'border-emerald-500',
    blue: 'border-blue-500',
    amber: 'border-amber-500',
    purple: 'border-violet-500',
  };

  const iconBgColors: any = {
    green: 'bg-emerald-50 text-emerald-600',
    blue: 'bg-blue-50 text-blue-600',
    amber: 'bg-amber-50 text-amber-600',
    purple: 'bg-violet-50 text-violet-600',
  };

  return (
    <Card className={`p-6 border-l-4 ${borderColors[color]} bg-white shadow-sm`}>
      <div className="flex justify-between items-start">
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">{title}</p>
          {typeof value === 'string' || typeof value === 'number' ? (
            <h4 className="text-2xl font-black text-gray-900 mt-1">{value}</h4>
          ) : (
            <div>{value}</div>
          )}
          {trend && (
            <div className="flex items-center gap-1 mt-2">
              <span className="text-xs font-bold text-emerald-600">{trend}</span>
              <span className="text-[10px] text-gray-400">vs last week</span>
            </div>
          )}
        </div>
        <div className={`p-3 rounded-xl ${iconBgColors[color]}`}>
          {React.cloneElement(icon as React.ReactElement, { size: 24 })}
        </div>
      </div>
    </Card>
  );
}

function DayManager({ currentDay }: any) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [openingBalance, setOpeningBalance] = useState('0');
  const [closingBalance, setClosingBalance] = useState('0');

  const handleStartDay = async () => {
    try {
      await addDoc(collection(db, 'days'), {
        date: format(new Date(), 'yyyy-MM-dd'),
        isClosed: false,
        openingBalance: parseFloat(openingBalance) || 0,
      });
      setIsModalOpen(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'days');
    }
  };

  const handleEndDay = async () => {
    if (!currentDay) return;
    try {
      await updateDoc(doc(db, 'days', currentDay.id), {
        isClosed: true,
        closingBalance: parseFloat(closingBalance) || 0,
      });
      setIsModalOpen(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'days');
    }
  };

  return (
    <>
      <Button onClick={() => setIsModalOpen(true)} variant={currentDay ? 'secondary' : 'primary'}>
        {currentDay ? 'End Day' : 'Start Day'}
      </Button>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={currentDay ? 'End Business Day' : 'Start Business Day'}
      >
        <div className="space-y-4">
          {currentDay ? (
            <>
              <p className="text-sm text-gray-600">Enter the final cash balance to close the day.</p>
              <Input label="Closing Balance ($)" type="number" value={closingBalance} onChange={(e: any) => setClosingBalance(e.target.value)} />
              <Button onClick={handleEndDay} className="w-full">Close Day</Button>
            </>
          ) : (
            <>
              <p className="text-sm text-gray-600">Enter the starting cash balance for today.</p>
              <Input label="Opening Balance ($)" type="number" value={openingBalance} onChange={(e: any) => setOpeningBalance(e.target.value)} />
              <Button onClick={handleStartDay} className="w-full">Start Day</Button>
            </>
          )}
        </div>
      </Modal>
    </>
  );
}

function POS({ currentDay, services, products, employees, isAdmin, showToast }: any) {
  const [cart, setCart] = useState<any[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [search, setSearch] = useState('');

  const filteredItems = useMemo(() => {
    const s = services.map((x: any) => ({ ...x, type: 'service' }));
    const p = products.map((x: any) => ({ ...x, type: 'product' }));
    const all = [...s, ...p];
    return all.filter(i => i.name.toLowerCase().includes(search.toLowerCase()));
  }, [services, products, search]);

  const addToCart = (item: any) => {
    const existing = cart.find(i => i.id === item.id && i.type === item.type);
    if (existing) {
      setCart(cart.map(i => i.id === item.id && i.type === item.type ? { ...i, quantity: i.quantity + 1 } : i));
    } else {
      setCart([...cart, { 
        ...item, 
        quantity: 1, 
        originalPrice: item.price,
        discountType: 'none', // 'none', 'percent', 'amount'
        discountValue: 0
      }]);
    }
  };

  const removeFromCart = (id: string, type: string) => {
    setCart(cart.filter(i => !(i.id === id && i.type === type)));
  };

  const updateCartItem = (id: string, type: string, updates: any) => {
    setCart(cart.map(i => (i.id === id && i.type === type) ? { ...i, ...updates } : i));
  };

  const getItemPrice = (item: any) => {
    let price = item.price;
    if (item.discountType === 'percent') {
      price = price * (1 - (parseFloat(item.discountValue) || 0) / 100);
    } else if (item.discountType === 'amount') {
      price = Math.max(0, price - (parseFloat(item.discountValue) || 0));
    }
    return price;
  };

  const totalAmount = cart.reduce((acc, i) => acc + (getItemPrice(i) * i.quantity), 0);
  const totalCost = cart.reduce((acc, i) => acc + ((i.cost || 0) * i.quantity), 0);

  const handleCheckout = async () => {
    if (!currentDay) return showToast('Please start the day first!', 'error');
    if (cart.length === 0) return showToast('Cart is empty!', 'error');
    if (!selectedEmployee) return showToast('Please select an employee!', 'error');

    try {
      // Prepare items for sale (use discounted price)
      const saleItems = cart.map(i => ({
        ...i,
        price: getItemPrice(i)
      }));

      await addDoc(collection(db, 'sales'), {
        customerName,
        items: saleItems,
        totalAmount,
        totalCost,
        employeeId: selectedEmployee,
        timestamp: new Date().toISOString(),
        dayId: currentDay.id
      });

      // Update product quantities
      for (const item of cart) {
        if (item.type === 'product') {
          const productRef = doc(db, 'products', item.id);
          const currentProduct = products.find((p: any) => p.id === item.id);
          if (currentProduct) {
            await updateDoc(productRef, {
              quantity: currentProduct.quantity - item.quantity
            });
          }
        }
      }

      setCart([]);
      setCustomerName('');
      setSelectedEmployee('');
      showToast('Sale completed successfully!');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'sales');
    }
  };

  if (!currentDay) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
        <div className="p-6 bg-amber-50 rounded-full text-amber-600">
          <AlertTriangle size={48} />
        </div>
        <h3 className="text-2xl font-bold text-gray-900">Day is Closed</h3>
        <p className="text-gray-500 max-w-xs">You must start a new business day before you can record any sales.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-full">
      <div className="lg:col-span-2 space-y-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search services or products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm"
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {filteredItems.map((item: any) => (
            <motion.button
              whileTap={{ scale: 0.98 }}
              key={`${item.type}-${item.id}`}
              onClick={() => addToCart(item)}
              className="p-4 bg-white border border-gray-200 rounded-xl text-left hover:border-indigo-500 hover:shadow-md transition-all group"
            >
              <div className="flex justify-between items-start mb-2">
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${item.type === 'service' ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'}`}>
                  {item.type}
                </span>
                <Plus size={16} className="text-gray-300 group-hover:text-indigo-500" />
              </div>
              <p className="font-semibold text-gray-900 truncate">{item.name}</p>
              <p className="text-lg font-bold text-indigo-600 mt-1">${item.price.toFixed(2)}</p>
              {item.type === 'product' && (
                <p className={`text-[10px] mt-1 ${item.quantity < 5 ? 'text-red-500 font-bold' : 'text-gray-400'}`}>
                  Stock: {item.quantity}
                </p>
              )}
            </motion.button>
          ))}
        </div>
      </div>

      <Card className="flex flex-col h-full">
        <div className="p-6 border-b border-gray-100 space-y-4">
          <h3 className="font-bold text-gray-900 flex items-center gap-2">
            <ShoppingCart size={20} />
            Current Order
          </h3>
          <Input label="Customer Name" placeholder="Walk-in Customer" value={customerName} onChange={(e: any) => setCustomerName(e.target.value)} />
          <Select label="Employee" options={employees} value={selectedEmployee} onChange={(e: any) => setSelectedEmployee(e.target.value)} />
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {cart.map((item: any) => (
            <div key={`${item.type}-${item.id}`} className="p-3 bg-gray-50 rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {isAdmin ? (
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-gray-400 font-bold uppercase">Price:</span>
                        <input 
                          type="number" 
                          value={item.price} 
                          onChange={(e) => updateCartItem(item.id, item.type, { price: parseFloat(e.target.value) || 0 })}
                          className="w-16 text-xs bg-white border border-gray-200 rounded px-1 py-0.5 focus:ring-1 focus:ring-indigo-500 outline-none"
                        />
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500">${item.price.toFixed(2)}</p>
                    )}
                    <span className="text-xs text-gray-400">x {item.quantity}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold text-gray-900">${(getItemPrice(item) * item.quantity).toFixed(2)}</span>
                  <button onClick={() => removeFromCart(item.id, item.type)} className="text-red-400 hover:text-red-600">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {/* Discount Section */}
              <div className="flex flex-col gap-2 pt-2 border-t border-gray-200">
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => updateCartItem(item.id, item.type, { discountType: item.discountType === 'percent' ? 'none' : 'percent', discountValue: 0 })}
                    className={`px-2 py-1 rounded text-[10px] font-bold uppercase transition-colors ${item.discountType === 'percent' ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                  >
                    Discount %
                  </button>
                  <button 
                    onClick={() => updateCartItem(item.id, item.type, { discountType: item.discountType === 'amount' ? 'none' : 'amount', discountValue: 0 })}
                    className={`px-2 py-1 rounded text-[10px] font-bold uppercase transition-colors ${item.discountType === 'amount' ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                  >
                    Discount $
                  </button>
                  {item.discountType !== 'none' && (
                    <input 
                      type="number" 
                      placeholder={item.discountType === 'percent' ? '%' : '$'}
                      value={item.discountValue || ''}
                      onChange={(e) => updateCartItem(item.id, item.type, { discountValue: parseFloat(e.target.value) || 0 })}
                      className="flex-1 text-xs bg-white border border-gray-200 rounded px-2 py-1 focus:ring-1 focus:ring-indigo-500 outline-none"
                    />
                  )}
                </div>
              </div>
            </div>
          ))}
          {cart.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-2 py-12">
              <ShoppingCart size={32} />
              <p className="text-sm">Your cart is empty</p>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-100 bg-gray-50 space-y-4">
          <div className="flex justify-between items-center text-lg font-bold text-gray-900">
            <span>Total</span>
            <span>${totalAmount.toFixed(2)}</span>
          </div>
          <Button onClick={handleCheckout} className="w-full py-4 text-lg shadow-lg shadow-indigo-100">
            Complete Sale
          </Button>
        </div>
      </Card>
    </div>
  );
}

function Inventory({ services, products, showToast }: any) {
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);

  const [formData, setFormData] = useState({
    name: '',
    price: '',
    cost: '',
    quantity: ''
  });

  const handleSaveService = async (e: any) => {
    e.preventDefault();
    try {
      const data = {
        name: formData.name,
        price: parseFloat(formData.price) || 0,
        cost: parseFloat(formData.cost) || 0
      };
      if (editingItem) {
        await updateDoc(doc(db, 'services', editingItem.id), data);
        showToast('Service updated successfully');
      } else {
        await addDoc(collection(db, 'services'), data);
        showToast('Service added successfully');
      }
      setIsServiceModalOpen(false);
      setEditingItem(null);
      setFormData({ name: '', price: '', cost: '', quantity: '' });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'services');
    }
  };

  const [confirmDelete, setConfirmDelete] = useState<{ isOpen: boolean, id: string, type: 'service' | 'product' | null }>({ isOpen: false, id: '', type: null });

  const handleSaveProduct = async (e: any) => {
    e.preventDefault();
    try {
      const data = {
        name: formData.name,
        price: parseFloat(formData.price) || 0,
        cost: parseFloat(formData.cost) || 0,
        quantity: parseInt(formData.quantity) || 0
      };
      if (editingItem) {
        await updateDoc(doc(db, 'products', editingItem.id), data);
        showToast('Product updated successfully');
      } else {
        await addDoc(collection(db, 'products'), data);
        showToast('Product added successfully');
      }
      setIsProductModalOpen(false);
      setEditingItem(null);
      setFormData({ name: '', price: '', cost: '', quantity: '' });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'products');
    }
  };

  const handleDelete = async () => {
    const { id, type } = confirmDelete;
    if (!type) return;
    try {
      await deleteDoc(doc(db, type === 'service' ? 'services' : 'products', id));
      showToast(`${type.charAt(0).toUpperCase() + type.slice(1)} deleted successfully`);
      setConfirmDelete({ isOpen: false, id: '', type: null });
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, type + 's');
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h3 className="text-2xl font-bold text-gray-900">Services & Products</h3>
        <div className="flex gap-3">
          <Button onClick={() => setIsServiceModalOpen(true)}><Plus size={20} /> Add Service</Button>
          <Button onClick={() => setIsProductModalOpen(true)} variant="secondary"><Plus size={20} /> Add Product</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card>
          <div className="p-6 border-b border-gray-100">
            <h4 className="font-bold text-gray-900 flex items-center gap-2">
              <Scissors size={20} className="text-indigo-600" />
              Services
            </h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                  <th className="px-6 py-3 font-semibold">Name</th>
                  <th className="px-6 py-3 font-semibold">Price</th>
                  <th className="px-6 py-3 font-semibold">Cost</th>
                  <th className="px-6 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {services.map((s: any) => (
                  <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-900">{s.name}</td>
                    <td className="px-6 py-4 text-gray-600">${s.price.toFixed(2)}</td>
                    <td className="px-6 py-4 text-gray-400">${s.cost.toFixed(2)}</td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button onClick={() => { setEditingItem(s); setFormData({ ...s, price: s.price.toString(), cost: s.cost.toString() }); setIsServiceModalOpen(true); }} className="text-indigo-600 hover:text-indigo-800">Edit</button>
                      <button onClick={() => setConfirmDelete({ isOpen: true, id: s.id, type: 'service' })} className="text-red-600 hover:text-red-800">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <div className="p-6 border-b border-gray-100">
            <h4 className="font-bold text-gray-900 flex items-center gap-2">
              <Package size={20} className="text-emerald-600" />
              Products
            </h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                  <th className="px-6 py-3 font-semibold">Name</th>
                  <th className="px-6 py-3 font-semibold">Price</th>
                  <th className="px-6 py-3 font-semibold">Stock</th>
                  <th className="px-6 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {products.map((p: any) => (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-900">{p.name}</td>
                    <td className="px-6 py-4 text-gray-600">${p.price.toFixed(2)}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${p.quantity < 5 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                        {p.quantity} in stock
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button onClick={() => { setEditingItem(p); setFormData({ ...p, price: p.price.toString(), cost: p.cost.toString(), quantity: p.quantity.toString() }); setIsProductModalOpen(true); }} className="text-indigo-600 hover:text-indigo-800">Edit</button>
                      <button onClick={() => setConfirmDelete({ isOpen: true, id: p.id, type: 'product' })} className="text-red-600 hover:text-red-800">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Modal isOpen={isServiceModalOpen} onClose={() => { setIsServiceModalOpen(false); setEditingItem(null); setFormData({ name: '', price: '', cost: '', quantity: '' }); }} title={editingItem ? 'Edit Service' : 'Add New Service'}>
        <form onSubmit={handleSaveService} className="space-y-4">
          <Input label="Service Name" required value={formData.name} onChange={(e: any) => setFormData({ ...formData, name: e.target.value })} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Sales Price ($)" type="number" step="0.01" required value={formData.price} onChange={(e: any) => setFormData({ ...formData, price: e.target.value })} />
            <Input label="Cost Price ($)" type="number" step="0.01" required value={formData.cost} onChange={(e: any) => setFormData({ ...formData, cost: e.target.value })} />
          </div>
          <Button type="submit" className="w-full">Save Service</Button>
        </form>
      </Modal>

      <Modal isOpen={isProductModalOpen} onClose={() => { setIsProductModalOpen(false); setEditingItem(null); setFormData({ name: '', price: '', cost: '', quantity: '' }); }} title={editingItem ? 'Edit Product' : 'Add New Product'}>
        <form onSubmit={handleSaveProduct} className="space-y-4">
          <Input label="Product Name" required value={formData.name} onChange={(e: any) => setFormData({ ...formData, name: e.target.value })} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Sales Price ($)" type="number" step="0.01" required value={formData.price} onChange={(e: any) => setFormData({ ...formData, price: e.target.value })} />
            <Input label="Cost Price ($)" type="number" step="0.01" required value={formData.cost} onChange={(e: any) => setFormData({ ...formData, cost: e.target.value })} />
          </div>
          <Input label="Initial Quantity" type="number" required value={formData.quantity} onChange={(e: any) => setFormData({ ...formData, quantity: e.target.value })} />
          <Button type="submit" className="w-full">Save Product</Button>
        </form>
      </Modal>

      <Modal
        isOpen={confirmDelete.isOpen}
        onClose={() => setConfirmDelete({ isOpen: false, id: '', type: null })}
        title="Confirm Delete"
      >
        <div className="space-y-4">
          <p className="text-gray-600">Are you sure you want to delete this {confirmDelete.type}? This action cannot be undone.</p>
          <div className="flex gap-3">
            <Button variant="ghost" className="flex-1" onClick={() => setConfirmDelete({ isOpen: false, id: '', type: null })}>Cancel</Button>
            <Button variant="danger" className="flex-1" onClick={handleDelete}>Delete</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function EmployeeManagement({ employees, showToast }: any) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<any>(null);
  const [formData, setFormData] = useState({ name: '', role: '' });

  const handleSave = async (e: any) => {
    e.preventDefault();
    try {
      if (editingEmployee) {
        await updateDoc(doc(db, 'employees', editingEmployee.id), formData);
        showToast('Employee updated successfully');
      } else {
        await addDoc(collection(db, 'employees'), formData);
        showToast('Employee added successfully');
      }
      setIsModalOpen(false);
      setEditingEmployee(null);
      setFormData({ name: '', role: '' });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'employees');
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h3 className="text-2xl font-bold text-gray-900">Team Members</h3>
        <Button onClick={() => setIsModalOpen(true)}><Plus size={20} /> Add Employee</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {employees.map((emp: any) => (
          <Card key={emp.id} className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xl">
                {emp.name.charAt(0)}
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-gray-900">{emp.name}</h4>
                <p className="text-sm text-gray-500">{emp.role || 'Staff Member'}</p>
              </div>
              <button onClick={() => { setEditingEmployee(emp); setFormData({ name: emp.name, role: emp.role || '' }); setIsModalOpen(true); }} className="text-gray-400 hover:text-indigo-600">
                <ChevronRight size={20} />
              </button>
            </div>
          </Card>
        ))}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setEditingEmployee(null); setFormData({ name: '', role: '' }); }} title={editingEmployee ? 'Edit Employee' : 'Add New Employee'}>
        <form onSubmit={handleSave} className="space-y-4">
          <Input label="Full Name" required value={formData.name} onChange={(e: any) => setFormData({ ...formData, name: e.target.value })} />
          <Input label="Role / Title" placeholder="e.g. Senior Barber" value={formData.role} onChange={(e: any) => setFormData({ ...formData, role: e.target.value })} />
          <Button type="submit" className="w-full">Save Employee</Button>
        </form>
      </Modal>
    </div>
  );
}

function Appointments({ appointments, services, employees, customers, showToast }: any) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isNewCustomerModalOpen, setIsNewCustomerModalOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  
  const [formData, setFormData] = useState({
    serviceId: '',
    employeeId: '',
    dateTime: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    status: 'scheduled'
  });

  const [newCustomerData, setNewCustomerData] = useState({
    firstName: '',
    lastName: '',
    phone: ''
  });

  const filteredCustomers = useMemo(() => {
    if (!customerSearch) return [];
    const search = customerSearch.toLowerCase();
    return customers.filter((c: Customer) => 
      c.firstName.toLowerCase().includes(search) || 
      c.lastName.toLowerCase().includes(search) || 
      c.phone.includes(search)
    );
  }, [customers, customerSearch]);

  const handleSave = async (e: any) => {
    e.preventDefault();
    if (!selectedCustomer) {
      return showToast('Please select or create a customer first', 'error');
    }
    try {
      await addDoc(collection(db, 'appointments'), {
        ...formData,
        customerName: `${selectedCustomer.firstName} ${selectedCustomer.lastName}`,
        customerId: selectedCustomer.id
      });
      setIsModalOpen(false);
      setSelectedCustomer(null);
      setCustomerSearch('');
      setFormData({ serviceId: '', employeeId: '', dateTime: format(new Date(), "yyyy-MM-dd'T'HH:mm"), status: 'scheduled' });
      showToast('Appointment booked successfully');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'appointments');
    }
  };

  const handleCreateCustomer = async (e: any) => {
    e.preventDefault();
    try {
      const docRef = await addDoc(collection(db, 'customers'), newCustomerData);
      const newCust = { id: docRef.id, ...newCustomerData };
      setSelectedCustomer(newCust);
      setCustomerSearch(`${newCust.firstName} ${newCust.lastName}`);
      setIsNewCustomerModalOpen(false);
      setNewCustomerData({ firstName: '', lastName: '', phone: '' });
      showToast('Customer created successfully');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'customers');
    }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      await updateDoc(doc(db, 'appointments', id), { status });
      showToast(`Appointment marked as ${status}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'appointments');
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h3 className="text-2xl font-bold text-gray-900">Appointment Book</h3>
        <Button onClick={() => setIsModalOpen(true)}><Plus size={20} /> New Appointment</Button>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                <th className="px-6 py-3 font-semibold">Customer</th>
                <th className="px-6 py-3 font-semibold">Service</th>
                <th className="px-6 py-3 font-semibold">Barber</th>
                <th className="px-6 py-3 font-semibold">Date & Time</th>
                <th className="px-6 py-3 font-semibold">Status</th>
                <th className="px-6 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {appointments.sort((a: any, b: any) => b.dateTime.localeCompare(a.dateTime)).map((appt: any) => (
                <tr key={appt.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-gray-900">{appt.customerName}</td>
                  <td className="px-6 py-4 text-gray-600">{services.find((s: any) => s.id === appt.serviceId)?.name}</td>
                  <td className="px-6 py-4 text-gray-600">{employees.find((e: any) => e.id === appt.employeeId)?.name}</td>
                  <td className="px-6 py-4 text-gray-600">{format(parseISO(appt.dateTime), 'MMM dd, hh:mm a')}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      appt.status === 'completed' ? 'bg-green-50 text-green-600' : 
                      appt.status === 'cancelled' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'
                    }`}>
                      {appt.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right space-x-2">
                    {appt.status === 'scheduled' && (
                      <>
                        <button onClick={() => updateStatus(appt.id, 'completed')} className="text-green-600 hover:text-green-800"><CheckCircle2 size={18} /></button>
                        <button onClick={() => updateStatus(appt.id, 'cancelled')} className="text-red-600 hover:text-red-800"><XCircle size={18} /></button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Book Appointment">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="relative">
            <Input 
              label="Search Customer" 
              placeholder="Name or Phone..."
              value={customerSearch} 
              onChange={(e: any) => {
                setCustomerSearch(e.target.value);
                setSelectedCustomer(null);
              }} 
            />
            {customerSearch && !selectedCustomer && (
              <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
                {filteredCustomers.map((c: Customer) => (
                  <button
                    key={c.id}
                    type="button"
                    className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm flex justify-between items-center"
                    onClick={() => {
                      setSelectedCustomer(c);
                      setCustomerSearch(`${c.firstName} ${c.lastName}`);
                    }}
                  >
                    <span>{c.firstName} {c.lastName}</span>
                    <span className="text-gray-400 text-xs">{c.phone}</span>
                  </button>
                ))}
                <button
                  type="button"
                  className="w-full text-left px-4 py-2 hover:bg-indigo-50 text-indigo-600 text-sm font-bold flex items-center gap-2 border-t border-gray-100"
                  onClick={() => setIsNewCustomerModalOpen(true)}
                >
                  <Plus size={16} /> Add New Customer "{customerSearch}"
                </button>
              </div>
            )}
            {selectedCustomer && (
              <div className="mt-2 p-2 bg-indigo-50 rounded-lg flex justify-between items-center">
                <span className="text-sm font-medium text-indigo-900">
                  Selected: {selectedCustomer.firstName} {selectedCustomer.lastName}
                </span>
                <button 
                  type="button" 
                  onClick={() => {
                    setSelectedCustomer(null);
                    setCustomerSearch('');
                  }}
                  className="text-indigo-600 hover:text-indigo-800"
                >
                  <XCircle size={16} />
                </button>
              </div>
            )}
          </div>

          <Select label="Service" options={services} required value={formData.serviceId} onChange={(e: any) => setFormData({ ...formData, serviceId: e.target.value })} />
          <Select label="Employee" options={employees} required value={formData.employeeId} onChange={(e: any) => setFormData({ ...formData, employeeId: e.target.value })} />
          <Input label="Date & Time" type="datetime-local" required value={formData.dateTime} onChange={(e: any) => setFormData({ ...formData, dateTime: e.target.value })} />
          <Button type="submit" className="w-full" disabled={!selectedCustomer}>Book Now</Button>
        </form>
      </Modal>

      <Modal isOpen={isNewCustomerModalOpen} onClose={() => setIsNewCustomerModalOpen(false)} title="New Customer">
        <form onSubmit={handleCreateCustomer} className="space-y-4">
          <Input 
            label="First Name" 
            required 
            value={newCustomerData.firstName} 
            onChange={(e: any) => setNewCustomerData({ ...newCustomerData, firstName: e.target.value })} 
          />
          <Input 
            label="Last Name (Family)" 
            required 
            value={newCustomerData.lastName} 
            onChange={(e: any) => setNewCustomerData({ ...newCustomerData, lastName: e.target.value })} 
          />
          <Input 
            label="Telephone Number" 
            required 
            type="tel"
            value={newCustomerData.phone} 
            onChange={(e: any) => setNewCustomerData({ ...newCustomerData, phone: e.target.value })} 
          />
          <Button type="submit" className="w-full">Save & Select Customer</Button>
        </form>
      </Modal>
    </div>
  );
}

function Reports({ sales, employees, services, products }: any) {
  const [dateRange, setDateRange] = useState({
    start: format(subDays(new Date(), 7), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd')
  });

  const filteredSales = useMemo(() => {
    return sales.filter((s: any) => {
      const date = s.timestamp.split('T')[0];
      return date >= dateRange.start && date <= dateRange.end;
    });
  }, [sales, dateRange]);

  const stats = useMemo(() => {
    const revenue = filteredSales.reduce((acc: number, s: any) => acc + s.totalAmount, 0);
    const cost = filteredSales.reduce((acc: number, s: any) => acc + s.totalCost, 0);
    const profit = revenue - cost;
    
    // Sales by Employee
    const byEmployee = employees.map((emp: any) => {
      const empSales = filteredSales.filter((s: any) => s.employeeId === emp.id);
      return {
        name: emp.name,
        revenue: empSales.reduce((acc: number, s: any) => acc + s.totalAmount, 0),
        salesCount: empSales.length
      };
    });

    // Sales by Category (Service vs Product)
    let serviceRev = 0;
    let productRev = 0;
    let productCost = 0;
    let serviceCount = 0;
    let productCount = 0;

    filteredSales.forEach((s: any) => {
      s.items.forEach((i: any) => {
        const itemPrice = i.price || 0;
        const itemCost = i.cost || 0;
        const itemQty = i.quantity || 0;

        if (i.type === 'service') {
          serviceRev += (itemPrice * itemQty);
          serviceCount += itemQty;
        } else {
          productRev += (itemPrice * itemQty);
          productCost += (itemCost * itemQty);
          productCount += itemQty;
        }
      });
    });

    return { 
      revenue, 
      cost, 
      profit, 
      serviceCount,
      productCount,
      productRev,
      productCost,
      byEmployee, 
      byCategory: [
        { name: 'Services', value: serviceRev },
        { name: 'Products', value: productRev },
        { name: 'Total', value: revenue }
      ]
    };
  }, [filteredSales, employees]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadCSV = () => {
    const headers = ['Date', 'Customer', 'Employee', 'Service', 'Product', 'Qty', 'Price', 'Total', 'Cost', 'Profit'];
    let totalQty = 0;
    let totalSales = 0;
    let totalCost = 0;
    let totalProfit = 0;

    const rows = filteredSales.flatMap((s: any) => {
      const empName = employees.find((e: any) => e.id === s.employeeId)?.name || 'Unknown';
      return s.items.flatMap((item: any) => {
        const itemPrice = item.price || 0;
        const itemCost = item.cost || 0;
        const itemQty = item.quantity || 0;
        
        // Split into individual rows for each unit
        const itemRows = [];
        for (let i = 0; i < itemQty; i++) {
          const itemTotal = itemPrice; // Total for 1 unit
          const itemUnitCost = itemCost; // Cost for 1 unit
          const itemUnitProfit = itemTotal - itemUnitCost;

          totalQty += 1;
          totalSales += itemTotal;
          totalCost += itemUnitCost;
          totalProfit += itemUnitProfit;

          itemRows.push([
            format(parseISO(s.timestamp), 'yyyy-MM-dd HH:mm'),
            s.customerName || 'Walk-in',
            empName,
            item.type === 'service' ? item.name : '',
            item.type === 'product' ? item.name : '',
            1,
            itemPrice.toFixed(2),
            itemTotal.toFixed(2),
            itemUnitCost.toFixed(2),
            itemUnitProfit.toFixed(2)
          ]);
        }
        return itemRows;
      });
    });

    // Add summary row
    const summaryRow = [
      'TOTALS', '', '', '', '', 
      totalQty, 
      '', 
      totalSales.toFixed(2), 
      totalCost.toFixed(2), 
      totalProfit.toFixed(2)
    ];

    const csvContent = [headers, ...rows, summaryRow]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `salon_report_${dateRange.start}_to_${dateRange.end}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  return (
    <div className="space-y-8 print:p-0">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden">
        <h3 className="text-2xl font-bold text-gray-900">Financial Reports</h3>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-3 bg-white p-2 rounded-xl border border-gray-200 shadow-sm">
            <Filter size={18} className="text-gray-400 ml-2" />
            <input type="date" value={dateRange.start} onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })} className="border-none focus:ring-0 text-sm" />
            <span className="text-gray-300">to</span>
            <input type="date" value={dateRange.end} onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })} className="border-none focus:ring-0 text-sm" />
          </div>
          <Button onClick={handlePrint} variant="secondary"><BarChart3 size={18} /> Print</Button>
          <Button onClick={handleDownloadCSV} variant="secondary"><Save size={18} /> Download CSV</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="p-6 bg-white border-l-4 border-blue-600 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-500 text-xs font-bold uppercase tracking-wider">Total Revenue</p>
              <h4 className="text-2xl font-black text-gray-900 mt-1">${stats.revenue.toFixed(2)}</h4>
            </div>
            <div className="p-3 bg-blue-50 rounded-xl text-blue-600">
              <TrendingUp size={24} />
            </div>
          </div>
          <div className="mt-4 text-xs font-medium text-blue-700 bg-blue-50 p-2 rounded-lg">
            {stats.serviceCount} services, {stats.productCount} products
          </div>
        </Card>
        <Card className="p-6 bg-white border-l-4 border-emerald-600 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-500 text-xs font-bold uppercase tracking-wider">Total Profit</p>
              <h4 className="text-2xl font-black text-gray-900 mt-1">${stats.profit.toFixed(2)}</h4>
            </div>
            <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600">
              <DollarSign size={24} />
            </div>
          </div>
          <div className="mt-4 text-xs font-medium text-emerald-700 bg-emerald-50 p-2 rounded-lg">
            Margin: {stats.revenue > 0 ? ((stats.profit / stats.revenue) * 100).toFixed(1) : 0}%
          </div>
        </Card>
        <Card className="p-6 bg-white border-l-4 border-violet-600 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-500 text-xs font-bold uppercase tracking-wider">Product Sales</p>
              <h4 className="text-2xl font-black text-gray-900 mt-1">${stats.productRev.toFixed(2)}</h4>
            </div>
            <div className="p-3 bg-violet-50 rounded-xl text-violet-600">
              <Package size={24} />
            </div>
          </div>
          <div className="mt-4 text-xs font-medium text-violet-700 bg-violet-50 p-2 rounded-lg">
            Cost: ${stats.productCost.toFixed(2)}
          </div>
        </Card>
        <Card className="p-6 bg-white border-l-4 border-rose-600 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-500 text-xs font-bold uppercase tracking-wider">Total Cost</p>
              <h4 className="text-2xl font-black text-gray-900 mt-1">${stats.cost.toFixed(2)}</h4>
            </div>
            <div className="p-3 bg-rose-50 rounded-xl text-rose-600">
              <AlertTriangle size={24} />
            </div>
          </div>
          <div className="mt-4 text-xs font-medium text-rose-700 bg-rose-50 p-2 rounded-lg">
            Incl. product & service costs
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 print:block print:space-y-8">
        <Card className="p-6">
          <h4 className="font-bold text-gray-900 mb-6">Revenue by Employee</h4>
          <div className="h-64 mb-8">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.byEmployee} margin={{ bottom: 30 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis 
                  dataKey="name" 
                  interval={0}
                  tick={(props: any) => {
                    const { x, y, payload } = props;
                    const empData = stats.byEmployee.find((e: any) => e.name === payload.value);
                    return (
                      <g transform={`translate(${x},${y})`}>
                        <text x={0} y={0} dy={16} textAnchor="middle" fill="#374151" fontSize={11} fontWeight="600">
                          {payload.value}
                        </text>
                        <text x={0} y={0} dy={32} textAnchor="middle" fill="#4f46e5" fontSize={10} fontWeight="700">
                          ${empData?.revenue.toFixed(2)}
                        </text>
                        <text x={0} y={0} dy={46} textAnchor="middle" fill="#9CA3AF" fontSize={9}>
                          {empData?.salesCount || 0} sales
                        </text>
                      </g>
                    );
                  }}
                />
                <YAxis />
                <Tooltip 
                  formatter={(value: number) => [`$${value.toFixed(2)}`, 'Revenue']}
                  labelFormatter={(label: string) => {
                    const empData = stats.byEmployee.find((e: any) => e.name === label);
                    return `${label} (${empData?.salesCount || 0} sales)`;
                  }}
                />
                <Bar dataKey="revenue" fill="#4f46e5" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-3 border-t border-gray-100 pt-6">
            {stats.byEmployee.sort((a: any, b: any) => b.revenue - a.revenue).map((emp: any) => (
              <div key={emp.name} className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-indigo-600"></div>
                  <span className="text-sm font-medium text-gray-700">{emp.name}</span>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-gray-900">${emp.revenue.toFixed(2)}</p>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider">{emp.salesCount} sales</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <h4 className="font-bold text-gray-900 mb-6">Revenue by Category</h4>
          <div className="h-64 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.byCategory.filter((c: any) => c.name !== 'Total')}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {stats.byCategory.filter((c: any) => c.name !== 'Total').map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2 ml-4">
              {stats.byCategory.map((c, i) => (
                <div key={c.name} className={`flex items-center gap-2 ${c.name === 'Total' ? 'pt-2 border-t border-gray-100 mt-2 font-bold' : ''}`}>
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: c.name === 'Total' ? '#111827' : COLORS[i] }}></div>
                  <span className={`text-sm ${c.name === 'Total' ? 'text-gray-900' : 'text-gray-600'}`}>{c.name}: ${c.value.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* Detailed Table */}
      <Card>
        <div className="p-6 border-b border-gray-100">
          <h4 className="font-bold text-gray-900">Detailed Sales Report</h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                <th className="px-6 py-3 font-semibold">Date</th>
                <th className="px-6 py-3 font-semibold">Customer</th>
                <th className="px-6 py-3 font-semibold">Employee</th>
                <th className="px-6 py-3 font-semibold">Item</th>
                <th className="px-6 py-3 font-semibold">Type</th>
                <th className="px-6 py-3 font-semibold text-center">Qty</th>
                <th className="px-6 py-3 font-semibold text-right">Price</th>
                <th className="px-6 py-3 font-semibold text-right">Total</th>
                <th className="px-6 py-3 font-semibold text-right">Cost</th>
                <th className="px-6 py-3 font-semibold text-right">Profit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredSales.flatMap((s: any) => {
                const empName = employees.find((e: any) => e.id === s.employeeId)?.name || 'Unknown';
                return s.items.flatMap((item: any, itemIdx: number) => {
                  const itemPrice = item.price || 0;
                  const itemCost = item.cost || 0;
                  const itemQty = item.quantity || 0;
                  
                  const rows = [];
                  for (let i = 0; i < itemQty; i++) {
                    const itemTotal = itemPrice;
                    const itemUnitCost = itemCost;
                    const itemProfit = itemTotal - itemUnitCost;
                    
                    rows.push(
                      <tr key={`${s.id}-${itemIdx}-${i}`} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 text-sm text-gray-600">{format(parseISO(s.timestamp), 'MMM dd, HH:mm')}</td>
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{s.customerName || 'Walk-in'}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{empName}</td>
                        <td className="px-6 py-4 text-sm text-gray-900 font-medium">{item.name}</td>
                        <td className="px-6 py-4 text-sm text-gray-500 capitalize">{item.type}</td>
                        <td className="px-6 py-4 text-sm text-gray-600 text-center">1</td>
                        <td className="px-6 py-4 text-sm text-gray-600 text-right">${itemPrice.toFixed(2)}</td>
                        <td className="px-6 py-4 text-sm font-bold text-gray-900 text-right">${itemTotal.toFixed(2)}</td>
                        <td className="px-6 py-4 text-sm text-gray-400 text-right">${itemUnitCost.toFixed(2)}</td>
                        <td className="px-6 py-4 text-sm font-bold text-green-600 text-right">${itemProfit.toFixed(2)}</td>
                      </tr>
                    );
                  }
                  return rows;
                });
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function SalesHistory({ sales, employees, services, products, currentDay, isAdmin, showToast }: any) {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingSale, setEditingSale] = useState<any>(null);
  const [editCustomerName, setEditCustomerName] = useState('');
  const [editEmployeeId, setEditEmployeeId] = useState('');
  
  const [confirmDeleteModal, setConfirmDeleteModal] = useState<{ isOpen: boolean, sale: any | null }>({ isOpen: false, sale: null });
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteSale = async () => {
    const sale = confirmDeleteModal.sale;
    if (!sale) return;
    
    setIsDeleting(true);
    try {
      // Revert product quantities
      for (const item of sale.items) {
        if (item.type === 'product') {
          const productRef = doc(db, 'products', item.id);
          const currentProduct = products.find((p: any) => p.id === item.id);
          if (currentProduct) {
            await updateDoc(productRef, {
              quantity: currentProduct.quantity + item.quantity
            });
          }
        }
      }

      await deleteDoc(doc(db, 'sales', sale.id));
      showToast('Invoice deleted successfully.');
      setConfirmDeleteModal({ isOpen: false, sale: null });
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'sales');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEditSale = (sale: any) => {
    if (!isAdmin) return showToast('Only the owner can edit invoices.', 'error');
    setEditingSale(sale);
    setEditCustomerName(sale.customerName || '');
    setEditEmployeeId(sale.employeeId);
    setIsEditModalOpen(true);
  };

  const saveEdit = async () => {
    try {
      await updateDoc(doc(db, 'sales', editingSale.id), {
        customerName: editCustomerName,
        employeeId: editEmployeeId
      });
      setIsEditModalOpen(false);
      setEditingSale(null);
      showToast('Invoice updated successfully.');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'sales');
    }
  };

  return (
    <div className="space-y-8">
      <h3 className="text-2xl font-bold text-gray-900">Sales History</h3>
      
      <Card>
        <div className="p-6 border-b border-gray-100">
          <h4 className="font-bold text-gray-900">Recent Invoices</h4>
          <p className="text-sm text-gray-500">Only the owner can edit or delete invoices before the end of the day.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                <th className="px-6 py-3 font-semibold">Date</th>
                <th className="px-6 py-3 font-semibold">Customer</th>
                <th className="px-6 py-3 font-semibold">Employee</th>
                <th className="px-6 py-3 font-semibold">Items</th>
                <th className="px-6 py-3 font-semibold">Total</th>
                <th className="px-6 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sales.sort((a: any, b: any) => b.timestamp.localeCompare(a.timestamp)).map((sale: any) => {
                const isEditable = currentDay && sale.dayId === currentDay.id;
                return (
                  <tr key={sale.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-sm text-gray-600">{format(parseISO(sale.timestamp), 'MMM dd, HH:mm')}</td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{sale.customerName || 'Walk-in'}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{employees.find((e: any) => e.id === sale.employeeId)?.name || 'Unknown'}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {sale.items.map((i: any) => `${i.name} (x${i.quantity})`).join(', ')}
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-gray-900">${sale.totalAmount.toFixed(2)}</td>
                    <td className="px-6 py-4 text-right space-x-2">
                      {isAdmin && (
                        <>
                          <button onClick={() => handleEditSale(sale)} className="text-indigo-600 hover:text-indigo-800 text-sm font-medium">Edit</button>
                          <button onClick={() => setConfirmDeleteModal({ isOpen: true, sale })} className="text-red-600 hover:text-red-800 text-sm font-medium">Delete</button>
                          {!isEditable && <span className="text-[10px] text-amber-600 font-medium block">Closed Day</span>}
                        </>
                      )}
                      {!isAdmin && !isEditable && <span className="text-xs text-gray-400 italic">Day Closed</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal
        isOpen={confirmDeleteModal.isOpen}
        onClose={() => !isDeleting && setConfirmDeleteModal({ isOpen: false, sale: null })}
        title="Confirm Delete Invoice"
      >
        <div className="space-y-4">
          <div className="p-4 bg-red-50 rounded-lg border border-red-100">
            <p className="text-sm text-red-800 font-medium">
              {confirmDeleteModal.sale && (!currentDay || confirmDeleteModal.sale.dayId !== currentDay.id)
                ? 'This invoice is from a closed business day. Deleting it will change past reports and revert product quantities. Are you sure you want to proceed?'
                : 'Are you sure you want to delete this invoice? This will revert product quantities.'}
            </p>
          </div>
          <div className="flex gap-3">
            <Button 
              variant="ghost" 
              className="flex-1" 
              onClick={() => setConfirmDeleteModal({ isOpen: false, sale: null })}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button 
              variant="danger" 
              className="flex-1 bg-red-600 hover:bg-red-700" 
              onClick={handleDeleteSale}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Confirm Delete'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Edit Invoice">
        <div className="space-y-4">
          <Input label="Customer Name" value={editCustomerName} onChange={(e: any) => setEditCustomerName(e.target.value)} />
          <Select label="Employee" options={employees} value={editEmployeeId} onChange={(e: any) => setEditEmployeeId(e.target.value)} />
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-xs font-bold text-gray-500 uppercase mb-2">Items (Read-only)</p>
            <ul className="text-sm space-y-1">
              {editingSale?.items.map((i: any) => (
                <li key={i.id} className="flex justify-between">
                  <span>{i.name} x {i.quantity}</span>
                  <span className="font-medium">${(i.price * i.quantity).toFixed(2)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-3 pt-3 border-t border-gray-200 flex justify-between font-bold">
              <span>Total</span>
              <span>${editingSale?.totalAmount.toFixed(2)}</span>
            </div>
          </div>
          <Button onClick={saveEdit} className="w-full">Save Changes</Button>
        </div>
      </Modal>
    </div>
  );
}

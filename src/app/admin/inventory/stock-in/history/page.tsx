'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import styles from '../../../../admin/admin.module.css';
import { Search, Filter, ArrowLeft, Download, Printer, ChevronDown, ChevronUp } from 'lucide-react';
import { format } from 'date-fns';

export default function StockInHistoryPage() {
  const router = useRouter();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const limit = 7;
  const [total, setTotal] = useState(0);

  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: ((page - 1) * limit).toString(),
        search,
        startDate: dateRange.start,
        endDate: dateRange.end
      });
      
      const res = await fetch(`/api/inventory/stock-in/history?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` }
      });
      const result = await res.json();
      if (res.ok) {
        setData(result.data || []);
        setTotal(result.pagination?.total || 0);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [page, search, dateRange]);

  const toggleRow = (referenceNumber: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(referenceNumber)) {
      newExpanded.delete(referenceNumber);
    } else {
      newExpanded.add(referenceNumber);
    }
    setExpandedRows(newExpanded);
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div>
            <ArrowLeft size={16} /> Back to Inventory
          </button>
          <h1>Stock In History</h1>
          <p>View all bulk stock-in transactions and their details</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className={styles.btnSecondary} onClick={() => window.print()}>
            <Printer size={18} /> Print
          </button>
          <button className={styles.btnSecondary} onClick={() => alert('Exporting to Excel/PDF...')}>
            <Download size={18} /> Export
          </button>
        </div>
      </div>

      <div className={styles.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', gap: '16px', flexWrap: 'wrap' }}>
          <div className={styles.searchBar} style={{ flex: 1, minWidth: '250px' }}>
            <Search size={18} color="#64748b" />
            <input 
              type="text" 
              placeholder="Search by Reference No. or Supplier..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <input 
              type="date" 
              className={styles.inputField} 
              style={{ padding: '8px 12px', width: 'auto' }}
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
            />
            <span style={{ display: 'flex', alignItems: 'center', color: '#64748b' }}>to</span>
            <input 
              type="date" 
              className={styles.inputField} 
              style={{ padding: '8px 12px', width: 'auto' }}
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
            />
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th style={{ width: '40px' }}></th>
                <th>Reference No.</th>
                <th>Date & Time</th>
                <th>Total Products</th>
                <th>Total Quantity Added</th>
                <th>Employee</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '32px' }}>Loading...</td></tr>
              ) : data.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '32px' }}>No stock in records found.</td></tr>
              ) : (
                data.map((transaction) => (
                  <React.Fragment key={transaction.referenceNumber}>
                    <tr 
                      onClick={() => toggleRow(transaction.referenceNumber)}
                      style={{ cursor: 'pointer', backgroundColor: expandedRows.has(transaction.referenceNumber) ? '#f8fafc' : 'white' }}
                    >
                      <td>
                        {expandedRows.has(transaction.referenceNumber) ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                      </td>
                      <td style={{ fontWeight: 600, color: '#334155' }}>{transaction.referenceNumber}</td>
                      <td>{format(new Date(transaction.createdAt), 'MMM dd, yyyy h:mm a')}</td>
                      <td style={{ fontWeight: 500 }}>{transaction.totalProducts} items</td>
                      <td style={{ fontWeight: 700, color: '#16a34a' }}>+{transaction.totalQuantity}</td>
                      <td>{transaction.employeeName || 'System'}</td>
                      <td>
                        <span className={styles.badge} style={{ backgroundColor: '#dcfce7', color: '#166534' }}>
                          {transaction.status}
                        </span>
                      </td>
                    </tr>
                    {expandedRows.has(transaction.referenceNumber) && (
                      <tr>
                        <td colSpan={7} style={{ padding: 0, backgroundColor: '#f8fafc' }}>
                          <div style={{ padding: '16px 40px', borderBottom: '1px solid #e2e8f0' }}>
                            <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#475569' }}>Products in this transaction:</h4>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                              <thead>
                                <tr style={{ color: '#64748b', textAlign: 'left', borderBottom: '1px solid #cbd5e1' }}>
                                  <th style={{ padding: '8px' }}>Product</th>
                                  <th style={{ padding: '8px' }}>Category</th>
                                  <th style={{ padding: '8px' }}>Quantity Added</th>
                                  <th style={{ padding: '8px' }}>Unit Cost</th>
                                  <th style={{ padding: '8px' }}>Supplier</th>
                                  <th style={{ padding: '8px' }}>Remarks</th>
                                </tr>
                              </thead>
                              <tbody>
                                {transaction.items.map((item: any) => (
                                  <tr key={item.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                    <td style={{ padding: '8px', fontWeight: 500 }}>{item.productName}</td>
                                    <td style={{ padding: '8px', color: '#64748b' }}>{item.category}</td>
                                    <td style={{ padding: '8px', fontWeight: 600, color: '#16a34a' }}>+{item.quantity}</td>
                                    <td style={{ padding: '8px' }}>{item.unitCost ? `₱${Number(item.unitCost).toFixed(2)}` : '-'}</td>
                                    <td style={{ padding: '8px' }}>{item.supplier || '-'}</td>
                                    <td style={{ padding: '8px', color: '#64748b' }}>{item.notes || '-'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Standard Pagination */}
        {totalPages > 1 && (
          <div className={styles.pagination}>
            <button disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button>
            <span>Page {page} of {totalPages}</span>
            <button disabled={page === totalPages} onClick={() => setPage(page + 1)}>Next</button>
          </div>
        )}
      </div>
    </div>
  );
}

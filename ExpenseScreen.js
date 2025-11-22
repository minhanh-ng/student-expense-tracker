import React, { useEffect, useState } from 'react';
import { useMemo } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  Button,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';

export default function ExpenseScreen() {
  const db = useSQLiteContext();

  const [expenses, setExpenses] = useState([]);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState('');
  const [filter, setFilter] = useState('all'); // 'all' | 'week' | 'month'

    const loadExpenses = async () => {
    const rows = await db.getAllAsync(
      'SELECT * FROM expenses ORDER BY id DESC;'
    );
      setExpenses(rows);
  };

    

  const isSameWeek = (isoDate, ref = new Date()) => {
      if (!isoDate) return false;
      const d = new Date(isoDate);
      const a = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const b = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
      // week starts on Sunday
      const startA = new Date(a);
      startA.setDate(a.getDate() - a.getDay());
      const startB = new Date(b);
      startB.setDate(b.getDate() - b.getDay());
      return startA.getTime() === startB.getTime();
    };

    const isSameMonth = (isoDate, ref = new Date()) => {
      if (!isoDate) return false;
      const d = new Date(isoDate);
      return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth();
    };
    const applyFilter = (rows) => {
      if (!rows) return [];
      if (filter === 'all') return rows;
      if (filter === 'week') return rows.filter(r => isSameWeek(r.date));
      if (filter === 'month') return rows.filter(r => isSameMonth(r.date));
      return rows;
    };

    const visibleExpenses = useMemo(() => applyFilter(expenses), [expenses, filter]);
    const totalVisible = useMemo(() => {
      return visibleExpenses.reduce((s, r) => s + Number(r.amount || 0), 0);
    }, [visibleExpenses]);

    const totalsByCategory = useMemo(() => {
      const map = {};
      for (const r of visibleExpenses) {
        const cat = (r.category || 'Uncategorized').trim() || 'Uncategorized';
        const amt = Number(r.amount || 0);
        map[cat] = (map[cat] || 0) + amt;
      }
      // convert to array sorted by amount desc
      return Object.entries(map).map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount);
    }, [visibleExpenses]);

  const addExpense = async () => {
    const amountNumber = parseFloat(amount);

    if (isNaN(amountNumber) || amountNumber <= 0) {
      // Basic validation: ignore invalid or non-positive amounts
      return;
    }

    const trimmedCategory = category.trim();
  const trimmedNote = note.trim();
  const trimmedDate = date.trim();

    if (!trimmedCategory) {
      // Category is required
      return;
    }

    const dateValue = trimmedDate || new Date().toISOString().slice(0, 10);

    await db.runAsync(
      'INSERT INTO expenses (amount, category, note, date) VALUES (?, ?, ?, ?);',
      [amountNumber, trimmedCategory, trimmedNote || null, dateValue]
    );

    setAmount('');
    setCategory('');
  setNote('');
  setDate('');

    loadExpenses();
  };

    const deleteExpense = async (id) => {
    await db.runAsync('DELETE FROM expenses WHERE id = ?;', [id]);
    loadExpenses();
  };

  const renderExpense = ({ item }) => (
    <View style={styles.expenseRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.expenseAmount}>${Number(item.amount).toFixed(2)}</Text>
    <Text style={styles.expenseCategory}>{item.category}{item.date ? ` · ${item.date}` : ''}</Text>
    {item.note ? <Text style={styles.expenseNote}>{item.note}</Text> : null}
      </View>

      <TouchableOpacity onPress={() => deleteExpense(item.id)}>
        <Text style={styles.delete}>✕</Text>
      </TouchableOpacity>
    </View>
  );

    useEffect(() => {
    async function setup() {
      // Ensure table includes 'date' for new installs
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS expenses (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          amount REAL NOT NULL,
          category TEXT NOT NULL,
          note TEXT,
          date TEXT NOT NULL
        );
      `);

      // For existing databases, check schema and add 'date' column if missing
      try {
        const cols = await db.getAllAsync("PRAGMA table_info(expenses);");
        const hasDate = Array.isArray(cols) && cols.some(c => c.name === 'date');
        if (!hasDate) {
          await db.execAsync('ALTER TABLE expenses ADD COLUMN date TEXT;');
          const today = new Date().toISOString().slice(0, 10);
          await db.runAsync('UPDATE expenses SET date = ? WHERE date IS NULL OR date = "";', [today]);
        }
      } catch (err) {
        // ALTER may not be supported in some environments or may fail — it's safe to continue
        console.warn('schema migration check failed', err);
      }

      await loadExpenses();
    }

    setup();
  }, []);

    return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.heading}>Student Expense Tracker</Text>

      <View style={styles.filterRow}>
        <TouchableOpacity style={[styles.filterButton, filter === 'all' && styles.filterActive]} onPress={() => setFilter('all')}>
          <Text style={styles.filterText}>All</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.filterButton, filter === 'week' && styles.filterActive]} onPress={() => setFilter('week')}>
          <Text style={styles.filterText}>This Week</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.filterButton, filter === 'month' && styles.filterActive]} onPress={() => setFilter('month')}>
          <Text style={styles.filterText}>This Month</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Amount (e.g. 12.50)"
          placeholderTextColor="#9ca3af"
          keyboardType="numeric"
          value={amount}
          onChangeText={setAmount}
        />
        <TextInput
          style={styles.input}
          placeholder="Category (Food, Books, Rent...)"
          placeholderTextColor="#9ca3af"
          value={category}
          onChangeText={setCategory}
        />
        <TextInput
          style={styles.input}
          placeholder="Note (optional)"
          placeholderTextColor="#9ca3af"
          value={note}
          onChangeText={setNote}
        />
        <TextInput
          style={styles.input}
          placeholder="Date (YYYY-MM-DD) — leave empty for today"
          placeholderTextColor="#9ca3af"
          
          value={date}
          onChangeText={setDate}
        />

        <Button title="Add Expense" onPress={addExpense} />
      </View>

      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Total</Text>
        <Text style={styles.totalAmount}>${totalVisible.toFixed(2)}</Text>
      </View>

      {totalsByCategory.length > 0 && (
        <View style={styles.categoryTotals}>
          <Text style={styles.categoryHeader}>Category {filter === 'all' ? '(All)' : filter === 'week' ? '(This Week)' : '(This Month)'}:</Text>
          {totalsByCategory.map((t) => (
            <Text key={t.category} style={styles.categoryBullet}>• {t.category}: ${t.amount.toFixed(2)}</Text>
          ))}
        </View>
      )}

      <FlatList
        data={visibleExpenses}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderExpense}
        ListEmptyComponent={
          <Text style={styles.empty}>No expenses yet.</Text>
        }
      />

      <Text style={styles.footer}>
        Enter your expenses and they’ll be saved locally with SQLite.
      </Text>
    </SafeAreaView>
  );
}

  const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#111827' },
  heading: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 16,
  },
  filterRow: {
    flexDirection: 'row',
    marginBottom: 12,
    gap: 8,
  },
  filterButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#1f2937',
    borderRadius: 8,
  },
  filterActive: {
    backgroundColor: '#374151',
  },
  filterText: {
    color: '#e5e7eb',
    fontWeight: '600',
  },
  form: {
    marginBottom: 16,
    gap: 8,
  },
  input: {
    padding: 10,
    backgroundColor: '#1f2937',
    color: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#374151',
  },
  expenseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f2937',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  expenseAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fbbf24',
  },
  expenseCategory: {
    fontSize: 14,
    color: '#e5e7eb',
  },
  expenseNote: {
    fontSize: 12,
    color: '#9ca3af',
  },
  delete: {
    color: '#f87171',
    fontSize: 20,
    marginLeft: 12,
  },
  empty: {
    color: '#9ca3af',
    marginTop: 24,
    textAlign: 'center',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#0f172a',
    borderRadius: 8,
    marginBottom: 8,
  },
  totalLabel: {
    color: '#9ca3af',
    fontWeight: '600',
  },
  totalAmount: {
    color: '#fbbf24',
    fontWeight: '700',
  },
  categoryTotals: {
    marginBottom: 8,
    padding: 8,
    backgroundColor: '#0b1220',
    borderRadius: 8,
  },
  categoryHeader: {
    color: '#e5e7eb',
    fontWeight: '700',
    marginBottom: 6,
  },
  categoryBullet: {
    color: '#e5e7eb',
    marginLeft: 4,
    marginBottom: 4,
  },
  categoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  categoryName: {
    color: '#e5e7eb',
    fontSize: 13,
  },
  categoryAmount: {
    color: '#fbbf24',
    fontWeight: '600',
    fontSize: 13,
  },
  footer: {
    textAlign: 'center',
    color: '#6b7280',
    marginTop: 12,
    fontSize: 12,
  },
});

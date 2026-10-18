import { useEffect, useMemo, useState } from 'react';

import type { CSSProperties, FormEvent } from 'react';

import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth';

import {

  addDoc, collection, doc, onSnapshot, orderBy,
  query, serverTimestamp, setDoc, where

} from 'firebase/firestore';

import { auth, db } from './firebase';



const OWNER_UID = '39yo5nWQS0ZwmAKMfHyHfdLSjo83';



type MenuItem = {

  id: string;

  name: string;

  description: string;

  category: string;

  price: number;

  image: string;

  active: boolean;

};



type OrderItem = {

  id: string;

  name: string;

  qty: number;

  price: number;

  subtotal: number;

};



type Order = {

  id: string;

  number: string;

  customer: string;

  type: 'Kedai' | 'Online';

  payment: 'Tunai' | 'QRIS';

  items: OrderItem[];

  total: number;

  cashierUid: string;

  createdAt?: { toDate?: () => Date } | null;

  status?: string;

};



const initialMenu = [

  { id: 'nasi-ayam', name: 'Nasi Ayam Indonesia', description: 'Nasi dan ayam berbumbu', category: 'Makanan', price: 15000, image: '', active: true },

  { id: 'nasi-goreng', name: 'Nasi Goreng Nusantara', description: 'Nasi goreng gurih', category: 'Makanan', price: 14000, image: '', active: true },

  { id: 'mie-goreng', name: 'Mie Goreng Rasa', description: 'Mie goreng pilihan', category: 'Makanan', price: 12000, image: '', active: true },

  { id: 'pisang-goreng', name: 'Pisang Goreng', description: 'Camilan pisang renyah', category: 'Makanan', price: 8000, image: '', active: true },

  { id: 'es-teh', name: 'Es Teh Manis', description: 'Minuman teh dingin', category: 'Minuman', price: 5000, image: '', active: true },

  { id: 'kopi-susu', name: 'Kopi Susu', description: 'Kopi susu nikmat', category: 'Minuman', price: 10000, image: '', active: true },

];



const money = (n: number) =>

  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);



const panel: CSSProperties = {

  background: '#fff', borderRadius: 14, padding: 16,

  boxShadow: '0 2px 8px #0000000d', marginBottom: 16,

};

const field: CSSProperties = {

  display: 'block', width: '100%', boxSizing: 'border-box',

  padding: 11, border: '1px solid #d1d5db', borderRadius: 8,

  marginTop: 5, marginBottom: 12, fontSize: 15,

};

const btn: CSSProperties = {

  padding: '10px 13px', border: 0, borderRadius: 8,

  background: '#166534', color: '#fff', fontWeight: 600,

  cursor: 'pointer',

};



function dateOf(order: Order): Date {

  try {

    if (order.createdAt?.toDate) return order.createdAt.toDate();

  } catch {}

  return new Date(0);

}



function periodStart(period: string): Date {

  const d = new Date();

  d.setHours(0, 0, 0, 0);

  if (period === 'day') return d;

  if (period === 'week') {

    const day = (d.getDay() + 6) % 7;

    d.setDate(d.getDate() - day);

    return d;

  }

  d.setDate(1);

  return d;

}



export default function App() {

  const [user, setUser] = useState<User | null>(null);

  const [authLoading, setAuthLoading] = useState(true);

  const [email, setEmail] = useState('');

  const [password, setPassword] = useState('');

  const [loginError, setLoginError] = useState('');

  const [loginBusy, setLoginBusy] = useState(false);



  const [menus, setMenus] = useState<MenuItem[]>([]);

  const [orders, setOrders] = useState<Order[]>([]);

  const [cart, setCart] = useState<Record<string, number>>({});

  const [customer, setCustomer] = useState('');

  const [orderType, setOrderType] = useState<'Kedai' | 'Online'>('Kedai');

  const [payment, setPayment] = useState<'Tunai' | 'QRIS'>('Tunai');

  const [page, setPage] = useState<'kasir' | 'menu' | 'riwayat' | 'pembukuan'>('kasir');

  const [message, setMessage] = useState('');

  const [saving, setSaving] = useState(false);

  const [editing, setEditing] = useState<MenuItem | null>(null);

  const [menuName, setMenuName] = useState('');

  const [menuDescription, setMenuDescription] = useState('');

  const [menuCategory, setMenuCategory] = useState('Makanan');

  const [menuPrice, setMenuPrice] = useState('');

  const [menuImage, setMenuImage] = useState('');

  const [reportPeriod, setReportPeriod] = useState('day');

  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);



  const isOwner = user?.uid === OWNER_UID;

  console.log('UID login:', user?.uid, 'UID pemilik:', OWNER_UID, 'Admin:', isOwner);



  useEffect(() => onAuthStateChanged(auth, u => {

    setUser(u);

    setAuthLoading(false);

  }), []);



  useEffect(() => {

    if (!user) {

      setMenus([]);

      setOrders([]);

      return;

    }



    const stopMenus = onSnapshot(

      query(collection(db, 'menus')),

      async snapshot => {

        if (snapshot.empty && user.uid === OWNER_UID) {

          for (const item of initialMenu) {

            await setDoc(doc(db, 'menus', item.id), item);

          }

          return;

        }

        setMenus(snapshot.docs.map(d => ({ ...d.data(), id: d.id } as MenuItem))

          .sort((a, b) => a.name.localeCompare(b.name)));

      },

      error => {

        console.error(error);

        setMessage('Menu tidak bisa dibaca. Periksa Firestore Rules.');

      }

    );



    const ordersQuery = isOwner

      ? query(collection(db, 'orders'), orderBy('createdAt', 'desc'))

      : query(collection(db, 'orders'), where('cashierUid', '==', user.uid));



    const stopOrders = onSnapshot(

      ordersQuery,

      snapshot => {

        setOrders(snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Order))

          .sort((a, b) => dateOf(b).getTime() - dateOf(a).getTime()));

      },

      error => {

        console.error(error);

        setMessage('Riwayat belum bisa dibaca. Periksa koneksi dan Rules.');

      }

    );



    return () => {

      stopMenus();

      stopOrders();

    };

  }, [user, isOwner]);



  const activeMenus = menus.filter(m => m.active !== false);

  const total = activeMenus.reduce((sum, m) => sum + m.price * (cart[m.id] || 0), 0);

  const itemCount = Object.values(cart).reduce((a, b) => a + b, 0);



  const reportOrders = useMemo(() => {

    const start = periodStart(reportPeriod).getTime();

    return orders.filter(o => {

      const t = dateOf(o).getTime();

      return t >= start && t <= Date.now();

    });

  }, [orders, reportPeriod]);



  const omzet = reportOrders.reduce((s, o) => s + Number(o.total || 0), 0);

  const cashTotal = reportOrders.filter(o => o.payment === 'Tunai')

    .reduce((s, o) => s + Number(o.total || 0), 0);

  const qrisTotal = reportOrders.filter(o => o.payment === 'QRIS')

    .reduce((s, o) => s + Number(o.total || 0), 0);



  async function login(e: FormEvent) {

    e.preventDefault();

    setLoginBusy(true);

    setLoginError('');

    try {

      await signInWithEmailAndPassword(auth, email.trim(), password);

    } catch (err) {

      console.error(err);

      setLoginError('Login gagal. Periksa email dan password.');

    } finally {

      setLoginBusy(false);

    }

  }



  function startEdit(m?: MenuItem) {

    const item = m || {

      id: '', name: '', description: '', category: 'Makanan',

      price: 0, image: '', active: true,

    };

    setEditing(item);

    setMenuName(item.name);

    setMenuDescription(item.description);

    setMenuCategory(item.category || 'Makanan');

    setMenuPrice(item.price ? String(item.price) : '');

    setMenuImage(item.image || '');

    setMessage('');

  }



  async function chooseImage(file?: File) {

    if (!file) return;

    if (!file.type.startsWith('image/')) {

      setMessage('Pilih file gambar.');

      return;

    }

    if (file.size > 500 * 1024) {

      setMessage('Ukuran gambar maksimal 500 KB untuk penyimpanan sementara ini.');

      return;

    }

    const reader = new FileReader();

    reader.onload = () => setMenuImage(String(reader.result || ''));

    reader.onerror = () => setMessage('Gambar gagal dibaca.');

    reader.readAsDataURL(file);

  }



  async function saveMenu(e: FormEvent) {

    e.preventDefault();

    if (!isOwner) return;

    const price = Number(menuPrice);

    if (!menuName.trim() || !Number.isFinite(price) || price <= 0) {

      setMessage('Isi nama menu dan harga yang benar.');

      return;

    }

    const id = editing?.id || `menu-${Date.now()}`;

    const item: MenuItem = {

      id,

      name: menuName.trim(),

      description: menuDescription.trim(),

      category: menuCategory,

      price,

      image: menuImage,

      active: editing?.active !== false,

    };

    try {

      await setDoc(doc(db, 'menus', id), item);

      setEditing(null);

      setMessage('Menu berhasil disimpan.');

    } catch (err) {

      console.error(err);

      setMessage('Gagal menyimpan menu. Periksa akses admin dan Firestore Rules.');

    }

  }



  async function toggleMenu(item: MenuItem) {

    if (!isOwner) return;

    try {

      await setDoc(doc(db, 'menus', item.id), { ...item, active: item.active === false });

      setMessage(item.active === false ? 'Menu diaktifkan.' : 'Menu dinonaktifkan.');

    } catch (err) {

      console.error(err);

      setMessage('Gagal mengubah status menu.');

    }

  }



  async function checkout() {

    if (!user || !itemCount || saving) return;

    const items: OrderItem[] = activeMenus.filter(m => cart[m.id] > 0).map(m => ({

      id: m.id, name: m.name, qty: cart[m.id], price: m.price,

      subtotal: m.price * cart[m.id],

    }));

    const number = `LR-${Date.now().toString().slice(-6)}`;

    setSaving(true);

    setMessage('');

    try {

      await addDoc(collection(db, 'orders'), {

        number,

        customer: customer.trim() || 'Pelanggan',

        type: orderType,

        payment,

        items,

        total,

        status: 'Baru',

        cashierUid: user.uid,

        createdAt: serverTimestamp(),

      });

      setCart({});

      setCustomer('');

      setOrderType('Kedai');

      setPayment('Tunai');

      setMessage(`Pesanan ${number} berhasil disimpan online.`);

    } catch (err) {

      console.error(err);

      setMessage('Pesanan gagal disimpan. Periksa Firestore Rules dan koneksi.');

    } finally {

      setSaving(false);

    }

  }



  function printReceipt(order: Order) {

    setSelectedOrder(order);

    setTimeout(() => window.print(), 150);

  }



  if (authLoading) return <main style={{ padding: 30 }}>Memeriksa login Loop rasA...</main>;



  if (!user) return (

    <main style={{ ...pageStyle, display: 'grid', placeItems: 'center' }}>

      <form onSubmit={login} style={{ ...panel, width: 'min(360px, 85vw)' }}>

        <h1 style={{ textAlign: 'center' }}>🍜 Loop rasA</h1>

        <p style={{ textAlign: 'center', color: '#6b7280' }}>Login Kasir / Pemilik</p>

        <label>Email<input style={field} type="email" required value={email} onChange={e => setEmail(e.target.value)} /></label>

        <label>Password<input style={field} type="password" required value={password} onChange={e => setPassword(e.target.value)} /></label>

        {loginError && <p style={{ color: '#b91c1c' }}>{loginError}</p>}

        <button style={{ ...btn, width: '100%' }} disabled={loginBusy}>{loginBusy ? 'Login...' : 'Login'}</button>

      </form>

    </main>

  );



  return (

    <main style={pageStyle}>

      <style>{`
        * { box-sizing: border-box; }
        button:disabled { opacity: .5; }

        @page {
          size: 58mm auto;
          margin: 0;
        }

        @media print {
          html, body {
            width: 58mm !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
          }

          body * {
            visibility: hidden !important;
          }

          #receipt,
          #receipt * {
            visibility: visible !important;
          }

          #receipt {
            display: block !important;
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 58mm !important;
            max-width: 58mm !important;
            margin: 0 !important;
            padding: 2mm !important;
            box-sizing: border-box !important;
            color: #000 !important;
            background: #fff !important;
            font-family: monospace !important;
            font-size: 10px !important;
            line-height: 1.35 !important;
            overflow-wrap: anywhere;
            word-break: normal;
          }

          #receipt img {
            max-width: 100% !important;
          }

          .no-print {
            display: none !important;
          }
        }
      `}</style>



      <header className="no-print" style={headerStyle}>

        <div>

          <small>INDONESIA FOOD</small>

          <h1 style={{ margin: '3px 0' }}>Loop rasA</h1>

          <small>{isOwner ? 'Pemilik / Admin' : 'Kasir'} · {user.email}</small>

        </div>

        <button style={{ ...btn, background: '#fff', color: '#166534' }} onClick={() => signOut(auth)}>Keluar</button>

      </header>



      <nav className="no-print" style={navStyle}>

        {([

          ['kasir', 'Kasir'],

          ...(isOwner ? [['menu', 'Kelola Menu']] : []),

          ['riwayat', 'Riwayat Pesanan'],

          ['pembukuan', 'Pembukuan'],

        ] as string[][]).map(([id, label]) => (

          <button key={id} style={{ ...btn, background: page === id ? '#166534' : '#e5e7eb', color: page === id ? '#fff' : '#1f2937' }} onClick={() => setPage(id as typeof page)}>{label}</button>

        ))}

      </nav>



      <section className="no-print" style={{ maxWidth: 1100, margin: '0 auto', padding: 16 }}>

        {message && <div role="status" style={{ ...panel, background: '#ecfdf5', color: '#166534' }}>{message}</div>}



        {page === 'kasir' && <>

          <h2>Menu</h2>

          <div style={gridStyle}>

            {activeMenus.map(m => (

              <article key={m.id} style={cardStyle}>

                {m.image ? <img src={m.image} alt={m.name} style={imageStyle} /> : <div style={placeholderImage}>{m.category === 'Minuman' ? '🥤' : '🍽️'}</div>}

                <h3>{m.name}</h3>

                <p style={{ color: '#6b7280', fontSize: 13 }}>{m.description}</p>

                <strong>{money(m.price)}</strong>

                <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 12 }}>

                  <button style={btnSecondary} onClick={() => setCart(c => ({ ...c, [m.id]: Math.max(0, (c[m.id] || 0) - 1) }))}>−</button>

                  <b>{cart[m.id] || 0}</b>

                  <button style={btn} onClick={() => setCart(c => ({ ...c, [m.id]: (c[m.id] || 0) + 1 }))}>+</button>

                </div>

              </article>

            ))}

          </div>



          <div style={panel}>

            <h2>Detail Pesanan</h2>

            <label>Nama pelanggan<input style={field} value={customer} onChange={e => setCustomer(e.target.value)} placeholder="Opsional" /></label>

            <label>Jenis pesanan<select style={field} value={orderType} onChange={e => setOrderType(e.target.value as 'Kedai' | 'Online')}><option>Kedai</option><option>Online</option></select></label>

            <label>Pembayaran<select style={field} value={payment} onChange={e => setPayment(e.target.value as 'Tunai' | 'QRIS')}><option>Tunai</option><option>QRIS</option></select></label>

            {activeMenus.filter(m => cart[m.id] > 0).map(m => <p key={m.id}>{m.name} × {cart[m.id]} — {money(m.price * cart[m.id])}</p>)}

            <h2>Total: {money(total)}</h2>

            <button style={{ ...btn, width: '100%' }} disabled={!itemCount || saving} onClick={checkout}>{saving ? 'Menyimpan...' : 'Simpan Pesanan'}</button>

          </div>

        </>}



        {page === 'menu' && isOwner && <>

          <h2>Kelola Menu</h2>

          <button style={btn} onClick={() => startEdit()}>+ Tambah Menu</button>

          {editing && <form onSubmit={saveMenu} style={{ ...panel, marginTop: 16 }}>

            <h3>{editing.id ? 'Edit Menu' : 'Menu Baru'}</h3>

            <label>Nama menu<input style={field} required value={menuName} onChange={e => setMenuName(e.target.value)} /></label>

            <label>Deskripsi<input style={field} value={menuDescription} onChange={e => setMenuDescription(e.target.value)} /></label>

            <label>Kategori<select style={field} value={menuCategory} onChange={e => setMenuCategory(e.target.value)}><option>Makanan</option><option>Minuman</option></select></label>

            <label>Harga (Rp)<input style={field} type="number" min="1" required value={menuPrice} onChange={e => setMenuPrice(e.target.value)} /></label>

            <label>Foto menu (maksimal 500 KB)

              <input style={field} type="file" accept="image/*" onChange={e => chooseImage(e.target.files?.[0])} />

            </label>

            {menuImage && <img src={menuImage} alt="Pratinjau menu" style={{ width: 150, maxWidth: '100%', borderRadius: 8 }} />}

            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>

              <button style={btn} type="submit">Simpan Menu</button>

              <button style={btnSecondary} type="button" onClick={() => setEditing(null)}>Batal</button>

            </div>

          </form>}

          <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>

            {menus.map(m => <div key={m.id} style={{ ...panel, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>

              {m.image ? <img src={m.image} alt="" style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 8 }} /> : <span style={{ fontSize: 30 }}>🍽️</span>}

              <div style={{ flex: 1 }}><b>{m.name}</b><div>{money(m.price)} · {m.category} · {m.active === false ? 'Nonaktif' : 'Aktif'}</div></div>

              <button style={btn} onClick={() => startEdit(m)}>Edit</button>

              <button style={btnSecondary} onClick={() => toggleMenu(m)}>{m.active === false ? 'Aktifkan' : 'Nonaktifkan'}</button>

            </div>)}

          </div>

        </>}



        {page === 'riwayat' && <>

          <h2>Riwayat Pesanan</h2>

          {orders.length === 0 && <div style={panel}>Belum ada pesanan yang bisa ditampilkan.</div>}

          {orders.map(o => <article key={o.id} style={panel}>

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>

              <div><b>{o.number || o.id}</b><div>{dateOf(o).getTime() ? dateOf(o).toLocaleString('id-ID') : 'Waktu tidak tersedia'}</div></div>

              <strong>{money(o.total || 0)}</strong>

            </div>

            <p>{o.customer} · {o.type} · {o.payment}</p>

            {(o.items || []).map((item, i) => <div key={`${item.id}-${i}`}>{item.name} × {item.qty} — {money(item.subtotal)}</div>)}

            <button style={{ ...btn, marginTop: 12 }} onClick={() => printReceipt(o)}>Cetak Struk</button>

          </article>)}

        </>}



        {page === 'pembukuan' && <>

          <h2>Pembukuan</h2>

          <label>Periode rekap<select style={field} value={reportPeriod} onChange={e => setReportPeriod(e.target.value)}><option value="day">Harian (hari ini)</option><option value="week">Mingguan (mulai Senin)</option><option value="month">Bulanan (bulan ini)</option></select></label>

          <div style={gridStyle}>

            <div style={statCard}><small>Omzet</small><h2>{money(omzet)}</h2></div>

            <div style={statCard}><small>Transaksi</small><h2>{reportOrders.length}</h2></div>

            <div style={statCard}><small>Tunai</small><h2>{money(cashTotal)}</h2></div>

            <div style={statCard}><small>QRIS</small><h2>{money(qrisTotal)}</h2></div>

          </div>

          <p style={{ color: '#6b7280', fontSize: 13 }}>Rekap dihitung dari pesanan yang tersimpan di Firestore dan terlihat oleh akun ini.</p>

        </>}

      </section>



      {selectedOrder && <div id="receipt">

        <center>

          <b style={{ fontSize: 16 }}>Loop rasA</b><br />

          Indonesia Food<br />

          ------------------------------<br />

          <b>{selectedOrder.number}</b><br />

          {dateOf(selectedOrder).getTime() ? dateOf(selectedOrder).toLocaleString('id-ID') : ''}<br />

          Pelanggan: {selectedOrder.customer}<br />

          Jenis: {selectedOrder.type}<br />

          ------------------------------

        </center>

        {(selectedOrder.items || []).map((item, i) => <div key={i} style={{ margin: '6px 0' }}>

          <div>{item.name}</div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{item.qty} x {money(item.price)}</span><span>{money(item.subtotal)}</span></div>

        </div>)}

        <div>------------------------------</div>

        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}><span>TOTAL</span><span>{money(selectedOrder.total)}</span></div>

        <div>Pembayaran: {selectedOrder.payment}</div>

        <center>Terima kasih!</center>

      </div>}

    </main>

  );

}



const pageStyle: CSSProperties = { minHeight: '100vh', background: '#f3f4f6', color: '#1f2937', fontFamily: 'Arial,sans-serif' };

const headerStyle: CSSProperties = { background: '#166534', color: 'white', padding: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 };

const navStyle: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 8, padding: 12, background: '#fff' };

const gridStyle: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 14, margin: '14px 0' };

const cardStyle: CSSProperties = { background: '#fff', borderRadius: 12, padding: 14, boxShadow: '0 2px 8px #0000000d' };

const imageStyle: CSSProperties = { width: '100%', height: 130, objectFit: 'cover', borderRadius: 8 };

const placeholderImage: CSSProperties = { height: 100, background: '#dcfce7', display: 'grid', placeItems: 'center', borderRadius: 8, fontSize: 42 };

const btnSecondary: CSSProperties = { ...btn, background: '#e5e7eb', color: '#1f2937' };

const statCard: CSSProperties = { ...panel, margin: 0, borderTop: '4px solid #166534' };

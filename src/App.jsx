import { useEffect, useMemo, useState } from "react";
import {
  Barcode, Boxes, LayoutDashboard, LogOut, Package, RefreshCw,
  Search, ShieldCheck, ShoppingBag, Users
} from "lucide-react";
import { isSupabaseConfigured, supabase } from "./supabase";

const money = (v) => new Intl.NumberFormat("tr-TR", {
  style: "currency", currency: "TRY", maximumFractionDigits: 2
}).format(Number(v || 0));

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [tab, setTab] = useState("dashboard");
  const [products, setProducts] = useState([]);
  const [variants, setVariants] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setProfile(null);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session?.user) loadProfile();
  }, [session]);

  useEffect(() => {
    if (session?.user && profile) loadCatalog();
  }, [session, profile]);

  async function loadProfile() {
    const { data, error } = await supabase
      .from("profiles").select("full_name, role").eq("id", session.user.id).maybeSingle();
    if (error) setNotice("Profil okunamadı: " + error.message);
    else setProfile(data);
  }

  async function loadCatalog() {
    setLoading(true);
    setNotice("");
    const [p, v] = await Promise.all([
      supabase.from("products").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("product_variants").select("*").order("created_at", { ascending: false }).limit(500)
    ]);
    if (p.error) setNotice("Ürünler yüklenemedi: " + p.error.message);
    else setProducts(p.data || []);
    if (v.error) setNotice("Varyantlar yüklenemedi: " + v.error.message);
    else setVariants(v.data || []);
    setLoading(false);
  }

  async function signIn(e) {
    e.preventDefault();
    setBusy(true); setNotice("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setNotice("Giriş yapılamadı: " + error.message);
    setBusy(false);
  }

  async function signOut() {
    await supabase.auth.signOut();
    setProfile(null); setProducts([]); setVariants([]);
  }

  const productById = useMemo(
    () => Object.fromEntries(products.map(p => [p.id, p])),
    [products]
  );

  const filteredVariants = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("tr");
    if (!q) return variants;
    return variants.filter(v => {
      const p = productById[v.product_id] || {};
      return [v.barcode, v.color, v.size, p.name, p.model_code]
        .filter(Boolean).join(" ").toLocaleLowerCase("tr").includes(q);
    });
  }, [variants, productById, query]);

  if (!isSupabaseConfigured) return <SetupScreen />;

  if (!session) return (
    <main className="login-wrap">
      <form className="login-card" onSubmit={signIn}>
        <div className="brand-mark">J</div>
        <p className="eyebrow">JAKAMEN YÜKSEKOVA</p>
        <h1>ERP Yönetim Sistemi</h1>
        <p className="muted">Devam etmek için mağaza hesabınızla giriş yapın.</p>
        <label>E-posta<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="username" /></label>
        <label>Şifre<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required autoComplete="current-password" /></label>
        <button className="primary full" disabled={busy}>{busy ? "Giriş yapılıyor..." : "Giriş yap"}</button>
        {notice && <p className="notice">{notice}</p>}
        <p className="tiny">Güvenli giriş Supabase Authentication üzerinden yapılır.</p>
      </form>
    </main>
  );

  const nav = [
    ["dashboard", "Genel Bakış", LayoutDashboard],
    ["products", "Ürün & Barkod", Package],
    ["stock", "Stok Yönetimi", Boxes],
    ["sales", "Satış", ShoppingBag],
    ["customers", "Müşteriler", Users]
  ];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark small">J</div><div><b>JAKAMEN</b><small>ERP YÖNETİM</small></div></div>
        <nav>{nav.map(([id, label, Icon]) => <button key={id} className={tab===id?"nav-item active":"nav-item"} onClick={()=>setTab(id)}><Icon size={18}/>{label}</button>)}</nav>
        <div className="side-bottom"><ShieldCheck size={16}/><span>{profile?.role === "admin" ? "Yönetici" : "Personel"} hesabı</span></div>
      </aside>
      <main className="main">
        <header className="topbar">
          <div><p className="eyebrow">MAĞAZA YÖNETİMİ</p><h1>{nav.find(n=>n[0]===tab)?.[1] || "JAKAMEN ERP"}</h1></div>
          <div className="userbox"><div className="avatar">{(profile?.full_name || session.user.email || "J").slice(0,1).toUpperCase()}</div><div><b>{profile?.full_name || session.user.email}</b><small>{profile?.role || "Profil yükleniyor"}</small></div><button className="icon-btn" onClick={signOut} title="Çıkış"><LogOut size={18}/></button></div>
        </header>

        {notice && <div className="notice banner">{notice}</div>}

        {tab === "dashboard" && <section>
          <div className="welcome"><div><p className="eyebrow">HOŞ GELDİNİZ</p><h2>{profile?.full_name || "JAKAMEN"}</h2><p className="muted">Mağaza işlemlerinizi tek panelden takip edin.</p></div><button className="secondary" onClick={loadCatalog}><RefreshCw size={16}/> Yenile</button></div>
          <div className="stats">
            <Stat icon={Package} label="Ürün modeli" value={products.length}/>
            <Stat icon={Barcode} label="Ürün varyantı" value={variants.length}/>
            <Stat icon={Boxes} label="Toplam stok" value={variants.reduce((s,v)=>s+Number(v.stock||0),0)}/>
          </div>
          <div className="panel"><h3>Hızlı erişim</h3><div className="quick-grid"><button onClick={()=>setTab("products")}><Package/> Ürün ve barkodlar</button><button onClick={()=>setTab("stock")}><Boxes/> Stok durumu</button><button onClick={()=>setTab("sales")}><ShoppingBag/> Satış ekranı</button></div></div>
        </section>}

        {(tab === "products" || tab === "stock") && <section className="panel">
          <div className="section-head"><div><h2>{tab==="products"?"Ürün ve Barkod Listesi":"Stok Yönetimi"}</h2><p className="muted">Supabase veritabanından canlı okuma</p></div><button className="secondary" onClick={loadCatalog}><RefreshCw size={16}/> Yenile</button></div>
          <div className="searchbox"><Search size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Barkod, ürün, model, renk veya beden ara..."/></div>
          {loading ? <p className="muted">Yükleniyor...</p> : <div className="table-wrap"><table><thead><tr><th>Ürün / Model</th><th>Barkod</th><th>Renk</th><th>Beden</th><th>Satış fiyatı</th><th>Stok</th></tr></thead><tbody>
            {filteredVariants.map(v=>{const p=productById[v.product_id]||{};return <tr key={v.id}><td><b>{p.name||"Ürün adı yok"}</b><small>{p.model_code||"—"}</small></td><td>{v.barcode||"—"}</td><td>{v.color||"—"}</td><td>{v.size||"—"}</td><td>{money(v.sale_price)}</td><td><b>{v.stock ?? 0}</b></td></tr>})}
            {!filteredVariants.length && <tr><td colSpan="6" className="empty">Kayıt bulunamadı.</td></tr>}
          </tbody></table></div>}
          <p className="tiny">Bu ilk sürüm yalnızca ürün ve varyantları listeler; ürün ekleme, düzenleme ve stok hareketi henüz etkin değildir.</p>
        </section>}

        {tab === "sales" && <Placeholder title="Barkodlu Satış" text="Satış ve stok düşme işlemleri, güvenli ve atomik veritabanı fonksiyonları hazırlandıktan sonra etkinleştirilecek."/>}
        {tab === "customers" && <Placeholder title="Müşteri ve Cari Hesap" text="Müşteri kayıtları ve tahsilat ekranı, mevcut tablo alanları doğrulandıktan sonra bağlanacak."/>}
        <footer>JAKAMEN ERP · İlk bağlantı sürümü · {profile?.role || "Giriş yapıldı"}</footer>
      </main>
    </div>
  );
}

function Stat({icon:Icon,label,value}) {
  return <div className="stat"><div className="stat-icon"><Icon size={19}/></div><span>{label}</span><b>{value}</b></div>;
}
function Placeholder({title,text}) {
  return <div className="panel placeholder"><div className="stat-icon"><ShoppingBag/></div><h2>{title}</h2><p className="muted">{text}</p><span className="pill">Hazırlanıyor</span></div>;
}
function SetupScreen() {
  return <main className="login-wrap"><div className="login-card"><div className="brand-mark">J</div><p className="eyebrow">JAKAMEN ERP</p><h1>Supabase bağlantısı bekleniyor</h1><p className="muted">Proje klasöründeki <code>.env.example</code> dosyasını <code>.env</code> olarak kopyalayın ve Supabase Project URL ile publishable/anon key değerlerini girin.</p><ol className="steps"><li>Supabase → Project Settings → API</li><li>Project URL değerini <code>VITE_SUPABASE_URL</code> alanına girin.</li><li>Publishable key (veya eski anon public key) değerini <code>VITE_SUPABASE_ANON_KEY</code> alanına girin.</li><li>Uygulamayı yeniden başlatın.</li></ol><p className="warning">Service role / secret key'i asla tarayıcıya veya bu dosyaya koymayın. Bu uygulama henüz internete yayınlanmış değildir.</p></div></main>;
}

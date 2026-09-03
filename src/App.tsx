import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Heart,
  Menu,
  Minus,
  Package,
  Plus,
  Search,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
  Star,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import "./App.css";
import "./readability.css";
import "./mobile.css";
import { supabase } from "./lib/supabase";
import { createOrder, fetchProducts, getAdminMetrics, getProfile } from "./lib/store";
import {
  archiveProduct,
  archiveOrders,
  confirmManualPayment,
  deleteAdminProduct,
  deleteOrders,
  fetchAdminCategories,
  fetchAdminOrders,
  fetchAdminProducts,
  fetchCustomers,
  getSettings,
  restoreProduct,
  restoreOrder,
  saveAdminProduct,
  saveSettings,
  updateOrderStatus,
  uploadProductImage,
} from "./lib/admin";
import {
  createManualOrder,
  getManualOrderSummary,
  getPublicPaymentSettings,
} from "./lib/manual-payment";
import { getCustomerAccount, saveCustomerAddress, saveCustomerProfile, toggleWishlist } from "./lib/customer";
import { clearAuthCallbackUrl, friendlyAuthError, getAuthRedirectUrl, isAuthRateLimited } from "./lib/auth";

type Product = {
  id: number;
  name: string;
  category: string;
  price: number;
  rating: number;
  reviews: number;
  image: string;
  description: string;
  shades: string[];
  badge?: string;
  new?: boolean;
};
type CartLine = Product & { quantity: number; shade: string };
const products: Product[] = [];
const categories = [
  [
    "Complexion",
    "https://images.unsplash.com/photo-1512496015851-a90fb38ba796?auto=format&fit=crop&w=700&q=80",
  ],
  [
    "Lips",
    "https://images.unsplash.com/photo-1586495777744-4413f21062fa?auto=format&fit=crop&w=700&q=80",
  ],
  [
    "Eyes",
    "https://images.unsplash.com/photo-1487412912498-0447578fcca8?auto=format&fit=crop&w=700&q=80",
  ],
  [
    "Skincare",
    "https://images.unsplash.com/photo-1611930022073-b7a4ba5fcccd?auto=format&fit=crop&w=700&q=80",
  ],
];
const money = (n: number) => `$${n.toFixed(2)}`;

export default function App() {
  const [page, setPage] = useState<
      "home" | "shop" | "story" | "guide" | "product" | "account" | "admin" | "checkout"
    >("home"),
    [active, setActive] = useState<Product | null>(null),
    [cartOpen, setCartOpen] = useState(false),
    [menu, setMenu] = useState(false),
    [search, setSearch] = useState(false),
    [query, setQuery] = useState(""),
    [category, setCategory] = useState("All"),
    [sort, setSort] = useState("Featured"),
    [toast, setToast] = useState(""),
    [user, setUser] = useState<string | null>(null),
    [isAdmin, setIsAdmin] = useState(false),
    [authIntent, setAuthIntent] = useState<"normal" | "recovery">("normal"),
    [cart, setCart] = useState<CartLine[]>(() =>
      JSON.parse(sessionStorage.getItem("blg-cart") ?? "[]"),
    ),
    [catalogVersion, setCatalogVersion] = useState(0);
  const go = (p: typeof page) => {
    setPage(p);
    setMenu(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const note = (s: string) => {
    setToast(s);
    setTimeout(() => setToast(""), 2500);
  };
  const add = (p: Product, shade = p.shades[0]) => {
    setCart((current) => {
      const found = current.find((x) => x.id === p.id && x.shade === shade);
      const stock = (p as Product & { inventory?: number }).inventory;
      if (stock !== undefined && (found?.quantity ?? 0) >= stock) {
        note("That item is at its available stock limit.");
        return current;
      }
      return found
        ? current.map((x) => (x === found ? { ...x, quantity: x.quantity + 1 } : x))
        : [...current, { ...p, shade, quantity: 1 }];
    });
    note(`${p.name} added to bag`);
  };
  const show = (p: Product) => {
    setActive(p);
    go("product");
  };
  const subtotal = cart.reduce((s, x) => s + x.price * x.quantity, 0);
  const items = useMemo(() => {
    void catalogVersion;
    return products
      .filter(
        (p) =>
          (category === "All" || p.category === category) &&
          p.name.toLowerCase().includes(query.toLowerCase()),
      )
      .sort((a, b) =>
        sort === "Price: low to high"
          ? a.price - b.price
          : sort === "Price: high to low"
            ? b.price - a.price
            : sort === "Top rated"
              ? b.rating - a.rating
              : 0,
      );
  }, [category, query, sort, catalogVersion]);
  useEffect(() => {
    let alive = true;
    fetchProducts()
      .then((data) => {
        if (alive) {
          products.splice(0, products.length, ...data);
          setCatalogVersion((v) => v + 1);
        }
      })
      .catch(() => note("The collection is temporarily unavailable."));
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    sessionStorage.setItem("blg-cart", JSON.stringify(cart));
  }, [cart]);
  useEffect(() => {
    const clearCart = () => setCart([]);
    window.addEventListener("blg:checkout-complete", clearCart);
    return () => window.removeEventListener("blg:checkout-complete", clearCart);
  }, []);
  useEffect(() => {
    const load = async () => {
      try {
        const { user: authUser, profile } = await getProfile();
        setUser(authUser?.email ?? null);
        setIsAdmin(profile?.role === "admin");
      } catch {
        setUser(null);
        setIsAdmin(false);
      }
    };
    void load();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      void load();
      if (event === "PASSWORD_RECOVERY") {
        clearAuthCallbackUrl();
        setAuthIntent("recovery");
        go("account");
        return;
      }
      if (event === "SIGNED_IN" && (window.location.hash.includes("access_token") || new URLSearchParams(window.location.search).has("code"))) {
        clearAuthCallbackUrl();
        if (session?.user) {
          setUser(session.user.email ?? null);
          note("Your email has been confirmed. Welcome to BALI & LISA GLAM.");
          go("account");
        }
      }
    });
    return () => subscription.unsubscribe();
  }, []);
  return (
    <div className="app">
      <div className="announcement">
        <Sparkles size={14} /> Complimentary shipping on orders over $75 <span>•</span> Join the
        list for 15% off
      </div>
      <Header
        count={cart.reduce((s, x) => s + x.quantity, 0)}
        page={page}
        isAdmin={isAdmin}
        go={go}
        cart={() => setCartOpen(true)}
        menu={() => setMenu(!menu)}
        search={() => setSearch(!search)}
      />
      {menu && (
        <>
        <button className="mobile-menu-scrim" aria-label="Close navigation menu" onClick={() => setMenu(false)} />
        <div className="mobile-menu" role="dialog" aria-label="Mobile navigation">
          {["Shop all", "Complexion", "Lips", "Eyes", "Skincare", "Our story", "Beauty guide", "Account", ...(isAdmin ? ["Studio"] : [])].map((x) => (
            <button
              key={x}
              className={
                (x === "Our story" && page === "story") ||
                (x === "Beauty guide" && page === "guide") ||
                (x === "Account" && page === "account") ||
                (x !== "Our story" && x !== "Studio" && (page === "shop" || page === "product")) ||
                (x === "Studio" && page === "admin")
                  ? "active"
                  : ""
              }
              onClick={() => {
                if (x === "Studio") {
                  go("admin");
                  return;
                }
                if (x === "Account") {
                  go("account");
                  return;
                }
                setCategory(x === "Shop all" || x === "Our story" || x === "Beauty guide" ? "All" : x);
                go(x === "Our story" ? "story" : x === "Beauty guide" ? "guide" : "shop");
              }}
            >
              {x}
            </button>
          ))}
        </div>
        </>
      )}
      {search && (
        <div className="search-bar">
          <Search size={20} />
          <input
            autoFocus
            placeholder="Search makeup, skincare, rituals..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button
            onClick={() => {
              go("shop");
              setSearch(false);
            }}
          >
            Search
          </button>
        </div>
      )}
      <main>
        {page === "home" && (
          <Home
            shop={() => go("shop")}
            story={() => go("story")}
            show={show}
            category={(x: string) => {
              setCategory(x);
              go("shop");
            }}
            add={add}
            note={note}
          />
        )}{" "}
        {page === "shop" && (
          <Shop
            items={items}
            category={category}
            setCategory={setCategory}
            sort={sort}
            setSort={setSort}
            query={query}
            setQuery={setQuery}
            show={show}
            add={add}
            note={note}
          />
        )}{" "}
        {page === "story" && <Story shop={() => go("shop")} />}{" "}
        {page === "guide" && (
          <BeautyGuide
            shopLips={() => {
              setCategory("Lips");
              go("shop");
            }}
          />
        )}{" "}
        {page === "product" && active && (
          <Detail product={active} back={() => go("shop")} add={add} />
        )}{" "}
        {page === "account" && <Account user={user} setUser={setUser} note={note} add={add} goShop={() => go("shop")} authIntent={authIntent} clearAuthIntent={() => setAuthIntent("normal")} />}{" "}
        {page === "admin" && <AdminGuard user={user} go={go} note={note} />}{" "}
        {page === "checkout" && (
          <Checkout
            cart={cart}
            subtotal={subtotal}
            back={() => go("shop")}
            done={async () => {
              try {
                await createOrder(
                  cart.map((item) => ({
                    product_id: item.id,
                    quantity: item.quantity,
                    shade: item.shade,
                  })),
                  {},
                );
                setCart([]);
                note("Your order is confirmed — thank you!");
                go("home");
              } catch {
                note("Please sign in and verify your details to place this order.");
              }
            }}
          />
        )}
      </main>
      <Footer go={go} note={note} />
      <Cart
        open={cartOpen}
        close={() => setCartOpen(false)}
        cart={cart}
        subtotal={subtotal}
        update={(id: number, shade: string, n: number) =>
          setCart((c) =>
            c
              .map((x) =>
                x.id === id && x.shade === shade
                  ? { ...x, quantity: Math.max(0, x.quantity + n) }
                  : x,
              )
              .filter((x) => x.quantity),
          )
        }
        remove={(id: number, shade: string) =>
          setCart((c) => c.filter((x) => !(x.id === id && x.shade === shade)))
        }
        checkout={() => {
          setCartOpen(false);
          go("checkout");
        }}
      />
      {toast && (
        <div className="toast">
          <Check size={17} />
          {toast}
        </div>
      )}
    </div>
  );
}
function Header({ count, page, isAdmin, go, cart, menu, search }: any) {
  return (
    <header className="header">
      <button className="icon mobile" onClick={menu}>
        <Menu />
      </button>
      <button className="wordmark" onClick={() => go("home")}>
        BALI & LISA <i>GLAM</i>
      </button>
      <nav>
        <button className={page === "shop" || page === "product" ? "active" : ""} onClick={() => go("shop")}>Shop</button>
        <button className={page === "story" ? "active" : ""} onClick={() => go("story")}>Our story</button>
        <button className={page === "guide" ? "active" : ""} onClick={() => go("guide")}>Beauty guide</button>
        {isAdmin && <button className={page === "admin" ? "active" : ""} data-page="admin" onClick={() => go("admin")}>Studio</button>}
      </nav>
      <div className="actions">
        <button className="icon" aria-label="Search" onClick={search}>
          <Search size={21} />
        </button>
        <button className={`icon account ${page === "account" ? "active" : ""}`} aria-label="Account" onClick={() => go("account")}>
          <UserRound size={21} />
        </button>
        <button className="bag" onClick={cart}>
          <ShoppingBag size={21} />
          <span>Bag {count ? `(${count})` : ""}</span>
        </button>
      </div>
    </header>
  );
}
function Home({ shop, story, show, category, add, note }: any) {
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">BALI & LISA GLAM</p>
          <h1>
            Home of <em>glamour, beauty, care & confidence.</em>
          </h1>
          <p>
            Discover beauty and personal-care essentials designed to help you look polished, feel
            cared for and express your confidence every day.
          </p>
          <button className="btn dark" onClick={shop}>
            Shop the collection <ArrowRight size={17} />
          </button>
        </div>
        <div className="hero-image">
          <img
            src="https://images.unsplash.com/photo-1616683693504-3ea7e9ad6fec?auto=format&fit=crop&w=1300&q=90"
            alt="Woman enjoying BALI & LISA GLAM beauty"
          />
          <div>
            Your glow
            <br />
            looks good on you <ArrowRight size={16} />
          </div>
        </div>
      </section>
      <section className="trust">
        <span>Vegan formulas</span>
        <b>✦</b>
        <span>Thoughtfully made</span>
        <b>✦</b>
        <span>Always cruelty-free</span>
        <b>✦</b>
        <span>For every shade of you</span>
      </section>
      <section className="section">
        <Head eyebrow="SHOP BY MOOD" title="A ritual for every version of you." action={shop} />
        <div className="category-grid">
          {categories.map(([name, img]) => (
            <button className="category-card" key={name} onClick={() => category(name)}>
              <img src={img} alt={name} />
              <span>{name}</span>
              <ArrowRight size={20} />
            </button>
          ))}
        </div>
      </section>
      <section className="featured">
        <Head eyebrow="THE EDIT" title="Made for main-character energy." action={shop} />
        <div className="product-grid">
          {products.slice(0, 4).map((p) => (
            <Card key={p.id} p={p} show={show} add={add} note={note} />
          ))}
        </div>
      </section>
      <section className="story">
        <div>
          <img
            src="https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=1100&q=85"
            alt="BALI & LISA GLAM muse"
          />
        </div>
        <div>
          <p className="eyebrow">OUR PHILOSOPHY</p>
          <h2>
            Beauty should feel like <em>coming home.</em>
          </h2>
          <p>
            We make sensorial essentials that celebrate the care, colour, and confidence already
            within you.
          </p>
          <button className="text" onClick={story}>
            Discover our world <ArrowRight size={16} />
          </button>
        </div>
      </section>
      <section className="newsletter">
        <Sparkles size={22} />
        <p className="eyebrow">THE GLOW LIST</p>
        <h2>Good things are coming.</h2>
        <p>First looks, little luxuries, and 15% off your first ritual.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            note("You are on the Glow List — welcome in.");
          }}
        >
          <input aria-label="Email" required type="email" placeholder="Your email address" />
          <button className="btn dark">Sign me up</button>
        </form>
      </section>
    </>
  );
}
function Head({ eyebrow, title, action }: any) {
  return (
    <div className="head">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
      </div>
      <button className="text" onClick={action}>
        View all <ArrowRight size={16} />
      </button>
    </div>
  );
}
function Card({ p, show, add, note }: any) {
  const saveToWishlist = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { note?.("Sign in to save items to your wishlist."); return; }
    try { await toggleWishlist(p.id, false); note?.(`${p.name} was saved to your wishlist.`); }
    catch { note?.("We could not save this item right now."); }
  };
  return (
    <article className="card">
      <button className="wishlist-toggle" aria-label={`Save ${p.name} to wishlist`} onClick={() => void saveToWishlist()}><Heart size={18} /></button>
      <button className="product-img" onClick={() => show(p)}>
        <img src={p.image} alt={p.name} />
        {(p.badge || p.new) && <span className="badge">{p.badge || "New"}</span>}
        <span className="quick">
          Quick add <Plus size={16} />
        </span>
      </button>
      <div className="product-info">
        <div>
          <p>{p.category}</p>
          <button onClick={() => show(p)}>{p.name}</button>
        </div>
        <strong>{money(p.price)}</strong>
      </div>
      <div className="card-bottom">
        <span className="rating">
          <Star size={14} fill="currentColor" />
          {p.rating} <small>({p.reviews})</small>
        </span>
        <button onClick={() => add(p)}>Add to bag</button>
      </div>
    </article>
  );
}
function Shop({ items, category, setCategory, sort, setSort, query, setQuery, show, add, note }: any) {
  const cats = ["All", "Complexion", "Lips", "Eyes", "Cheeks", "Skincare"];
  return (
    <section className="shop">
      <div className="page-title">
        <p className="eyebrow">THE COLLECTION</p>
        <h1>
          Find your new <em>favourite.</em>
        </h1>
        <p>High-performance essentials made to make you feel seen.</p>
      </div>
      <div className="toolbar">
        <div className="pills">
          {cats.map((x) => (
            <button
              className={category === x ? "selected" : ""}
              onClick={() => setCategory(x)}
              key={x}
            >
              {x}
            </button>
          ))}
        </div>
        <div className="sort">
          <SlidersHorizontal size={17} />
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option>Featured</option>
            <option>Top rated</option>
            <option>Price: low to high</option>
            <option>Price: high to low</option>
          </select>
        </div>
      </div>
      <div className="results">
        <span>{items.length} products</span>
        <div>
          <Search size={16} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search collection"
          />
        </div>
      </div>
      <div className="product-grid">
        {items.map((p: Product) => (
          <Card p={p} key={p.id} show={show} add={add} note={note} />
        ))}
      </div>
      {!items.length && (
        <div className="empty">
          <Search size={30} />
          <h3>No matches yet</h3>
          <p>Try another search or explore every ritual.</p>
          <button
            className="btn dark"
            onClick={() => {
              setCategory("All");
              setQuery("");
            }}
          >
            See everything
          </button>
        </div>
      )}
    </section>
  );
}
function Story({ shop }: any) {
  return (
    <section className="our-story">
      <div className="story-intro">
        <p className="eyebrow">ABOUT BALI & LISA GLAM</p>
        <h1>
          Beauty, care and confidence for your <em>everyday.</em>
        </h1>
        <p>
          Bali & Lisa Glam is a beauty and personal-care brand created to help our customers care
          for their beauty, enhance their everyday routine and feel confident in their look.
        </p>
      </div>
      <div className="story-hero">
        <img
          src="https://images.unsplash.com/photo-1515377905703-c4788e51af15?auto=format&fit=crop&w=1500&q=85"
          alt="BALI & LISA GLAM founder portrait"
        />
      </div>
      <div className="story-manifesto">
        <p className="eyebrow">OUR COLLECTION</p>
        <h2>Beauty essentials that combine style, comfort and care.</h2>
        <p>
          Selected formulas feature nourishing ingredients such as shea butter, coconut oil,
          vitamin E and other carefully chosen cosmetic ingredients depending on the product.
          From lip care and colour to complexion, eyes and future skincare collections, Bali &
          Lisa Glam is designed to make everyday beauty feel effortless, enjoyable and glamorous.
        </p>
      </div>
      <div className="values">
        <article>
          <span>01</span>
          <h3>Thoughtful by nature</h3>
          <p>
            Formulas that feel beautiful, wear beautifully, and are made with considered choices.
          </p>
        </article>
        <article>
          <span>02</span>
          <h3>Every shade welcome</h3>
          <p>Colour that celebrates dimension, expression, and every version of your glow.</p>
        </article>
        <article>
          <span>03</span>
          <h3>Joy is essential</h3>
          <p>Because a five-minute ritual can be the sweetest part of your day.</p>
        </article>
      </div>
      <section className="story-close">
        <img
          src="https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1000&q=85"
          alt="BALI & LISA GLAM community"
        />
        <div>
          <p className="eyebrow">THE BALI & LISA WAY</p>
          <h2>Made for the mirror moments that belong only to you.</h2>
          <button className="btn dark" onClick={shop}>
            Find your ritual <ArrowRight size={17} />
          </button>
        </div>
      </section>
    </section>
  );
}
function BeautyGuide({ shopLips }: any) {
  const lipHabits = [
    ["Stay hydrated", "Drinking enough water supports your overall wellness and helps keep your daily beauty routine balanced."],
    ["Avoid constantly licking or touching your lips", "Frequent licking may leave lips feeling drier. Give them time to stay protected and moisturized."],
    ["Remove lip products before bed", "Gently cleanse your lips before sleeping, especially after wearing lipstick or other long-wear products."],
    ["Exfoliate gently", "Use a gentle lip scrub occasionally to remove loose, dry surface skin. Avoid aggressive or excessive scrubbing."],
    ["Moisturize regularly", "Apply lip balm, lip oil or another moisturizing lip-care product to help lips feel soft and comfortable."],
  ];
  const lipCare = [
    ["Lip scrub", "Gently removes loose, dry surface skin and helps prepare the lips for the next steps in your routine."],
    ["Lip mask", "Provides an intensive moisturizing step and helps lips feel softer and more comfortable."],
    ["Lip balm / lip moisturizer", "Helps protect against dryness while keeping lips feeling smooth and moisturized."],
    ["Lip gloss", "Adds shine and enhances the appearance of the lips while providing a comfortable glossy finish."],
    ["Lip oil", "Provides nourishing moisture and a smooth, glossy finish that can help lips feel soft and conditioned."],
  ];
  const routine = [
    ["01", "Exfoliate", "Gently exfoliate your lips with a lip scrub and a soft lip brush when needed."],
    ["02", "Mask", "Apply a lip mask and leave it on according to the product instructions."],
    ["03", "Moisturize", "Apply lip balm or lip moisturizer to help soften and condition your lips."],
    ["04", "Finish with gloss or oil", "Apply your favourite lip gloss or lip oil for moisture, shine and a polished finish."],
  ];
  return (
    <section className="beauty-guide">
      <header className="guide-intro">
        <p className="eyebrow">BEAUTY GUIDE</p>
        <h1>Care rituals for your most <em>comfortable glow.</em></h1>
        <p>Thoughtful, cosmetic-care guidance for the little rituals that help you feel polished every day.</p>
      </header>
      <section className="guide-section guide-habits">
        <div className="guide-heading">
          <p className="eyebrow">LIP & SKIN CARE ROUTINE</p>
          <h2>Simple habits for softer, healthier-looking lips.</h2>
        </div>
        <div className="guide-habit-grid">
          {lipHabits.map(([title, copy], index) => (
            <article key={title}>
              <span>0{index + 1}</span>
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="guide-skin">
        <p className="eyebrow">SIMPLE SKIN CARE ROUTINE</p>
        <h2>Cleanse <b>→</b> Hydrate <b>→</b> Moisturize <b>→</b> Protect</h2>
        <p>Gently cleanse your skin, use suitable hydrating products, apply moisturizer and use sunscreen during the daytime. Choose products that suit your individual skin type and discontinue use if irritation occurs.</p>
      </section>
      <section className="guide-section">
        <div className="guide-heading guide-heading-wide">
          <p className="eyebrow">LIP CARE EDUCATION</p>
          <h2>How to care for dry, chapped or dull-looking lips.</h2>
          <button className="text" onClick={shopLips}>Shop lip care <ArrowRight size={16} /></button>
        </div>
        <div className="guide-care-grid">
          {lipCare.map(([title, copy]) => (
            <article key={title}>
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="guide-routine">
        <div>
          <p className="eyebrow">YOUR BALI & LISA GLAM LIP CARE ROUTINE</p>
          <h2>A simple ritual, your way.</h2>
        </div>
        <div className="guide-steps">
          {routine.map(([number, title, copy]) => (
            <article key={number}>
              <span>{number}</span>
              <div><h3>{title}</h3><p>{copy}</p></div>
            </article>
          ))}
        </div>
      </section>
      <section className="guide-ingredients">
        <div>
          <p className="eyebrow">INGREDIENTS WE LOVE</p>
          <h2>Thoughtfully chosen for the beauty of the ritual.</h2>
          <p>Depending on the individual product formulation, BALI & LISA GLAM products may feature ingredients such as:</p>
        </div>
        <ul>
          {["Shea butter", "Coconut oil", "Coconut butter", "Vitamin E", "Glycerin", "Beeswax", "Sugar in exfoliating lip scrubs", "Cosmetic gloss bases such as Versagel in selected gloss formulations"].map((ingredient) => <li key={ingredient}>{ingredient}</li>)}
        </ul>
        <small>Ingredient information is general brand education. Individual product ingredients are shown only where configured for that product.</small>
      </section>
      <section className="guide-finishes">
        <p className="eyebrow">FLAVOURS & FINISHES</p>
        <h2>Selected collections may include options such as:</h2>
        <div>
          <article><h3>Lip scrubs</h3><p>Strawberry · Pineapple · Lemon · and more</p></article>
          <article><h3>Lip balms</h3><p>Honey · Tinted options · and other varieties</p></article>
          <article><h3>Lip glosses</h3><p>Strawberry · Clear · Extra Clear · and other shades or finishes</p></article>
        </div>
        <small>Availability varies by product. These options are informational unless listed on a current product.</small>
      </section>
    </section>
  );
}
function Detail({ product, back, add }: any) {
  const [shade, setShade] = useState(product.shades[0]),
    [qty, setQty] = useState(1),
    [tab, setTab] = useState("Details");
  useEffect(() => {
    setShade(product.shades[0]);
    setQty(1);
  }, [product]);
  return (
    <section className="detail">
      <button className="back" onClick={back}>
        <ArrowLeft size={17} /> Back to collection
      </button>
      <div className="detail-grid">
        <div className="gallery">
          <img src={product.image} alt={product.name} />
          <span>BALI & LISA GLAM</span>
        </div>
        <div className="details">
          <p className="eyebrow">{product.category}</p>
          <h1>{product.name}</h1>
          <div className="detail-rating">
            <Star size={16} fill="currentColor" /> {product.rating} <u>{product.reviews} reviews</u>
          </div>
          <h3>{money(product.price)}</h3>
          <p className="desc">{product.description}</p>
          <div className="shade-label">
            <span>Choose a shade</span>
            <b>{shade}</b>
          </div>
          <div className="shades">
            {product.shades.map((x: string, i: number) => (
              <button
                key={x}
                className={shade === x ? "active" : ""}
                onClick={() => setShade(x)}
                title={x}
                style={{ background: ["#ead8cf", "#c99070", "#a36048", "#51302c"][i % 4] }}
              />
            ))}
          </div>
          <div className="purchase">
            <div className="quantity">
              <button onClick={() => setQty(Math.max(1, qty - 1))}>
                <Minus size={15} />
              </button>
              {qty}
              <button onClick={() => setQty(qty + 1)}>
                <Plus size={15} />
              </button>
            </div>
            <button
              className="btn dark"
              onClick={() => {
                for (let i = 0; i < qty; i++) add(product, shade);
              }}
            >
              Add to bag — {money(product.price * qty)}
            </button>
          </div>
          <div className="accord">
            {["Details", "How to use", "Ingredients"].map((x) => (
              <div key={x}>
                <button onClick={() => setTab(tab === x ? "" : x)}>
                  {x}
                  <ChevronDown size={18} />
                </button>
                {tab === x && (
                  <p>
                    {x === "Details"
                      ? product.description
                      : x === "How to use"
                        ? "Apply with fingertips, brush, or your favourite ritual tool. Build to your desired finish."
                        : "Vegan, cruelty-free, and made with skin-kind ingredients without compromise."}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      <section className="promise">
        <Package size={22} />
        <div>
          <b>Free delivery on $75+</b>
          <span>Complimentary standard shipping and easy 30-day returns.</span>
        </div>
        <Heart size={22} />
        <div>
          <b>Made with care</b>
          <span>Vegan, cruelty-free and consciously crafted.</span>
        </div>
      </section>
    </section>
  );
}
function Cart({ open, close, cart, subtotal, update, remove, checkout }: any) {
  return (
    <>
      <div className={`overlay ${open ? "show" : ""}`} onClick={close} />
      <aside className={`drawer ${open ? "open" : ""}`}>
        <div className="drawer-head">
          <h2>
            Your bag <small>({cart.reduce((s: number, x: CartLine) => s + x.quantity, 0)})</small>
          </h2>
          <button className="icon" onClick={close}>
            <X />
          </button>
        </div>
        {cart.length ? (
          <>
            <div className="lines">
              {cart.map((x: CartLine) => (
                <div className="line" key={`${x.id}-${x.shade}`}>
                  <img src={x.image} alt="" />
                  <div>
                    <p>{x.category}</p>
                    <b>{x.name}</b>
                    <span>{x.shade}</span>
                    <div className="line-foot">
                      <div className="mini-qty">
                        <button onClick={() => update(x.id, x.shade, -1)}>
                          <Minus size={13} />
                        </button>
                        {x.quantity}
                        <button onClick={() => update(x.id, x.shade, 1)}>
                          <Plus size={13} />
                        </button>
                      </div>
                      <button onClick={() => remove(x.id, x.shade)}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  <strong>{money(x.price * x.quantity)}</strong>
                </div>
              ))}
            </div>
            <div className="cart-total">
              <div>
                <span>Subtotal</span>
                <b>{money(subtotal)}</b>
              </div>
              <small>Shipping and taxes calculated at checkout.</small>
              <button className="btn dark" onClick={checkout}>
                Secure checkout <ArrowRight size={17} />
              </button>
              <button className="continue" onClick={close}>
                Continue shopping
              </button>
            </div>
          </>
        ) : (
          <div className="empty-cart">
            <ShoppingBag size={37} />
            <h3>Your bag is waiting.</h3>
            <p>Fill it with the little things that make you glow.</p>
            <button className="btn dark" onClick={close}>
              Shop now
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
function Checkout({ cart, subtotal, back }: any) {
  const [step, setStep] = useState(1),
    [address, setAddress] = useState<Record<string, string>>({ country: "Canada" }),
    [method, setMethod] = useState<"manual_whatsapp" | "manual_email">("manual_whatsapp"),
    [settings, setSettings] = useState<any>(null),
    [busy, setBusy] = useState(false),
    [confirmation, setConfirmation] = useState<any>(null),
    [error, setError] = useState("");
  const orderSubmissionStarted = useRef(false);
  useEffect(() => {
    void getPublicPaymentSettings()
      .then(setSettings)
      .catch(() => setError("Payment contact details are not configured yet."));
  }, []);
  useEffect(() => {
    void getCustomerAccount()
      .then(({ profile, address: savedAddress }) => {
        if (!savedAddress) return;
        setAddress((current) => ({
          ...savedAddress,
          email: profile?.email ?? current.email ?? "",
          phone: savedAddress.phone ?? profile?.phone ?? current.phone ?? "",
          country: savedAddress.country ?? "Canada",
          ...current,
        }));
      })
      .catch(() => undefined);
  }, []);
  const shipping =
    subtotal >= (settings?.free_shipping_threshold_cents ?? 7500) / 100
      ? 0
      : (settings?.standard_shipping_cents ?? 800) / 100;
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (step === 1) {
      const requiredFields = [
        ["first_name", "first name"],
        ["last_name", "last name"],
        ["email", "email address"],
        ["phone", "phone number"],
        ["address", "street address"],
        ["city", "city"],
        ["province", "province"],
        ["postal_code", "postal code"],
        ["country", "country"],
      ] as const;
      const missingField = requiredFields.find(([field]) => !address[field]?.trim());
      if (missingField) {
        setError(`Enter your ${missingField[1]} to continue to payment.`);
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address.email.trim())) {
        setError("Enter a valid email address.");
        return;
      }
      const postal = (address.postal_code ?? "").toUpperCase().replace(/\s/g, "");
      if (!/^[ABCEGHJKLMNPRSTVXY]\d[A-Z]\d[A-Z]\d$/.test(postal)) {
        setError("Enter a valid Canadian postal code.");
        return;
      }
      setError("");
      setStep(2);
      return;
    }
    if (!settings) {
      setError("Payment contact details are not available.");
      return;
    }
    if (orderSubmissionStarted.current) return;
    orderSubmissionStarted.current = true;
    setBusy(true);
    let orderCreated = false;
    try {
      const order = await createManualOrder(
        cart.map((x: CartLine) => ({ product_id: x.id, quantity: x.quantity, shade: x.shade })),
        address,
        method,
      );
      orderCreated = true;
      const orderSummary = await getManualOrderSummary(order.order_id);
      setConfirmation({ ...order, method });
      window.dispatchEvent(new Event("blg:checkout-complete"));
      const formatCad = (cents: number) => `CA$${(cents / 100).toFixed(2)}`;
      const orderLines = orderSummary.order_items
        .map((item, index) => {
          const lineTotal = item.unit_price_cents * item.quantity;
          return [
            `${index + 1}. ${item.product_name}`,
            item.shade ? `   Color/Variant: ${item.shade}` : null,
            `   Quantity: ${item.quantity}`,
            `   Price: ${formatCad(item.unit_price_cents)}`,
            `   Subtotal: ${formatCad(lineTotal)}`,
          ]
            .filter(Boolean)
            .join("\n");
        })
        .join("\n\n");
      const message = `Hello Bali & Lisa Glam,

My name is ${[address.first_name, address.last_name].filter(Boolean).join(" ")}.

I would like to complete payment for my order.

Order Reference: #${orderSummary.order_number}

ORDER DETAILS

${orderLines}

Shipping: ${formatCad(orderSummary.shipping_cents)}
Order Total: ${formatCad(orderSummary.total_cents)}

DELIVERY
${address.city}, ${address.province}
${address.postal_code.toUpperCase()}
${address.country}

Payment Method: ${method === "manual_whatsapp" ? "WhatsApp Manual Payment" : "Email Manual Payment"}

Please send me the payment instructions. I will send my successful payment receipt here after payment.

Thank you.`;
      const encodedMessage = encodeURIComponent(message);
      if (method === "manual_whatsapp" && settings.whatsapp_number) {
        window.open(
          `https://wa.me/${String(settings.whatsapp_number).replace(/\D/g, "")}?text=${encodedMessage}`,
          "_blank",
          "noopener",
        );
      }
      if (method === "manual_email" && settings.business_email) {
        window.location.href = `mailto:${settings.business_email}?subject=${encodeURIComponent(`Payment Request - Order #${orderSummary.order_number}`)}&body=${encodedMessage}`;
      }
    } catch {
      if (!orderCreated) {
        orderSubmissionStarted.current = false;
        setError("We could not create your order. Please check your details and try again.");
      } else {
        setError("Your order was created, but we could not open the payment contact link.");
      }
    } finally {
      setBusy(false);
    }
  };
  if (confirmation)
    return (
      <section className="checkout">
        <div className="account-card">
          <p className="eyebrow">ORDER CREATED</p>
          <h1>Payment awaiting confirmation</h1>
          <p>
            Order #{confirmation.order_number} is pending payment verification. Contact Bali & Lisa
            Glam using your selected method and send your receipt privately.
          </p>
          <p>
            <b>Total: CA${(confirmation.total_cents / 100).toFixed(2)}</b>
          </p>
          <button className="btn dark" onClick={back}>
            Continue shopping
          </button>
        </div>
      </section>
    );
  return (
    <section className="checkout">
      <button className="wordmark checkout-logo" onClick={back}>
        BALI & LISA <i>GLAM</i>
      </button>
      <div className="checkout-layout">
        <form noValidate onSubmit={submit}>
          <button type="button" className="back" onClick={back}>
            <ArrowLeft size={16} /> Continue shopping
          </button>
          <p className="eyebrow">SECURE CHECKOUT</p>
          <h1>{step === 1 ? "Where shall we send your glow?" : "Choose payment contact"}</h1>
          <div className="steps">
            <span className="active">1. Delivery</span>
            <span className={step === 2 ? "active" : ""}>2. Payment</span>
          </div>
          {error && (
            <p className="checkout-error" role="alert">
              {error}
            </p>
          )}
          {step === 1 ? (
            <>
              <div className="form-row">
                <label>
                  First name
                  <input
                    required
                    value={address.first_name ?? ""}
                    onChange={(e) => setAddress({ ...address, first_name: e.target.value })}
                  />
                </label>
                <label>
                  Last name
                  <input
                    required
                    value={address.last_name ?? ""}
                    onChange={(e) => setAddress({ ...address, last_name: e.target.value })}
                  />
                </label>
              </div>
              <label>
                Email
                <input
                  required
                  type="email"
                  value={address.email ?? ""}
                  onChange={(e) => setAddress({ ...address, email: e.target.value })}
                />
              </label>
              <label>
                Phone
                <input
                  required
                  type="tel"
                  value={address.phone ?? ""}
                  onChange={(e) => setAddress({ ...address, phone: e.target.value })}
                />
              </label>
              <label>
                Address
                <input
                  required
                  value={address.address ?? ""}
                  onChange={(e) => setAddress({ ...address, address: e.target.value })}
                />
              </label>
              <label>
                Apartment / unit (optional)
                <input
                  value={address.unit ?? ""}
                  onChange={(e) => setAddress({ ...address, unit: e.target.value })}
                />
              </label>
              <div className="form-row">
                <label>
                  City
                  <input
                    required
                    value={address.city ?? ""}
                    onChange={(e) => setAddress({ ...address, city: e.target.value })}
                  />
                </label>
                <label>
                  Province
                  <input
                    required
                    value={address.province ?? ""}
                    onChange={(e) => setAddress({ ...address, province: e.target.value })}
                  />
                </label>
              </div>
              <div className="form-row">
                <label>
                  Postal code
                  <input
                    required
                    value={address.postal_code ?? ""}
                    onChange={(e) => setAddress({ ...address, postal_code: e.target.value })}
                  />
                </label>
                <label>
                  Country
                  <input
                    required
                    value={address.country ?? "Canada"}
                    onChange={(e) => setAddress({ ...address, country: e.target.value })}
                  />
                </label>
              </div>
            </>
          ) : (
            <>
              <p>
                For now, payments are completed directly with Bali & Lisa Glam through WhatsApp or
                email. After placing your order, contact us using one of the options below. We’ll
                provide payment instructions privately. Send your payment receipt after payment.
                Your order will be confirmed only after payment has been verified.
              </p>
              <label>
                <input
                  type="radio"
                  checked={method === "manual_whatsapp"}
                  onChange={() => setMethod("manual_whatsapp")}
                />{" "}
                WhatsApp Payment — continue privately on WhatsApp
              </label>
              <label>
                <input
                  type="radio"
                  checked={method === "manual_email"}
                  onChange={() => setMethod("manual_email")}
                />{" "}
                Email Payment — request instructions by email
              </label>
              <p>Credit / Debit Card — Stripe: Coming soon</p>
            </>
          )}
          <button type="submit" className="btn dark pay" disabled={busy}>
            {step === 1
              ? "Continue to payment"
              : busy
                ? "Creating order…"
                : method === "manual_whatsapp"
                  ? "Place order & continue on WhatsApp"
                  : "Place order & continue by Email"}{" "}
            <ArrowRight size={17} />
          </button>
        </form>
        <aside className="summary">
          <h3>Order summary</h3>
          {cart.map((x: CartLine) => (
            <div className="summary-line" key={x.id}>
              <img src={x.image} alt="" />
              <span>
                {x.name} <small>× {x.quantity}</small>
              </span>
              <b>{money(x.price * x.quantity)}</b>
            </div>
          ))}
          <div className="summary-total">
            <span>Subtotal</span>
            <b>CA{money(subtotal)}</b>
            <span>Shipping</span>
            <b>{shipping ? "CA" + money(shipping) : "Free"}</b>
            <strong>
              Total <em>CA{money(subtotal + shipping)}</em>
            </strong>
          </div>
        </aside>
      </div>
    </section>
  );
}
function Account({ user, setUser, note, add, goShop, authIntent, clearAuthIntent }: any) {
  const [mode, setMode] = useState<"signin" | "signup" | "reset" | "confirm">("signin");
  const [email, setEmail] = useState(""), [password, setPassword] = useState(""), [confirmPassword, setConfirmPassword] = useState("");
  const [firstName, setFirstName] = useState(""), [lastName, setLastName] = useState(""), [busy, setBusy] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState(0), [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [existingUnconfirmed, setExistingUnconfirmed] = useState(false);
  const requestLock = useRef(false);
  useEffect(() => {
    if (!cooldownUntil) return;
    const timer = window.setInterval(() => {
      const seconds = Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000));
      setCooldownSeconds(seconds);
      if (!seconds) setCooldownUntil(0);
    }, 250);
    return () => window.clearInterval(timer);
  }, [cooldownUntil]);
  const startCooldown = (seconds = 120) => { setCooldownUntil(Date.now() + seconds * 1000); setCooldownSeconds(seconds); };
  const changeMode = (next: "signin" | "signup" | "reset") => { setMode(next); setPassword(""); setConfirmPassword(""); };
  const correctEmail = () => { changeMode("signup"); setExistingUnconfirmed(false); setCooldownUntil(0); setCooldownSeconds(0); };
  const requestFailureMessage = (error: unknown) => friendlyAuthError(error) === "We couldn't connect right now. Check your connection and try again." ? "We couldn't request the confirmation email right now. Check your connection and try again." : friendlyAuthError(error);
  const logAuthOutcome = (outcome: string) => { if (import.meta.env.DEV) console.info(`[BALI & LISA GLAM auth] ${outcome}`); };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (requestLock.current || busy || (cooldownSeconds > 0 && mode !== "signin")) return;
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) { note("Enter a valid email address."); return; }
    if (mode === "signup" && (!firstName.trim() || !lastName.trim())) { note("Enter your first and last name."); return; }
    if (mode === "signup" && password.length < 6) { note("Use a password with at least 6 characters."); return; }
    if (mode === "signup" && password !== confirmPassword) { note("Passwords do not match."); return; }
    requestLock.current = true; setBusy(true);
    try {
      if (mode === "reset") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: getAuthRedirectUrl() });
        if (error) throw error;
        note("Check your email for a password-reset link."); return;
      }
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: getAuthRedirectUrl(), data: { first_name: firstName, last_name: lastName } } });
        if (error) throw error;
        if (data.session) { setUser(data.user?.email ?? email); note("Welcome to BALI & LISA GLAM."); }
        else {
          const existing = data.user?.identities?.length === 0;
          setExistingUnconfirmed(existing); setMode("confirm"); startCooldown(60); logAuthOutcome(existing ? "signup accepted for existing unconfirmed account" : "signup confirmation requested");
          note(existing ? "An account with this email is waiting for confirmation." : "Confirmation requested. Check your email.");
        }
        return;
      }
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      setUser(data.user.email ?? email); note("Welcome to BALI & LISA GLAM.");
    } catch (error) { if (isAuthRateLimited(error)) { startCooldown(); logAuthOutcome("signup rate limited"); } else logAuthOutcome("signup request failed"); note(requestFailureMessage(error)); }
    finally { requestLock.current = false; setBusy(false); }
  };
  const resendConfirmation = async () => {
    if (requestLock.current || busy || cooldownSeconds > 0) return;
    requestLock.current = true; setBusy(true);
    try { const { error } = await supabase.auth.resend({ type: "signup", email, options: { emailRedirectTo: getAuthRedirectUrl() } }); if (error) throw error; startCooldown(); logAuthOutcome("resend confirmation requested"); note("Confirmation requested. Delivery can sometimes take a few minutes."); }
    catch (error) { if (isAuthRateLimited(error)) { startCooldown(); logAuthOutcome("resend rate limited"); note("Supabase is temporarily limiting confirmation emails. Please wait a few minutes before requesting another email. Your account request has not been lost."); } else { logAuthOutcome("resend request failed"); note(requestFailureMessage(error)); } }
    finally { requestLock.current = false; setBusy(false); }
  };
  if (authIntent === "recovery") return <RecoveryPassword note={note} done={clearAuthIntent} />;
  if (user) return <section className="account-page"><CustomerDashboard setUser={setUser} note={note} add={add} goShop={goShop} /></section>;
  return <section className="account-page"><div className="account-card">
    {mode === "confirm" ? <><p className="eyebrow">CHECK YOUR EMAIL</p><h1>Check your email.</h1><p>We’ve asked Supabase to send a confirmation link to <b>{email}</b>. Delivery can sometimes take a few minutes.</p>{existingUnconfirmed && <p className="auth-hint">An account with this email is waiting for confirmation. Check your inbox or request a new confirmation email when available.</p>}<div className="auth-delivery-help"><b>Didn’t receive it?</b><span>Check Spam or Junk, confirm the email address above is correct, and wait a few minutes before requesting another email.</span></div><button className="btn dark" disabled={busy || cooldownSeconds > 0} onClick={() => void resendConfirmation()}>{busy ? "Requesting…" : cooldownSeconds ? `Resend available in ${cooldownSeconds}s` : "Resend confirmation email"}</button><div className="account-switch"><button onClick={correctEmail}>Wrong email? Change email address</button><small>Changing this field does not update an existing account. Edit it, then explicitly create an account with the corrected address.</small><button onClick={() => changeMode("signin")}>Already confirmed your email? Sign in</button></div></> : <>
      <p className="eyebrow">{mode === "signup" ? "CREATE ACCOUNT" : mode === "reset" ? "RESET PASSWORD" : "WELCOME IN"}</p><h1>{mode === "signup" ? "Let’s make it official." : mode === "reset" ? "Reset your password." : "Welcome back."}</h1>
      <div className="auth-tabs"><button className={mode === "signin" ? "active" : ""} onClick={() => changeMode("signin")}>Sign In</button><button className={mode === "signup" ? "active" : ""} onClick={() => changeMode("signup")}>Create Account</button></div>
      <form onSubmit={submit}>{mode === "signup" && <><div className="form-row"><label>First name<input required value={firstName} onChange={(event) => setFirstName(event.target.value)} /></label><label>Last name<input required value={lastName} onChange={(event) => setLastName(event.target.value)} /></label></div><p className="auth-hint">Please double-check your email. Your confirmation link will be sent here.</p></>}<label>Email address<input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>{mode !== "reset" && <><label>Password<input required minLength={6} type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={(event) => setPassword(event.target.value)} /></label>{mode === "signup" && <label>Confirm password<input required minLength={6} type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label>}</>}<button className="btn dark" disabled={busy || (cooldownSeconds > 0 && mode !== "signin")}>{busy ? "Please wait…" : cooldownSeconds && mode !== "signin" ? `Try again in ${cooldownSeconds}s` : mode === "signup" ? "Create account" : mode === "reset" ? "Send reset link" : "Sign in"}</button></form>
      <div className="account-switch">{mode !== "reset" && <button onClick={() => changeMode("reset")}>Forgot password?</button>}{mode === "reset" && <button onClick={() => changeMode("signin")}>Back to Sign In</button>}</div>
    </>}
  </div></section>;
}
function RecoveryPassword({ note, done }: any) {
  const [password, setPassword] = useState(""), [confirm, setConfirm] = useState(""), [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (password.length < 6) { note("Use a password with at least 6 characters."); return; }
    if (password !== confirm) { note("Passwords do not match."); return; }
    setBusy(true);
    try { const { error } = await supabase.auth.updateUser({ password }); if (error) throw error; note("Your password has been updated."); done(); }
    catch (error) { note(friendlyAuthError(error)); }
    finally { setBusy(false); }
  };
  return <section className="account-page"><div className="account-card"><p className="eyebrow">CHOOSE A NEW PASSWORD</p><h1>Secure your account.</h1><form onSubmit={submit}><label>New password<input required minLength={6} type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label><label>Confirm new password<input required minLength={6} type="password" autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} /></label><button className="btn dark" disabled={busy}>{busy ? "Updating…" : "Update password"}</button></form></div></section>;
}
function CustomerDashboard({ setUser, note, add, goShop }: any) {
  const [data, setData] = useState<any>(null);
  const [tab, setTab] = useState("Overview");
  const [busy, setBusy] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const load = async () => {
    try { setData(await getCustomerAccount()); }
    catch { note("Your account data could not be loaded."); }
  };
  useEffect(() => { void load(); }, []);
  if (!data) return <section className="account-page"><p>Loading your account…</p></section>;
  const profile = data.profile ?? {};
  const orders = data.orders ?? [];
  const address = data.address ?? {};
  const wish = data.wishlist ?? [];
  const updateProfile = (key: string, value: string) => setData((current: any) => ({ ...current, profile: { ...current.profile, [key]: value } }));
  const updateAddress = (key: string, value: string) => setData((current: any) => ({ ...current, address: { ...(current.address ?? {}), [key]: value } }));
  const save = async (fn: () => Promise<void>, message: string) => {
    setBusy(true);
    try { await fn(); await load(); note(message); }
    catch { note("We could not save your changes."); }
    finally { setBusy(false); }
  };
  const saveAddress = () => {
    const postal = (address.postal_code ?? "").toUpperCase().replace(/\s/g, "");
    if (!/^[ABCEGHJKLMNPRSTVXY]\d[A-Z]\d[A-Z]\d$/.test(postal)) { note("Enter a valid Canadian postal code."); return; }
    void save(() => saveCustomerAddress({ ...address, postal_code: `${postal.slice(0, 3)} ${postal.slice(3)}` }), "Default delivery address saved.");
  };
  return <section className="customer-account"><header><p className="eyebrow">MY ACCOUNT</p><h1>Welcome back, {profile.first_name || data.user.email.split("@")[0]}.</h1></header><nav>{["Overview", "My Orders", "Profile", "Addresses", "Wishlist", "Security"].map((x) => <button className={tab === x ? "active" : ""} onClick={() => setTab(x)} key={x}>{x}</button>)}<button onClick={async () => { await supabase.auth.signOut(); setUser(null); }}>Sign out</button></nav><main>
    {tab === "Overview" && <div className="account-summary"><article><b>{orders.length}</b><span>Orders</span></article><article><b>{orders.filter((o: any) => o.payment_status === "awaiting_payment").length}</b><span>Awaiting payment</span></article><article><b>{orders.filter((o: any) => o.payment_status === "paid").length}</b><span>Paid orders</span></article><article><b>{wish.length}</b><span>Saved items</span></article></div>}
    {tab === "My Orders" && <CustomerOrders orders={orders} refresh={load} />}
    {tab === "Profile" && <form className="account-form" onSubmit={(event) => { event.preventDefault(); void save(() => saveCustomerProfile(profile), "Profile saved."); }}><label>First name<input value={profile.first_name ?? ""} onChange={(event) => updateProfile("first_name", event.target.value)} /></label><label>Last name<input value={profile.last_name ?? ""} onChange={(event) => updateProfile("last_name", event.target.value)} /></label><label>Email<input disabled value={profile.email ?? ""} /></label><label>Phone<input value={profile.phone ?? ""} onChange={(event) => updateProfile("phone", event.target.value)} /></label><button className="btn dark" disabled={busy}>Save changes</button></form>}
    {tab === "Addresses" && <form className="account-form" onSubmit={(event) => { event.preventDefault(); saveAddress(); }}>{["first_name", "last_name", "address", "unit", "city", "province", "postal_code", "country", "phone"].map((key) => <label key={key}>{key.replace("_", " ")}<input required={key !== "unit"} value={address[key] ?? (key === "country" ? "Canada" : "")} onChange={(event) => updateAddress(key, event.target.value)} /></label>)}<button className="btn dark" disabled={busy}>Save address</button></form>}
    {tab === "Wishlist" && <div className="wishlist-grid">{wish.length ? wish.map((row: any) => { const p = row.products; const available = p?.is_active && p?.inventory_quantity > 0; return p && <article key={p.id}><img src={p.image_url} alt={p.name} /><b>{p.name}</b><span>{money(p.price_cents / 100)}</span><small>{available ? "Available" : "Currently unavailable"}</small>{available && <button className="btn dark" onClick={() => add({ id: p.id, name: p.name, category: "Saved item", price: p.price_cents / 100, rating: 0, reviews: 0, image: p.image_url, description: "", shades: ["Universal"], inventory: p.inventory_quantity })}>Add to bag</button>}<button onClick={() => void save(() => toggleWishlist(p.id, true), "Removed from wishlist.")}>Remove</button></article>; }) : <p>Your wishlist is waiting for something beautiful. <button className="text" onClick={goShop}>Explore products</button></p>}</div>}
    {tab === "Security" && <div className="account-form"><p>Use a secure password to protect your account.</p><form onSubmit={(event) => { event.preventDefault(); if (newPassword.length < 6) { note("Use a password with at least 6 characters."); return; } if (newPassword !== confirmNewPassword) { note("Passwords do not match."); return; } void save(async () => { const { error } = await supabase.auth.updateUser({ password: newPassword }); if (error) throw error; setNewPassword(""); setConfirmNewPassword(""); }, "Your password has been updated."); }}><label>New password<input required minLength={6} type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></label><label>Confirm new password<input required minLength={6} type="password" value={confirmNewPassword} onChange={(event) => setConfirmNewPassword(event.target.value)} /></label><button className="btn dark" disabled={busy}>Update password</button></form><button className="text" onClick={async () => { const { error } = await supabase.auth.resetPasswordForEmail(profile.email, { redirectTo: getAuthRedirectUrl() }); note(error ? "We could not send your password-reset link." : "Check your email for a password-reset link."); }}>Send a password-reset link instead</button></div>}
  </main></section>;
}
function CustomerOrders({ orders, refresh }: any) {
  const [filter, setFilter] = useState("all");
  const [detail, setDetail] = useState<string | null>(null);
  const list = orders.filter((order: any) => filter === "all" || order.payment_status === filter || order.status === filter);
  return <section className="customer-orders"><button className="text" onClick={() => void refresh()}>Refresh status</button><select aria-label="Filter orders" value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">All Orders</option><option value="awaiting_payment">Awaiting Payment</option><option value="paid">Paid</option><option value="fulfilled">Fulfilled</option></select>{list.length ? list.map((order: any) => { const delivery = order.shipping_address ?? {}; return <article key={order.id}><button className="order-open" onClick={() => setDetail(detail === order.id ? null : order.id)}><b>Order #{order.order_number}</b><span>{new Date(order.created_at).toLocaleDateString("en-CA")} · {money(order.total_cents / 100)}</span><span>Payment: {paymentStatusLabel(order.payment_status)} · {orderStatusLabel(order.status)}</span></button>{detail === order.id && <div className="customer-order-detail"><p>{order.payment_status === "paid" ? "Payment successful — your payment has been confirmed." : "Payment awaiting confirmation. If you have sent your receipt, no further action is required unless we contact you."}</p><p><b>Delivery</b><br />{[delivery.address, delivery.unit, delivery.city, delivery.province, delivery.postal_code, delivery.country].filter(Boolean).join(", ") || "Delivery details are on file."}</p>{order.order_items.map((item: any, index: number) => <div key={`${item.product_name}-${index}`}><b>{item.product_name}</b><span>{item.shade ? `${item.shade} · ` : ""}Qty {item.quantity} · {money(item.unit_price_cents / 100)} each · {money(item.unit_price_cents * item.quantity / 100)}</span></div>)}<p>Merchandise: {money(order.subtotal_cents / 100)} · Shipping: {money(order.shipping_cents / 100)} · Total: {money(order.total_cents / 100)}</p></div>}</article>; }) : <p>You haven’t placed any orders yet.</p>}</section>;
}
function AdminGuard({ user, go, note }: any) {
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    void getProfile()
      .then(({ profile }) => setIsAdmin(profile?.role === "admin"))
      .catch(() => setIsAdmin(false));
  }, [user]);
  if (isAdmin) return <Admin note={note} />;
  return (
    <section className="admin-gate">
      <div>
        <p className="eyebrow">RESTRICTED AREA</p>
        <h1>Studio is for the BALI & LISA team.</h1>
        <p>
          Product, order, and customer tools are available only to authenticated administrators.
        </p>
        <button className="btn dark" onClick={() => go("account")}>
          {user ? "Request administrator access" : "Sign in as admin"} <ArrowRight size={17} />
        </button>
        <button className="text" onClick={() => go("home")}>
          Return to storefront
        </button>
        <small>Access is determined by your secure Supabase profile role.</small>
      </div>
    </section>
  );
}
function Admin({ note }: any) {
  const [active, setActive] = useState("Overview"),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [metrics, setMetrics] = useState<any>(null),
    [adminProducts, setAdminProducts] = useState<any[]>([]),
    [orders, setOrders] = useState<any[]>([]),
    [customers, setCustomers] = useState<any[]>([]),
    [categories, setCategories] = useState<any[]>([]),
    [settings, setSettings] = useState<any>(null),
    [editing, setEditing] = useState<any>(null),
    [imageFile, setImageFile] = useState<File | null>(null),
    [imagePreview, setImagePreview] = useState(""),
    [uploadingImage, setUploadingImage] = useState(false),
    [editorError, setEditorError] = useState(""),
    [query, setQuery] = useState("");
  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [m, p, o, c, cs, s] = await Promise.all([
        getAdminMetrics(),
        fetchAdminProducts(query),
        fetchAdminOrders(),
        fetchCustomers(),
        fetchAdminCategories(),
        getSettings(),
      ]);
      setMetrics(m);
      setAdminProducts(p);
      setOrders(o);
      setCustomers(c);
      setCategories(cs);
      setSettings(s);
    } catch {
      setError("Studio data could not be loaded. Please refresh and try again.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, []);
  useEffect(() => {
    if (!editing) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setEditing(null);
        setImageFile(null);
        setImagePreview("");
        setEditorError("");
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [editing]);
  const saveProduct = async (e: FormEvent) => {
    e.preventDefault();
    try {
      setEditorError("");
      let imageUrl = editing.image_url;
      if (imageFile) {
        setUploadingImage(true);
        imageUrl = await uploadProductImage(imageFile);
        setUploadingImage(false);
      }
      await saveAdminProduct({ ...editing, image_url: imageUrl }, editing.id);
      setEditing(null);
      setImageFile(null);
      setImagePreview("");
      await load();
      note("Product saved.");
    } catch (saveError: any) {
      console.error("Studio product save failed:", saveError);
      const message = saveError?.code === "23505"
        ? "A product with this slug already exists. Choose a unique slug."
        : "We couldn't save this product. Please review the details and try again.";
      setEditorError(message);
      note(message);
    } finally {
      setUploadingImage(false);
    }
  };
  const closeEditor = () => {
    setEditing(null);
    setImageFile(null);
    setImagePreview("");
    setEditorError("");
  };
  const chooseProductImage = (file?: File) => {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setEditorError("Choose a JPG, PNG, or WEBP image.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setEditorError("Choose an image smaller than 5 MB.");
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setEditorError("");
  };
  return (
    <section className="admin">
      <aside className="admin-nav">
        <button className="wordmark">
          BALI & LISA <i>GLAM</i>
        </button>
        <p>ADMIN STUDIO</p>
        {["Overview", "Products", "Orders", "Customers", "Settings"].map((x) => (
          <button className={active === x ? "selected" : ""} onClick={() => setActive(x)} key={x}>
            {x}
          </button>
        ))}
      </aside>
      <div className="admin-main">
        <header>
          <div>
            <p className="eyebrow">{active.toUpperCase()}</p>
            <h1>{active === "Overview" ? "Good morning, Lisa." : active}</h1>
          </div>
          {active === "Products" && (
            <button
              className="btn dark"
              onClick={() => {
                setImageFile(null);
                setImagePreview("");
                setEditorError("");
                setEditing({
                  name: "",
                  slug: "",
                  description: "",
                  price_cents: 0,
                  inventory_quantity: 0,
                  category_id: categories[0]?.id ?? null,
                  image_url: "",
                  shades: ["Universal"],
                  is_active: true,
                });
              }}
            >
              <Plus size={17} /> Add product
            </button>
          )}
        </header>
        {loading ? (
          <p>Loading Studio data…</p>
        ) : error ? (
          <div className="empty">
            <h3>{error}</h3>
            <button className="btn dark" onClick={() => void load()}>
              Try again
            </button>
          </div>
        ) : active === "Overview" ? (
          <AdminOverview
            metrics={metrics}
            products={adminProducts}
            openProducts={() => setActive("Products")}
          />
        ) : active === "Products" ? (
          <AdminProducts
            products={adminProducts}
            categories={categories}
            query={query}
            setQuery={setQuery}
            edit={(product: any) => {
              setImageFile(null);
              setImagePreview("");
              setEditorError("");
              setEditing(product);
            }}
            archive={async (id: number) => {
              if (confirm("Archive this product? It will remain in order history.")) {
                await archiveProduct(id);
                await load();
                note("Product archived.");
              }
            }}
            restore={async (id: number) => {
              try {
                await restoreProduct(id);
                await load();
                note("Product restored to the store.");
              } catch (restoreError) {
                console.error("Studio product restore failed:", restoreError);
                note("Product could not be restored.");
              }
            }}
            remove={async (product: any) => {
              if (confirm(`Permanently delete ${product.name}? This cannot be undone.`)) {
                try {
                  await deleteAdminProduct(product.id);
                  await load();
                  note("Product permanently deleted.");
                } catch (deleteError) {
                  console.error("Studio product deletion failed:", deleteError);
                  note("Product could not be deleted.");
                }
              }
            }}
          />
        ) : active === "Orders" ? (
          <AdminOrders orders={orders} refresh={load} note={note} />
        ) : active === "Customers" ? (
          <AdminCustomers customers={customers} />
        ) : (
          <AdminSettings
            settings={settings}
            setSettings={setSettings}
            save={async () => {
              await saveSettings(settings);
              note("Settings saved.");
            }}
          />
        )}
        {editing && (
          <div
            className="overlay show"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) closeEditor();
            }}
          >
            <form className="product-editor" onSubmit={saveProduct}>
              <header className="product-editor-header">
                <div>
                  <p className="eyebrow">PRODUCT CATALOG</p>
                  <h2>{editing.id ? "Edit product" : "Add product"}</h2>
                </div>
                <button
                  type="button"
                  className="icon product-editor-close"
                  aria-label="Close product editor"
                  onClick={closeEditor}
                >
                  <X size={22} />
                </button>
              </header>
              <div className="product-editor-content">
                <div className="image-upload-field">
                  <label htmlFor="product-image-file">Product image</label>
                  <input
                    id="product-image-file"
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                    onChange={(event) => chooseProductImage(event.target.files?.[0])}
                  />
                  <small>{imageFile ? imageFile.name : "JPG, PNG, or WEBP. Maximum 5 MB."}</small>
                  {(imagePreview || editing.image_url) && (
                    <img
                      className="product-image-preview"
                      src={imagePreview || editing.image_url}
                      alt="Product image preview"
                    />
                  )}
                </div>
                {[
                  ["name", "Name"],
                  ["slug", "Slug"],
                  ["description", "Description"],
                  ["price_cents", "Price (cents)"],
                  ["inventory_quantity", "Stock"],
                ].map(([key, label]) => (
                  <label key={key}>
                    {label}
                    <input
                      required
                      value={editing[key] ?? ""}
                      onChange={(e) =>
                        setEditing({
                          ...editing,
                          [key]:
                            key === "price_cents" || key === "inventory_quantity"
                              ? Number(e.target.value)
                              : e.target.value,
                        })
                      }
                    />
                  </label>
                ))}
                <label>
                  Image URL (optional fallback)
                  <input
                    required={!imageFile}
                    value={editing.image_url ?? ""}
                    onChange={(event) => setEditing({ ...editing, image_url: event.target.value })}
                  />
                </label>
                <label>
                  Category
                  <select
                    value={editing.category_id ?? ""}
                    onChange={(e) =>
                      setEditing({ ...editing, category_id: Number(e.target.value) })
                    }
                  >
                    {categories.map((c) => (
                      <option value={c.id} key={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                {editorError && (
                  <p className="product-editor-error" role="alert">
                    {editorError}
                  </p>
                )}
              </div>
              <footer className="product-editor-footer">
                <button type="button" className="btn editor-cancel" onClick={closeEditor}>
                  Cancel
                </button>
                <button className="btn dark" disabled={uploadingImage}>
                  {uploadingImage ? "Uploading image…" : "Save product"}
                </button>
              </footer>
            </form>
          </div>
        )}
      </div>
    </section>
  );
}
function AdminOverview({ metrics, products, openProducts }: any) {
  return (
    <>
      <div className="stats">
        {[
          ["Paid revenue", money(metrics?.sales ?? 0)],
          ["Active orders", String(metrics?.activeOrders?.length ?? 0)],
          ["Awaiting payment", String(metrics?.awaitingPayment ?? 0)],
          ["Paid orders", String(metrics?.paidOrders ?? 0)],
          ["Customers", String(metrics?.customers ?? 0)],
          ["Active products", String(metrics?.activeProducts ?? 0)],
          ["Low stock", String(metrics?.lowStock ?? 0)],
        ].map((x) => (
          <div className="stat" key={x[0]}>
            <span>{x[0]}</span>
            <b>{x[1]}</b>
            <small>
              {x[0] === "Paid revenue" ? "Confirmed payments only" : "Live Supabase data"}
            </small>
          </div>
        ))}
      </div>
      <section className="inventory">
        <div className="inventory-head">
          <h2>Product inventory</h2>
          <button className="text" onClick={openProducts}>
            Manage products <ArrowRight size={16} />
          </button>
        </div>
        <div className="table-head">
          <span>PRODUCT</span>
          <span>STATUS</span>
          <span>IN STOCK</span>
          <span>PRICE</span>
        </div>
        {products.slice(0, 5).map((p: any) => (
          <div className="table-row" key={p.id}>
            <span className="table-product">
              <img src={p.image_url} alt="" />
              <b>
                {p.name}
                <small>{p.categories?.name}</small>
              </b>
            </span>
            <span>{p.is_active ? "Active" : "Archived"}</span>
            <span>{p.inventory_quantity}</span>
            <span>{money(p.price_cents / 100)}</span>
          </div>
        ))}
      </section>
    </>
  );
}
function AdminProducts({ products, query, setQuery, edit, archive, restore, remove }: any) {
  return (
    <section className="inventory product-inventory">
      <input
        className="product-search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search products"
      />
      <div className="product-table-head">
        <span>PRODUCT</span>
        <span>CATEGORY</span>
        <span>STATUS</span>
        <span>IN STOCK</span>
        <span>PRICE</span>
        <span>EDIT</span>
        <span>STORE VISIBILITY</span>
        <span>DELETE</span>
      </div>
      {products.map((p: any) => (
        <article className="product-table-row" key={p.id}>
          <div className="table-product" data-label="Product">
            <img src={p.image_url} alt="" />
            <b>
              {p.name}
            </b>
          </div>
          <div data-label="Category">{p.categories?.name ?? "Uncategorized"}</div>
          <div data-label="Status">
            <span className={`product-status ${p.is_active ? "is-active" : "is-archived"}`}>
              {p.is_active ? "Active" : "Archived"}
            </span>
          </div>
          <div data-label="In stock">{p.inventory_quantity}</div>
          <div data-label="Price">{money(p.price_cents / 100)}</div>
          <div data-label="Edit">
            <button
              className="product-table-action"
              onClick={() =>
                edit({ ...p, category_id: p.categories?.id, shades: p.shades ?? ["Universal"] })
              }
            >
              Edit
            </button>
          </div>
          <div data-label="Store visibility">
            {p.is_active ? (
              <button className="product-table-action" onClick={() => archive(p.id)}>
                Remove from store
              </button>
            ) : (
              <button className="product-table-action restore-product" onClick={() => restore(p.id)}>
                Restore to store
              </button>
            )}
          </div>
          <div data-label="Delete">
            <button className="delete-product product-table-action" onClick={() => remove(p)}>
              Delete product
            </button>
          </div>
        </article>
      ))}
    </section>
  );
}
const paymentMethodLabel = (method?: string | null) =>
  ({ manual_whatsapp: "WhatsApp", manual_email: "Email", stripe: "Stripe" })[method ?? ""] ??
  "Manual";
const paymentStatusLabel = (status?: string | null) =>
  ({ awaiting_payment: "Awaiting Payment", paid: "Paid", cancelled: "Cancelled" })[
    status ?? ""
  ] ?? "Awaiting Payment";
const orderStatusLabel = (status?: string | null) =>
  ({ pending: "Pending", paid: "Paid", fulfilled: "Fulfilled", cancelled: "Cancelled", refunded: "Refunded" })[
    status ?? ""
  ] ?? "Pending";

function AdminOrders({ orders, refresh, note }: any) {
  const [view, setView] = useState<"active" | "archived">("active");
  const [search, setSearch] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [methodFilter, setMethodFilter] = useState("all");
  const [sort, setSort] = useState("newest");
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const visibleOrders = useMemo(() => orders
    .filter((order: any) => view === "archived" ? Boolean(order.archived_at) : !order.archived_at)
    .filter((order: any) => {
      const customer = `${order.profiles?.first_name ?? ""} ${order.profiles?.last_name ?? ""} ${order.profiles?.email ?? ""}`.toLowerCase();
      return !search.trim() || String(order.order_number ?? "").includes(search.trim()) || customer.includes(search.trim().toLowerCase());
    })
    .filter((order: any) => paymentFilter === "all" || (order.payment_status ?? "awaiting_payment") === paymentFilter)
    .filter((order: any) => statusFilter === "all" || order.status === statusFilter)
    .filter((order: any) => methodFilter === "all" || order.payment_method === methodFilter)
    .sort((a: any, b: any) => sort === "oldest" ? +new Date(a.created_at) - +new Date(b.created_at) : sort === "highest" ? b.total_cents - a.total_cents : sort === "lowest" ? a.total_cents - b.total_cents : +new Date(b.created_at) - +new Date(a.created_at)), [orders, view, search, paymentFilter, statusFilter, methodFilter, sort]);
  const runBulk = async (action: "archive" | "delete") => {
    if (!selected.length) return;
    const confirmed = action === "delete"
      ? confirm(`Permanently delete ${selected.length} selected order${selected.length === 1 ? "" : "s"}? This cannot be undone.`)
      : confirm(`Archive ${selected.length} selected order${selected.length === 1 ? "" : "s"}?`);
    if (!confirmed) return;
    setBusy(true);
    try {
      if (action === "delete") await deleteOrders(selected); else await archiveOrders(selected);
      setSelected([]); await refresh(); note(action === "delete" ? "Selected orders permanently deleted." : "Selected orders archived.");
    } catch (error) { console.error("Studio bulk order action failed:", error); note("The selected orders could not be updated."); }
    finally { setBusy(false); }
  };
  const toggleSelected = (id: string) => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  return <section className="inventory orders-list">
    <div className="order-controls">
      <div className="order-view-tabs"><button className={view === "active" ? "selected" : ""} onClick={() => { setView("active"); setSelected([]); }}>Active orders</button><button className={view === "archived" ? "selected" : ""} onClick={() => { setView("archived"); setSelected([]); }}>Archived orders</button></div>
      <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search order number or customer" />
      <select value={paymentFilter} onChange={(event) => setPaymentFilter(event.target.value)}><option value="all">All payment statuses</option><option value="awaiting_payment">Awaiting Payment</option><option value="paid">Paid</option><option value="cancelled">Cancelled</option></select>
      <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">All order statuses</option>{["pending", "paid", "fulfilled", "cancelled", "refunded"].map((status) => <option value={status} key={status}>{orderStatusLabel(status)}</option>)}</select>
      <select value={methodFilter} onChange={(event) => setMethodFilter(event.target.value)}><option value="all">All payment methods</option><option value="manual_whatsapp">WhatsApp</option><option value="manual_email">Email</option></select>
      <select value={sort} onChange={(event) => setSort(event.target.value)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="highest">Highest total</option><option value="lowest">Lowest total</option></select>
    </div>
    {selected.length > 0 && <div className="order-bulk-actions"><b>{selected.length} selected</b>{view === "active" && <button disabled={busy} onClick={() => void runBulk("archive")}>Archive selected</button>}<button className="delete-product" disabled={busy} onClick={() => void runBulk("delete")}>Delete selected permanently</button></div>}
    {visibleOrders.length ? visibleOrders.map((o: any) => {
      const customerName = [o.profiles?.first_name, o.profiles?.last_name].filter(Boolean).join(" ") || "Customer";
      const address = o.shipping_address ?? {};
      return <article className="order-card" key={o.id}>
        <header className="order-card-header"><label className="order-select"><input type="checkbox" checked={selected.includes(o.id)} onChange={() => toggleSelected(o.id)} /><span className="sr-only">Select order #{o.order_number}</span></label><div><p>Order reference</p><h2>#{o.order_number ?? o.id.slice(0, 8)}</h2></div><span className={`status-badge payment-${o.payment_status ?? "awaiting_payment"}`}>Payment: {paymentStatusLabel(o.payment_status)}</span></header>
        <div className="order-meta"><div><span>Customer</span><b>{customerName}</b><small>{o.profiles?.email ?? "No email available"}</small></div><div><span>Date</span><b>{new Date(o.created_at).toLocaleString("en-CA")}</b></div><div><span>Total</span><b>{money(o.total_cents / 100)}</b></div><div><span>Payment method</span><b>{paymentMethodLabel(o.payment_method)}</b></div></div>
        <div className="order-products"><h3>Products</h3><ul>{o.order_items?.map((item: any) => <li key={`${o.id}-${item.product_name}-${item.shade ?? "standard"}`}><b>{item.product_name}</b>{item.shade && <span>Color/Variant: {item.shade}</span>}<span>Quantity: {item.quantity} · {money(item.unit_price_cents / 100)} each · Subtotal: {money((item.unit_price_cents * item.quantity) / 100)}</span></li>)}</ul></div>
        {detailId === o.id && <div className="order-detail"><div><span>Delivery</span><b>{[address.address, address.unit, `${address.city ?? ""}${address.province ? `, ${address.province}` : ""}`, address.postal_code, address.country].filter(Boolean).join(" · ")}</b><small>{address.phone ? `Phone: ${address.phone}` : ""}</small></div><div><span>Payment</span><b>{paymentMethodLabel(o.payment_method)} · {paymentStatusLabel(o.payment_status)}</b><small>{o.paid_at ? `Paid: ${new Date(o.paid_at).toLocaleString("en-CA")}` : "Not yet paid"}</small></div><div><span>Totals</span><b>Shipping {money(o.shipping_cents / 100)} · Total {money(o.total_cents / 100)}</b><small>Order status: {orderStatusLabel(o.status)}</small></div></div>}
        <div className="order-actions"><button className="product-table-action" onClick={() => setDetailId(detailId === o.id ? null : o.id)}>{detailId === o.id ? "Hide details" : "View details"}</button><div><span>Order status</span><label className="status-select"><span className="sr-only">Order status</span><select value={o.status} onChange={async (event) => { try { await updateOrderStatus(o.id, event.target.value as any); await refresh(); note("Order status updated."); } catch (error) { console.error("Order status update failed:", error); note("Order status could not be updated."); } }}>{["pending", "paid", "fulfilled", "cancelled", "refunded"].map((status) => <option key={status} value={status}>{orderStatusLabel(status)}</option>)}</select></label></div>
          {o.payment_status === "awaiting_payment" && <button type="button" className="btn dark order-payment-action" onClick={async () => { if (confirm(`Confirm that you independently verified payment for Order #${o.order_number}?`)) { try { await confirmManualPayment(o.id); await refresh(); note("Payment marked as paid."); } catch (error) { console.error("Payment confirmation failed:", error); note("Payment could not be confirmed."); } } }}>Mark as Paid</button>}
          {view === "active" ? <button className="product-table-action" onClick={async () => { try { await archiveOrders([o.id]); await refresh(); note("Order archived."); } catch (error) { console.error("Order archive failed:", error); note("Order could not be archived."); } }}>Archive order</button> : <button className="product-table-action restore-product" onClick={async () => { try { await restoreOrder(o.id); await refresh(); note("Order restored."); } catch (error) { console.error("Order restore failed:", error); note("Order could not be restored."); } }}>Restore order</button>}
          <button className="delete-product product-table-action" onClick={async () => { if (confirm(`Permanently delete Order #${o.order_number}? This cannot be undone.`)) { try { await deleteOrders([o.id]); await refresh(); note("Order permanently deleted."); } catch (error) { console.error("Order deletion failed:", error); note("Order could not be deleted."); } } }}>Delete order permanently</button></div>
      </article>;
    }) : <p>No {view} orders match these filters.</p>}
  </section>;
}
function AdminCustomers({ customers }: any) {
  return (
    <section className="inventory">
      {customers.length ? (
        customers.map((c: any) => (
          <div className="table-row" key={c.id}>
            <span>
              <b>{[c.first_name, c.last_name].filter(Boolean).join(" ") || "Customer"}</b>
              <small>{c.email}</small>
            </span>
            <span>{c.role}</span>
            <span>{c.orders?.length ?? 0} orders</span>
            <span>
              {money(
                (c.orders ?? []).reduce((sum: number, o: any) => sum + o.total_cents, 0) / 100,
              )}
            </span>
          </div>
        ))
      ) : (
        <p>No customers yet.</p>
      )}
    </section>
  );
}
function AdminSettings({ settings, setSettings, save }: any) {
  if (!settings) return <p>No settings found.</p>;
  return (
    <form
      className="account-card"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      {[
        ["business_name", "Business name"],
        ["business_email", "Business email"],
        ["whatsapp_number", "WhatsApp number"],
        ["free_shipping_threshold_cents", "Free shipping threshold (cents)"],
        ["standard_shipping_cents", "Standard shipping (cents)"],
        ["bank_transfer_instructions", "Bank transfer instructions"],
      ].map(([key, label]) => (
        <label key={key}>
          {label}
          <input
            value={settings[key] ?? ""}
            onChange={(e) =>
              setSettings({
                ...settings,
                [key]: key.includes("cents") ? Number(e.target.value) : e.target.value,
              })
            }
          />
        </label>
      ))}
      <button className="btn dark">Save settings</button>
    </form>
  );
}
function Footer({ go, note }: any) {
  const subscribe = (e: FormEvent) => {
    e.preventDefault();
    note("You are on the Glow List — welcome in.");
  };
  return (
    <footer>
      <div className="footer-top">
        <div>
          <button className="wordmark" onClick={() => go("home")}>
            BALI & LISA <i>GLAM</i>
          </button>
          <p>
            Beauty in its most personal form.
            <br />
            Made for your real, radiant life.
          </p>
        </div>
        <div>
          <h4>Shop</h4>
          <button onClick={() => go("shop")}>New arrivals</button>
          <button onClick={() => go("shop")}>Best sellers</button>
          <button onClick={() => go("shop")}>Skincare</button>
        </div>
        <div>
          <h4>About</h4>
          <button onClick={() => go("story")}>Our story</button>
          <button onClick={() => go("guide")}>Beauty guide</button>
          <button onClick={() => go("account")}>My account</button>
        </div>
        <div>
          <h4>Stay in the know</h4>
          <p>Beauty notes in your inbox. No noise, only glow.</p>
          <form className="footer-email" onSubmit={subscribe}>
            <input required type="email" placeholder="Email address" />
            <button aria-label="Subscribe">
              <ArrowRight size={17} />
            </button>
          </form>
        </div>
      </div>
      <div className="footer-bottom">
        <span>© 2026 BALI & LISA GLAM</span>
        <span>Privacy · Terms · Accessibility</span>
        <span>@balilisaglam</span>
      </div>
    </footer>
  );
}

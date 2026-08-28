import lipoil1 from "@/assets/products/lipoil-1.jpg";
import lipbalm1 from "@/assets/products/lipbalm-1.jpg";
import skincare1 from "@/assets/products/skincare-1.jpg";
import accessory1 from "@/assets/products/accessory-1.jpg";

export type Category = "lip-gloss" | "lip-oil" | "lip-balm" | "skincare" | "accessories";

export const categories: { slug: Category; label: string; blurb: string }[] = [
  { slug: "lip-gloss", label: "Lip Gloss", blurb: "High-shine, non-sticky finishes" },
  { slug: "lip-oil", label: "Lip Oil", blurb: "Hydrating, glassy lip treatments" },
  { slug: "lip-balm", label: "Lip Balm", blurb: "Soothing, conditioning care" },
  { slug: "skincare", label: "Skincare", blurb: "Glow-getter essentials" },
  { slug: "accessories", label: "Accessories", blurb: "Beauty tools & vanity must-haves" },
];

export type Review = {
  id: string;
  author: string;
  rating: number;
  title: string;
  body: string;
  date: string;
};

export type Product = {
  id: string;
  slug: string;
  name: string;
  category: Category;
  price: number;
  compareAt?: number;
  image: string;
  shortDesc: string;
  description: string;
  highlights: string[];
  ingredients: string;
  rating: number;
  reviewCount: number;
  reviews: Review[];
  badges?: ("new" | "best-seller" | "limited")[];
  stock: number;
};

const baseReviews: Review[] = [
  { id: "r1", author: "Sophie M.", rating: 5, title: "Obsessed", body: "Glides on like silk. My new everyday gloss.", date: "2025-04-12" },
  { id: "r2", author: "Amélie R.", rating: 5, title: "Worth every penny", body: "Beautifully packaged and the color is divine.", date: "2025-03-02" },
  { id: "r3", author: "Jess T.", rating: 4, title: "Loved it", body: "Lasts a long time and feels luxurious.", date: "2025-02-19" },
];

export const products: Product[] = [
  {
    id: "p1", slug: "rose-petal-lip-gloss", name: "Rose Petal Lip Gloss", category: "lip-gloss",
    price: 28, compareAt: 34, image: lipoil1,
    shortDesc: "Mirror-shine gloss in a soft rose petal hue.",
    description: "A weightless, mirror-finish gloss tinted with crushed rose pigments. Hydrates with squalane and vitamin E for plush, kissable lips.",
    highlights: ["Non-sticky, mirror finish", "Squalane + vitamin E", "Vegan & cruelty-free", "Made in Canada"],
    ingredients: "Caprylic/Capric Triglyceride, Squalane, Tocopherol, Hydrogenated Polyisobutene, Mica, Rosa Damascena Extract.",
    rating: 4.9, reviewCount: 412, reviews: baseReviews,
    badges: ["best-seller"], stock: 48,
  },
  {
    id: "p2", slug: "honey-glaze-lip-oil", name: "Honey Glaze Lip Oil", category: "lip-oil",
    price: 32, image: lipoil1,
    shortDesc: "Glassy plumping oil with sweet honey notes.",
    description: "An ultra-glossy lip oil that floods lips with moisture. Lightweight, never tacky, with a subtle warm-honey scent.",
    highlights: ["Plumping peptide complex", "Glassy mirror finish", "Subtle honey scent"],
    ingredients: "Helianthus Annuus Seed Oil, Squalane, Ricinus Communis Oil, Tocopherol, Aroma.",
    rating: 4.8, reviewCount: 287, reviews: baseReviews,
    badges: ["new", "best-seller"], stock: 32,
  },
  {
    id: "p3", slug: "rosé-quartz-lip-balm", name: "Rosé Quartz Lip Balm", category: "lip-balm",
    price: 22, image: lipbalm1,
    shortDesc: "Buttery balm in a chic refillable pot.",
    description: "A melt-in balm that wraps lips in 24-hour comfort. Pure shea butter and rosehip oil heal and soften overnight.",
    highlights: ["24h hydration", "Shea butter + rosehip oil", "Refillable pot"],
    ingredients: "Butyrospermum Parkii, Rosa Canina Oil, Cera Alba, Tocopherol.",
    rating: 4.9, reviewCount: 533, reviews: baseReviews,
    badges: ["best-seller"], stock: 64,
  },
  {
    id: "p4", slug: "luminous-glow-serum", name: "Luminous Glow Serum", category: "skincare",
    price: 64, compareAt: 72, image: skincare1,
    shortDesc: "Brightening niacinamide + vitamin C serum.",
    description: "A featherlight serum that fades dullness and evens skin tone in 4 weeks. Powered by 10% niacinamide and stabilized vitamin C.",
    highlights: ["10% niacinamide", "Stabilized vitamin C", "Fragrance-free"],
    ingredients: "Aqua, Niacinamide, Ascorbyl Glucoside, Glycerin, Panthenol, Hyaluronic Acid.",
    rating: 4.7, reviewCount: 189, reviews: baseReviews,
    badges: ["new"], stock: 26,
  },
  {
    id: "p5", slug: "rose-gold-brush-trio", name: "Rose Gold Brush Trio", category: "accessories",
    price: 58, image: accessory1,
    shortDesc: "Vegan brush set for flawless face artistry.",
    description: "Three weighted brushes in signature rose gold, hand-cut with vegan fibers. Includes powder, blush, and contour brush.",
    highlights: ["Vegan fibers", "Weighted handle", "Signature rose gold"],
    ingredients: "Aluminum, Synthetic Taklon Fibers.",
    rating: 4.8, reviewCount: 96, reviews: baseReviews, stock: 18,
  },
  {
    id: "p6", slug: "midnight-bloom-lip-gloss", name: "Midnight Bloom Lip Gloss", category: "lip-gloss",
    price: 28, image: lipoil1,
    shortDesc: "Deep berry shimmer for after-dark drama.",
    description: "A jewel-toned berry gloss with subtle gold flecks. Same hydrating formula as Rose Petal in a moodier shade.",
    highlights: ["Plumping shine", "Vitamin E", "Vegan"],
    ingredients: "Caprylic/Capric Triglyceride, Squalane, Mica.",
    rating: 4.7, reviewCount: 152, reviews: baseReviews, stock: 22,
  },
  {
    id: "p7", slug: "vanilla-cream-lip-balm", name: "Vanilla Cream Lip Balm", category: "lip-balm",
    price: 22, image: lipbalm1,
    shortDesc: "Warm vanilla balm for everyday softness.",
    description: "A cozy vanilla-scented balm that melts into lips for soft, hydrated comfort.",
    highlights: ["Subtle vanilla", "Shea + jojoba", "Refillable"],
    ingredients: "Butyrospermum Parkii, Simmondsia Chinensis Oil, Aroma.",
    rating: 4.8, reviewCount: 207, reviews: baseReviews, stock: 41,
  },
  {
    id: "p8", slug: "peach-nectar-lip-oil", name: "Peach Nectar Lip Oil", category: "lip-oil",
    price: 32, image: lipoil1,
    shortDesc: "Juicy peach-tinted glossy oil treatment.",
    description: "A sheer peach-tinted oil that hydrates and adds a juicy flush of color.",
    highlights: ["Peach tint", "Plumping complex", "Glassy finish"],
    ingredients: "Helianthus Annuus Seed Oil, Squalane, Aroma.",
    rating: 4.6, reviewCount: 138, reviews: baseReviews,
    badges: ["new"], stock: 30,
  },
  {
    id: "p9", slug: "hydra-dew-moisturizer", name: "Hydra Dew Moisturizer", category: "skincare",
    price: 48, image: skincare1,
    shortDesc: "Cushiony daily moisturizer for dewy skin.",
    description: "A bouncy gel-cream that quenches thirsty skin with hyaluronic acid and ceramides.",
    highlights: ["Hyaluronic + ceramides", "Lightweight gel-cream", "Fragrance-free"],
    ingredients: "Aqua, Glycerin, Sodium Hyaluronate, Ceramide NP.",
    rating: 4.8, reviewCount: 221, reviews: baseReviews, stock: 19,
  },
  {
    id: "p10", slug: "silk-vanity-pouch", name: "Silk Vanity Pouch", category: "accessories",
    price: 38, image: accessory1,
    shortDesc: "Quilted blush silk travel pouch.",
    description: "A chic quilted silk pouch — perfect for carrying your daily lip ritual.",
    highlights: ["Quilted silk", "Magnetic close", "Travel-perfect"],
    ingredients: "100% mulberry silk shell, recycled satin lining.",
    rating: 4.9, reviewCount: 74, reviews: baseReviews, stock: 12,
  },
  {
    id: "p11", slug: "berry-shine-lip-oil", name: "Berry Shine Lip Oil", category: "lip-oil",
    price: 32, compareAt: 38, image: lipoil1,
    shortDesc: "Sheer berry oil with vitamin-rich glow.",
    description: "Sheer berry tint with a glass-like glossy finish and lightweight feel.",
    highlights: ["Berry tint", "Antioxidant rich", "Glassy finish"],
    ingredients: "Helianthus Annuus Seed Oil, Vaccinium Myrtillus Extract.",
    rating: 4.7, reviewCount: 110, reviews: baseReviews, stock: 27,
  },
  {
    id: "p12", slug: "ceramide-night-cream", name: "Ceramide Night Cream", category: "skincare",
    price: 72, image: skincare1,
    shortDesc: "Rich barrier-repair overnight cream.",
    description: "An indulgent overnight cream that rebuilds the skin barrier while you sleep.",
    highlights: ["Ceramide complex", "Squalane", "Wake up plumped"],
    ingredients: "Aqua, Squalane, Ceramide NP, Cholesterol, Glycerin.",
    rating: 4.9, reviewCount: 64, reviews: baseReviews,
    badges: ["limited"], stock: 9,
  },
];

export const findBySlug = (slug: string) => products.find(p => p.slug === slug);
export const featured = () => products.filter(p => p.badges?.includes("best-seller")).slice(0, 4);
export const newArrivals = () => products.filter(p => p.badges?.includes("new")).slice(0, 4);
export const bestSellers = () => products.filter(p => p.badges?.includes("best-seller")).slice(0, 8);

export const promoCodes: Record<string, { type: "percent" | "flat"; value: number; label: string }> = {
  GLOW10: { type: "percent", value: 10, label: "10% off" },
  WELCOME15: { type: "percent", value: 15, label: "15% welcome offer" },
  SHIPFREE: { type: "flat", value: 0, label: "Free shipping unlocked" },
};

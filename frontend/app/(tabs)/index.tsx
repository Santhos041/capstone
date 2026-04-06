import React, { useState, useContext, useEffect, useCallback } from "react";
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, FlatList, StatusBar, Modal,
  Dimensions, ActivityIndicator, RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../context/AuthContext";
import { useCart } from "../../context/CartContext";
import { fetchProducts, fetchCategories } from "../../services/api";
import { trackClick } from "../../services/api";
import { useRef } from "react";

const { width: SCREEN_W } = Dimensions.get("window");

// ─── Types ────────────────────────────────────────────────────────────────────

type Product = {
  id: string; name: string; weight: string; price: number; mrp: number;
  time: string; emoji: string; bg: string; description?: string; highlights?: string[];
};

// ─── Mock Data ────────────────────────────────────────────────────────────────

const BANNERS = [
  { id: "1", text: "🛒 Free delivery on orders above ₹199", bg: "#0C831F" },
  { id: "2", text: "⚡ Delivery in 8 minutes", bg: "#1565C0" },
  { id: "3", text: "🎁 50% OFF on first order", bg: "#B71C1C" },
];

// ─── Add / Counter Button ─────────────────────────────────────────────────────

function AddButton({ product, small = false }: { product: Product; small?: boolean }) {
  const { cartItems, addToCart, removeFromCart } = useCart();
  const qty = cartItems.find(i => i.product_id === product.id)?.qty ?? 0;
  
  if (qty === 0) return (
    <TouchableOpacity 
      style={[styles.addBtn, small && styles.addBtnSmall]} 
      onPress={() => addToCart({
        product_id: product.id,
        product_name: product.name,
        price: product.price,
      })} 
      activeOpacity={0.8}
    >
      <Text style={[styles.addBtnText, small && styles.addBtnTextSmall]}>ADD</Text>
      <Text style={[styles.addBtnPlus, small && styles.addBtnPlusSmall]}>+</Text>
    </TouchableOpacity>
  );
  return (
    <View style={[styles.counterBox, small && styles.counterBoxSmall]}>
      <TouchableOpacity onPress={() => removeFromCart(product.id)} style={styles.counterBtn}>
        <Text style={[styles.counterBtnText, small && styles.counterBtnTextSmall]}>−</Text>
      </TouchableOpacity>
      <Text style={[styles.counterVal, small && styles.counterValSmall]}>{qty}</Text>
      <TouchableOpacity onPress={() => addToCart({
        product_id: product.id,
        product_name: product.name,
        price: product.price,
      })} style={styles.counterBtn}>
        <Text style={[styles.counterBtnText, small && styles.counterBtnTextSmall]}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Product Card ─────────────────────────────────────────────────────────────

function ProductCard({ item, onPress }: { item: Product; onPress: (p: Product) => void }) {
  const discount = Math.round(((item.mrp - item.price) / item.mrp) * 100);
  return (
    <TouchableOpacity style={styles.productCard} onPress={() => onPress(item)} activeOpacity={0.93}>
      {discount > 0 && <View style={styles.discountBadge}><Text style={styles.discountText}>{discount}% OFF</Text></View>}
      <View style={[styles.productImageBox, { backgroundColor: item.bg }]}>
        <Text style={styles.productEmoji}>{item.emoji}</Text>
        <View style={styles.timeTag}><Text style={styles.timeTagText}>⚡ {item.time}</Text></View>
      </View>
      <View style={styles.productInfo}>
        <Text style={styles.productName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.productWeight}>{item.weight}</Text>
        <View style={styles.priceRow}>
          <Text style={styles.productPrice}>₹{item.price}</Text>
          {discount > 0 && <Text style={styles.productMrp}>₹{item.mrp}</Text>}
        </View>
      </View>
      <AddButton product={item} small />
    </TouchableOpacity>
  );
}

// ─── Product Detail Modal ─────────────────────────────────────────────────────

function ProductDetailModal({ product, onClose }: { product: Product | null; onClose: () => void }) {
  if (!product) return null;
  const discount = Math.round(((product.mrp - product.price) / product.mrp) * 100);
  return (
    <Modal visible={!!product} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <TouchableOpacity style={styles.modalBackdrop} onPress={onClose} activeOpacity={1} />
        <View style={styles.modalSheet}>
          <TouchableOpacity style={styles.modalClose} onPress={onClose}>
            <Text style={styles.modalCloseText}>✕</Text>
          </TouchableOpacity>
          <View style={[styles.modalImageBox, { backgroundColor: product.bg }]}>
            <Text style={styles.modalEmoji}>{product.emoji}</Text>
            {discount > 0 && <View style={styles.modalDiscountBadge}><Text style={styles.discountText}>{discount}% OFF</Text></View>}
            <View style={styles.timeTag}><Text style={styles.timeTagText}>⚡ {product.time}</Text></View>
          </View>
          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            <Text style={styles.modalName}>{product.name}</Text>
            <Text style={styles.modalWeight}>{product.weight}</Text>
            <View style={styles.modalPriceRow}>
              <Text style={styles.modalPrice}>₹{product.price}</Text>
              {discount > 0 && <>
                <Text style={styles.modalMrp}>₹{product.mrp}</Text>
                <View style={styles.modalSavingTag}>
                  <Text style={styles.modalSavingText}>Save ₹{product.mrp - product.price}</Text>
                </View>
              </>}
            </View>
            {product.description && (
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>About this product</Text>
                <Text style={styles.modalDescription}>{product.description}</Text>
              </View>
            )}
            {product.highlights && (
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Highlights</Text>
                {product.highlights.map((h, i) => (
                  <View key={i} style={styles.highlightRow}>
                    <Text style={styles.highlightDot}>✓</Text>
                    <Text style={styles.highlightText}>{h}</Text>
                  </View>
                ))}
              </View>
            )}
            <View style={{ height: 20 }} />
          </ScrollView>
          <View style={styles.modalFooter}>
            <View>
              <Text style={styles.modalFooterPrice}>₹{product.price}</Text>
              <Text style={styles.modalFooterWeight}>{product.weight}</Text>
            </View>
            <AddButton product={product} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Home Screen ──────────────────────────────────────────────────────────────

function HomeScreen({ onProductPress }: { onProductPress: (p: Product) => void }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadData = async () => {
    try {
      const [prods, cats] = await Promise.all([fetchProducts(), fetchCategories()]);
      const mapped = prods.map((p: any) => ({
        id: p.id, name: p.name, weight: p.weight,
        price: p.price, mrp: p.mrp, time: p.delivery_time,
        emoji: p.emoji, bg: p.bg,
        description: p.description, highlights: p.highlights,
      }));
      setProducts(mapped);
      setCategories(cats);
      setError("");
    } catch (e) {
      setError("Could not connect to server. Check your IP and WiFi.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const onRefresh = useCallback(() => { setRefreshing(true); loadData(); }, []);

  if (loading) return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <ActivityIndicator size="large" color="#0C831F" />
      <Text style={{ marginTop: 12, color: "#888" }}>Loading products...</Text>
    </View>
  );

  if (error) return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 24 }}>
      <Text style={{ fontSize: 40, marginBottom: 12 }}>⚠️</Text>
      <Text style={{ fontSize: 16, fontWeight: "700", color: "#1A1A1A", marginBottom: 6 }}>Connection Error</Text>
      <Text style={{ fontSize: 13, color: "#888", textAlign: "center", marginBottom: 20 }}>{error}</Text>
      <TouchableOpacity
        style={{ backgroundColor: "#0C831F", borderRadius: 10, paddingHorizontal: 24, paddingVertical: 12 }}
        onPress={() => { setLoading(true); loadData(); }}
      >
        <Text style={{ color: "#fff", fontWeight: "700" }}>Retry</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      style={styles.body}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#0C831F"]} />}
    >
      <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={styles.bannerScroll}>
        {BANNERS.map((b) => (
          <View key={b.id} style={[styles.bannerCard, { backgroundColor: b.bg }]}>
            <Text style={styles.bannerText}>{b.text}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Shop by Category</Text>
      </View>
      <View style={styles.categoryGrid}>
        {categories.map((cat) => (
          <TouchableOpacity key={cat.id} style={[styles.categoryCard, { backgroundColor: cat.bg }]} activeOpacity={0.85}>
            <Text style={styles.categoryEmoji}>{cat.emoji}</Text>
            <Text style={styles.categoryName}>{cat.name}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Bestsellers</Text>
        <TouchableOpacity><Text style={styles.seeAll}>See all</Text></TouchableOpacity>
      </View>
      <FlatList
        data={products}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => <ProductCard item={item} onPress={onProductPress} />}
        horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.productList}
      />

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Fresh Picks</Text>
        <TouchableOpacity><Text style={styles.seeAll}>See all</Text></TouchableOpacity>
      </View>
      <FlatList
        data={[...products].reverse()}
        keyExtractor={(i) => "f" + i.id}
        renderItem={({ item }) => <ProductCard item={item} onPress={onProductPress} />}
        horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.productList}
      />
      <View style={{ height: 90 }} />
    </ScrollView>
  );
}

// ─── Account Screen ───────────────────────────────────────────────────────────


function AccountScreen() {
  const { user, selectedAddress, logout, updateUser } = useAuth();
  const router = useRouter();
  const [editName, setEditName] = useState(false);
  const [editEmail, setEditEmail] = useState(false);
  const [nameVal, setNameVal] = useState(user?.name ?? "");
  const [emailVal, setEmailVal] = useState(user?.email ?? "");

  if (!user) return (
    <View style={styles.emptyCart}>
      <Text style={styles.emptyCartEmoji}>👤</Text>
      <Text style={styles.emptyCartTitle}>Not logged in</Text>
      <Text style={styles.emptyCartSub}>Please login to view your account</Text>
    </View>
  );

  const saveName = () => { updateUser({ name: nameVal }); setEditName(false); };
  const saveEmail = () => { updateUser({ email: emailVal }); setEditEmail(false); };
  const handleLogout = () => { logout(); router.replace("/login"); };
  const avatar = user.name ? user.name[0].toUpperCase() : user.phone?.slice(-2) ?? "?";

  return (
    <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
      <View style={styles.profileHero}>
        <View style={styles.avatarCircle}><Text style={styles.avatarText}>{avatar}</Text></View>
        <Text style={styles.profileName}>{user.name || "Hey there 👋"}</Text>
        <Text style={styles.profilePhone}>+91 {user.phone}</Text>
      </View>
      <View style={styles.profileCard}>
        <Text style={styles.profileCardTitle}>Personal Details</Text>
        <View style={styles.profileField}>
          <Text style={styles.profileFieldLabel}>Full Name</Text>
          {editName ? (
            <View style={styles.profileEditRow}>
              <TextInput style={styles.profileEditInput} value={nameVal} onChangeText={setNameVal} autoFocus placeholder="Enter your name" placeholderTextColor="#ccc" />
              <TouchableOpacity onPress={saveName} style={styles.saveBtn}><Text style={styles.saveBtnText}>Save</Text></TouchableOpacity>
            </View>
          ) : (
            <View style={styles.profileValueRow}>
              <Text style={styles.profileValue}>{user.name || "Not set"}</Text>
              <TouchableOpacity onPress={() => { setNameVal(user.name ?? ""); setEditName(true); }}>
                <Text style={styles.editLink}>Edit</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
        <View style={styles.divider} />
        <View style={styles.profileField}>
          <Text style={styles.profileFieldLabel}>Mobile Number</Text>
          <View style={styles.profileValueRow}>
            <Text style={styles.profileValue}>+91 {user.phone}</Text>
            <View style={styles.verifiedBadge}><Text style={styles.verifiedText}>✓ Verified</Text></View>
          </View>
        </View>
        <View style={styles.divider} />
        <View style={styles.profileField}>
          <Text style={styles.profileFieldLabel}>Email Address</Text>
          {editEmail ? (
            <View style={styles.profileEditRow}>
              <TextInput style={styles.profileEditInput} value={emailVal} onChangeText={setEmailVal} autoFocus placeholder="Enter your email" placeholderTextColor="#ccc" keyboardType="email-address" />
              <TouchableOpacity onPress={saveEmail} style={styles.saveBtn}><Text style={styles.saveBtnText}>Save</Text></TouchableOpacity>
            </View>
          ) : (
            <View style={styles.profileValueRow}>
              <Text style={styles.profileValue}>{user.email || "Not set"}</Text>
              <TouchableOpacity onPress={() => { setEmailVal(user.email ?? ""); setEditEmail(true); }}>
                <Text style={styles.editLink}>Edit</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
      <View style={styles.profileCard}>
        <Text style={styles.profileCardTitle}>Saved Addresses</Text>
        {user.addresses.map((addr) => (
          <View key={addr.id}>
            <View style={styles.profileAddrRow}>
              <View style={[styles.profileAddrIcon, addr.id === selectedAddress?.id && styles.profileAddrIconActive]}>
                <Text style={{ fontSize: 18 }}>{addr.icon}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={styles.profileAddrLabel}>{addr.label}</Text>
                  {addr.id === selectedAddress?.id && (
                    <View style={styles.defaultBadge}><Text style={styles.defaultBadgeText}>Default</Text></View>
                  )}
                </View>
                <Text style={styles.profileAddrFull} numberOfLines={2}>{addr.full}</Text>
              </View>
            </View>
            <View style={styles.divider} />
          </View>
        ))}
        <TouchableOpacity style={styles.manageAddrBtn} onPress={() => router.push("/address")} activeOpacity={0.8}>
          <Text style={styles.manageAddrText}>＋  Manage Addresses</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.profileCard}>
        {[
          { icon: "📦", label: "My Orders" },
          { icon: "❤️", label: "Wishlist" },
          { icon: "🎟", label: "Coupons & Offers" },
          { icon: "🔔", label: "Notifications" },
          { icon: "❓", label: "Help & Support" },
        ].map((item, i) => (
          <View key={i}>
            <TouchableOpacity style={styles.menuRow} activeOpacity={0.7}>
              <Text style={styles.menuIcon}>{item.icon}</Text>
              <Text style={styles.menuLabel}>{item.label}</Text>
              <Text style={styles.menuChevron}>›</Text>
            </TouchableOpacity>
            {i < 4 && <View style={styles.divider} />}
          </View>
        ))}
      </View>
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.85}>
        <Text style={styles.logoutText}>🚪  Logout</Text>
      </TouchableOpacity>
      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

function AppInner() {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("home");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const { cartItems } = useCart();
  const { user,selectedAddress } = useAuth();
  const router = useRouter();


  const sessionId = useRef(
    Date.now().toString(36) + Math.random().toString(36).substring(2)
  ).current;
  const cartCount = cartItems.reduce((s, i) => s + i.qty, 0);
  const addrLabel = selectedAddress
    ? `${selectedAddress.label} – ${selectedAddress.full.split(",")[0]}`
    : "Select address";

  const handleProductPress = (product: Product) => {
    setSelectedProduct(product);   // open modal immediately

    if (user?.id) {
      trackClick(
        user.id,
        sessionId,
        product.id,
        product.name,
        product.price
      );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#0C831F" barStyle="light-content" />
      <View style={styles.header}>
        <View style={styles.deliveryRow}>
          <View>
            <Text style={styles.deliveryLabel}>Delivery in</Text>
            <Text style={styles.deliveryTime}>8 minutes</Text>
          </View>
          <TouchableOpacity style={styles.locationBtn} onPress={() => router.push("/address")} activeOpacity={0.8}>
            <Text style={styles.locationIcon}>📍</Text>
            <Text style={styles.locationText} numberOfLines={1}>{addrLabel} <Text style={styles.chevron}>▾</Text></Text>
          </TouchableOpacity>
        </View>
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder='Search "milk"'
            placeholderTextColor="#999"
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Text style={styles.clearBtn}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {activeTab === "home" && <HomeScreen onProductPress={handleProductPress} />}
      {activeTab === "orders" && (
        <View style={styles.emptyCart}>
          <Text style={styles.emptyCartEmoji}>📦</Text>
          <Text style={styles.emptyCartTitle}>No orders yet</Text>
          <Text style={styles.emptyCartSub}>Your past orders will appear here</Text>
        </View>
      )}
      {activeTab === "account" && <AccountScreen />}

      <ProductDetailModal product={selectedProduct} onClose={() => setSelectedProduct(null)} />

      <View style={styles.tabBar}>
        {[
          { key: "home", icon: "🏠", label: "Home" },
          { key: "cart", icon: "🛒", label: "Cart", badge: cartCount },
          { key: "orders", icon: "📦", label: "Orders" },
          { key: "account", icon: "👤", label: "Account" },
        ].map((tab) => (
          <TouchableOpacity 
            key={tab.key} 
            style={styles.tabItem} 
            onPress={() => {
              if (tab.key === "cart") {
                router.push("/(tabs)/cart");
              } else {
                setActiveTab(tab.key);
              }
            }} 
            activeOpacity={0.7}
          >
            <View style={styles.tabIconWrap}>
              <Text style={styles.tabIcon}>{tab.icon}</Text>
              {tab.badge != null && tab.badge > 0 && (
                <View style={styles.tabBadge}><Text style={styles.tabBadgeText}>{tab.badge}</Text></View>
              )}
            </View>
            <Text style={[styles.tabLabel, activeTab === tab.key && styles.tabLabelActive]}>{tab.label}</Text>
            {activeTab === tab.key && <View style={styles.tabDot} />}
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
}

export default function App() {
  return <AppInner />;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8F8F8" },
  header: { backgroundColor: "#0C831F", paddingHorizontal: 14, paddingTop: 10, paddingBottom: 12, elevation: 4, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4 },
  deliveryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  deliveryLabel: { color: "#C8F5D0", fontSize: 11, fontWeight: "500" },
  deliveryTime: { color: "#fff", fontSize: 18, fontWeight: "800", letterSpacing: 0.3 },
  locationBtn: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, maxWidth: 200 },
  locationIcon: { fontSize: 13 },
  locationText: { color: "#fff", fontSize: 12, marginLeft: 4, fontWeight: "600", flexShrink: 1 },
  chevron: { fontSize: 10 },
  searchBar: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 10, paddingHorizontal: 12, height: 42 },
  searchIcon: { fontSize: 16, marginRight: 8 },
  searchInput: { flex: 1, fontSize: 14, color: "#222", padding: 0 },
  clearBtn: { fontSize: 14, color: "#999", paddingHorizontal: 4 },
  body: { flex: 1 },
  bannerScroll: { marginVertical: 12 },
  bannerCard: { width: SCREEN_W - 28, marginHorizontal: 14, borderRadius: 12, paddingVertical: 20, paddingHorizontal: 20, justifyContent: "center" },
  bannerText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 14, marginTop: 8, marginBottom: 10 },
  sectionTitle: { fontSize: 17, fontWeight: "800", color: "#1A1A1A" },
  seeAll: { fontSize: 13, color: "#0C831F", fontWeight: "600" },
  categoryGrid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 10, gap: 8, marginBottom: 4 },
  categoryCard: { width: "22%", aspectRatio: 0.9, borderRadius: 12, alignItems: "center", justifyContent: "center", padding: 6, margin: 2 },
  categoryEmoji: { fontSize: 28 },
  categoryName: { fontSize: 10, fontWeight: "600", color: "#333", textAlign: "center", marginTop: 5 },
  productList: { paddingHorizontal: 12, paddingBottom: 4, gap: 12 },
  productCard: { width: 148, backgroundColor: "#fff", borderRadius: 14, padding: 10, elevation: 2, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4, position: "relative", marginBottom: 4 },
  discountBadge: { position: "absolute", top: 8, left: 8, backgroundColor: "#0C831F", borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2, zIndex: 1 },
  discountText: { color: "#fff", fontSize: 9, fontWeight: "800" },
  productImageBox: { height: 100, borderRadius: 10, alignItems: "center", justifyContent: "center", position: "relative", marginBottom: 8 },
  productEmoji: { fontSize: 48 },
  timeTag: { position: "absolute", bottom: 6, right: 6, backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2 },
  timeTagText: { color: "#fff", fontSize: 8, fontWeight: "700" },
  productInfo: { marginBottom: 8 },
  productName: { fontSize: 13, fontWeight: "700", color: "#1A1A1A", marginBottom: 2 },
  productWeight: { fontSize: 11, color: "#888", marginBottom: 4 },
  priceRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  productPrice: { fontSize: 14, fontWeight: "800", color: "#1A1A1A" },
  productMrp: { fontSize: 11, color: "#aaa", textDecorationLine: "line-through" },
  addBtn: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#fff", borderWidth: 1.5, borderColor: "#0C831F", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 7 },
  addBtnSmall: { paddingHorizontal: 10, paddingVertical: 5 },
  addBtnText: { color: "#0C831F", fontWeight: "800", fontSize: 13 },
  addBtnTextSmall: { fontSize: 11 },
  addBtnPlus: { color: "#0C831F", fontWeight: "800", fontSize: 16 },
  addBtnPlusSmall: { fontSize: 13 },
  counterBox: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#0C831F", borderRadius: 8, paddingHorizontal: 4, paddingVertical: 4 },
  counterBoxSmall: { paddingVertical: 3 },
  counterBtn: { width: 28, height: 28, alignItems: "center", justifyContent: "center" },
  counterBtnText: { color: "#fff", fontSize: 18, fontWeight: "700", lineHeight: 20 },
  counterBtnTextSmall: { fontSize: 15 },
  counterVal: { color: "#fff", fontWeight: "800", fontSize: 15, minWidth: 20, textAlign: "center" },
  counterValSmall: { fontSize: 13 },
  tabBar: { flexDirection: "row", backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#EBEBEB", paddingTop: 8, paddingBottom: 10, elevation: 10, shadowColor: "#000", shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.08, shadowRadius: 6 },
  tabItem: { flex: 1, alignItems: "center", position: "relative" },
  tabIconWrap: { position: "relative" },
  tabIcon: { fontSize: 20 },
  tabBadge: { position: "absolute", top: -4, right: -8, backgroundColor: "#E53935", borderRadius: 9, minWidth: 18, height: 18, alignItems: "center", justifyContent: "center", paddingHorizontal: 3 },
  tabBadgeText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  tabLabel: { fontSize: 10, color: "#888", marginTop: 3, fontWeight: "600" },
  tabLabelActive: { color: "#0C831F", fontWeight: "800" },
  tabDot: { position: "absolute", bottom: -6, width: 4, height: 4, borderRadius: 2, backgroundColor: "#0C831F" },
  modalOverlay: { flex: 1, justifyContent: "flex-end" },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.45)" },
  modalSheet: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "90%", overflow: "hidden" },
  modalClose: { position: "absolute", top: 14, right: 14, zIndex: 10, backgroundColor: "rgba(0,0,0,0.12)", borderRadius: 20, width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  modalCloseText: { fontSize: 14, color: "#333", fontWeight: "700" },
  modalImageBox: { height: 220, alignItems: "center", justifyContent: "center", position: "relative" },
  modalEmoji: { fontSize: 100 },
  modalDiscountBadge: { position: "absolute", top: 14, left: 14, backgroundColor: "#0C831F", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  modalBody: { paddingHorizontal: 18, paddingTop: 16 },
  modalName: { fontSize: 20, fontWeight: "800", color: "#1A1A1A", marginBottom: 4 },
  modalWeight: { fontSize: 13, color: "#888", marginBottom: 12 },
  modalPriceRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 },
  modalPrice: { fontSize: 22, fontWeight: "800", color: "#1A1A1A" },
  modalMrp: { fontSize: 15, color: "#aaa", textDecorationLine: "line-through" },
  modalSavingTag: { backgroundColor: "#E8F5E9", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  modalSavingText: { color: "#0C831F", fontSize: 12, fontWeight: "700" },
  modalSection: { marginBottom: 18 },
  modalSectionTitle: { fontSize: 15, fontWeight: "800", color: "#1A1A1A", marginBottom: 8 },
  modalDescription: { fontSize: 13, color: "#555", lineHeight: 20 },
  highlightRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 6 },
  highlightDot: { color: "#0C831F", fontWeight: "800", marginRight: 8, fontSize: 13 },
  highlightText: { fontSize: 13, color: "#444", flex: 1 },
  modalFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18, paddingVertical: 14, borderTopWidth: 1, borderTopColor: "#F0F0F0", backgroundColor: "#fff" },
  modalFooterPrice: { fontSize: 18, fontWeight: "800", color: "#1A1A1A" },
  modalFooterWeight: { fontSize: 12, color: "#888" },
  emptyCart: { flex: 1, alignItems: "center", justifyContent: "center", paddingBottom: 60 },
  emptyCartEmoji: { fontSize: 64, marginBottom: 16 },
  emptyCartTitle: { fontSize: 20, fontWeight: "800", color: "#1A1A1A", marginBottom: 6 },
  emptyCartSub: { fontSize: 14, color: "#888" },
  cartDeliveryBanner: { backgroundColor: "#0C831F", margin: 14, borderRadius: 12, padding: 12, alignItems: "center" },
  cartDeliveryText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  cartItemsBox: { backgroundColor: "#fff", marginHorizontal: 14, borderRadius: 14, padding: 14, marginBottom: 14, elevation: 1 },
  cartSectionLabel: { fontSize: 14, fontWeight: "700", color: "#555", marginBottom: 12 },
  cartItem: { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#F5F5F5" },
  cartItemImg: { width: 60, height: 60, borderRadius: 10, alignItems: "center", justifyContent: "center", marginRight: 12 },
  cartItemEmoji: { fontSize: 32 },
  cartItemInfo: { flex: 1 },
  cartItemName: { fontSize: 14, fontWeight: "700", color: "#1A1A1A", marginBottom: 2 },
  cartItemWeight: { fontSize: 11, color: "#888", marginBottom: 4 },
  cartItemPrice: { fontSize: 14, fontWeight: "800", color: "#1A1A1A" },
  cartItemRight: { alignItems: "center", gap: 6 },
  cartItemTotal: { fontSize: 13, fontWeight: "700", color: "#333", marginTop: 4 },
  billBox: { backgroundColor: "#fff", marginHorizontal: 14, borderRadius: 14, padding: 16, marginBottom: 14, elevation: 1 },
  billTitle: { fontSize: 16, fontWeight: "800", color: "#1A1A1A", marginBottom: 14 },
  billRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  billLabel: { fontSize: 13, color: "#555" },
  billValue: { fontSize: 13, fontWeight: "600", color: "#333" },
  billTotal: { borderTopWidth: 1, borderTopColor: "#F0F0F0", paddingTop: 12, marginTop: 4 },
  billTotalLabel: { fontSize: 15, fontWeight: "800", color: "#1A1A1A" },
  billTotalValue: { fontSize: 16, fontWeight: "800", color: "#1A1A1A" },
  savingsBanner: { backgroundColor: "#E8F5E9", borderRadius: 8, padding: 10, marginTop: 8, alignItems: "center" },
  savingsText: { color: "#0C831F", fontWeight: "700", fontSize: 13 },
  checkoutBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#fff", paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: "#EBEBEB", elevation: 10 },
  checkoutTotal: { fontSize: 18, fontWeight: "800", color: "#1A1A1A" },
  checkoutSub: { fontSize: 11, color: "#888" },
  checkoutBtn: { backgroundColor: "#0C831F", borderRadius: 12, paddingHorizontal: 22, paddingVertical: 14 },
  checkoutBtnText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  profileHero: { backgroundColor: "#0C831F", paddingTop: 30, paddingBottom: 28, alignItems: "center" },
  avatarCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", marginBottom: 12, elevation: 4 },
  avatarText: { fontSize: 28, fontWeight: "800", color: "#0C831F" },
  profileName: { fontSize: 20, fontWeight: "800", color: "#fff", marginBottom: 4 },
  profilePhone: { fontSize: 14, color: "#C8F5D0" },
  profileCard: { backgroundColor: "#fff", marginHorizontal: 14, marginTop: 14, borderRadius: 16, padding: 16, elevation: 1 },
  profileCardTitle: { fontSize: 14, fontWeight: "800", color: "#888", marginBottom: 14, textTransform: "uppercase", letterSpacing: 0.6 },
  profileField: { paddingVertical: 4 },
  profileFieldLabel: { fontSize: 11, fontWeight: "700", color: "#bbb", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 },
  profileValueRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  profileValue: { fontSize: 15, fontWeight: "600", color: "#1A1A1A" },
  editLink: { fontSize: 13, color: "#0C831F", fontWeight: "700" },
  profileEditRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  profileEditInput: { flex: 1, borderWidth: 1.5, borderColor: "#0C831F", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, color: "#1A1A1A" },
  saveBtn: { backgroundColor: "#0C831F", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9 },
  saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  verifiedBadge: { backgroundColor: "#E8F5E9", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  verifiedText: { color: "#0C831F", fontSize: 11, fontWeight: "700" },
  divider: { height: 1, backgroundColor: "#F5F5F5", marginVertical: 12 },
  profileAddrRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  profileAddrIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: "#F5F5F5", alignItems: "center", justifyContent: "center" },
  profileAddrIconActive: { backgroundColor: "#E8F5E9" },
  profileAddrLabel: { fontSize: 14, fontWeight: "700", color: "#1A1A1A", marginBottom: 2 },
  profileAddrFull: { fontSize: 12, color: "#888", lineHeight: 17 },
  defaultBadge: { backgroundColor: "#E8F5E9", borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 },
  defaultBadgeText: { color: "#0C831F", fontSize: 10, fontWeight: "700" },
  manageAddrBtn: { marginTop: 4 },
  manageAddrText: { color: "#0C831F", fontWeight: "700", fontSize: 14 },
  menuRow: { flexDirection: "row", alignItems: "center", paddingVertical: 4 },
  menuIcon: { fontSize: 20, marginRight: 14 },
  menuLabel: { flex: 1, fontSize: 15, fontWeight: "600", color: "#1A1A1A" },
  menuChevron: { fontSize: 20, color: "#ccc" },
  logoutBtn: { marginHorizontal: 14, marginTop: 14, backgroundColor: "#FFF0F0", borderRadius: 14, padding: 16, alignItems: "center" },
  logoutText: { color: "#E53935", fontWeight: "800", fontSize: 15 },
});
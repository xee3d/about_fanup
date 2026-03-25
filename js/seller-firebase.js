/**
 * seller-firebase.js
 * Firebase Auth + Firestore 실연동 — FANUP 판매자 센터
 *
 * Collections:
 *   /sellers   — 판매자 프로필 (uid, status: pending|approved|rejected)
 *   /products  — 판매 상품    (vendorId → seller.id)
 *   /orders    — 주문         (vendorId → seller.id)
 */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js';
import {
  getAuth,
  onAuthStateChanged,
  signOut,
} from 'https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js';
import {
  getFirestore,
  collection, query, where, orderBy, limit,
  getDocs, addDoc, updateDoc, deleteDoc,
  doc, onSnapshot, serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js';
import {
  getStorage, ref, uploadBytes, getDownloadURL,
} from 'https://www.gstatic.com/firebasejs/10.14.0/firebase-storage.js';

// ─── Firebase 초기화 ────────────────────────────────────────
const firebaseConfig = {
  apiKey:            'AIzaSyAsQZo491B1W3s_s2WcqrTMdgH810Putao',
  authDomain:        'fanup-app.firebaseapp.com',
  projectId:         'fanup-app',
  storageBucket:     'fanup-app-storage',
  messagingSenderId: '542708276250',
  appId:             '1:542708276250:web:a2f01ca6b84ed1d50845a3',
};

const app     = initializeApp(firebaseConfig);
const auth    = getAuth(app);
const db      = getFirestore(app);
const storage = getStorage(app);

// ─── 상태 ───────────────────────────────────────────────────
let currentSeller = null;   // { id, businessName, ... }
let ordersUnsub   = null;   // Firestore 실시간 리스너 해제용

// ─── 로그인 오버레이 주입 (rejected 상태 전용) ───────────────
function injectLoginOverlay() {
  const el = document.createElement('div');
  el.id = 'auth-overlay';
  el.innerHTML = `
    <div class="auth-card">
      <img src="assets/fanup_logo.png" alt="FANUP" class="auth-logo">
      <h2 class="auth-title">판매자 센터</h2>
      <p class="auth-sub" id="authMsg">승인된 파트너 계정으로 로그인하세요.</p>
      <a href="login.html" class="auth-google-btn" id="loginLink" style="text-decoration:none;display:flex;align-items:center;justify-content:center;gap:8px;">
        로그인하러 가기 →
      </a>
      <a href="apply.html" style="font-size:0.82rem;color:var(--text-muted);text-align:center;display:block;margin-top:8px;">
        입점 신청은 여기 →
      </a>
      <div class="auth-rejected" id="authRejected" style="display:none;">
        <div>❌ 입점이 거절되었습니다.</div>
        <p id="authRejectedReason" style="font-size:0.82rem;margin-top:8px;"></p>
        <a href="apply.html" style="font-size:0.82rem;color:var(--brand);margin-top:8px;display:block;">재신청하기 →</a>
        <a href="mailto:seller@cheez.im" class="auth-contact-link">문의하기 →</a>
      </div>
    </div>
  `;
  el.style.cssText = `
    position:fixed; inset:0; z-index:9000;
    background:var(--bg); display:flex; align-items:center; justify-content:center;
  `;
  document.body.appendChild(el);
}

// ─── 오버레이 제어 (login / rejected) ───────────────────────
function showOverlay(state, msg = '') {
  const overlay  = document.getElementById('auth-overlay');
  const loginLink = document.getElementById('loginLink');
  const rejected = document.getElementById('authRejected');
  const authMsg  = document.getElementById('authMsg');
  if (!overlay) return;
  overlay.style.display = 'flex';
  if (loginLink) loginLink.style.display = state === 'rejected' ? 'none' : '';
  rejected.style.display = state === 'rejected' ? 'block' : 'none';
  if (state === 'login') authMsg.textContent = msg || '승인된 파트너 계정으로 로그인하세요.';
  if (state === 'rejected' && msg) {
    document.getElementById('authRejectedReason').textContent = '사유: ' + msg;
  }
}

function hideOverlay() {
  const overlay = document.getElementById('auth-overlay');
  if (overlay) overlay.style.display = 'none';
}

// ─── 판매자 프로필 조회 ──────────────────────────────────────
async function fetchSeller(uid) {
  const q   = query(collection(db, 'sellers'), where('uid', '==', uid));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { id: doc.id, ...doc.data() };
}

// ─── 대시보드 UI 채우기 ──────────────────────────────────────
function updateSellerInfo(seller) {
  // 사이드바 이름 / 역할
  document.querySelector('.user-name')?.replaceChildren
    ? document.querySelector('.user-name')?.replaceChildren(document.createTextNode(seller.businessName || '판매자'))
    : null;
  if (document.querySelector('.user-name')) {
    document.querySelector('.user-name').textContent = seller.businessName || '판매자';
  }
  // 업체 정보 페이지
  const fields = {
    'info-business-name': seller.businessName,
    'info-owner':         seller.ownerName,
    'info-biz-number':    seller.businessNumber,
    'info-phone':         seller.customerPhone || seller.phone,
    'info-address':       seller.address,
    'info-mail-order':    seller.mailOrderNumber,
    'info-email':         seller.email,
  };
  Object.entries(fields).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el && val) el.textContent = val;
  });
}

// ─── 상품 로드 & 렌더 ────────────────────────────────────────
async function loadProducts() {
  if (!currentSeller) return;
  const q    = query(
    collection(db, 'products'),
    where('vendorId', '==', currentSeller.id),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(q);
  const products = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderProducts(products);
  renderDashboardStock(products);
}

function renderProducts(products) {
  const tbody = document.getElementById('products-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  if (products.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--text-muted);">등록된 상품이 없습니다.</td></tr>';
    return;
  }
  products.forEach(p => {
    const stockClass = p.stock <= 3 ? 'stock-low' : 'stock-ok';
    const statusText = p.status === 'active' ? '판매중' : p.status === 'pending' ? '심사중' : '중지';
    const statusCls  = p.status === 'active' ? 'status-success' : p.status === 'pending' ? 'status-warning' : 'status-muted';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <div class="product-thumb">
          ${p.thumbnail ? `<img src="${p.thumbnail}" style="width:100%;height:100%;object-fit:cover;border-radius:6px;">` : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>`}
        </div>
      </td>
      <td class="td-main">${p.name}</td>
      <td>₩${Number(p.price).toLocaleString()}</td>
      <td class="${stockClass}">${p.stock ?? '-'}</td>
      <td><span class="status ${statusCls}">${statusText}</span></td>
      <td>
        <button class="btn btn-ghost btn-sm" onclick="editProduct('${p.id}')">수정</button>
        <button class="btn btn-ghost btn-sm" style="color:var(--danger);" onclick="deleteProduct('${p.id}', '${p.name.replace(/'/g,"\\'")}')">삭제</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
  // 상품수 카운트
  const el = document.getElementById('product-count');
  if (el) el.textContent = `등록 상품 (${products.length})`;
  const statEl = document.getElementById('stat-product-count');
  if (statEl) statEl.textContent = products.length;
}

function renderDashboardStock(products) {
  const tbody = document.getElementById('stock-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  const low = products.filter(p => p.stock <= 5 && p.status === 'active').slice(0, 5);
  if (low.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:var(--text-muted);padding:16px;">재고 부족 상품 없음</td></tr>';
    return;
  }
  low.forEach(p => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td class="td-main">${p.name}</td><td class="${p.stock <= 3 ? 'stock-low' : ''}">${p.stock}</td><td><span class="status ${p.stock === 0 ? 'status-danger' : 'status-warning'}">${p.stock === 0 ? '품절' : '부족'}</span></td>`;
    tbody.appendChild(tr);
  });
}

// ─── 주문 실시간 구독 ────────────────────────────────────────
function subscribeOrders() {
  if (!currentSeller) return;
  if (ordersUnsub) { ordersUnsub(); ordersUnsub = null; }
  const q = query(
    collection(db, 'orders'),
    where('vendorId', '==', currentSeller.id),
    orderBy('createdAt', 'desc')
  );
  ordersUnsub = onSnapshot(q, snap => {
    const orders = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderOrders(orders);
    renderDashboardOrders(orders);
    updateDashboardStats(orders);
  });
}

const STATUS_LABEL = {
  paid:              '결제완료',
  preparing:         '준비중',
  shipping:          '배송중',
  delivered:         '배송완료',
  refund_requested:  '환불요청',
  refunded:          '환불완료',
  cancelled:         '취소',
};
const STATUS_CLS = {
  paid:             'status-warning',
  preparing:        'status-info',
  shipping:         'status-info',
  delivered:        'status-success',
  refund_requested: 'status-danger',
  refunded:         'status-muted',
  cancelled:        'status-muted',
};

function renderOrders(orders) {
  const tbody = document.getElementById('orders-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  if (orders.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--text-muted);">주문 내역이 없습니다.</td></tr>';
    return;
  }
  orders.forEach(o => {
    const date  = o.createdAt?.toDate ? o.createdAt.toDate().toLocaleDateString('ko-KR') : '-';
    const label = STATUS_LABEL[o.status] || o.status;
    const cls   = STATUS_CLS[o.status]  || '';
    const tr    = document.createElement('tr');
    tr.innerHTML = `
      <td><input type="checkbox" class="order-check"></td>
      <td class="td-code">#FU-${o.id.slice(-8).toUpperCase()}</td>
      <td class="td-main">${o.productName || '-'}</td>
      <td>${o.creatorNames?.[0] || '-'}</td>
      <td><span class="recip-code">팬업-${o.id.slice(0,6).toUpperCase()}</span></td>
      <td>₩${Number(o.totalAmount).toLocaleString()}</td>
      <td><span class="status ${cls}">${label}</span></td>
      <td>
        ${o.status === 'paid' ? `<button class="btn btn-ghost btn-sm" onclick="updateOrderStatus('${o.id}','preparing')">준비 시작</button>` : ''}
        ${o.status === 'preparing' ? `<button class="btn btn-primary btn-sm" onclick="openShippingModal('${o.id}')">송장 입력</button>` : ''}
        ${o.status === 'shipping' ? `<span style="color:var(--text-muted);font-size:0.8rem;">배송중</span>` : ''}
        <button class="invoice-btn" onclick="printInvoiceReal('${o.id}')">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
          송장
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
  // 배송 처리 탭
  renderShippingTab(orders.filter(o => o.status === 'preparing' || o.status === 'shipping'));
  // 주문 수 배지
  const newCount = orders.filter(o => o.status === 'paid').length;
  document.querySelectorAll('.nav-badge.yellow').forEach(b => b.textContent = newCount || '');
}

function renderDashboardOrders(orders) {
  const tbody = document.getElementById('recent-orders-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  orders.slice(0, 5).forEach(o => {
    const label = STATUS_LABEL[o.status] || o.status;
    const cls   = STATUS_CLS[o.status]  || '';
    const tr    = document.createElement('tr');
    tr.innerHTML = `
      <td class="td-code">#FU-${o.id.slice(-8).toUpperCase()}</td>
      <td class="td-main">${o.productName || '-'}</td>
      <td>${o.creatorNames?.[0] || '-'}</td>
      <td><span class="status ${cls}">${label}</span></td>
    `;
    tbody.appendChild(tr);
  });
}

function renderShippingTab(orders) {
  const tbody = document.getElementById('shipping-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  if (orders.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--text-muted);">배송 처리 대기 없음</td></tr>';
    return;
  }
  orders.forEach(o => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="td-code">#FU-${o.id.slice(-8).toUpperCase()}</td>
      <td class="td-main">${o.productName || '-'}</td>
      <td>${o.creatorNames?.[0] || '-'}</td>
      <td><span class="recip-code">팬업-${o.id.slice(0,6).toUpperCase()}</span></td>
      <td><span class="safe-num">🛡 0507-****-****</span></td>
      <td><span class="status ${STATUS_CLS[o.status]}">${STATUS_LABEL[o.status]}</span></td>
      <td>
        ${o.status === 'preparing' ? `<button class="btn btn-primary btn-sm" onclick="openShippingModal('${o.id}')">송장 입력</button>` : ''}
        <button class="print-invoice-btn" onclick="printInvoiceReal('${o.id}')">🖨 출력</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
  const badge = document.querySelector('.nav-item[data-page="shipping"] .nav-badge');
  if (badge) badge.textContent = orders.filter(o => o.status === 'preparing').length || '';
}

function updateDashboardStats(orders) {
  const now    = new Date();
  const month  = now.getMonth();
  const year   = now.getFullYear();
  const thisMonth = orders.filter(o => {
    const d = o.createdAt?.toDate ? o.createdAt.toDate() : new Date(0);
    return d.getMonth() === month && d.getFullYear() === year && o.status !== 'refunded' && o.status !== 'cancelled';
  });
  const totalSales = thisMonth.reduce((s, o) => s + (o.totalAmount || 0), 0);
  const commission = thisMonth.reduce((s, o) => s + (o.commissionAmount || 0), 0);
  const settlement = totalSales - commission;
  const newOrders  = orders.filter(o => o.status === 'paid').length;

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('stat-new-orders',  newOrders);
  set('stat-monthly-sales', `₩${(totalSales/1000).toFixed(0)}K`);
  set('stat-settlement',    `₩${(settlement/1000).toFixed(0)}K`);
  renderSettlement(orders);
}

// ─── 정산 통계 렌더 ──────────────────────────────────────────
function renderSettlement(orders) {
  const tbody = document.getElementById('settlement-tbody');
  if (!tbody) return;
  // 월별 그룹
  const byMonth = {};
  orders.forEach(o => {
    if (o.status === 'refunded' || o.status === 'cancelled') return;
    const d = o.createdAt?.toDate ? o.createdAt.toDate() : null;
    if (!d) return;
    const key = `${d.getFullYear()}년 ${d.getMonth()+1}월`;
    if (!byMonth[key]) byMonth[key] = { sales:0, commission:0, settled: o.isSettled };
    byMonth[key].sales += o.totalAmount || 0;
    byMonth[key].commission += o.commissionAmount || 0;
  });
  tbody.innerHTML = '';
  Object.entries(byMonth).reverse().forEach(([month, data]) => {
    const net = data.sales - data.commission;
    const tr  = document.createElement('tr');
    tr.innerHTML = `
      <td>${month}</td>
      <td>₩${data.sales.toLocaleString()}</td>
      <td>₩${data.commission.toLocaleString()}</td>
      <td style="font-weight:700;color:var(--brand);">₩${net.toLocaleString()}</td>
      <td><span class="status ${data.settled ? 'status-success' : 'status-warning'}">${data.settled ? '입금 완료' : '정산 예정'}</span></td>
    `;
    tbody.appendChild(tr);
  });
}

// ─── 상품 등록 (CRUD) ────────────────────────────────────────
window.submitProduct = async function(e) {
  e?.preventDefault();
  if (!currentSeller) return;
  const name      = document.getElementById('prod-name')?.value.trim();
  const price     = parseInt(document.getElementById('prod-price')?.value || 0);
  const origPrice = parseInt(document.getElementById('prod-orig-price')?.value || 0);
  const category  = document.getElementById('prod-category')?.value || 'all';
  const stock     = parseInt(document.getElementById('prod-stock')?.value || 0);
  const desc      = document.getElementById('prod-desc')?.value.trim() || '';
  const shippingFee = parseInt(document.getElementById('prod-shipping')?.value || 0);

  if (!name || !price) { alert('상품명과 가격을 입력하세요.'); return; }

  // ─── 이미지 업로드 ────────────────────────────────────────
  const imageInput = document.getElementById('prod-images-input');
  const imageUrls  = [];
  if (imageInput && imageInput.files.length > 0) {
    const files = Array.from(imageInput.files).slice(0, 4);
    for (const file of files) {
      const path     = `products/${currentSeller.id}/${Date.now()}_${file.name}`;
      const storageRef = ref(storage, path);
      const snapshot = await uploadBytes(storageRef, file);
      const url      = await getDownloadURL(snapshot.ref);
      imageUrls.push(url);
    }
  }

  const editId = document.getElementById('prod-edit-id')?.value;
  const data = {
    vendorId:    currentSeller.id,
    vendorName:  currentSeller.businessName,
    name, price, originalPrice: origPrice || price,
    category, stock, description: desc,
    shippingFee, stockStatus: stock <= 0 ? 'out_of_stock' : stock <= 5 ? 'low_stock' : 'in_stock',
    status: 'pending',
    updatedAt: serverTimestamp(),
  };

  if (imageUrls.length > 0) {
    data.images    = imageUrls;
    data.thumbnail = imageUrls[0];
  }

  if (editId) {
    await updateDoc(doc(db, 'products', editId), data);
  } else {
    data.createdAt = serverTimestamp();
    data.rating = 0; data.reviewCount = 0;
    await addDoc(collection(db, 'products'), data);
  }
  alert('상품이 저장됐습니다. 관리자 승인 후 판매 활성화됩니다.');
  resetProductForm();
  await loadProducts();
  window.switchPage && window.switchPage('products');
};

window.editProduct = async function(id) {
  const snap = await getDocs(query(collection(db, 'products'), where('__name__', '==', id)));
  if (snap.empty) return;
  const p = snap.docs[0].data();
  document.getElementById('prod-name').value      = p.name || '';
  document.getElementById('prod-price').value     = p.price || '';
  document.getElementById('prod-orig-price').value = p.originalPrice || '';
  document.getElementById('prod-category').value  = p.category || 'all';
  document.getElementById('prod-stock').value     = p.stock ?? '';
  document.getElementById('prod-desc').value      = p.description || '';
  document.getElementById('prod-shipping').value  = p.shippingFee ?? '';
  document.getElementById('prod-edit-id').value   = id;
  document.getElementById('prod-form-title')?.replaceChildren
    ? null : null;
  if (document.getElementById('prod-form-title'))
    document.getElementById('prod-form-title').textContent = '상품 수정';
  window.switchPage && window.switchPage('products');
  document.getElementById('prod-name')?.focus();
};

window.deleteProduct = async function(id, name) {
  if (!confirm(`"${name}"을 삭제하시겠습니까?`)) return;
  await deleteDoc(doc(db, 'products', id));
  await loadProducts();
};

function resetProductForm() {
  ['prod-name','prod-price','prod-orig-price','prod-stock','prod-desc','prod-shipping'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  const editId = document.getElementById('prod-edit-id');
  if (editId) editId.value = '';
  if (document.getElementById('prod-form-title'))
    document.getElementById('prod-form-title').textContent = '신규 상품 등록';
}

// ─── 주문 상태 변경 ──────────────────────────────────────────
window.updateOrderStatus = async function(orderId, status) {
  await updateDoc(doc(db, 'orders', orderId), { status, updatedAt: serverTimestamp() });
};

// ─── 배송 모달 ───────────────────────────────────────────────
let _shippingOrderId = null;
window.openShippingModal = function(orderId) {
  _shippingOrderId = orderId;
  document.getElementById('shippingModal')?.classList.add('open');
};
window.confirmShipping = async function() {
  const carrier = document.getElementById('shippingCarrier')?.value;
  const number  = document.getElementById('shippingNumber')?.value.trim();
  if (!number) { alert('송장 번호를 입력하세요.'); return; }
  await updateDoc(doc(db, 'orders', _shippingOrderId), {
    status: 'shipping',
    trackingCarrier: carrier,
    trackingNumber:  number,
    updatedAt: serverTimestamp(),
  });
  window.closeShipping && window.closeShipping();
};

// ─── 송장 출력 (실제 주소는 서버에서만 제공) ─────────────────
window.printInvoiceReal = async function(orderId) {
  // TODO: 실제 배포시 Firebase Functions 호출로 전체 주소 획득
  // 현재는 마스킹된 정보만 표시 (개인정보 보호)
  const w = window.open('', '_blank', 'width=400,height=320');
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
    <style>
      body{font-family:sans-serif;padding:24px;font-size:13px;}
      .lbl{font-size:10px;color:#888;margin-bottom:2px;}
      .val{font-size:14px;font-weight:700;margin-bottom:12px;}
      hr{border:none;border-top:1px solid #ddd;margin:12px 0;}
      .notice{font-size:10px;color:#aaa;margin-top:16px;}
    </style>
    <script>window.onload=()=>{window.print();window.close();}<\/script>
  </head><body>
    <div class="lbl">주문번호</div><div class="val">#FU-${orderId.slice(-8).toUpperCase()}</div>
    <div class="lbl">수령인 코드</div><div class="val">팬업-${orderId.slice(0,6).toUpperCase()}</div>
    <div class="lbl">안심번호</div><div class="val">0507-****-**** (FANUP 제공)</div>
    <hr>
    <div class="lbl">배송지</div><div class="val">※ FANUP 물류 시스템에서 확인</div>
    <div class="notice">배송지 주소는 FANUP 판매자 센터 API를 통해 물류사에 직접 전달됩니다.<br>본 출력물에는 개인정보가 포함되지 않습니다. (FANUP 개인정보 보호 정책)</div>
  </body></html>`);
  w.document.close();
};

// ─── 로그아웃 ────────────────────────────────────────────────
window.sellerLogout = async function() {
  if (ordersUnsub) { ordersUnsub(); ordersUnsub = null; }
  currentSeller = null;
  await signOut(auth);
};

// ─── Auth 상태 감시 (핵심) ───────────────────────────────────
onAuthStateChanged(auth, async user => {
  if (!user) {
    currentSeller = null;
    showOverlay('login');
    return;
  }

  // 판매자 프로필 조회
  const seller = await fetchSeller(user.uid);

  if (!seller) {
    // 미등록 → 입점 신청 페이지로
    location.href = 'apply.html';
    return;
  }

  if (seller.status === 'pending') {
    // 심사 대기 → 전용 페이지로
    location.href = 'pending.html';
    return;
  }

  if (seller.status === 'rejected') {
    showOverlay('rejected', seller.rejectionReason || '');
    return;
  }

  // approved → 대시보드 활성화
  currentSeller = seller;
  hideOverlay();
  updateSellerInfo(seller);
  await loadProducts();
  subscribeOrders();
});

// ─── 상품 폼 submit 이벤트 연결 ─────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('prod-form')?.addEventListener('submit', e => {
    e.preventDefault();
    window.submitProduct(e);
  });
  // 배송 모달 확인 버튼
  document.getElementById('confirmShippingBtn')?.addEventListener('click', window.confirmShipping);

  // ─── 이미지 미리보기 ─────────────────────────────────────
  document.getElementById('prod-images-input')?.addEventListener('change', function() {
    const preview = document.getElementById('prod-img-preview');
    if (!preview) return;
    const slots = preview.querySelectorAll('.img-slot');
    const files  = Array.from(this.files).slice(0, 4);

    slots.forEach((slot, i) => {
      slot.innerHTML = '';
      if (files[i]) {
        const img = document.createElement('img');
        img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:calc(var(--radius,8px) - 2px);';
        img.src = URL.createObjectURL(files[i]);
        slot.appendChild(img);
      } else if (i === 0) {
        // 첫 번째 슬롯은 + 아이콘 표시
        slot.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
      }
    });
  });
});

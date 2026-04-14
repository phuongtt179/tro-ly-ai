/**
 * firebaseService.js
 * Khởi tạo Firebase Admin SDK và cung cấp helper CRUD cho Firestore
 *
 * Schema:
 * users/{userId}/journals/{docId}
 * users/{userId}/tasks/{docId}
 * users/{userId}/reminders/{docId}
 * users/{userId}/plans/{docId}
 */

const admin = require('firebase-admin');
const path = require('path');

// Khởi tạo Firebase một lần duy nhất
let db;

function initFirebase() {
  if (admin.apps.length > 0) {
    db = admin.firestore();
    return db;
  }

  let credential;

  // Hỗ trợ cả file path và biến môi trường JSON
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    // Render/Railway: set toàn bộ JSON trong env var
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    credential = admin.credential.cert(serviceAccount);
  } else {
    // Local: dùng file path
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH
      ? path.resolve(process.cwd(), process.env.FIREBASE_SERVICE_ACCOUNT_PATH)
      : path.join(__dirname, '..', 'firebase-service-account.json');
    const serviceAccount = require(serviceAccountPath);
    credential = admin.credential.cert(serviceAccount);
  }

  admin.initializeApp({
    credential,
    projectId: process.env.FIREBASE_PROJECT_ID,
  });

  db = admin.firestore();
  console.log('[FIREBASE] Đã kết nối Firestore');
  return db;
}

// Khởi tạo ngay khi require
initFirebase();

// ==================== HELPER FUNCTIONS ====================

/**
 * Lấy reference đến subcollection của user
 */
function userCollection(userId, collectionName) {
  return db.collection('users').doc(userId).collection(collectionName);
}

/**
 * Thêm document mới
 */
async function addDoc(userId, collectionName, data) {
  const ref = userCollection(userId, collectionName);
  const docRef = await ref.add({
    ...data,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return docRef.id;
}

/**
 * Cập nhật document
 */
async function updateDoc(userId, collectionName, docId, data) {
  const ref = userCollection(userId, collectionName).doc(docId);
  await ref.update({
    ...data,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

/**
 * Xóa document
 */
async function deleteDoc(userId, collectionName, docId) {
  await userCollection(userId, collectionName).doc(docId).delete();
}

/**
 * Lấy nhiều documents với filter tùy chọn
 * filters: [{ field, op, value }]
 */
async function queryDocs(userId, collectionName, filters = [], orderBy = null, limit = 50) {
  let query = userCollection(userId, collectionName);

  filters.forEach(({ field, op, value }) => {
    query = query.where(field, op, value);
  });

  if (orderBy) {
    query = query.orderBy(orderBy.field, orderBy.direction || 'asc');
  }

  if (limit) {
    query = query.limit(limit);
  }

  const snapshot = await query.get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

/**
 * Lấy một document theo ID
 */
async function getDocById(userId, collectionName, docId) {
  const doc = await userCollection(userId, collectionName).doc(docId).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() };
}

/**
 * Query global (không qua userId) - dùng cho scheduler
 */
async function queryGlobal(collectionGroup, filters = []) {
  let query = db.collectionGroup(collectionGroup);
  filters.forEach(({ field, op, value }) => {
    query = query.where(field, op, value);
  });
  const snapshot = await query.get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ref: doc.ref, ...doc.data() }));
}

module.exports = {
  db,
  addDoc,
  updateDoc,
  deleteDoc,
  queryDocs,
  getDocById,
  queryGlobal,
  userCollection,
  admin,
};

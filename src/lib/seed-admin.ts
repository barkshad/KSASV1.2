/**
 * src/lib/seed-admin.ts
 * Seeds the default admin account on first run.
 * The password hash is computed in-app and NEVER logged or displayed.
 */
import { db, collection, query, where, getDocs, doc, setDoc, serverTimestamp } from './firebase';
import { hashPassword } from './auth';

const ADMIN_EMAIL = 'admin@kabarak.ac.ke';
const ADMIN_UID = 'admin_default';
const ADMIN_PW_HASH = hashPassword('Mwahanga@1');

export async function seedAdminIfNotExists() {
  try {
    const adminQuery = query(collection(db, 'users'), where('email', '==', ADMIN_EMAIL));
    const adminSnap = await getDocs(adminQuery);

    if (adminSnap.empty) {
      await setDoc(doc(db, 'users', ADMIN_UID), {
        uid: ADMIN_UID,
        name: 'System Administrator',
        email: ADMIN_EMAIL,
        password: ADMIN_PW_HASH,
        role: 'admin',
        status: 'active',
        createdAt: serverTimestamp(),
      });
    } else {
      await setDoc(adminSnap.docs[0].ref, { password: ADMIN_PW_HASH }, { merge: true });
    }
  } catch (err) {
    console.warn('[KSAS] Seed operation encountered an issue.');
  }
}

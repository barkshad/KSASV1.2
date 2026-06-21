import { db, collection, doc, setDoc, getDocs, getDoc, updateDoc, runTransaction, serverTimestamp, query, where } from './firebase';
import { uploadJSONToCloudinary, fetchJSONFromCloudinary } from './cloudinary';

export const collections = {
  USERS: 'users',
  SESSIONS: 'sessions',
  COURSES: 'courses',
  ENROLLMENTS: 'enrollments',
  AUDIT_LOGS: 'audit_logs'
};

export async function logAudit(user: any, actionType: string, entity: string, details: string) {
  const logRef = doc(collection(db, collections.AUDIT_LOGS));
  await setDoc(logRef, {
    timestamp: serverTimestamp(),
    userId: user?.uid || 'unknown',
    userRole: user?.role || 'unknown',
    userEmail: user?.email || 'unknown',
    actionType,
    entity,
    details,
    ipAddress: 'device'
  });
}

export async function checkInStudent(sessionId: string, studentData: any, token: string, deviceFingerprint: string) {
  const sessionDocRef = doc(db, collections.SESSIONS, sessionId);
  const sessionDoc = await getDoc(sessionDocRef);

  if (!sessionDoc.exists()) throw new Error('Session not found');
  const sessionData = sessionDoc.data();

  if (sessionData.status !== 'open') throw new Error('Session is closed');

  // Use the uid field from the user object (the original student ID like KAB/101/2023)
  // stored in the 'uid' field of the user document
  const studentId = studentData.uid || studentData.id;
  const studentName = studentData.name || 'Unknown Student';

  if (!studentId) throw new Error('Student ID not found. Please log out and log in again.');

  // Use studentId as the document key (sanitize slashes)
  const attendanceDocId = studentId.replace(/\//g, '_').replace(/\s+/g, '_');
  const attendanceRef = doc(db, `${collections.SESSIONS}/${sessionId}/attendance`, attendanceDocId);

  await runTransaction(db, async (transaction) => {
    const attendanceDoc = await transaction.get(attendanceRef);
    if (attendanceDoc.exists()) {
      throw new Error('You have already been marked present for this session');
    }

    const now = new Date();
    const sessionStart = sessionData.startTime;
    // Determine if late (after windowMinutes from session start)
    let status = 'present';
    try {
      const [startHour, startMin] = sessionStart.split(':').map(Number);
      const sessionStartMs = new Date();
      sessionStartMs.setHours(startHour, startMin, 0, 0);
      const diffMinutes = (now.getTime() - sessionStartMs.getTime()) / 60000;
      if (diffMinutes > (sessionData.windowMinutes || 15)) {
        status = 'late';
      }
    } catch (e) {
      // default to present if time parse fails
    }

    transaction.set(attendanceRef, {
      studentId,
      studentName,
      studentEmail: studentData.email || '',
      timestamp: serverTimestamp(),
      deviceFingerprint,
      status
    });
  });
}

export async function archiveSession(sessionId: string) {
  const sessionDocRef = doc(db, collections.SESSIONS, sessionId);
  const sessionDoc = await getDoc(sessionDocRef);
  if (!sessionDoc.exists()) return;

  const sessionData = sessionDoc.data();

  const attendanceQuery = collection(db, `${collections.SESSIONS}/${sessionId}/attendance`);
  const attendanceSnapshot = await getDocs(attendanceQuery);

  const attendanceList = attendanceSnapshot.docs.map(d => d.data());

  const archiveData = {
    ...sessionData,
    attendance: attendanceList
  };

  await uploadJSONToCloudinary(`session_${sessionId}.json`, archiveData);
}

export async function closeSession(sessionId: string) {
  const sessionRef = doc(db, collections.SESSIONS, sessionId);
  await updateDoc(sessionRef, { status: 'closed' });
}

// src/lib/csvExport.ts

export interface AttendanceCsvRow {
  studentId: string;
  studentName: string;
  studentEmail: string;
  regNumber: string;
  status: string;
  date: string;
  timeIn: string;
  courseCode: string;
  courseName: string;
  room: string;
  lecturerName: string;
  topicOfDay: string;
  deviceFingerprint: string;
}

export function formatTimeIn(timestamp: any): string {
  if (!timestamp) return '—';

  try {
    const date =
      typeof timestamp?.toDate === 'function'
        ? timestamp.toDate()
        : new Date(timestamp);

    return date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return '—';
  }
}

export function buildAttendanceCsv(
  rows: AttendanceCsvRow[]
): string {
  const headers = [
    'Student ID',
    'Full Name',
    'Email',
    'Reg Number',
    'Status',
    'Date',
    'Time In',
    'Course Code',
    'Course Name',
    'Room / Venue',
    'Lecturer',
    'Topic of Day',
    'Device Fingerprint',
  ];

  const escape = (value: unknown) =>
    `"${String(value ?? '').replace(/"/g, '""')}"`;

  const csvRows = rows.map((row) =>
    [
      row.studentId,
      row.studentName,
      row.studentEmail,
      row.regNumber,
      row.status,
      row.date,
      row.timeIn,
      row.courseCode,
      row.courseName,
      row.room,
      row.lecturerName,
      row.topicOfDay,
      row.deviceFingerprint,
    ]
      .map(escape)
      .join(',')
  );

  return [headers.map(escape).join(','), ...csvRows].join('\n');
}

export function downloadCsv(
  filename: string,
  csvContent: string
): void {
  const blob = new Blob([csvContent], {
    type: 'text/csv;charset=utf-8;',
  });

  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

export function exportSessionCSV(session: any, attendanceRecords: any[]): void {
  const headers = ['Student Name', 'Registration Number', 'Check-In Time', 'Status', 'Device Fingerprint'];

  const rows = attendanceRecords.map((r: any) => [
    r.studentName || '',
    r.studentId || '',
    r.checkInTime ? new Date(r.checkInTime).toLocaleString() : (r.timestamp?.toDate ? r.timestamp.toDate().toLocaleString() : '—'),
    r.status || 'PRESENT',
    r.deviceFingerprint || 'N/A',
  ]);

  const escape = (cell: string) => `"${String(cell).replace(/"/g, '""')}"`;

  const csv = [headers, ...rows].map(row => row.map(escape).join(',')).join('\n');

  const safeCourse = (session.courseName || 'session').replace(/[^a-zA-Z0-9]/g, '_');
  const safeDate = (session.date || new Date().toISOString().split('T')[0]);
  const sessionId = (session.id || '').slice(0, 8);
  const filename = `KSAS_${safeCourse}_${safeDate}_${sessionId}.csv`;

  downloadCsv(filename, csv);
}

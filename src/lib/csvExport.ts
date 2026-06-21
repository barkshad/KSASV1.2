// src/lib/csvExport.ts

export interface AttendanceCsvRow {
  studentId: string;
  studentName: string;
  studentEmail: string;
  status: string;
  date: string;
  timeIn: string;
  courseCode: string;
  courseName: string;
  room: string;
  lecturerName: string;
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
    'Status',
    'Date',
    'Time In',
    'Course Code',
    'Course Name',
    'Room / Venue',
    'Lecturer',
  ];

  const escape = (value: unknown) =>
    `"${String(value ?? '').replace(/"/g, '""')}"`;

  const csvRows = rows.map((row) =>
    [
      row.studentId,
      row.studentName,
      row.studentEmail,
      row.status,
      row.date,
      row.timeIn,
      row.courseCode,
      row.courseName,
      row.room,
      row.lecturerName,
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

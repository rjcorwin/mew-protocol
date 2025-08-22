export function table(data: any[], columns: string[]): string {
  if (data.length === 0) return '';

  // Calculate column widths
  const widths: Record<string, number> = {};
  
  columns.forEach(col => {
    widths[col] = col.length;
    data.forEach(row => {
      const value = String(row[col] || '');
      // Remove ANSI color codes for width calculation
      const cleanValue = value.replace(/\u001b\[[0-9;]*m/g, '');
      widths[col] = Math.max(widths[col], cleanValue.length);
    });
  });

  // Build header
  const header = columns
    .map(col => col.padEnd(widths[col]))
    .join('  ');
    
  const separator = columns
    .map(col => '-'.repeat(widths[col]))
    .join('  ');

  // Build rows
  const rows = data.map(row => 
    columns
      .map(col => {
        const value = String(row[col] || '');
        // Calculate padding considering ANSI codes
        const cleanValue = value.replace(/\u001b\[[0-9;]*m/g, '');
        const padding = widths[col] - cleanValue.length;
        return value + ' '.repeat(padding);
      })
      .join('  ')
  );

  return [header, separator, ...rows].join('\n');
}
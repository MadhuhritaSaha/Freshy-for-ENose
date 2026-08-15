import { InspectionRecord } from '../types';

/**
 * Exports a single inspection record's 10 Hz time-series data.
 * Columns: time_ms, MQ135, MQ137, TGS2600, TGS2602, TGS2620, temp_c, rh_pct, verdict
 */
export function downloadRecordCSV(record: InspectionRecord): void {
  const headers = ['time_ms', 'MQ135', 'MQ137', 'TGS2600', 'TGS2602', 'TGS2620', 'temp_c', 'rh_pct', 'verdict'];
  const rows: string[] = [headers.join(',')];

  if (record.timeSeries && record.timeSeries.length > 0) {
    record.timeSeries.forEach((pt) => {
      rows.push(
        [
          pt.time_ms,
          pt.MQ135,
          pt.MQ137,
          pt.TGS2600,
          pt.TGS2602,
          pt.TGS2620,
          pt.temp_c,
          pt.rh_pct,
          `"${record.verdict}"`,
        ].join(',')
      );
    });
  } else if (record.sensorReadings) {
    // If only summary was recorded
    rows.push(
      [
        0,
        record.sensorReadings.MQ135,
        record.sensorReadings.MQ137,
        record.sensorReadings.TGS2600,
        record.sensorReadings.TGS2602,
        record.sensorReadings.TGS2620,
        record.temp_c ?? 25.0,
        record.rh_pct ?? 55.0,
        `"${record.verdict}"`,
      ].join(',')
    );
  } else {
    // Image check or other
    rows.push([0, '', '', '', '', '', '', '', `"${record.verdict}"`].join(','));
  }

  const csvContent = 'data:text/csv;charset=utf-8,' + encodeURIComponent(rows.join('\n'));
  const link = document.createElement('a');
  const sanitizedDate = new Date(record.timestamp).toISOString().replace(/[:.]/g, '-');
  const filename = `freshnose_${record.sampleType}_${sanitizedDate}.csv`;

  link.setAttribute('href', csvContent);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Exports all inspection records into one summary CSV.
 */
export function downloadAllHistoryCSV(records: InspectionRecord[]): void {
  const headers = [
    'id',
    'timestamp_iso',
    'sample',
    'test_type',
    'verdict',
    'confidence_pct',
    'MQ135_adc',
    'MQ137_adc',
    'TGS2600_adc',
    'TGS2602_adc',
    'TGS2620_adc',
    'temp_c',
    'rh_pct'
  ];

  const rows: string[] = [headers.join(',')];

  records.forEach((rec) => {
    rows.push(
      [
        `"${rec.id}"`,
        `"${rec.timestamp}"`,
        `"${rec.sampleLabel}"`,
        `"${rec.testType}"`,
        `"${rec.verdict}"`,
        rec.confidence,
        rec.sensorReadings?.MQ135 ?? '',
        rec.sensorReadings?.MQ137 ?? '',
        rec.sensorReadings?.TGS2600 ?? '',
        rec.sensorReadings?.TGS2602 ?? '',
        rec.sensorReadings?.TGS2620 ?? '',
        rec.temp_c ?? '',
        rec.rh_pct ?? '',
      ].join(',')
    );
  });

  const csvContent = 'data:text/csv;charset=utf-8,' + encodeURIComponent(rows.join('\n'));
  const link = document.createElement('a');
  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `freshnose_archive_all_${dateStr}.csv`;

  link.setAttribute('href', csvContent);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

import { calculateTotalMinutes } from './timesheet-calc';

/**
 * Spesifikasi untuk agregasi durasi timesheet.
 *
 * Modul `./timesheet-calc` belum ada — tugasnya adalah membuatnya, lalu
 * memakainya di TimesheetsService.createTimesheet.
 *
 * Kontrak:
 *   calculateTotalMinutes(timeBlocks, manualEntries, period) => number
 *
 *   timeBlocks:    Array<{ blockStart: Date | string; blockEnd: Date | string }>
 *   manualEntries: Array<{ durationMinutes: number }>
 *   period:        { start: Date; end: Date }
 *
 * Mengembalikan total menit (integer).
 */
describe('calculateTotalMinutes', () => {
  const period = {
    start: new Date('2026-03-02T00:00:00Z'),
    end: new Date('2026-03-08T23:59:59Z'),
  };

  it('mengembalikan 0 kalau tidak ada data', () => {
    expect(calculateTotalMinutes([], [], period)).toBe(0);
  });

  it('menjumlahkan durasi time block sederhana', () => {
    const blocks = [
      {
        blockStart: new Date('2026-03-02T09:00:00Z'),
        blockEnd: new Date('2026-03-02T11:30:00Z'),
      }, // 150 mnt
      {
        blockStart: new Date('2026-03-03T13:00:00Z'),
        blockEnd: new Date('2026-03-03T14:00:00Z'),
      }, // 60 mnt
    ];
    expect(calculateTotalMinutes(blocks, [], period)).toBe(210);
  });

  it('menerima blockStart/blockEnd berupa string ISO', () => {
    const blocks = [
      { blockStart: '2026-03-02T09:00:00Z', blockEnd: '2026-03-02T10:00:00Z' },
    ];
    expect(calculateTotalMinutes(blocks, [], period)).toBe(60);
  });

  it('menambahkan durasi manual entry', () => {
    const blocks = [
      {
        blockStart: new Date('2026-03-02T09:00:00Z'),
        blockEnd: new Date('2026-03-02T10:00:00Z'),
      }, // 60
    ];
    const manual = [{ durationMinutes: 45 }, { durationMinutes: 15 }];
    expect(calculateTotalMinutes(blocks, manual, period)).toBe(120);
  });

  // ─── Edge case 1: block yang tumpang tindih tidak boleh dihitung dua kali ───
  it('menggabungkan block yang tumpang tindih penuh', () => {
    const blocks = [
      {
        blockStart: new Date('2026-03-02T09:00:00Z'),
        blockEnd: new Date('2026-03-02T11:00:00Z'),
      }, // 120
      {
        blockStart: new Date('2026-03-02T09:30:00Z'),
        blockEnd: new Date('2026-03-02T10:00:00Z'),
      }, // di dalamnya
    ];
    expect(calculateTotalMinutes(blocks, [], period)).toBe(120);
  });

  it('menggabungkan block yang tumpang tindih sebagian', () => {
    const blocks = [
      {
        blockStart: new Date('2026-03-02T09:00:00Z'),
        blockEnd: new Date('2026-03-02T10:00:00Z'),
      },
      {
        blockStart: new Date('2026-03-02T09:45:00Z'),
        blockEnd: new Date('2026-03-02T11:00:00Z'),
      },
    ];
    // gabungan 09:00–11:00 = 120, bukan 60 + 75 = 135
    expect(calculateTotalMinutes(blocks, [], period)).toBe(120);
  });

  it('tidak menggabungkan block yang hanya bersentuhan ujungnya', () => {
    const blocks = [
      {
        blockStart: new Date('2026-03-02T09:00:00Z'),
        blockEnd: new Date('2026-03-02T10:00:00Z'),
      },
      {
        blockStart: new Date('2026-03-02T10:00:00Z'),
        blockEnd: new Date('2026-03-02T10:30:00Z'),
      },
    ];
    expect(calculateTotalMinutes(blocks, [], period)).toBe(90);
  });

  it('menangani block yang tidak urut', () => {
    const blocks = [
      {
        blockStart: new Date('2026-03-05T14:00:00Z'),
        blockEnd: new Date('2026-03-05T15:00:00Z'),
      },
      {
        blockStart: new Date('2026-03-02T09:00:00Z'),
        blockEnd: new Date('2026-03-02T10:00:00Z'),
      },
    ];
    expect(calculateTotalMinutes(blocks, [], period)).toBe(120);
  });

  // ─── Edge case 2: block yang melewati batas periode dipotong, bukan dibuang ─
  it('memotong block yang mulai sebelum periode', () => {
    const blocks = [
      {
        blockStart: new Date('2026-03-01T23:00:00Z'), // sebelum periode
        blockEnd: new Date('2026-03-02T01:00:00Z'), // 1 jam masuk periode
      },
    ];
    expect(calculateTotalMinutes(blocks, [], period)).toBe(60);
  });

  it('memotong block yang berakhir setelah periode', () => {
    const blocks = [
      {
        blockStart: new Date('2026-03-08T23:00:00Z'),
        blockEnd: new Date('2026-03-09T01:00:00Z'),
      },
    ];
    // 23:00:00 – 23:59:59 = 59,983 mnt -> dibulatkan 60
    expect(calculateTotalMinutes(blocks, [], period)).toBe(60);
  });

  it('mengabaikan block yang sepenuhnya di luar periode', () => {
    const blocks = [
      {
        blockStart: new Date('2026-02-20T09:00:00Z'),
        blockEnd: new Date('2026-02-20T10:00:00Z'),
      },
    ];
    expect(calculateTotalMinutes(blocks, [], period)).toBe(0);
  });

  // ─── Edge case 3: pembulatan dilakukan sekali di akhir ─────────────────────
  it('membulatkan sekali di akhir, bukan per block', () => {
    // 3 block masing-masing 40 detik = 120 detik = 2 menit tepat.
    // Kalau dibulatkan per block (Math.round(0,667)=1) hasilnya jadi 3.
    const blocks = [
      {
        blockStart: new Date('2026-03-02T09:00:00Z'),
        blockEnd: new Date('2026-03-02T09:00:40Z'),
      },
      {
        blockStart: new Date('2026-03-02T10:00:00Z'),
        blockEnd: new Date('2026-03-02T10:00:40Z'),
      },
      {
        blockStart: new Date('2026-03-02T11:00:00Z'),
        blockEnd: new Date('2026-03-02T11:00:40Z'),
      },
    ];
    expect(calculateTotalMinutes(blocks, [], period)).toBe(2);
  });

  // ─── Edge case 4: data rusak tidak boleh bikin hasil negatif/NaN ───────────
  it('mengabaikan block dengan blockEnd sebelum blockStart', () => {
    const blocks = [
      {
        blockStart: new Date('2026-03-02T10:00:00Z'),
        blockEnd: new Date('2026-03-02T09:00:00Z'),
      },
      {
        blockStart: new Date('2026-03-03T09:00:00Z'),
        blockEnd: new Date('2026-03-03T10:00:00Z'),
      },
    ];
    expect(calculateTotalMinutes(blocks, [], period)).toBe(60);
  });

  it('mengabaikan block dengan tanggal tidak valid', () => {
    const blocks = [
      { blockStart: 'bukan-tanggal', blockEnd: '2026-03-02T10:00:00Z' },
      {
        blockStart: new Date('2026-03-03T09:00:00Z'),
        blockEnd: new Date('2026-03-03T10:00:00Z'),
      },
    ];
    expect(calculateTotalMinutes(blocks, [], period)).toBe(60);
  });

  it('mengabaikan manual entry yang bukan angka valid', () => {
    const manual = [
      { durationMinutes: 30 },
      { durationMinutes: NaN },
      { durationMinutes: -10 },
    ];
    expect(calculateTotalMinutes([], manual, period)).toBe(30);
  });

  it('selalu mengembalikan integer', () => {
    const blocks = [
      {
        blockStart: new Date('2026-03-02T09:00:00Z'),
        blockEnd: new Date('2026-03-02T09:00:30Z'),
      },
    ];
    expect(Number.isInteger(calculateTotalMinutes(blocks, [], period))).toBe(
      true,
    );
  });
});

/**
 * Exam blueprint — per-level section configuration for the full Mock Test (V2).
 *
 * Sections tagged as 'written' (Set 1) or 'oral' (Set 2).
 * Set 1 and Set 2 are scored independently; both must hit pass mark for overall PASS.
 *
 * V1 Digital Exam Lite scope — matches real TELC/Goethe exam structure.
 */

export type ExamSectionKey = 'Hören' | 'Lesen' | 'Sprachbausteine' | 'Schreiben' | 'Sprechen';
export type ExamSetGroup = 'written' | 'oral';

export type ExamBlueprintSection = {
  section: ExamSectionKey;
  setGroup: ExamSetGroup;
  timeMinutes: number;
  teils: number[];
  /** Questions per teil (for Hören/Lesen MCQ-style). Schreiben/Sprechen = 1 per teil. */
  questionsPerTeil?: number[];
};

export const PASS_MARK_PCT = 60;

export const EXAM_BLUEPRINTS: Record<string, ExamBlueprintSection[]> = {
  A1: [
    { section: 'Hören',     setGroup: 'written', timeMinutes: 20, teils: [1, 2, 3],       questionsPerTeil: [5, 5, 5] },
    { section: 'Lesen',     setGroup: 'written', timeMinutes: 25, teils: [1, 2, 3],       questionsPerTeil: [5, 5, 5] },
    { section: 'Schreiben', setGroup: 'written', timeMinutes: 20, teils: [1, 2] },
    { section: 'Sprechen',  setGroup: 'oral',    timeMinutes: 15, teils: [1, 2, 3] },
  ],
  A2: [
    { section: 'Hören',     setGroup: 'written', timeMinutes: 20, teils: [1, 2, 3, 4],    questionsPerTeil: [5, 5, 5, 5] },
    { section: 'Lesen',     setGroup: 'written', timeMinutes: 25, teils: [1, 2, 3, 4],    questionsPerTeil: [5, 5, 5, 5] },
    { section: 'Schreiben', setGroup: 'written', timeMinutes: 20, teils: [1, 2] },
    { section: 'Sprechen',  setGroup: 'oral',    timeMinutes: 15, teils: [1, 2, 3] },
  ],
  B1: [
    { section: 'Hören',           setGroup: 'written', timeMinutes: 40, teils: [1, 2, 3, 4],    questionsPerTeil: [10, 5, 7, 8] },
    { section: 'Lesen',           setGroup: 'written', timeMinutes: 65, teils: [1, 2, 3, 4, 5], questionsPerTeil: [6, 6, 7, 7, 4] },
    { section: 'Sprachbausteine', setGroup: 'written', timeMinutes: 15, teils: [1, 2],          questionsPerTeil: [10, 10] },
    { section: 'Schreiben',       setGroup: 'written', timeMinutes: 30, teils: [1, 2, 3] },
    { section: 'Sprechen',        setGroup: 'oral',    timeMinutes: 15, teils: [1, 2, 3] },
  ],
};

export function getBlueprint(level: string): ExamBlueprintSection[] {
  return EXAM_BLUEPRINTS[level] ?? EXAM_BLUEPRINTS.B1!;
}

export function getTotalMinutes(level: string): number {
  return getBlueprint(level).reduce((sum, s) => sum + s.timeMinutes, 0);
}

export function getWrittenSections(level: string): ExamBlueprintSection[] {
  return getBlueprint(level).filter((s) => s.setGroup === 'written');
}

export function getOralSections(level: string): ExamBlueprintSection[] {
  return getBlueprint(level).filter((s) => s.setGroup === 'oral');
}

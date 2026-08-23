import type { ReactNode } from 'react';
import { ArrowLeftRight, Ban, Check, Gavel, Hourglass, Minus } from 'lucide-react';
import { PageHeader } from './DashboardLayout';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableCaption } from './ui/table';

interface OffenseRule {
  id: string;
  offense: string;
  measure: string;
  duration: string;
  suspensionType: string;
  reEntryMethod: string;
  semesterVoided: string;
  priorCoursesRetained: string;
  reportToPolice: string;
}

const OFFENSE_RULES: OffenseRule[] = [
  { id: '1', offense: 'Undermining principles/objectives of the University', measure: 'Suspension', duration: '—', suspensionType: 'Indefinite', reEntryMethod: 'Re-application required', semesterVoided: 'Yes', priorCoursesRetained: 'Yes', reportToPolice: 'No' },
  { id: '2', offense: 'Criminal arrest/conviction in court while enrolled', measure: 'Suspension', duration: '—', suspensionType: 'Case-dependent', reEntryMethod: 'Committee decision', semesterVoided: 'Yes', priorCoursesRetained: 'Yes', reportToPolice: 'Yes' },
  { id: '3', offense: 'Obstruction/disruption of teaching, research, admin, or disciplinary procedures', measure: 'Suspension', duration: '—', suspensionType: 'Indefinite', reEntryMethod: 'Re-application required', semesterVoided: 'Yes', priorCoursesRetained: 'Yes', reportToPolice: 'No' },
  { id: '4', offense: 'Caught drunk on campus', measure: 'Suspension', duration: '1', suspensionType: 'Fixed', reEntryMethod: 'Automatic after duration', semesterVoided: 'Yes', priorCoursesRetained: 'Yes', reportToPolice: 'No' },
  { id: '5', offense: 'Possession of alcohol or tobacco', measure: 'Dismissal', duration: '—', suspensionType: '—', reEntryMethod: 'Readmission as new student only', semesterVoided: 'Yes', priorCoursesRetained: 'No', reportToPolice: 'No' },
  { id: '6', offense: 'Use/possession of marijuana, heroin, cocaine, other drugs', measure: 'Dismissal', duration: '—', suspensionType: '—', reEntryMethod: 'Readmission as new student only', semesterVoided: 'Yes', priorCoursesRetained: 'No', reportToPolice: 'Yes' },
  { id: '7', offense: 'Possession of firearms, explosives, knives, lethal weapons', measure: 'Dismissal', duration: '—', suspensionType: '—', reEntryMethod: 'Readmission as new student only', semesterVoided: 'Yes', priorCoursesRetained: 'No', reportToPolice: 'Yes' },
  { id: '8', offense: 'Setting off/tampering with fire safety equipment', measure: 'Suspension or fine', duration: '—', suspensionType: 'Case-dependent', reEntryMethod: 'Committee decision', semesterVoided: 'Yes', priorCoursesRetained: 'Yes', reportToPolice: 'No' },
  { id: '9', offense: 'Willful disrespect / failure to comply with directive (insubordination)', measure: 'Suspension', duration: '—', suspensionType: 'Indefinite', reEntryMethod: 'Re-application required', semesterVoided: 'Yes', priorCoursesRetained: 'Yes', reportToPolice: 'No' },
  { id: '10', offense: 'Willful damage/destruction of property, unlawful entry, assault', measure: 'Suspension', duration: '—', suspensionType: 'Indefinite', reEntryMethod: 'Re-application required', semesterVoided: 'Yes', priorCoursesRetained: 'Yes', reportToPolice: 'No' },
  { id: '11', offense: 'Public indecent assault (e.g., sexual gesture)', measure: 'Suspension', duration: '—', suspensionType: 'Indefinite', reEntryMethod: 'Re-application required', semesterVoided: 'Yes', priorCoursesRetained: 'Yes', reportToPolice: 'No' },
  { id: '12', offense: 'Sexual harassment', measure: 'Dismissal', duration: '—', suspensionType: '—', reEntryMethod: 'Readmission as new student only', semesterVoided: 'Yes', priorCoursesRetained: 'No', reportToPolice: 'Yes' },
  { id: '13', offense: 'Incitement of students (riot/strike)', measure: 'Suspension or Dismissal', duration: '—', suspensionType: 'Case-dependent', reEntryMethod: 'Committee decision', semesterVoided: 'Yes', priorCoursesRetained: 'Depends on ruling', reportToPolice: 'No' },
  { id: '14a', offense: 'Unauthorized political activity — 1st offense', measure: 'Warning', duration: '—', suspensionType: '—', reEntryMethod: 'N/A', semesterVoided: 'No', priorCoursesRetained: 'Yes', reportToPolice: 'No' },
  { id: '14b', offense: 'Unauthorized political activity — 2nd offense', measure: 'Suspension', duration: '1', suspensionType: 'Fixed', reEntryMethod: 'Automatic after duration', semesterVoided: 'Yes', priorCoursesRetained: 'Yes', reportToPolice: 'No' },
  { id: '14c', offense: 'Unauthorized political activity — 3rd offense', measure: 'Dismissal', duration: '—', suspensionType: '—', reEntryMethod: 'Readmission as new student only', semesterVoided: 'Yes', priorCoursesRetained: 'No', reportToPolice: 'No' },
  { id: '15', offense: "Distorting/misrepresenting the University's or leadership's image", measure: 'Dismissal', duration: '—', suspensionType: '—', reEntryMethod: 'Readmission as new student only', semesterVoided: 'Yes', priorCoursesRetained: 'No', reportToPolice: 'No' },
  { id: '16', offense: 'Academic dishonesty (cheating/plagiarism)', measure: 'Suspension (or course grade nullified)', duration: '1+', suspensionType: 'Fixed-minimum', reEntryMethod: 'Automatic or committee decision', semesterVoided: 'Depends on severity', priorCoursesRetained: 'Yes', reportToPolice: 'No' },
];

/**
 * Measure tones deliberately reuse StatusBadge's vocabulary (tinted fill, inset ring, leading dot)
 * so a sanction named here reads the same as the same sanction shown on a live case.
 */
const MEASURE_STYLES: Record<string, { cls: string; dot: string }> = {
  'Warning': { cls: 'bg-yellow-50 text-yellow-800 ring-yellow-200/70', dot: 'bg-yellow-500' },
  'Suspension': { cls: 'bg-rose-50 text-rose-800 ring-rose-200/70', dot: 'bg-rose-500' },
  'Suspension or fine': { cls: 'bg-amber-50 text-amber-800 ring-amber-200/70', dot: 'bg-amber-500' },
  'Suspension or Dismissal': { cls: 'bg-orange-50 text-orange-800 ring-orange-200/70', dot: 'bg-orange-500' },
  'Suspension (or course grade nullified)': { cls: 'bg-rose-50 text-rose-800 ring-rose-200/70', dot: 'bg-rose-500' },
  'Dismissal': { cls: 'bg-rose-100 text-rose-900 ring-rose-300/70', dot: 'bg-rose-700' },
};

function MeasureBadge({ measure }: { measure: string }) {
  const tone = MEASURE_STYLES[measure] || { cls: 'bg-ink-100 text-ink-600 ring-ink-200', dot: 'bg-ink-400' };
  return (
    <span
      className={`inline-flex items-center gap-1.5 pl-1.5 pr-2.5 py-0.5 rounded-full font-tight text-[11px] font-semibold
                  ring-1 ring-inset whitespace-nowrap ${tone.cls}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${tone.dot}`} aria-hidden="true" />
      {measure}
    </span>
  );
}

/**
 * Yes/No columns. The tick is brand navy rather than green on purpose: several of these flags
 * ("Report to Police: Yes") are not good news, and a green tick would imply a verdict the schedule
 * isn't making. Anything that isn't a flat yes or no is a judgement call, so it's tinted amber.
 */
function FlagCell({ value }: { value: string }) {
  if (value === 'Yes' || value === 'No') {
    return (
      <span className={`inline-flex items-center gap-1.5 font-tight text-[12px] ${value === 'Yes' ? 'text-ink-700' : 'text-ink-400'}`}>
        {value === 'Yes'
          ? <Check size={13} className="text-brand-600 shrink-0" aria-hidden="true" />
          : <Minus size={13} className="text-ink-300 shrink-0" aria-hidden="true" />}
        {value}
      </span>
    );
  }
  return (
    <span className="inline-flex items-start gap-1.5 font-tight text-[12px] text-amber-700">
      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 mt-1.5" aria-hidden="true" />
      {value}
    </span>
  );
}

/** Purely presentational wrapper for the three interpretation notes below the schedule. */
function RuleNote({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="card p-6">
      <div className="flex items-center gap-2.5 mb-3">
        <span
          className="w-8 h-8 rounded-full bg-brand-50 text-brand-700 flex items-center justify-center shrink-0"
          aria-hidden="true"
        >
          {icon}
        </span>
        <p className="eyebrow">{label}</p>
      </div>
      <p className="text-[13px] text-ink-600 leading-relaxed">{children}</p>
    </div>
  );
}

const HEAD_CELL = 'eyebrow font-semibold text-ink-500 h-auto px-4 py-3 align-bottom';
const BODY_CELL = 'px-4 py-3.5 align-top';

export function DisciplinaryRulesPage() {
  return (
    <>
      <PageHeader
        title="Disciplinary Rules & Regulations"
        subtitle="Official offense categories and mandated measures — AUCA Student Handbook 2018–2021, Chapter IX"
      />
      <div className="flex-1 overflow-y-auto p-4 sm:p-8">
        <div className="mx-auto w-full max-w-[1500px] space-y-6 rise">
          <section className="card overflow-hidden">
            <div className="flex flex-wrap items-end justify-between gap-3 px-4 sm:px-6 py-5 border-b border-[var(--hairline)]">
              <div className="min-w-0">
                <p className="eyebrow">Chapter IX · Schedule of offenses</p>
                <h2 className="display-md text-ink-900 mt-1.5">Offenses and mandated measures</h2>
              </div>
              <p className="flex xl:hidden items-center gap-1.5 font-tight text-[12px] text-ink-400">
                <ArrowLeftRight size={13} aria-hidden="true" />
                Scroll sideways for the full row
              </p>
            </div>
            <Table>
              <TableCaption className="sr-only">
                Offense categories with the mandated measure, duration, suspension type, re-entry method, and academic
                and reporting consequences for each.
              </TableCaption>
              <TableHeader>
                <TableRow className="bg-ink-50/70 border-b border-[var(--hairline)] hover:bg-ink-50/70">
                  <TableHead className={HEAD_CELL} scope="col">ID</TableHead>
                  <TableHead className={HEAD_CELL} scope="col">Offense</TableHead>
                  <TableHead className={HEAD_CELL} scope="col">Measure</TableHead>
                  <TableHead className={`${HEAD_CELL} whitespace-normal max-w-[6rem]`} scope="col">Duration (semesters)</TableHead>
                  <TableHead className={`${HEAD_CELL} whitespace-normal max-w-[7rem]`} scope="col">Suspension type</TableHead>
                  <TableHead className={HEAD_CELL} scope="col">Re-entry method</TableHead>
                  <TableHead className={`${HEAD_CELL} whitespace-normal max-w-[7rem]`} scope="col">Current semester voided</TableHead>
                  <TableHead className={`${HEAD_CELL} whitespace-normal max-w-[7rem]`} scope="col">Prior courses retained</TableHead>
                  <TableHead className={`${HEAD_CELL} whitespace-normal max-w-[6rem]`} scope="col">Report to police</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {OFFENSE_RULES.map(rule => (
                  <TableRow
                    key={rule.id}
                    className="border-b border-[var(--hairline)] hover:bg-brand-50/40 transition-colors duration-[var(--dur)] ease-[var(--ease-out)]"
                  >
                    <TableCell className={`${BODY_CELL} font-mono tabular text-[11px] text-ink-400 pt-4`}>{rule.id}</TableCell>
                    <TableCell className={`${BODY_CELL} whitespace-normal min-w-[240px] max-w-[380px] text-[13px] leading-relaxed text-ink-900`}>
                      {rule.offense}
                    </TableCell>
                    <TableCell className={BODY_CELL}><MeasureBadge measure={rule.measure} /></TableCell>
                    <TableCell className={`${BODY_CELL} tabular text-[13px] text-ink-600`}>{rule.duration}</TableCell>
                    <TableCell className={`${BODY_CELL} text-[13px] text-ink-600`}>{rule.suspensionType}</TableCell>
                    <TableCell className={`${BODY_CELL} text-[13px] text-ink-600`}>{rule.reEntryMethod}</TableCell>
                    <TableCell className={BODY_CELL}><FlagCell value={rule.semesterVoided} /></TableCell>
                    <TableCell className={BODY_CELL}><FlagCell value={rule.priorCoursesRetained} /></TableCell>
                    <TableCell className={BODY_CELL}><FlagCell value={rule.reportToPolice} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </section>

          <section className="grid sm:grid-cols-3 gap-4">
            <RuleNote icon={<Ban size={15} />} label="On Dismissal">
              No prior completed courses count if the student is later readmitted as a new student.
            </RuleNote>
            <RuleNote icon={<Hourglass size={15} />} label="On Suspension">
              Prior completed semesters remain valid; only the semester in progress at the time of suspension is voided
              (if suspension starts after the first month of the semester).
            </RuleNote>
            <RuleNote icon={<Gavel size={15} />} label="Appeals">
              Must be filed within 7 calendar days, addressed to the Rector and copied to the Dean of Students; only one
              appeal is allowed per disciplinary stage.
            </RuleNote>
          </section>

          <footer className="border-t border-[var(--hairline)] pt-4">
            <p className="font-tight text-[12px] leading-relaxed text-ink-400 max-w-[80ch]">
              Source: AUCA Student Handbook 2018–2021, Chapter IX (Disciplinary Regulations). Reference material only —
              it does not affect how incidents are reported or decided in CaseFlow.
            </p>
          </footer>
        </div>
      </div>
    </>
  );
}

import { Check, Minus } from 'lucide-react';
import { PageHeader } from './DashboardLayout';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from './ui/table';

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

const MEASURE_STYLES: Record<string, string> = {
  'Warning': 'bg-yellow-50 text-yellow-700 border-yellow-200',
  'Suspension': 'bg-red-50 text-red-700 border-red-200',
  'Suspension or fine': 'bg-orange-50 text-orange-700 border-orange-200',
  'Suspension or Dismissal': 'bg-orange-50 text-orange-700 border-orange-200',
  'Suspension (or course grade nullified)': 'bg-red-50 text-red-700 border-red-200',
  'Dismissal': 'bg-red-100 text-red-800 border-red-300',
};

function MeasureBadge({ measure }: { measure: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border whitespace-nowrap ${MEASURE_STYLES[measure] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
      {measure}
    </span>
  );
}

function FlagCell({ value }: { value: string }) {
  if (value === 'Yes' || value === 'No') {
    return (
      <span className={`inline-flex items-center gap-1 text-xs ${value === 'Yes' ? 'text-gray-700' : 'text-gray-400'}`}>
        {value === 'Yes' ? <Check size={12} className="text-green-600" /> : <Minus size={12} />}
        {value}
      </span>
    );
  }
  return <span className="text-xs text-amber-700">{value}</span>;
}

export function DisciplinaryRulesPage() {
  return (
    <>
      <PageHeader
        title="Disciplinary Rules & Regulations"
        subtitle="Official offense categories and mandated measures — AUCA Student Handbook 2018–2021, Chapter IX"
      />
      <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-6">
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Offense</TableHead>
                <TableHead>Measure</TableHead>
                <TableHead>Duration (semesters)</TableHead>
                <TableHead>Suspension Type</TableHead>
                <TableHead>Re-entry Method</TableHead>
                <TableHead>Current Semester Voided</TableHead>
                <TableHead>Prior Courses Retained</TableHead>
                <TableHead>Report to Police</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {OFFENSE_RULES.map(rule => (
                <TableRow key={rule.id}>
                  <TableCell className="text-gray-400 font-mono text-xs">{rule.id}</TableCell>
                  <TableCell className="whitespace-normal min-w-[240px] text-gray-800">{rule.offense}</TableCell>
                  <TableCell><MeasureBadge measure={rule.measure} /></TableCell>
                  <TableCell className="text-gray-600">{rule.duration}</TableCell>
                  <TableCell className="text-gray-600">{rule.suspensionType}</TableCell>
                  <TableCell className="text-gray-600">{rule.reEntryMethod}</TableCell>
                  <TableCell><FlagCell value={rule.semesterVoided} /></TableCell>
                  <TableCell><FlagCell value={rule.priorCoursesRetained} /></TableCell>
                  <TableCell><FlagCell value={rule.reportToPolice} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">On Dismissal</p>
            <p className="text-sm text-gray-700 leading-relaxed">No prior completed courses count if the student is later readmitted as a new student.</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">On Suspension</p>
            <p className="text-sm text-gray-700 leading-relaxed">Prior completed semesters remain valid; only the semester in progress at the time of suspension is voided (if suspension starts after the first month of the semester).</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Appeals</p>
            <p className="text-sm text-gray-700 leading-relaxed">Must be filed within 7 calendar days, addressed to the Rector, copied to the Dean of Students; only 1 appeal allowed per disciplinary stage.</p>
          </div>
        </div>

        <p className="text-xs text-gray-400">Source: AUCA Student Handbook 2018–2021, Chapter IX (Disciplinary Regulations). This is reference material only — it does not affect how incidents are reported or decided in CaseFlow.</p>
      </div>
    </>
  );
}

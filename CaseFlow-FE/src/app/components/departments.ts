/**
 * AUCA's real academic and administrative structure.
 *
 * Sourced from the university's own site (web.auca.ac.rw), whose faculty listing gives the department
 * count for each faculty — 3 / 4 / 4 / 1 / 2 / 1 — and from the published undergraduate programme
 * list, which names them. The two reconcile exactly at 15 departments, which is why the groupings
 * below are split the way they are.
 *
 * Students and staff are deliberately offered different lists. A student belongs to a *programme*
 * ("Software Engineering"); a lecturer or registrar belongs to a *faculty* or an administrative office
 * ("Faculty of Information Technology", "Registrar's Office"). Offering one flat list would force an
 * admin to claim a degree programme as their department.
 */

export interface DepartmentGroup {
  /** Rendered as an <optgroup> label. */
  group: string;
  options: readonly string[];
}

/** Degree programmes, grouped by the faculty that owns them. Used wherever a student is described. */
export const STUDENT_DEPARTMENT_GROUPS: readonly DepartmentGroup[] = [
  {
    group: 'Faculty of Information Technology',
    options: ['Software Engineering', 'Network & Communication Systems', 'Information Management'],
  },
  {
    group: 'Faculty of Business Administration',
    options: ['Accounting', 'Finance', 'Management', 'Marketing'],
  },
  {
    group: 'Faculty of Education',
    options: [
      'Accounting and Information Technology',
      'English Language and Literature & French',
      'Geography and History',
      'Mathematics and Economics',
    ],
  },
  { group: 'Faculty of Theology', options: ['Theology'] },
  { group: 'Faculty of Nursing & Midwifery', options: ['Nursing', 'Midwifery'] },
  { group: 'School of Medicine (ASOME)', options: ['General Medicine'] },
];

/**
 * Where staff sit. The faculties themselves, plus the administrative offices that actually appear in
 * a disciplinary workflow — the registrar raises holds, student affairs receives physical evidence,
 * and the committee members belong to the committee rather than to a teaching department.
 */
export const STAFF_DEPARTMENT_GROUPS: readonly DepartmentGroup[] = [
  {
    group: 'Faculties & Schools',
    options: [
      'Faculty of Information Technology',
      'Faculty of Business Administration',
      'Faculty of Education',
      'Faculty of Theology',
      'Faculty of Nursing & Midwifery',
      'School of Medicine (ASOME)',
    ],
  },
  {
    group: 'Administration',
    options: [
      "Registrar's Office",
      'Student Affairs',
      'Disciplinary Committee',
      'Academic Affairs',
      'Finance Office',
      'Library',
      'IT Services',
      'Human Resources',
    ],
  },
];

export function departmentGroupsFor(role: string | undefined): readonly DepartmentGroup[] {
  return role === 'student' ? STUDENT_DEPARTMENT_GROUPS : STAFF_DEPARTMENT_GROUPS;
}

/**
 * Every value either list can produce, for validation and for the report page's filter.
 */
export const ALL_DEPARTMENTS: readonly string[] = [
  ...STUDENT_DEPARTMENT_GROUPS.flatMap(g => g.options),
  ...STAFF_DEPARTMENT_GROUPS.flatMap(g => g.options),
];

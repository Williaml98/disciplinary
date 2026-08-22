/**
 * AUCA faculties/departments offered in the registration form and the admin create-account form.
 *
 * A fixed list rather than free text so `reporterDepartment` report filtering and the department
 * column stay consistent — the backend column is plain free-text, and typo'd variants ("Comp Sci",
 * "computer science") would each become their own filter value.
 */
export const DEPARTMENTS = [
  'Computer Science',
  'Information Technology',
  'Business Administration',
  'Accounting',
  'Economics',
  'Education',
  'Theology',
  'Nursing',
  'Public Health',
  'Social Work',
  'Law',
  'Communication',
] as const;

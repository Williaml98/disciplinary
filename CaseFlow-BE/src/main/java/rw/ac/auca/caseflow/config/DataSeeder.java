package rw.ac.auca.caseflow.config;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import rw.ac.auca.caseflow.domain.AppUser;
import rw.ac.auca.caseflow.domain.AuditEntry;
import rw.ac.auca.caseflow.domain.CaseStatus;
import rw.ac.auca.caseflow.domain.DecisionType;
import rw.ac.auca.caseflow.domain.DisciplinaryCase;
import rw.ac.auca.caseflow.domain.Note;
import rw.ac.auca.caseflow.domain.RegistrationStatus;
import rw.ac.auca.caseflow.domain.Role;
import rw.ac.auca.caseflow.repository.CaseRepository;
import rw.ac.auca.caseflow.repository.UserRepository;

/**
 * Seeds demo data equivalent to CaseFlow-FE's mockData.tsx (DEMO_USERS / INITIAL_CASES),
 * so the two projects can be compared side by side while they're not yet wired together.
 */
@Component
public class DataSeeder implements CommandLineRunner {

    private static final DateTimeFormatter TIMESTAMP_FORMAT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");
    private static final String DEMO_PASSWORD = "demo1234";

    private final UserRepository userRepository;
    private final CaseRepository caseRepository;
    private final PasswordEncoder passwordEncoder;

    public DataSeeder(UserRepository userRepository, CaseRepository caseRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.caseRepository = caseRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    public void run(String... args) {
        if (userRepository.count() > 0 || caseRepository.count() > 0) {
            return;
        }
        seedUsers();
        seedCases();
    }

    private void seedUsers() {
        String hash = passwordEncoder.encode(DEMO_PASSWORD);
        userRepository.save(new AppUser("Dr. Marie Claire Uwase", Role.LECTURER, "Computer Science", null, "mcuwase@auca.ac.rw", hash));
        userRepository.save(new AppUser("Dr. Emmanuel Kayitesi", Role.COMMITTEE, "Disciplinary Committee (Chair)", null, "ekayitesi@auca.ac.rw", hash));
        userRepository.save(new AppUser("Jean Bosco Habimana", Role.STUDENT, null, "21045", "jbhabimana@student.auca.ac.rw", hash));
        userRepository.save(new AppUser("Alice Mutoni", Role.ADMIN, "Registrar Office", null, "amutoni@auca.ac.rw", hash));
    }

    private void seedCases() {
        DisciplinaryCase c1 = new DisciplinaryCase(
                "CF-2026-001", "Jean Bosco Habimana", "21045", "Dr. Marie Claire Uwase", "Computer Science",
                "Exam Cheating",
                "Student was found in possession of unauthorized notes during the COMP301 Final Examination on June 5, 2026. The notes contained pre-written formulas and answers. The invigilator confiscated the material and submitted it as evidence.",
                "Recovered cheat sheet (physical copy submitted), Invigilator written statement",
                date("2026-06-05"), CaseStatus.UNDER_REVIEW, RegistrationStatus.FLAGGED);
        c1.addNote(new Note("Dr. Emmanuel Kayitesi", "Evidence reviewed. The cheat sheet contains course-specific formulas clearly written in advance. Will proceed to full committee deliberation.", ts("2026-06-08 10:30")));
        c1.addNote(new Note("Dr. Amina Nziza", "I concur with the Chair. Student should be given an opportunity to respond before a final decision is made.", ts("2026-06-09 14:15")));
        c1.addAuditEntry(new AuditEntry("Incident Reported", "Dr. Marie Claire Uwase", ts("2026-06-05 11:00")));
        c1.addAuditEntry(new AuditEntry("Case CF-2026-001 Created", "System", ts("2026-06-05 11:01")));
        c1.addAuditEntry(new AuditEntry("Committee Chair Notified", "System", ts("2026-06-05 11:01")));
        c1.addAuditEntry(new AuditEntry("Status set to: Under Review", "Dr. Emmanuel Kayitesi", ts("2026-06-08 09:00")));
        c1.addAuditEntry(new AuditEntry("Note Added", "Dr. Emmanuel Kayitesi", ts("2026-06-08 10:30")));
        c1.addAuditEntry(new AuditEntry("Note Added", "Dr. Amina Nziza", ts("2026-06-09 14:15")));
        caseRepository.save(c1);

        DisciplinaryCase c2 = new DisciplinaryCase(
                "CF-2026-002", "Solange Ingabire", "22118", "Prof. Patrick Nkurunziza", "Business Administration",
                "Academic Plagiarism",
                "Student submitted a final year project found to be 78% similar to a 2023 publication from a Kenyan university per Turnitin analysis. No attribution was included in the submitted work.",
                "Turnitin report (78% similarity score), Original publication DOI reference",
                date("2026-05-20"), CaseStatus.UNDER_APPEAL, RegistrationStatus.RESTRICTED);
        c2.recordDecision(DecisionType.SEMESTER_SUSPENSION, date("2026-06-01"), date("2026-07-01"), date("2026-12-31"));
        c2.submitAppeal("I respectfully contest this decision. While I acknowledge some similarity in sections, I was not fully aware that reformatting published content without explicit attribution constituted plagiarism at this level. I request the committee to reconsider the severity of the sanction given that this is my first offense.");
        c2.addNote(new Note("Dr. Emmanuel Kayitesi", "Committee finds this a serious breach of academic integrity. Turnitin report is conclusive. Semester suspension imposed effective July 2026.", ts("2026-05-28 09:00")));
        c2.addAuditEntry(new AuditEntry("Incident Reported", "Prof. Patrick Nkurunziza", ts("2026-05-20 14:00")));
        c2.addAuditEntry(new AuditEntry("Case CF-2026-002 Created", "System", ts("2026-05-20 14:01")));
        c2.addAuditEntry(new AuditEntry("Status set to: Under Review", "Dr. Emmanuel Kayitesi", ts("2026-05-22 09:00")));
        c2.addAuditEntry(new AuditEntry("Decision Recorded: Semester Suspension", "Dr. Emmanuel Kayitesi", ts("2026-06-01 16:00")));
        c2.addAuditEntry(new AuditEntry("Registration Status: RESTRICTED", "System", ts("2026-06-01 16:01")));
        c2.addAuditEntry(new AuditEntry("Student Notified via Email", "System", ts("2026-06-01 16:02")));
        c2.addAuditEntry(new AuditEntry("Appeal Submitted by Student", "Solange Ingabire", ts("2026-06-10 11:00")));
        c2.addAuditEntry(new AuditEntry("Status set to: Under Appeal", "System", ts("2026-06-10 11:01")));
        caseRepository.save(c2);

        DisciplinaryCase c3 = new DisciplinaryCase(
                "CF-2026-003", "Eric Nshimiyimana", "20387", "Dr. Grace Uwimana", "Theology",
                "Disruptive Behavior",
                "Student repeatedly disrupted a lecture on June 12, 2026, by shouting at the lecturer and refusing to leave the classroom when asked. Campus security was called to escort the student out of the building.",
                "Security incident report, Written statements from 3 classmates",
                date("2026-06-12"), CaseStatus.REPORTED, RegistrationStatus.FLAGGED);
        c3.addAuditEntry(new AuditEntry("Incident Reported", "Dr. Grace Uwimana", ts("2026-06-12 15:30")));
        c3.addAuditEntry(new AuditEntry("Case CF-2026-003 Created", "System", ts("2026-06-12 15:31")));
        c3.addAuditEntry(new AuditEntry("Committee Chair Notified", "System", ts("2026-06-12 15:31")));
        caseRepository.save(c3);

        DisciplinaryCase c4 = new DisciplinaryCase(
                "CF-2025-047", "Diane Mukamana", "19234", "Dr. Samuel Bigirimana", "Information Technology",
                "Exam Cheating",
                "Student was found using a mobile phone during the INFT401 final exam. Forensic analysis of the phone revealed photographs of exam questions from a previous session, indicating premeditated intent.",
                "Confiscated mobile phone (submitted for forensics), Invigilator report, Forensic analysis report",
                date("2025-11-15"), CaseStatus.RESOLVED, RegistrationStatus.ACTIVE);
        c4.recordDecision(DecisionType.SEMESTER_SUSPENSION, date("2025-11-30"), date("2026-01-01"), date("2026-06-30"));
        c4.addNote(new Note("Dr. Emmanuel Kayitesi", "Evidence is conclusive. Student admitted to the offense during hearing. One semester suspension imposed. Re-integration approved after suspension period ended.", ts("2025-11-28 11:00")));
        c4.addAuditEntry(new AuditEntry("Incident Reported", "Dr. Samuel Bigirimana", ts("2025-11-15 10:00")));
        c4.addAuditEntry(new AuditEntry("Case CF-2025-047 Created", "System", ts("2025-11-15 10:01")));
        c4.addAuditEntry(new AuditEntry("Status set to: Under Review", "Dr. Emmanuel Kayitesi", ts("2025-11-18 09:00")));
        c4.addAuditEntry(new AuditEntry("Decision Recorded: Semester Suspension", "Dr. Emmanuel Kayitesi", ts("2025-11-30 14:00")));
        c4.addAuditEntry(new AuditEntry("Registration Status: RESTRICTED", "System", ts("2025-11-30 14:01")));
        c4.addAuditEntry(new AuditEntry("Re-integration Approved", "Dr. Emmanuel Kayitesi", ts("2026-07-01 09:00")));
        c4.addAuditEntry(new AuditEntry("Registration Status: ACTIVE", "System", ts("2026-07-01 09:01")));
        c4.addAuditEntry(new AuditEntry("Case Closed", "Alice Mutoni", ts("2026-07-01 09:05")));
        caseRepository.save(c4);

        DisciplinaryCase c5 = new DisciplinaryCase(
                "CF-2026-004", "Pacifique Ishimwe", "23012", "Dr. Marie Claire Uwase", "Computer Science",
                "Unauthorized Collaboration",
                "Two students submitted identical programming assignments for COMP201. Source code comparison detected 97% similarity despite the assignment explicitly requiring independent work.",
                "Source code comparison report (97% similarity), Assignment submission logs",
                date("2026-06-18"), CaseStatus.REPORTED, RegistrationStatus.ACTIVE);
        c5.addAuditEntry(new AuditEntry("Incident Reported", "Dr. Marie Claire Uwase", ts("2026-06-18 09:00")));
        c5.addAuditEntry(new AuditEntry("Case CF-2026-004 Created", "System", ts("2026-06-18 09:01")));
        c5.addAuditEntry(new AuditEntry("Committee Chair Notified", "System", ts("2026-06-18 09:01")));
        caseRepository.save(c5);

        DisciplinaryCase c6 = new DisciplinaryCase(
                "CF-2026-005", "Claudine Uwera", "22456", "Prof. Jean Claude Rugamba", "Nursing",
                "Document Forgery",
                "Student was found to have forged a clinical practicum attendance sheet, signing off on hours she did not complete. The supervising nurse reported the discrepancy after comparing the sheet with hospital records.",
                "Forged attendance sheet, Hospital practicum records, Supervising nurse statement",
                date("2026-06-20"), CaseStatus.DECIDED, RegistrationStatus.ACTIVE);
        c6.recordDecision(DecisionType.PROBATION, date("2026-06-25"), null, null);
        c6.addNote(new Note("Dr. Emmanuel Kayitesi", "Given this is a first offense and student expressed remorse, committee decided on formal probation. Student must re-complete clinical hours under direct supervision.", ts("2026-06-24 10:00")));
        c6.addAuditEntry(new AuditEntry("Incident Reported", "Prof. Jean Claude Rugamba", ts("2026-06-20 08:30")));
        c6.addAuditEntry(new AuditEntry("Case CF-2026-005 Created", "System", ts("2026-06-20 08:31")));
        c6.addAuditEntry(new AuditEntry("Status set to: Under Review", "Dr. Emmanuel Kayitesi", ts("2026-06-21 09:00")));
        c6.addAuditEntry(new AuditEntry("Decision Recorded: Probation", "Dr. Emmanuel Kayitesi", ts("2026-06-25 14:00")));
        c6.addAuditEntry(new AuditEntry("Student Notified via Email", "System", ts("2026-06-25 14:01")));
        caseRepository.save(c6);
    }

    private static Instant ts(String value) {
        return LocalDateTime.parse(value, TIMESTAMP_FORMAT).toInstant(ZoneOffset.UTC);
    }

    private static LocalDate date(String value) {
        return LocalDate.parse(value);
    }
}

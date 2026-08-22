package rw.ac.auca.caseflow.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import rw.ac.auca.caseflow.domain.AppUser;
import rw.ac.auca.caseflow.domain.CaseStatus;
import rw.ac.auca.caseflow.domain.DisciplinaryCase;
import rw.ac.auca.caseflow.domain.RegistrationStatus;
import rw.ac.auca.caseflow.domain.Role;
import rw.ac.auca.caseflow.repository.CaseRepository;

/** Status transitions, evidence validation, case-id allocation, stats and the merged audit feed. */
class CaseWorkflowTest extends AbstractApiTest {

    @Autowired
    private CaseRepository caseRepository;

    private DisciplinaryCase createCase(String id, String studentId, CaseStatus status) {
        return caseRepository.save(new DisciplinaryCase(
                id, "Some Student", studentId, "Dr. Reporter", "CS",
                "Plagiarism", "description", "evidence",
                LocalDate.now(), status, RegistrationStatus.ACTIVE));
    }

    private String authHeader(AppUser user) {
        return "Bearer " + tokenFor(user);
    }

    private String changeStatus(String id, String to) throws Exception {
        return objectMapper.writeValueAsString(Map.of("status", to, "by", "Committee"));
    }

    // ---- status transitions ----

    @Test
    void changeStatus_alongALegalTransition_succeeds() throws Exception {
        createCase("CF-WF-001", "50001", CaseStatus.REPORTED);
        AppUser committee = createUser("Committee WF", "commwf@auca.ac.rw", Role.COMMITTEE, null);

        mockMvc.perform(post("/api/cases/CF-WF-001/status").header("Authorization", authHeader(committee))
                        .contentType(MediaType.APPLICATION_JSON).content(changeStatus("CF-WF-001", "Under Review")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("Under Review"));
    }

    /** The endpoint used to apply any status at all, so Reported -> Decided was silently accepted. */
    @Test
    void changeStatus_skippingTheLifecycle_isRejected() throws Exception {
        createCase("CF-WF-002", "50002", CaseStatus.REPORTED);
        AppUser committee = createUser("Committee WF2", "commwf2@auca.ac.rw", Role.COMMITTEE, null);

        mockMvc.perform(post("/api/cases/CF-WF-002/status").header("Authorization", authHeader(committee))
                        .contentType(MediaType.APPLICATION_JSON).content(changeStatus("CF-WF-002", "Decided")))
                .andExpect(status().isConflict())
                .andExpect(status().reason(containsString("cannot go from Reported to Decided")));

        assertThat(caseRepository.findById("CF-WF-002").orElseThrow().getStatus()).isEqualTo(CaseStatus.REPORTED);
    }

    @Test
    void changeStatus_onACaseUnderAppeal_isRejected() throws Exception {
        createCase("CF-WF-003", "50003", CaseStatus.UNDER_APPEAL);
        AppUser committee = createUser("Committee WF3", "commwf3@auca.ac.rw", Role.COMMITTEE, null);

        mockMvc.perform(post("/api/cases/CF-WF-003/status").header("Authorization", authHeader(committee))
                        .contentType(MediaType.APPLICATION_JSON).content(changeStatus("CF-WF-003", "Resolved")))
                .andExpect(status().isConflict());
    }

    /** The raw enum constant name must parse too — previously only the display string did. */
    @Test
    void changeStatus_acceptsTheEnumConstantName() throws Exception {
        createCase("CF-WF-004", "50004", CaseStatus.REPORTED);
        AppUser committee = createUser("Committee WF4", "commwf4@auca.ac.rw", Role.COMMITTEE, null);

        mockMvc.perform(post("/api/cases/CF-WF-004/status").header("Authorization", authHeader(committee))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("status", "UNDER_REVIEW"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("Under Review"));
    }

    @Test
    void changeStatus_withAnUnknownValue_returnsAReadableBadRequest() throws Exception {
        createCase("CF-WF-005", "50005", CaseStatus.REPORTED);
        AppUser committee = createUser("Committee WF5", "commwf5@auca.ac.rw", Role.COMMITTEE, null);

        mockMvc.perform(post("/api/cases/CF-WF-005/status").header("Authorization", authHeader(committee))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("status", "Bogus"))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(containsString("Under Review")));
    }

    @Test
    void allowedStatuses_reflectsTheCurrentState() throws Exception {
        createCase("CF-WF-006", "50006", CaseStatus.REPORTED);
        AppUser committee = createUser("Committee WF6", "commwf6@auca.ac.rw", Role.COMMITTEE, null);

        mockMvc.perform(get("/api/cases/CF-WF-006/allowed-statuses").header("Authorization", authHeader(committee)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2));
    }

    @Test
    void changeStatus_asStudent_isForbidden() throws Exception {
        createCase("CF-WF-007", "50007", CaseStatus.REPORTED);
        AppUser student = createUser("Student WF", "studwf@student.auca.ac.rw", Role.STUDENT, "50007");

        mockMvc.perform(post("/api/cases/CF-WF-007/status").header("Authorization", authHeader(student))
                        .contentType(MediaType.APPLICATION_JSON).content(changeStatus("CF-WF-007", "Under Review")))
                .andExpect(status().isForbidden());
    }

    // ---- appeals still work against a resolved case ----

    /**
     * Warning/Probation/Cleared now resolve immediately, so the appeal right would be lost if a resolved
     * case couldn't be appealed. It reopens the case instead.
     */
    @Test
    void appeal_againstAResolvedCase_reopensIt() throws Exception {
        createCase("CF-WF-008", "50008", CaseStatus.RESOLVED);
        AppUser student = createUser("Student Appeal", "studappeal@student.auca.ac.rw", Role.STUDENT, "50008");

        mockMvc.perform(post("/api/cases/CF-WF-008/appeal").header("Authorization", authHeader(student))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("appealText", "I dispute this."))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("Under Appeal"));
    }

    // ---- students see the case but not the committee's notes ----

    @Test
    void student_seesCaseDetailButNotCommitteeNotes() throws Exception {
        createCase("CF-WF-009", "50009", CaseStatus.REPORTED);
        AppUser committee = createUser("Committee Notes", "commnotes@auca.ac.rw", Role.COMMITTEE, null);
        AppUser student = createUser("Student Notes", "studnotes@student.auca.ac.rw", Role.STUDENT, "50009");

        mockMvc.perform(post("/api/cases/CF-WF-009/notes").header("Authorization", authHeader(committee))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "author", "Committee Notes", "text", "Internal deliberation"))))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/cases/CF-WF-009").header("Authorization", authHeader(committee)))
                .andExpect(jsonPath("$.notes.length()").value(1));

        mockMvc.perform(get("/api/cases/CF-WF-009").header("Authorization", authHeader(student)))
                .andExpect(status().isOk())
                // Everything else about their own case stays visible.
                .andExpect(jsonPath("$.description").value("description"))
                .andExpect(jsonPath("$.auditTrail.length()").value(org.hamcrest.Matchers.greaterThan(0)))
                .andExpect(jsonPath("$.notes.length()").value(0));
    }

    // ---- evidence validation ----

    @Test
    void uploadEvidence_rejectsANonImageContentType() throws Exception {
        createCase("CF-WF-010", "50010", CaseStatus.REPORTED);
        AppUser lecturer = createUser("Lecturer Ev", "lectev@auca.ac.rw", Role.LECTURER, null);

        MockMultipartFile file = new MockMultipartFile(
                "files", "notes.txt", "text/plain", "hello".getBytes());

        mockMvc.perform(multipart("/api/cases/CF-WF-010/evidence").file(file)
                        .header("Authorization", authHeader(lecturer)))
                .andExpect(status().isBadRequest());
    }

    /** The declared content type is just a header — the bytes have to back it up. */
    @Test
    void uploadEvidence_rejectsAFileWhoseBytesDontMatchItsDeclaredType() throws Exception {
        createCase("CF-WF-011", "50011", CaseStatus.REPORTED);
        AppUser lecturer = createUser("Lecturer Ev2", "lectev2@auca.ac.rw", Role.LECTURER, null);

        MockMultipartFile disguised = new MockMultipartFile(
                "files", "evil.png", "image/png", "#!/bin/sh\nrm -rf /".getBytes());

        mockMvc.perform(multipart("/api/cases/CF-WF-011/evidence").file(disguised)
                        .header("Authorization", authHeader(lecturer)))
                .andExpect(status().isBadRequest())
                .andExpect(status().reason(containsString("don't match")));
    }

    @Test
    void uploadEvidence_acceptsARealPngAndARealPdf() throws Exception {
        createCase("CF-WF-012", "50012", CaseStatus.REPORTED);
        AppUser lecturer = createUser("Lecturer Ev3", "lectev3@auca.ac.rw", Role.LECTURER, null);

        byte[] png = new byte[]{(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0};
        byte[] pdf = "%PDF-1.7\n%%EOF\n".getBytes();

        mockMvc.perform(multipart("/api/cases/CF-WF-012/evidence")
                        .file(new MockMultipartFile("files", "photo.png", "image/png", png))
                        .file(new MockMultipartFile("files", "scan.pdf", "application/pdf", pdf))
                        .header("Authorization", authHeader(lecturer)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.evidenceFiles.length()").value(2))
                // Exposed as a resolvable path, not a bare filename.
                .andExpect(jsonPath("$.evidenceFiles[0]").value(containsString("/cases/CF-WF-012/evidence/")));
    }

    // ---- case id allocation ----

    @Test
    void caseIds_areSequentialAndSurviveDeletion() throws Exception {
        AppUser lecturer = createUser("Lecturer Id", "lectid@auca.ac.rw", Role.LECTURER, null);

        String first = reportCaseAndReturnId(lecturer, "60101");
        String second = reportCaseAndReturnId(lecturer, "60102");
        assertThat(first).isNotEqualTo(second);

        // The old count()+1 scheme reused an id as soon as any case was deleted.
        caseRepository.deleteById(second);
        String third = reportCaseAndReturnId(lecturer, "60103");
        assertThat(third).isNotEqualTo(first).isNotEqualTo(second);
    }

    /**
     * Regression for the migration path: introducing the counter to a database that already held cases
     * would otherwise start it at zero and reissue an id that exists — and since the id is the primary
     * key, save() would merge over the existing case rather than failing.
     */
    @Test
    void caseIds_doNotCollideWithCasesThatPredateTheCounter() throws Exception {
        int year = java.time.Year.now().getValue();
        createCase("CF-%d-001".formatted(year), "60201", CaseStatus.REPORTED);
        createCase("CF-%d-002".formatted(year), "60202", CaseStatus.REPORTED);
        AppUser lecturer = createUser("Lecturer Migrate", "lectmigrate@auca.ac.rw", Role.LECTURER, null);

        String issued = reportCaseAndReturnId(lecturer, "60203");

        assertThat(issued).isEqualTo("CF-%d-003".formatted(year));
        assertThat(caseRepository.count()).isEqualTo(3);
    }

    private String reportCaseAndReturnId(AppUser reporter, String studentId) throws Exception {
        String body = mockMvc.perform(post("/api/cases").header("Authorization", authHeader(reporter))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "studentName", "S", "studentId", studentId,
                                "reportedBy", reporter.getName(), "reporterDepartment", "CS",
                                "offenseType", "Plagiarism", "description", "d", "evidence", "e"))))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(body).get("id").asText();
    }

    // ---- stats ----

    @Test
    void caseStats_countGloballyRegardlessOfPaging() throws Exception {
        createCase("CF-WF-013", "50013", CaseStatus.REPORTED);
        createCase("CF-WF-014", "50014", CaseStatus.UNDER_REVIEW);
        createCase("CF-WF-015", "50015", CaseStatus.RESOLVED);
        AppUser admin = createUser("Admin Stats2", "adminstats2@auca.ac.rw", Role.ADMIN, null);

        mockMvc.perform(get("/api/cases/stats").header("Authorization", authHeader(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(3))
                .andExpect(jsonPath("$.reported").value(1))
                .andExpect(jsonPath("$.underReview").value(1))
                .andExpect(jsonPath("$.resolved").value(1))
                .andExpect(jsonPath("$.open").value(2));
    }

    @Test
    void caseStats_areNotVisibleToStudents() throws Exception {
        AppUser student = createUser("Student Stats", "studstats@student.auca.ac.rw", Role.STUDENT, "50016");

        mockMvc.perform(get("/api/cases/stats").header("Authorization", authHeader(student)))
                .andExpect(status().isForbidden());
    }

    @Test
    void listCases_paginatesAndFiltersByStatus() throws Exception {
        createCase("CF-WF-016", "50017", CaseStatus.REPORTED);
        createCase("CF-WF-017", "50018", CaseStatus.UNDER_REVIEW);
        createCase("CF-WF-018", "50019", CaseStatus.RESOLVED);
        AppUser admin = createUser("Admin List", "adminlist@auca.ac.rw", Role.ADMIN, null);

        mockMvc.perform(get("/api/cases").header("Authorization", authHeader(admin))
                        .param("status", "Reported").param("status", "Under Review"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(2));

        mockMvc.perform(get("/api/cases").header("Authorization", authHeader(admin)).param("size", "2"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(2))
                .andExpect(jsonPath("$.totalElements").value(3))
                .andExpect(jsonPath("$.last").value(false));
    }

    // ---- merged audit feed ----

    /**
     * The one native query in the codebase, so this is the only place the H2/Postgres split could
     * diverge. Asserts both kinds appear in one chronological feed.
     */
    @Test
    void auditFeed_mergesCaseAndUserEntries() throws Exception {
        AppUser admin = createUser("Admin Audit", "adminaudit@auca.ac.rw", Role.ADMIN, null);
        AppUser target = createUser("Audit Target", "audittarget@auca.ac.rw", Role.LECTURER, null);

        // A case action...
        reportCaseAndReturnId(admin, "50020");
        // ...and a user-management action.
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .patch("/api/users/" + target.getId() + "/role")
                        .header("Authorization", authHeader(admin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("role", "committee"))))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/audit").header("Authorization", authHeader(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[?(@.kind == 'USER')].action").isNotEmpty())
                .andExpect(jsonPath("$.content[?(@.kind == 'CASE')].action").isNotEmpty());

        mockMvc.perform(get("/api/audit").header("Authorization", authHeader(admin)).param("kind", "USER"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].targetUserName").value("Audit Target"));
    }

    @Test
    void auditFeed_isAdminOnly() throws Exception {
        AppUser committee = createUser("Committee Audit", "commaudit@auca.ac.rw", Role.COMMITTEE, null);

        mockMvc.perform(get("/api/audit").header("Authorization", authHeader(committee)))
                .andExpect(status().isForbidden());
    }
}

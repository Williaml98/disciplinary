package rw.ac.auca.caseflow.web;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import rw.ac.auca.caseflow.domain.AppUser;
import rw.ac.auca.caseflow.domain.CaseStatus;
import rw.ac.auca.caseflow.domain.DisciplinaryCase;
import rw.ac.auca.caseflow.domain.RegistrationStatus;
import rw.ac.auca.caseflow.domain.Role;
import rw.ac.auca.caseflow.repository.CaseRepository;

class CaseControllerAuthorizationTest extends AbstractApiTest {

    @Autowired
    private CaseRepository caseRepository;

    private DisciplinaryCase createCase(String id, String studentId) {
        DisciplinaryCase disciplinaryCase = new DisciplinaryCase(
                id, "Some Student", studentId, "Some Reporter", "Computer Science",
                "Late Submission", "description", "evidence",
                LocalDate.now(), CaseStatus.REPORTED, RegistrationStatus.FLAGGED);
        return caseRepository.save(disciplinaryCase);
    }

    private String authHeader(AppUser user) {
        return "Bearer " + tokenFor(user);
    }

    // ---- authentication ----

    @Test
    void listCases_withoutToken_returnsUnauthorized() throws Exception {
        mockMvc.perform(get("/api/cases")).andExpect(status().isUnauthorized());
    }

    // ---- student scoping ----

    @Test
    void listCases_asStudent_onlyReturnsOwnCases() throws Exception {
        createCase("CF-TEST-001", "20001");
        createCase("CF-TEST-002", "20002");
        AppUser student = createUser("Student One", "student1@student.auca.ac.rw", Role.STUDENT, "20001");

        mockMvc.perform(get("/api/cases").header("Authorization", authHeader(student)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].id").value("CF-TEST-001"));
    }

    @Test
    void listCases_asLecturer_returnsAllCases() throws Exception {
        createCase("CF-TEST-003", "20003");
        createCase("CF-TEST-004", "20004");
        AppUser lecturer = createUser("Lecturer One", "lect1@auca.ac.rw", Role.LECTURER, null);

        mockMvc.perform(get("/api/cases").header("Authorization", authHeader(lecturer)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)));
    }

    @Test
    void getCase_asStudent_forSomeoneElsesCase_isForbidden() throws Exception {
        createCase("CF-TEST-005", "20005");
        AppUser student = createUser("Student Two", "student2@student.auca.ac.rw", Role.STUDENT, "99999");

        mockMvc.perform(get("/api/cases/CF-TEST-005").header("Authorization", authHeader(student)))
                .andExpect(status().isForbidden());
    }

    @Test
    void getCase_asStudent_forOwnCase_succeeds() throws Exception {
        createCase("CF-TEST-006", "20006");
        AppUser student = createUser("Student Three", "student3@student.auca.ac.rw", Role.STUDENT, "20006");

        mockMvc.perform(get("/api/cases/CF-TEST-006").header("Authorization", authHeader(student)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("CF-TEST-006"));
    }

    // ---- report an incident ----

    @Test
    void reportCase_asLecturer_succeeds() throws Exception {
        AppUser lecturer = createUser("Lecturer Two", "lect2@auca.ac.rw", Role.LECTURER, null);

        mockMvc.perform(post("/api/cases").header("Authorization", authHeader(lecturer))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "studentName", "Some Student", "studentId", "30001",
                                "reportedBy", "Lecturer Two", "reporterDepartment", "CS",
                                "offenseType", "Plagiarism", "description", "desc", "evidence", ""))))
                .andExpect(status().isCreated());
    }

    @Test
    void reportCase_asStudent_isForbidden() throws Exception {
        AppUser student = createUser("Student Four", "student4@student.auca.ac.rw", Role.STUDENT, "30002");

        mockMvc.perform(post("/api/cases").header("Authorization", authHeader(student))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "studentName", "Some Student", "studentId", "30002",
                                "reportedBy", "Student Four", "reporterDepartment", "CS",
                                "offenseType", "Plagiarism", "description", "desc", "evidence", ""))))
                .andExpect(status().isForbidden());
    }

    @Test
    void reportCase_asCommittee_isForbidden() throws Exception {
        AppUser committee = createUser("Committee One", "comm1@auca.ac.rw", Role.COMMITTEE, null);

        mockMvc.perform(post("/api/cases").header("Authorization", authHeader(committee))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "studentName", "Some Student", "studentId", "30003",
                                "reportedBy", "Committee One", "reporterDepartment", "CS",
                                "offenseType", "Plagiarism", "description", "desc", "evidence", ""))))
                .andExpect(status().isForbidden());
    }

    // ---- deliberation notes (committee only) ----

    @Test
    void addNote_asCommittee_succeedsAndTransitionsReportedToUnderReview() throws Exception {
        createCase("CF-TEST-007", "20007");
        AppUser committee = createUser("Committee Two", "comm2@auca.ac.rw", Role.COMMITTEE, null);

        mockMvc.perform(post("/api/cases/CF-TEST-007/notes").header("Authorization", authHeader(committee))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("author", "Committee Two", "text", "Reviewing."))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("Under Review"));
    }

    @Test
    void addNote_asStudent_isForbidden() throws Exception {
        createCase("CF-TEST-008", "20008");
        AppUser student = createUser("Student Five", "student5@student.auca.ac.rw", Role.STUDENT, "20008");

        mockMvc.perform(post("/api/cases/CF-TEST-008/notes").header("Authorization", authHeader(student))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("author", "Student Five", "text", "Hi"))))
                .andExpect(status().isForbidden());
    }

    // ---- decisions (committee only) ----

    @Test
    void recordDecision_asCommittee_succeeds() throws Exception {
        createCase("CF-TEST-009", "20009");
        AppUser committee = createUser("Committee Three", "comm3@auca.ac.rw", Role.COMMITTEE, null);

        mockMvc.perform(post("/api/cases/CF-TEST-009/decision").header("Authorization", authHeader(committee))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("decision", "Warning", "by", "Committee Three"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.decision").value("Warning"))
                .andExpect(jsonPath("$.status").value("Decided"));
    }

    @Test
    void recordDecision_asLecturer_isForbidden() throws Exception {
        createCase("CF-TEST-010", "20010");
        AppUser lecturer = createUser("Lecturer Three", "lect3@auca.ac.rw", Role.LECTURER, null);

        mockMvc.perform(post("/api/cases/CF-TEST-010/decision").header("Authorization", authHeader(lecturer))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("decision", "Warning", "by", "Lecturer Three"))))
                .andExpect(status().isForbidden());
    }

    // ---- appeals ----

    @Test
    void submitAppeal_asOwningStudent_succeeds() throws Exception {
        createCase("CF-TEST-011", "20011");
        AppUser student = createUser("Student Six", "student6@student.auca.ac.rw", Role.STUDENT, "20011");

        mockMvc.perform(post("/api/cases/CF-TEST-011/appeal").header("Authorization", authHeader(student))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("appealText", "I disagree."))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("Under Appeal"));
    }

    @Test
    void submitAppeal_asDifferentStudent_isForbidden() throws Exception {
        createCase("CF-TEST-012", "20012");
        AppUser student = createUser("Student Seven", "student7@student.auca.ac.rw", Role.STUDENT, "99998");

        mockMvc.perform(post("/api/cases/CF-TEST-012/appeal").header("Authorization", authHeader(student))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("appealText", "Not mine."))))
                .andExpect(status().isForbidden());
    }

    @Test
    void submitAppeal_asLecturer_isForbidden() throws Exception {
        createCase("CF-TEST-013", "20013");
        AppUser lecturer = createUser("Lecturer Four", "lect4@auca.ac.rw", Role.LECTURER, null);

        mockMvc.perform(post("/api/cases/CF-TEST-013/appeal").header("Authorization", authHeader(lecturer))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("appealText", "Not a student."))))
                .andExpect(status().isForbidden());
    }

    @Test
    void resolveAppeal_asCommittee_succeeds() throws Exception {
        createCase("CF-TEST-014", "20014");
        AppUser committee = createUser("Committee Four", "comm4@auca.ac.rw", Role.COMMITTEE, null);

        mockMvc.perform(post("/api/cases/CF-TEST-014/appeal/resolution").header("Authorization", authHeader(committee))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("resolution", "Overturned", "by", "Committee Four"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("Resolved"));
    }

    // ---- reintegration ----

    @Test
    void approveReintegration_asCommittee_succeeds() throws Exception {
        createCase("CF-TEST-015", "20015");
        AppUser committee = createUser("Committee Five", "comm5@auca.ac.rw", Role.COMMITTEE, null);

        mockMvc.perform(post("/api/cases/CF-TEST-015/reintegration").header("Authorization", authHeader(committee))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("by", "Committee Five"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("Resolved"))
                .andExpect(jsonPath("$.registrationStatus").value("Active"));
    }

    @Test
    void approveReintegration_asStudent_isForbidden() throws Exception {
        createCase("CF-TEST-016", "20016");
        AppUser student = createUser("Student Eight", "student8@student.auca.ac.rw", Role.STUDENT, "20016");

        mockMvc.perform(post("/api/cases/CF-TEST-016/reintegration").header("Authorization", authHeader(student))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("by", "Student Eight"))))
                .andExpect(status().isForbidden());
    }

    // ---- evidence download stays open even without a token ----

    @Test
    void getEvidenceFile_withoutToken_isNotBlockedByAuth() throws Exception {
        createCase("CF-TEST-017", "20017");

        // No matching file exists, but the point is that Spring Security lets the request
        // through to the controller (404 from EvidenceStorage) instead of 401.
        mockMvc.perform(get("/api/cases/CF-TEST-017/evidence/does-not-exist.png"))
                .andExpect(result -> {
                    int status = result.getResponse().getStatus();
                    if (status == 401) {
                        throw new AssertionError("Evidence download should not require authentication, got 401");
                    }
                });
    }
}

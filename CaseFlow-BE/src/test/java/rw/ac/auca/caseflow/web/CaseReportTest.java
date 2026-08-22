package rw.ac.auca.caseflow.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.MvcResult;
import rw.ac.auca.caseflow.domain.AppUser;
import rw.ac.auca.caseflow.domain.CaseStatus;
import rw.ac.auca.caseflow.domain.DisciplinaryCase;
import rw.ac.auca.caseflow.domain.RegistrationStatus;
import rw.ac.auca.caseflow.domain.Role;
import rw.ac.auca.caseflow.repository.CaseRepository;

class CaseReportTest extends AbstractApiTest {

    @Autowired
    private CaseRepository caseRepository;

    private DisciplinaryCase createCase(String id, String studentId, String offenseType,
                                         LocalDate reportDate, String reportedBy, String department) {
        DisciplinaryCase disciplinaryCase = new DisciplinaryCase(
                id, "Some Student", studentId, reportedBy, department,
                offenseType, "description", "evidence",
                reportDate, CaseStatus.REPORTED, RegistrationStatus.FLAGGED);
        return caseRepository.save(disciplinaryCase);
    }

    private String authHeader(AppUser user) {
        return "Bearer " + tokenFor(user);
    }

    @Test
    void report_withoutToken_returnsUnauthorized() throws Exception {
        mockMvc.perform(get("/api/cases/report")).andExpect(status().isUnauthorized());
    }

    @Test
    void report_asStudent_isForbidden() throws Exception {
        AppUser student = createUser("Student Reporter", "reportstudent@student.auca.ac.rw", Role.STUDENT, "60001");

        mockMvc.perform(get("/api/cases/report").header("Authorization", authHeader(student)))
                .andExpect(status().isForbidden());
    }

    @Test
    void report_asLecturer_returnsPdfByDefault() throws Exception {
        createCase("CF-RPT-001", "60002", "Plagiarism", LocalDate.of(2026, 1, 15), "Dr. A", "CS");
        AppUser lecturer = createUser("Report Lecturer", "reportlect@auca.ac.rw", Role.LECTURER, null);

        MvcResult result = mockMvc.perform(get("/api/cases/report").header("Authorization", authHeader(lecturer)))
                .andExpect(status().isOk())
                .andReturn();

        assertThat(result.getResponse().getContentType()).isEqualTo("application/pdf");
        byte[] body = result.getResponse().getContentAsByteArray();
        assertThat(body).isNotEmpty();
        // PDF files always start with the "%PDF-" magic bytes.
        assertThat(new String(body, 0, 5)).isEqualTo("%PDF-");
    }

    @Test
    void report_asCsv_containsOnlyMatchingRowsForOffenseFilter() throws Exception {
        createCase("CF-RPT-002", "60003", "Plagiarism", LocalDate.of(2026, 2, 1), "Dr. B", "CS");
        createCase("CF-RPT-003", "60004", "Late Submission", LocalDate.of(2026, 2, 1), "Dr. B", "CS");
        AppUser committee = createUser("Report Committee", "reportcomm@auca.ac.rw", Role.COMMITTEE, null);

        MvcResult result = mockMvc.perform(get("/api/cases/report")
                        .param("format", "csv")
                        .param("offenseType", "Plagiarism")
                        .header("Authorization", authHeader(committee)))
                .andExpect(status().isOk())
                .andReturn();

        assertThat(result.getResponse().getContentType()).startsWith("text/csv");
        String csv = result.getResponse().getContentAsString();
        assertThat(csv).contains("CF-RPT-002");
        assertThat(csv).doesNotContain("CF-RPT-003");
    }

    @Test
    void report_filtersByDateRange() throws Exception {
        createCase("CF-RPT-004", "60005", "Theft", LocalDate.of(2025, 6, 1), "Dr. C", "CS");
        createCase("CF-RPT-005", "60006", "Theft", LocalDate.of(2026, 6, 1), "Dr. C", "CS");
        AppUser admin = createUser("Report Admin", "reportadmin@auca.ac.rw", Role.ADMIN, null);

        MvcResult result = mockMvc.perform(get("/api/cases/report")
                        .param("format", "csv")
                        .param("reportDateFrom", "2026-01-01")
                        .param("reportDateTo", "2026-12-31")
                        .header("Authorization", authHeader(admin)))
                .andExpect(status().isOk())
                .andReturn();

        String csv = result.getResponse().getContentAsString();
        assertThat(csv).contains("CF-RPT-005");
        assertThat(csv).doesNotContain("CF-RPT-004");
    }

    @Test
    void report_withInvalidFormat_returnsBadRequest() throws Exception {
        AppUser admin = createUser("Report Admin Two", "reportadmin2@auca.ac.rw", Role.ADMIN, null);

        mockMvc.perform(get("/api/cases/report").param("format", "xml")
                        .header("Authorization", authHeader(admin)))
                .andExpect(status().isBadRequest());
    }

    /**
     * Regression: enum query parameters used to bind via Enum.valueOf(), which ignores the wire values
     * these enums expose to Jackson — so the Reports page's status filter was a silent 400.
     */
    @Test
    void report_filtersByStatusUsingWireValue() throws Exception {
        createCase("CF-RPT-006", "60007", "Theft", LocalDate.of(2026, 3, 1), "Dr. D", "CS");
        DisciplinaryCase reviewed = createCase("CF-RPT-007", "60008", "Theft", LocalDate.of(2026, 3, 1), "Dr. D", "CS");
        reviewed.setStatus(CaseStatus.UNDER_REVIEW);
        caseRepository.save(reviewed);
        AppUser admin = createUser("Report Admin Three", "reportadmin3@auca.ac.rw", Role.ADMIN, null);

        MvcResult result = mockMvc.perform(get("/api/cases/report")
                        .param("format", "csv")
                        .param("status", "Under Review")
                        .header("Authorization", authHeader(admin)))
                .andExpect(status().isOk())
                .andReturn();

        String csv = result.getResponse().getContentAsString();
        assertThat(csv).contains("CF-RPT-007");
        assertThat(csv).doesNotContain("CF-RPT-006");
    }

    /** The raw enum constant name is accepted too, so a caller sending UNDER_REVIEW isn't rejected. */
    @Test
    void report_filtersByStatusUsingEnumConstantName() throws Exception {
        AppUser admin = createUser("Report Admin Four", "reportadmin4@auca.ac.rw", Role.ADMIN, null);

        mockMvc.perform(get("/api/cases/report")
                        .param("format", "csv")
                        .param("status", "UNDER_REVIEW")
                        .header("Authorization", authHeader(admin)))
                .andExpect(status().isOk());
    }

    @Test
    void report_withUnknownStatus_returnsBadRequestNamingTheValidValues() throws Exception {
        AppUser admin = createUser("Report Admin Five", "reportadmin5@auca.ac.rw", Role.ADMIN, null);

        mockMvc.perform(get("/api/cases/report")
                        .param("format", "csv")
                        .param("status", "Nonsense")
                        .header("Authorization", authHeader(admin)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(containsString("Under Review")));
    }
}
